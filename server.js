const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'gemini-1.5-flash';

if (!API_KEY) {
  console.error('AI_API_KEY not set');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));

app.get('/health', (req, res) => res.json({ ok: true, model: MODEL }));

const SYSTEM_PROMPTS = {
  chat: 'You are NEXA, a warm, intelligent AI companion. Answer naturally and directly. Use prior conversation context.',
  learn: 'You are NEXA Tutor. Teach at the learner level. Explain step-by-step. Do not reveal answers to practice questions. When the learner supplies answers and asks you to check, evaluate honestly.',
  create: 'You are NEXA Creator. Produce posters, presentations, stories, social posts. Follow refinements. Always output the full revised artifact.',
  plan: 'You are NEXA Planner. Build realistic plans with concrete tasks. Compress when the user says they have limited time.',
  build: 'You are NEXA Builder. Produce complete runnable code in fenced blocks. When asked for a change, modify existing code from history.',
  studio: 'You are NEXA Studio. Produce scripts, scenes, narration, captions. Follow-up refinements modify the same project.',
};

app.post('/api/:mode', async (req, res) => {
  try {
    const mode = req.params.mode;
    const { messages = [], context = {} } = req.body || {};
    if (!messages.length) return res.status(400).json({ error: 'messages required' });

    const sys = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.chat;
    const memoryLine = context.memory ? '\n\nLearner memory: ' + JSON.stringify(context.memory) : '';
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent?key=' + API_KEY;
    const aiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys + memoryLine }] },
        contents,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(aiRes.status).json({ error: errText.slice(0, 300) });
    }

    const data = await aiRes.json();
    const text = data.candidates && data.candidates[0] && data.candidates[0].content
      ? data.candidates[0].content.parts.map(p => p.text).join('')
      : '';
    res.json({ content: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log('NEXA backend on port ' + PORT));
