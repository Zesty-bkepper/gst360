
import { GoogleGenAI, Type } from "@google/genai";
import { ResearchTopic } from "../types";

// Always use process.env.API_KEY directly for initialization as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeTopic = async (topic: string): Promise<ResearchTopic> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following topic in depth and provide structured research data: "${topic}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          keyInsights: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          sentiment: { 
            type: Type.STRING,
            description: "Must be one of: positive, neutral, negative"
          },
          confidence: { type: Type.NUMBER }
        },
        required: ["title", "summary", "keyInsights", "sentiment", "confidence"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return {
    ...data,
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now()
  };
};

export const createChatSession = (systemInstruction: string) => {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction
    }
  });
};
