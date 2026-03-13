import OpenAI from "openai"; // Correct import for v4

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure your .env file has this key
});

async function getGPTAnalysis(videoAnalysis) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an AI that analyzes video insights." },
        { role: "user", content: `Analyze this video data: ${JSON.stringify(videoAnalysis)}` }
      ],
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("GPT API Error:", error);
    return "Error generating insights.";
  }
}

export default getGPTAnalysis;
