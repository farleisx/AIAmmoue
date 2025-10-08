import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { prompt } = req.body;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
You are a professional web developer AI. Generate a complete mini-website as JSON:
{
  "files": [
    {"path": "index.html", "content": "..."},
    {"path": "style.css", "content": "..."},
    {"path": "script.js", "content": "..."}
  ]
}
Do not include extra text. The website should match this user description:
${prompt}
`;

    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();

    // Extract JSON
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonText = text.slice(start, end + 1);
    const json = JSON.parse(jsonText);

    res.status(200).json({ success: true, files: json.files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}
