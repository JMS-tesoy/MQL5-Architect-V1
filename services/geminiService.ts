import { GoogleGenAI, Type } from "@google/genai";
import { CodeType, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are an elite MQL5 (MetaQuotes Language 5) developer with over 15 years of experience in algorithmic trading. 
Your task is to generate high-performance, strictly typed, and error-free MQL5 code based on user requests.

Guidelines:
1. **Syntax**: Use modern MQL5 syntax. Ensure all variables are typed correctly.
2. **Structure**: 
   - Include strict property definitions (#property strict, #property copyright, etc.).
   - Use standard event handlers: OnInit(), OnDeinit(), OnTick() (for EAs) or OnCalculate() (for Indicators).
3. **Safety**: Implement basic error checking for trade operations (CheckReturnKey).
4. **Comments**: Add concise but helpful comments explaining the logic.
5. **Output Format**: You must return a JSON object containing the 'code' (the raw MQL5 source code) and a short 'explanation' of what the code does.
6. **Inputs**: Define input variables (input int, input double) for parameters that the user might want to optimize (e.g., LotSize, MovingAveragePeriod).

Focus on creating production-ready code.
`;

const CHAT_SYSTEM_INSTRUCTION = `
You are an intelligent MQL5 coding assistant. You have access to the user's current MQL5 code.
The user may ask you to explain the code, fix errors, or modify the logic.

Rules:
1. **Analyze**: Look at the "Current Code" provided in the context.
2. **Modify**: If the user asks to change, fix, or update the code, you MUST provide the FULL updated MQL5 code in your response.
3. **Explain**: If the user just asks a question without requesting code changes, do not provide the "updatedCode" field.
4. **Format**: You must return a JSON object.

JSON Schema:
{
  "reply": "Your conversational response to the user.",
  "updatedCode": "The full, complete MQL5 code string (only if changes are needed, otherwise null or empty string)."
}
`;

// Helper to clean JSON markdown
const cleanJsonOutput = (text: string): string => {
  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleanText;
};

export const generateMql5 = async (
  prompt: string, 
  type: CodeType,
  documentationContext?: string
): Promise<{ code: string; explanation: string }> => {
  
  let fullPrompt = `
    Create an MQL5 ${type}.
    
    User Requirement:
    ${prompt}
  `;

  if (documentationContext) {
    fullPrompt += `
    
    REFERENCE DOCUMENTATION:
    The user has provided the following documentation/context to assist with this task. 
    Use the functions, syntax, and libraries defined in this documentation where applicable, especially if they differ from standard libraries.
    
    --- BEGIN DOCUMENTATION ---
    ${documentationContext.slice(0, 500000)} 
    --- END DOCUMENTATION ---
    (Note: Documentation may be truncated if it exceeds limits, prioritize recent API usage)
    `;
  }

  fullPrompt += `
    Ensure the code is complete and compilable in MetaEditor.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            code: {
              type: Type.STRING,
              description: "The complete, compilable MQL5 source code.",
            },
            explanation: {
              type: Type.STRING,
              description: "A brief summary of the strategy or logic implemented.",
            },
          },
          required: ["code", "explanation"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(cleanJsonOutput(response.text));
    }
    
    throw new Error("No response generated");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const chatWithCode = async (
  currentCode: string,
  chatHistory: ChatMessage[],
  userMessage: string,
  documentationContext?: string
): Promise<{ reply: string; updatedCode?: string }> => {

  // Construct history context string
  const conversationContext = chatHistory
    .slice(-10) // Keep last 10 messages for context window efficiency
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  let fullPrompt = `
    CURRENT MQL5 CODE CONTEXT:
    \`\`\`mql5
    ${currentCode}
    \`\`\`

    CONVERSATION HISTORY:
    ${conversationContext}

    USER REQUEST:
    ${userMessage}
  `;

  if (documentationContext) {
    fullPrompt += `
    REFERENCE DOCUMENTATION:
    ${documentationContext.slice(0, 100000)}
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: fullPrompt,
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "The conversational response.",
            },
            updatedCode: {
              type: Type.STRING,
              description: "The complete updated code if modifications were made.",
              nullable: true
            },
          },
          required: ["reply"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(cleanJsonOutput(response.text));
    }
    
    throw new Error("No response generated");
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};