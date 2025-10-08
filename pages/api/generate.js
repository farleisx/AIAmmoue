import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { prompt } = req.body;

    // 1️⃣ Generate site files using Gemini Flash 2.5
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fullPrompt = `
You are a professional web developer AI.
Generate a small complete website in JSON format like this:
{
  "files": [
    {"path": "index.html", "content": "<!DOCTYPE html>..."},
    {"path": "style.css", "content": "body {...}"},
    {"path": "script.js", "content": "console.log('ready')"}
  ]
}
Make sure it matches this user description:
${prompt}
    `;

    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();

    // Extract JSON safely
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Invalid JSON from Gemini");
    const jsonText = text.slice(start, end + 1);
    const json = JSON.parse(jsonText);
    const files = json.files || [];

    // 2️⃣ Prepare deployment payload for Vercel
    const deployFiles = {};
    for (const f of files) {
      deployFiles[f.path] = {
        data: Buffer.from(f.content).toString("base64"),
      };
    }

    const vercelBody = {
      name: `site-${Date.now()}`, // random site name
      files: Object.entries(deployFiles).map(([path, data]) => ({
        file: path,
        data: data.data,
      })),
      target: "production",
    };

    // 3️⃣ Deploy to Vercel using your token
    const vercelRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MY_VERCEL_TOKEN}`, // ✅ your custom variable
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vercelBody),
    });

    const vercelData = await vercelRes.json();
    if (!vercelRes.ok)
      throw new Error(vercelData.error?.message || "Vercel deploy failed");

    const url = vercelData.url ? `https://${vercelData.url}` : "Unknown URL";

    // ✅ Send final deployed URL to user
    res.status(200).json({
      success: true,
      deployed: true,
      url,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
