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
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const modeLabel = tradingMode === 'scalping' ? 'Scalping (1–15m)' :
                      tradingMode === 'day' ? 'Day Trading (15m–1H)' :
                      'Swing Trading (4H–Daily)';

    const prompt = `You are an expert Smart Money Concepts (SMC) and ICT trader.
Analyse this trading chart screenshot carefully.

Symbol: ${symbol}
Trading Mode: ${modeLabel}
High Probability Mode: ${highProbMode ? 'ON' : 'OFF'}

Return ONLY valid JSON in this exact format (no extra text):

{
  "bias": "BUY" or "SELL" or "WAIT",
  "confidence": number between 50 and 95,
  "marketType": "short description",
  "htfBias": "Bullish" or "Bearish" or "Ranging",
  "confluences": ["factor1", "factor2", "factor3", "factor4", "factor5"],
  "comment": "one short paragraph explanation",
  "timeframeHint": "suggested timeframe"
}

Rules:
- Be strict. Prefer WAIT if the setup is not clear.
- Focus on: Higher Timeframe Bias, Market Structure (BOS/CHoCH), Order Blocks, Fair Value Gaps, Liquidity Sweeps, Breaker Blocks.
- Confidence should be realistic.
- Maximum 5-6 confluence items.`;

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
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(500).json({ error: data.error?.message || 'OpenAI error' });
    }

    let content = data.choices[0].message.content.trim();
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    const analysis = JSON.parse(content);
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
