const express = require('express');
const { Assessment, Course, Document } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { upload, finalizeUpload, streamFileToResponse, streamFileInline, deleteStoredFile } = require('../config/storage');

const router = express.Router();
router.use(requireAuth);

async function canAccessAssessment(user, assessmentId) {
  const assessment = await Assessment.findByPk(assessmentId, { include: Course });
  if (!assessment) return null;
  const isOwnerStudent = user.role === 'student' && assessment.studentId === user.id;
  const isCourseTeacher = user.role === 'teacher' && assessment.Course.teacherId === user.id;
  return (isOwnerStudent || isCourseTeacher) ? assessment : null;
}

router.post('/:assessmentId', upload.single('file'), async (req, res) => {
  try {
    const assessment = await canAccessAssessment(req.user, req.params.assessmentId);
    if (!assessment) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });

    const storedFileName = await finalizeUpload(req.file);

    const doc = await Document.create({
      assessmentId: assessment.id,
      uploadedById: req.user.id,
      originalName: req.file.originalname,
      storedFileName,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const assessment = await canAccessAssessment(req.user, doc.assessmentId);
    if (!assessment) return res.status(403).json({ error: 'Forbidden' });

    await streamFileToResponse(res, doc.storedFileName, doc.originalName, doc.mimeType);
  } catch (err) {
    console.error('Download failed:', err);
    res.status(500).json({ error: 'Download failed' });
  }
});

router.get('/:id/preview', async (req, res) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const assessment = await canAccessAssessment(req.user, doc.assessmentId);
    if (!assessment) return res.status(403).json({ error: 'Forbidden' });

    await streamFileInline(res, doc.storedFileName, doc.mimeType);
  } catch (err) {
    console.error('Preview failed:', err);
    res.status(500).json({ error: 'Preview failed' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const assessment = await canAccessAssessment(req.user, doc.assessmentId);
    if (!assessment) return res.status(403).json({ error: 'Forbidden' });

    if (doc.uploadedById !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete files you uploaded yourself' });
    }

    await deleteStoredFile(doc.storedFileName);
    await doc.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /documents/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
