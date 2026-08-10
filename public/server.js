const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Chart analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { image, symbol, tradingMode, highProbMode } = req.body;

    if (!image || !symbol) {
      return res.status(400).json({ error: 'Missing image or symbol' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured on Railway' });
    }

    const modeLabel = tradingMode === 'scalping' ? 'Scalping (1–15m)' :
                      tradingMode === 'day' ? 'Day Trading (15m–1H)' :
                      'Swing Trading (4H–Daily)';

    const prompt = `You are an expert Smart Money Concepts (SMC) and ICT trader.
Analyse this trading chart screenshot carefully.

Symbol: ${symbol}
Trading Mode: ${modeLabel}
High Probability Mode: ${highProbMode ? 'ON' : 'OFF'}

IMPORTANT: Return ONLY a valid JSON object. Do not write any other text before or after the JSON.

Use this exact format:

{
  "bias": "BUY",
  "confidence": 78,
  "marketType": "Trending market",
  "htfBias": "Bullish",
  "confluences": ["HTF Bias: Bullish", "Order Block", "Liquidity Sweep", "Fair Value Gap"],
  "comment": "Clear bullish structure with good confluence.",
  "timeframeHint": "15m - 1H"
}

Rules:
- bias must be only BUY, SELL or WAIT
- confidence must be a number between 50 and 95
- Prefer WAIT if the setup is not clear
- Maximum 6 confluence items`;

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
                  detail: 'low'          // changed to low to reduce size & cost
                }
              }
            ]
          }
        ],
        max_tokens: 600,
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI Error:', data);
      return res.status(500).json({ error: data.error?.message || 'OpenAI API error' });
    }

    let content = data.choices[0].message.content.trim();

    // Clean the response aggressively
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Try to extract JSON if there's extra text
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      content = content.substring(firstBrace, lastBrace + 1);
    }

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseErr) {
      console.error('JSON Parse failed. Raw content:', content);
      return res.status(500).json({ 
        error: 'AI returned invalid format. Please try again with a clearer chart.' 
      });
    }

    res.json(analysis);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Market Avenger Pro running on port ${PORT}`);
});
