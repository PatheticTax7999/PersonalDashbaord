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

  // Google GenAI client (lazily initialized to prevent server startup crash if API key is not yet set)
  let aiInstance: GoogleGenAI | null = null;
  function getGoogleGenAI(): GoogleGenAI {
    if (!aiInstance) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in the Secrets panel or .env file.");
      }
      aiInstance = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiInstance;
  }

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
      const ai = getGoogleGenAI();
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

  // API router for Supplement Generation
  app.post("/api/generate-supplements", async (req, res) => {
    try {
      const { goal } = req.body;
      if (!goal || typeof goal !== "string") {
        return res.status(400).json({ error: "Goal is required and must be a string." });
      }

      console.log(`[Supps API] Generating recommendations for goal: "${goal}"`);
      const prompt = `Formulate a supplement recommendation plan for a client with the following goal: "${goal}".
Recommend 3 highly effective, evidence-based supplements that fit this goal.
For each supplement, specify:
1. "name": The short clean name of the supplement (e.g. "Ashwagandha", "Magnesium Glycinate", "Vitamin D3", "L-Theanine").
2. "dosage": An appropriate standard daily dosage text (e.g. "300 mg", "5000 IU", "200 mg").
3. "times": An array containing one or more time slots when this is most effective. Choose ONLY from: ["morning", "afternoon", "evening", "night"]. Keep in mind:
   - Energy raising/stimulants/focus things (like Caffeine, L-Theanine, Vitamin D3) are morning or afternoon.
   - Sleep promotion/muscle relaxation things (like Magnesium, Zinc, Chamomile) are evening or night.
4. "reason": A single, elegant sentence explaining why this time of day or dosage is optimal.

Return ONLY a valid raw JSON array of objects without markdown formatting or code blocks. Do not wrap in \`\`\`json. Each object must strictly follow this structure:
[
  {
    "name": "Magnesium Glycinate",
    "dosage": "300 mg",
    "times": ["night"],
    "reason": "Promotes nervous system recovery and optimal muscle relaxation before sleep."
  }
]`;

      const ai = getGoogleGenAI();
      const reply = await generateCoachResponse(
        ai, 
        [{ role: "user", parts: [{ text: prompt }] }], 
        "You are an expert supplement and clinical sports nutritionist. You structure perfect evidence-based supplementation recommendations in raw JSON format."
      );

      let cleaned = (reply || "").trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      res.json({ supplements: parsed });
    } catch (err: any) {
      console.error("Supplement Generation API Error:", err);
      res.status(503).json({ 
        error: "Failed to generate supplement recommendations. Please try again." 
      });
    }
  });

  // API router for Personalized Hydration Plan (Water recommendation)
  app.post("/api/water-recommendation", async (req, res) => {
    try {
      const {
        height,
        weight,
        age,
        creatineEnabled,
        creatineAmount,
        stimulantsEnabled,
        stimulantsAmount,
        containerType,
        capacity,
        capacityUnit
      } = req.body;

      console.log(`[Water API] Generating recommendation: Weight=${weight}kg, Height=${height}cm, Creatine=${creatineEnabled}, Caffeine=${stimulantsEnabled}`);

      const prompt = `Calculate the optimal daily water intake requirement (in milliliters) and formulate a dynamic scientific explanation for an individual with the following parameters:
- Height: ${height || 175} cm
- Weight: ${weight || 75} kg
- Age: ${age || 25} years
- Takes Creatine Monohydrate: ${creatineEnabled ? 'Yes, ' + (creatineAmount || 5) + 'g daily' : 'No'}
- Takes Stimulants/Caffeine: ${stimulantsEnabled ? 'Yes, ' + (stimulantsAmount || 150) + 'mg daily' : 'No'}
- Container choice: ${capacity || 500} ${capacityUnit || 'ml'} ${containerType || 'bottle'}

Provide:
1. "recommendedGoalMl": An integer value representing the total recommended daily water goal in milliliters. Ensure it aligns with baseline requirements (35 ml per kg of bodyweight), adding 500-1000 ml if creatine is enabled to support cell volumization, and adding 250-500 ml if caffeine is enabled to counter its diuretic effect.
2. "aiExplanation": A highly polished, short, scientific, and encouraging explanation (2-3 sentences max) detailing WHY this specific water goal was recommended, explicitly noting how their metrics (weight/height) and their supplementation (creatine/caffeine if checked) interact to create this specific physiological demand. Use scientific clarity (e.g., cellular hydration, muscle tissue saturation, counterbalancing mild diuretic effects) in a humble, minimalist tone.

Return ONLY a valid raw JSON object. Do not wrap in markdown or code blocks. Strictly follow this structure:
{
  "recommendedGoalMl": 3300,
  "aiExplanation": "A customized explanation of the hydration need."
}`;

      const ai = getGoogleGenAI();
      const reply = await generateCoachResponse(
        ai,
        [{ role: "user", parts: [{ text: prompt }] }],
        "You are an expert sports performance physician and clinical hydration specialist. You structure custom evidence-based hydration calculations in raw JSON format."
      );

      let cleaned = (reply || "").trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      res.json(parsed);
    } catch (err: any) {
      console.error("Water Recommendation API Error:", err);
      // Construct a safe, clean baseline if AI service is busy/fails
      const weightVal = Number(req.body.weight) || 75;
      const creatineAmt = req.body.creatineEnabled ? Number(req.body.creatineAmount) || 5 : 0;
      const stimAmt = req.body.stimulantsEnabled ? Number(req.body.stimulantsAmount) || 150 : 0;
      
      // Calculate responsive mathematical approximation
      let calculatedGoalMl = Math.round(weightVal * 35);
      if (creatineAmt > 0) calculatedGoalMl += 750;
      if (stimAmt > 0) calculatedGoalMl += 350;
      if (calculatedGoalMl < 1500) calculatedGoalMl = 2000;

      const aiExplanation = `Based on your weight of ${weightVal}kg${req.body.creatineEnabled ? ' and active creatine usage' : ''}, a baseline hydration limit of ${calculatedGoalMl}ml is recommended. Creatine increases osmotic cellular draw for muscle repair, requiring extra fluids, while lifestyle factors call for regular continuous sips throughout the day.`;

      res.json({
        recommendedGoalMl: calculatedGoalMl,
        aiExplanation
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
