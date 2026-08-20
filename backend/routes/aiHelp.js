const express = require('express');
const { Assessment, Course, Question } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_HISTORY_TURNS = 10;

router.post('/:assessmentId', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'AI study help isn\u2019t configured on this server yet.' });
    }

    const assessment = await Assessment.findByPk(req.params.assessmentId, {
      include: [Course, { model: Question, as: 'questions' }]
    });
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'student' || assessment.studentId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { message, history } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });

    const questionContext = (assessment.questions || [])
      .map((q, i) => {
        if (q.type === 'multiple_choice') {
          const options = q.options ? JSON.parse(q.options) : [];
          return `${i + 1}. (multiple choice) "${q.prompt}" - options: ${options.join(', ')}`;
        }
        return `${i + 1}. (short answer) "${q.prompt}"`;
      })
      .join('\n');

    const systemPrompt = `You are a patient study helper inside an education platform called EduConnect, assisting a student named ${req.user.fullName} with an assessment titled "${assessment.title}" in the course "${assessment.Course.name}".

${questionContext ? `This assessment includes the following questions:\n${questionContext}\n` : ''}
Your role is to help the student understand the underlying concepts well enough to answer confidently on their own - not to state which multiple-choice option is correct, or write their short-answer response for them. If asked directly for "the answer", explain the relevant concept, walk through the reasoning, or ask a guiding question instead, and briefly note that you're doing this on purpose so the assessment still reflects their own understanding. Keep responses concise and encouraging.`;

    const conversationHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: message.trim() }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Groq API error:', response.status, errBody);
      return res.status(502).json({ error: 'AI study helper is temporarily unavailable' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    res.json({ reply });
  } catch (err) {
    console.error('POST /ai-help/:assessmentId failed:', err);
    res.status(500).json({ error: 'Failed to get a response from the study helper' });
  }
});

module.exports = router;
