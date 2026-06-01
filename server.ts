import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google GenAI client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Helper helper to generate coach response with retry and model fallback
  async function generateCoachResponse(ai: GoogleGenAI, contents: any, systemInstruction: string) {
    const models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[Coach API] Requesting ${model} (attempt ${attempt}/3)`);
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
            }
          });
          if (response && response.text) {
            console.log(`[Coach API] Successful response using ${model}`);
            return response.text;
          }
        } catch (err: any) {
          lastError = err;
          console.error(`[Coach API] Error on model ${model}, attempt ${attempt}:`, err.message || err);
          
          // If the error is not a rate limit or service unavailable, or if it is our last attempt, break to try next model
          const errStr = String(err.message || err);
          const statusVal = err.status || err.statusCode || err.code;
          const statusStr = String(statusVal || "");
          const isTransient = !statusVal || 
                              statusVal === 503 || 
                              statusVal === 429 || 
                              statusVal === 500 || 
                              statusStr.includes("503") || 
                              statusStr.includes("UNAVAILABLE") || 
                              statusStr.includes("429") ||
                              errStr.includes("503") || 
                              errStr.includes("UNAVAILABLE") || 
                              errStr.includes("demand");
          
          if (!isTransient || attempt === 3) {
            break;
          }
          
          // Exponential backoff delay
          await new Promise((resolve) => setTimeout(resolve, attempt * 400));
        }
      }
    }

    throw lastError || new Error("Failed to generate response after trying fallbacks.");
  }

  // API router for Coach
  app.post("/api/coach", async (req, res) => {
    try {
      const { messages, systemPrompt } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages structure" });
      }

      // Map roles to user/model compatible with Gemini
      const contents = messages.map((m: any) => {
        const rawRole = (m.role || '').toLowerCase();
        // user stays user, ai/model/assistant maps to model
        const role = rawRole === 'user' ? 'user' : 'model';
        const text = m.content || m.text || m.message || "";
        return {
          role,
          parts: [{ text }]
        };
      });

      const sysInstruction = systemPrompt || "You are a professional fitness coach.";
      const replyText = await generateCoachResponse(ai, contents, sysInstruction);

      res.json({ reply: replyText });
    } catch (err: any) {
      console.error("Final Coach API Error:", err);
      // Simplify error message or propagate gracefully
      res.status(503).json({ 
        error: "The coach service is experiencing temporary high demand. Please try sending your message again in a few moments." 
      });
    }
  });

  // Hot Module Replacement/development or production mode serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
