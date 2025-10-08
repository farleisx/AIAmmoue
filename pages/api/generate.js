import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { prompt } = req.body;

    // 1. Use Gemini to generate site files
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fullPrompt = `
You are a web developer AI. Generate a complete small website as JSON:
{
  "files": [
    {"path": "index.html", "content": "..."},
    {"path": "style.css", "content": "..."},
    {"path": "script.js", "content": "..."}
  ]
}
The site must fully match this user request:
${prompt}
`;
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonText = text.slice(start, end + 1);
    const json = JSON.parse(jsonText);
    const files = json.files || [];

    // 2. Build Vercel deploy payload
    const deployFiles = {};
    for (const f of files) {
      deployFiles[f.path] = {
        data: Buffer.from(f.content).toString("base64"),
      };
    }

    const vercelBody = {
      name: `site-${Date.now()}`,
      files: Object.entries(deployFiles).map(([path, data]) => ({
        file: path,
        data: data.data,
      })),
      target: "production",
    };

    // 3. Send deploy request to Vercel API
    const vercelRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vercelBody),
    });

    const vercelData = await vercelRes.json();
    if (!vercelRes.ok) throw new Error(vercelData.error?.message || "Deploy failed");

    const url = vercelData.url ? `https://${vercelData.url}` : "Unknown";

    res.status(200).json({
      success: true,
      deployed: true,
      url,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
