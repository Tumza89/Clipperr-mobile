const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Current Gemini model
const MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

app.post('/api/analyze', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing on Railway' });
    }

    const { image, symbol, mode, highProb } = req.body || {};
    if (!image || !symbol) {
      return res.status(400).json({ error: 'Missing image or symbol' });
    }

    const base64 = String(image).replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    if (base64.length < 100) {
      return res.status(400).json({ error: 'Image data too small or invalid' });
    }

    const prompt = `
You are an expert SMC / ICT / PO3 price action analyst.
Analyze this trading chart screenshot for symbol ${symbol}.
Trading mode: ${mode || 'scalping'}.
High probability mode: ${highProb ? 'yes' : 'no'}.

Return ONLY valid JSON (no markdown, no extra text) with this exact structure:
{
  "bias": "BUY" or "SELL" or "WAIT",
  "confidence": number 0-100,
  "phase": "Accumulation" or "Manipulation" or "Distribution",
  "strategy": "short strategy name",
  "structureType": "e.g. HH+HL or LH+LL or unclear",
  "entryZone": "e.g. Discount FVG / Order Block",
  "entryQuality": "A+" or "A" or "B" or "—",
  "rr": "e.g. 1 : 2",
  "slPips": number,
  "tpPips": number,
  "confluences": ["item1", "item2", "item3"],
  "comment": "1-2 sentence explanation",
  "tf": "suggested timeframe",
  "session": "current session if relevant"
}

Rules:
- Only BUY or SELL when structure + liquidity/displacement are clear.
- Prefer WAIT when chart is unclear or low quality.
- Be honest. Do not invent levels you cannot see.
- Keep confluences to real SMC/ICT concepts only.
`;

    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024
      }
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(500).json({
        error: data?.error?.message || 'Gemini request failed'
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse failed:', cleaned);
      return res.status(500).json({
        error: 'AI returned invalid JSON. Try another screenshot.',
        raw: cleaned.slice(0, 300)
      });
    }

    analysis.symbol = symbol;
    analysis.confidence = analysis.confidence || analysis.conf || 0;
    res.json(analysis);
  } catch (err) {
    console.error('Server crash:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('SignalsPro running on', PORT));
