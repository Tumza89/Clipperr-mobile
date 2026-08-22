const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  MODEL +
  ':generateContent?key=' +
  GEMINI_API_KEY;

app.get('/api/health', function (req, res) {
  res.json({
    ok: true,
    hasKey: !!process.env.GEMINI_API_KEY
  });
});

app.post('/api/analyze', async function (req, res) {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing on Railway' });
    }

    const body = req.body || {};
    const image = body.image;
    const symbol = body.symbol;
    const mode = body.mode || 'scalping';
    const highProb = body.highProb;

    if (!image || !symbol) {
      return res.status(400).json({ error: 'Missing image or symbol' });
    }

    const base64 = String(image).replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    if (base64.length < 100) {
      return res.status(400).json({ error: 'Image data too small or invalid' });
    }

    const prompt =
      'You are an expert SMC / ICT / PO3 price action analyst.\n' +
      'Analyze this trading chart screenshot for symbol ' + symbol + '.\n' +
      'Trading mode: ' + mode + '.\n' +
      'High probability mode: ' + (highProb ? 'yes' : 'no') + '.\n\n' +
      'Return ONLY valid JSON (no markdown, no extra text) with this exact structure:\n' +
      '{\n' +
      '  "bias": "BUY" or "SELL" or "WAIT",\n' +
      '  "confidence": number 0-100,\n' +
      '  "phase": "Accumulation" or "Manipulation" or "Distribution",\n' +
      '  "strategy": "short strategy name",\n' +
      '  "structureType": "e.g. HH+HL or LH+LL or unclear",\n' +
      '  "entryZone": "e.g. Discount FVG / Order Block",\n' +
      '  "entryQuality": "A+" or "A" or "B" or "—",\n' +
      '  "rr": "e.g. 1 : 2",\n' +
      '  "slPips": number,\n' +
      '  "tpPips": number,\n' +
      '  "confluences": ["item1", "item2", "item3"],\n' +
      '  "comment": "1-2 sentence explanation",\n' +
      '  "tf": "suggested timeframe",\n' +
      '  "session": "current session if relevant"\n' +
      '}\n\n' +
      'Rules:\n' +
      '- Only BUY or SELL when structure + liquidity/displacement are clear.\n' +
      '- Prefer WAIT when chart is unclear or low quality.\n' +
      '- Be honest. Do not invent levels you cannot see.\n' +
      '- Keep confluences to real SMC/ICT concepts only.';

    const payload = {
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
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(500).json({
        error: (data && data.error && data.error.message) || 'Gemini request failed'
      });
    }

    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
        ? data.candidates[0].content.parts[0].text
        : '';

    const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();

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
    return res.json(analysis);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Fallback last — no star route
app.use(function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function () {
  console.log('SignalsPro running on', PORT);
});
