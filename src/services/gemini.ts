import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeData(fullData: any[]) {
  if (!fullData || fullData.length === 0) return {};
  
  // 1. Extract schema from up to 50 rows to be fast but accurate
  const sampleForSchema = fullData.slice(0, 50);
  const columns = Object.keys(sampleForSchema[0] || {});
  
  const columnInfo = columns.map(col => {
    const vals = sampleForSchema.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
    // Check if majority of values are numeric
    const numericCount = vals.filter(v => typeof v === 'number' || !isNaN(Number(String(v).replace(/[^0-9.-]+/g, "")))).length;
    const isNumeric = vals.length > 0 && (numericCount / vals.length) > 0.8;
    return `${col} (${isNumeric ? 'numeric' : 'text'})`;
  });

  // 2. Send only 3 rows to Gemini to save massive amounts of time/tokens
  const miniSample = fullData.slice(0, 3);

  const prompt = `Analyze this dataset.
  Columns: ${columnInfo.join(", ")}
  Sample Data: ${JSON.stringify(miniSample)}
  
  Provide a summary, 3 key insights, and suggest 2-4 charts.
  CRITICAL RULES FOR CHARTS:
  1. 'yAxisKey' MUST be a 'numeric' column.
  2. 'xAxisKey' MUST be a 'text' or date column (except for scatter plots, where it can be numeric).
  3. Chart Types:
     - 'line': Use for trends over time (dates/years on X axis).
     - 'bar': Use for comparing categorical values.
     - 'pie': Use for parts of a whole (percentages/shares).
     - 'scatter': Use for correlation between two numeric columns.
  4. Keep titles short and descriptive.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      temperature: 0.2, // Lower temperature for faster, more deterministic output
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "A brief 1-2 sentence summary of what this data represents."
          },
          insights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Short, punchy key insights derived from the data."
          },
          charts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: { type: Type.STRING, description: "One of: bar, line, pie, scatter" },
                xAxisKey: { type: Type.STRING, description: "The column name to use for the X axis (MUST be text/categorical)" },
                yAxisKey: { type: Type.STRING, description: "The column name to use for the Y axis (MUST be numeric)" },
                description: { type: Type.STRING, description: "Why this chart is useful" }
              },
              required: ["title", "type", "xAxisKey", "yAxisKey", "description"]
            }
          }
        },
        required: ["summary", "insights", "charts"]
      }
    }
  });

  let text = response.text || "{}";
  // Remove markdown formatting if present
  if (text.startsWith("```json")) {
    text = text.replace(/^```json\n/, "").replace(/\n```$/, "");
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\n/, "").replace(/\n```$/, "");
  }
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini:", text);
    throw new Error("Failed to analyze data. Please try again.");
  }
}
