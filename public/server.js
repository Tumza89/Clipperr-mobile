const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.post('/api/analyze', async (req, res) => {
  try {
    const { image, symbol, tradingMode, highProbMode } = req.body;

    if (!image || !symbol) {
      return res.status(400).json({ error: 'Missing image or symbol' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const modeHint = tradingMode === 'scalping'
      ? 'Focus on 1–15 minute structure'
      : tradingMode === 'day'
      ? 'Focus on 15m–1H structure'
      : 'Focus on 4H–Daily structure';

    const prompt = `
You are a professional Smart Money Concepts (SMC/ICT) chart analyst.
Analyze the uploaded trading chart screenshot carefully.

Symbol: ${symbol}
Trading mode: ${tradingMode} (${modeHint})
High probability mode: ${highProbMode ? 'YES' : 'NO'}

Return ONLY valid JSON in this exact format (no markdown, no extra text):

{
  "bias": "BUY" | "SELL" | "WAIT",
  "confidence": number between 50 and 95,
  "marketType": "string",
  "structureType": "string (e.g. Higher High + Higher Low (HH + HL))",
  "keyLevel": "string (Support holding / Resistance holding / None)",
  "entryType": "Limit Entry" | "Market Entry" | "Pullback Entry" | "—",
  "entryZone": "string",
  "entryQuality": "A+" | "A" | "B" | "C" | "—",
  "rr": "string e.g. 1 : 2",
  "confluences": ["string", "string"],
  "comment": "short practical comment",
  "tf": "string timeframe hint"
}

Rules:
- Base everything on what is actually visible in the chart.
- If structure is unclear, use bias "WAIT".
- Prefer quality over forcing a trade.
- Keep confluences realistic (Order Block, FVG, BOS, CHoCH, Liquidity Sweep, Support/Resistance, HH/HL/LH/LL).
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'low'
                }
              }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(500).json({
        error: data.error?.message || 'OpenAI request failed'
      });
    }

    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse failed:', content);
      return res.status(500).json({ error: 'AI returned invalid JSON' });
    }

    // Basic safety defaults
    analysis.symbol = symbol;
    analysis.bias = (analysis.bias || 'WAIT').toUpperCase();
    analysis.confidence = Math.min(95, Math.max(50, Number(analysis.confidence) || 60));
    analysis.confluences = Array.isArray(analysis.confluences) ? analysis.confluences : [];

    res.json(analysis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while analysing chart' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
