export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: "Invalid JSON" }); }
  }

  const goal = body?.goal;
  const items = body?.items || "なし";
  if (!goal) return res.status(400).json({ error: "goal is required" });

  const prompt = `モノタロウのAIアドバイザーとして回答してください。必ずJSONのみ返してください。コードブロック（\`\`\`）は絶対に使わないでください。

目的: ${goal}
手持ち: ${items}

以下の形式で返してください:
{"title":"タイトル","summary":"1文で状況","parts":[{"name":"商品名（型番含む）","reason":"1文の理由","monotaro":"あり","priority":"必須"}],"warnings":["注意点1","注意点2","注意点3"],"reviews":[{"stars":4,"text":"レビュー文","meta":"用途"},{"stars":5,"text":"レビュー文2","meta":"用途2"}]}

parts3〜5個。monotaro=あり/要確認/なし。priority=必須/推奨/あると便利。`;

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
        })
      }
    );

    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(500).json({ error: "Gemini API error: " + JSON.stringify(data) });

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let clean = raw.replace(/^```json\s*/g, "").replace(/^```\s*/g, "").replace(/```\s*$/g, "").trim();
    const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(500).json({ error: "JSON not found", raw: raw.slice(0, 200) });
    const parsed = JSON.parse(clean.slice(s, e + 1));
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
