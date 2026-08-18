const express = require('express');
const { Assessment, Course, Question, Answer } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const VALID_TYPES = ['multiple_choice', 'short_answer'];

async function loadAssessmentWithCourse(assessmentId) {
  return Assessment.findByPk(assessmentId, { include: Course });
}

router.post('/', requireRole('lecturer'), async (req, res) => {
  try {
    const { assessmentId, type, prompt, options, correctOptionIndex, points } = req.body;
    if (!assessmentId || !prompt) return res.status(400).json({ error: 'assessmentId and prompt are required' });
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'type must be "multiple_choice" or "short_answer"' });

    const assessment = await loadAssessmentWithCourse(assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (assessment.Course.teacherId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    if (type === 'multiple_choice') {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: 'multiple_choice questions need at least 2 options' });
      }
      if (correctOptionIndex === undefined || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
        return res.status(400).json({ error: 'correctOptionIndex must point to one of the options' });
      }
    }

    const existingCount = await Question.count({ where: { assessmentId } });

    const question = await Question.create({
      assessmentId,
      type,
      prompt,
      options: type === 'multiple_choice' ? JSON.stringify(options) : null,
      correctOptionIndex: type === 'multiple_choice' ? correctOptionIndex : null,
      points: points || 1,
      order: existingCount
    });

    const payload = question.toJSON();
    payload.options = payload.options ? JSON.parse(payload.options) : null;
    res.status(201).json(payload);
  } catch (err) {
    console.error('POST /questions failed:', err);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

router.delete('/:questionId', requireRole('lecturer'), async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const assessment = await loadAssessmentWithCourse(question.assessmentId);
    if (!assessment || assessment.Course.teacherId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await Answer.destroy({ where: { questionId: question.id } });
    await question.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /questions/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

router.patch('/:questionId', requireRole('lecturer'), async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const assessment = await loadAssessmentWithCourse(question.assessmentId);
    if (!assessment || assessment.Course.teacherId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { prompt, options, correctOptionIndex, points } = req.body;

    if (prompt !== undefined) {
      if (!prompt.trim()) return res.status(400).json({ error: 'prompt cannot be empty' });
      question.prompt = prompt;
    }

    if (question.type === 'multiple_choice' && (options !== undefined || correctOptionIndex !== undefined)) {
      const newOptions = options !== undefined ? options : JSON.parse(question.options);
      const newCorrectIndex = correctOptionIndex !== undefined ? correctOptionIndex : question.correctOptionIndex;

      if (!Array.isArray(newOptions) || newOptions.length < 2) {
        return res.status(400).json({ error: 'multiple_choice questions need at least 2 options' });
      }
      if (newCorrectIndex < 0 || newCorrectIndex >= newOptions.length) {
        return res.status(400).json({ error: 'correctOptionIndex must point to one of the options' });
      }

      question.options = JSON.stringify(newOptions);
      question.correctOptionIndex = newCorrectIndex;
    }

    if (points !== undefined) question.points = points;

    await question.save();

    if (question.type === 'multiple_choice') {
      const answer = await Answer.findOne({ where: { questionId: question.id } });
      if (answer && answer.selectedOptionIndex !== null) {
        answer.isCorrect = answer.selectedOptionIndex === question.correctOptionIndex;
        answer.pointsAwarded = answer.isCorrect ? question.points : 0;
        await answer.save();
      }
    }

    const payload = question.toJSON();
    payload.options = payload.options ? JSON.parse(payload.options) : null;
    res.json(payload);
  } catch (err) {
    console.error('PATCH /questions/:id failed:', err);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

router.post('/:questionId/answer', requireRole('student'), async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const assessment = await Assessment.findByPk(question.assessmentId);
    if (!assessment || assessment.studentId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { selectedOptionIndex, textResponse } = req.body;

    let [answer] = await Answer.findOrCreate({
      where: { questionId: question.id },
      defaults: { questionId: question.id }
    });

    if (question.type === 'multiple_choice') {
      if (selectedOptionIndex === undefined) return res.status(400).json({ error: 'selectedOptionIndex is required' });
      answer.selectedOptionIndex = selectedOptionIndex;
      answer.isCorrect = selectedOptionIndex === question.correctOptionIndex;
      answer.pointsAwarded = answer.isCorrect ? question.points : 0;
    } else {
      if (!textResponse) return res.status(400).json({ error: 'textResponse is required' });
      answer.textResponse = textResponse;
    }
    await answer.save();

    res.json(answer);
  } catch (err) {
    console.error('POST /questions/:id/answer failed:', err);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

router.patch('/:questionId/grade', requireRole('lecturer'), async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const assessment = await loadAssessmentWithCourse(question.assessmentId);
    if (!assessment || assessment.Course.teacherId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { pointsAwarded } = req.body;
    if (pointsAwarded === undefined || pointsAwarded < 0 || pointsAwarded > question.points) {
      return res.status(400).json({ error: `pointsAwarded must be between 0 and ${question.points}` });
    }

    const answer = await Answer.findOne({ where: { questionId: question.id } });
    if (!answer) return res.status(404).json({ error: 'No answer submitted yet for this question' });

    answer.pointsAwarded = pointsAwarded;
    await answer.save();

    res.json(answer);
  } catch (err) {
    console.error('PATCH /questions/:id/grade failed:', err);
    res.status(500).json({ error: 'Failed to grade answer' });
  }
});

module.exports = router;
