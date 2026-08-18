import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import client, { API_BASE } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function AssessmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [qType, setQType] = useState('multiple_choice');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptions, setQOptions] = useState(['', '']);
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [qPoints, setQPoints] = useState(1);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [shortAnswerDrafts, setShortAnswerDrafts] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const fileRef = useRef();
  const socketRef = useRef();

  const load = async () => {
    const { data } = await client.get(`/assessments/${id}`);
    setAssessment(data);
    setGradeInput(data.grade || '');
    setFeedbackInput(data.feedbackSummary || '');
  };

  useEffect(() => {
    load();
    const socket = io(API_BASE);
    socketRef.current = socket;
    socket.emit('join_assessment_room', id);
    socket.on('new_comment', (c) => {
      setAssessment((prev) => prev ? { ...prev, comments: [...(prev.comments || []), c] } : prev);
    });
    return () => socket.disconnect();
  }, [id]);

  const submitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await client.post(`/comments/${id}`, { body: comment });
    setComment('');
    load();
  };

  const uploadDocument = async (e) => {
    e.preventDefault();
    const file = fileRef.current.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await client.post(`/documents/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      fileRef.current.value = '';
      load();
    } finally {
      setUploading(false);
    }
  };

  const updateStatus = async (status) => {
    await client.patch(`/assessments/${id}`, { status });
    load();
  };

  const saveGrade = async (e) => {
    e.preventDefault();
    setSavingGrade(true);
    try {
      await client.patch(`/assessments/${id}`, { grade: gradeInput, feedbackSummary: feedbackInput });
      load();
    } finally {
      setSavingGrade(false);
    }
  };

  const deleteAssessment = async () => {
    if (!window.confirm('Delete this assessment? This removes it for the student too, and can\'t be undone.')) return;
    await client.delete(`/assessments/${id}`);
    navigate('/assessments');
  };

  const downloadDoc = (docId, name) => {
    client.get(`/documents/${docId}/download`, { responseType: 'blob' }).then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const isPreviewable = (mimeType) => mimeType?.startsWith('image/') || mimeType === 'application/pdf';

  const openPreview = (doc) => {
    client.get(`/documents/${doc.id}/preview`, { responseType: 'blob' }).then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data], { type: doc.mimeType }));
      setPreviewDoc({ url, mimeType: doc.mimeType, name: doc.originalName });
    });
  };

  const closePreview = () => {
    if (previewDoc) window.URL.revokeObjectURL(previewDoc.url);
    setPreviewDoc(null);
  };

  const deleteDoc = async (docId) => {
    if (!window.confirm('Delete this file? This can\'t be undone.')) return;
    await client.delete(`/documents/${docId}`);
    load();
  };

  const resetQuestionForm = () => {
    setQPrompt('');
    setQOptions(['', '']);
    setQCorrectIndex(0);
    setQPoints(1);
    setShowQuestionForm(false);
    setEditingQuestionId(null);
  };

  const startEditQuestion = (q) => {
    setEditingQuestionId(q.id);
    setQType(q.type);
    setQPrompt(q.prompt);
    setQPoints(q.points);
    if (q.type === 'multiple_choice') {
      setQOptions(q.options && q.options.length ? q.options : ['', '']);
      setQCorrectIndex(q.correctOptionIndex ?? 0);
    } else {
      setQOptions(['', '']);
      setQCorrectIndex(0);
    }
    setShowQuestionForm(true);
  };

  const addQuestion = async (e) => {
    e.preventDefault();
    setSavingQuestion(true);
    try {
      if (editingQuestionId) {
        const payload = { prompt: qPrompt, points: qPoints };
        if (qType === 'multiple_choice') {
          payload.options = qOptions.filter((o) => o.trim());
          payload.correctOptionIndex = qCorrectIndex;
        }
        await client.patch(`/questions/${editingQuestionId}`, payload);
      } else {
        const payload = {
          assessmentId: id,
          type: qType,
          prompt: qPrompt,
          points: qPoints
        };
        if (qType === 'multiple_choice') {
          payload.options = qOptions.filter((o) => o.trim());
          payload.correctOptionIndex = qCorrectIndex;
        }
        await client.post('/questions', payload);
      }
      resetQuestionForm();
      load();
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question? This can\'t be undone.')) return;
    await client.delete(`/questions/${questionId}`);
    load();
  };

  const submitMultipleChoice = async (questionId, selectedOptionIndex) => {
    await client.post(`/questions/${questionId}/answer`, { selectedOptionIndex });
    load();
  };

  const submitShortAnswer = async (questionId) => {
    const textResponse = shortAnswerDrafts[questionId];
    if (!textResponse?.trim()) return;
    await client.post(`/questions/${questionId}/answer`, { textResponse });
    load();
  };

  const gradeShortAnswer = async (questionId, pointsAwarded) => {
    await client.patch(`/questions/${questionId}/grade`, { pointsAwarded });
    load();
  };

  if (!assessment) return <div className="max-w-4xl mx-auto px-6 py-10 text-ink/40">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link to="/assessments" className="text-sm text-ink/50 hover:text-indigo-650">← Back to assessments</Link>

      <div className="flex items-start justify-between mt-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{assessment.title}</h1>
          <p className="text-ink/50 mt-1">
            {assessment.Course?.code} — {assessment.Course?.name}
            {user.role === 'lecturer' && ` · ${assessment.student?.fullName}`}
          </p>
        </div>
        {user.role === 'lecturer' && (
          <div className="flex items-center gap-2">
            <select
              value={assessment.status}
              onChange={(e) => updateStatus(e.target.value)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm capitalize"
            >
              <option value="assigned">Assigned</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="needs_revision">Needs revision</option>
            </select>
            <button
              onClick={deleteAssessment}
              className="text-sm font-medium text-clay/70 hover:text-clay hover:underline px-2"
              title="Delete this assessment"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-ink/10 p-5">
          <h3 className="font-medium text-ink mb-3">Documents</h3>
          {assessment.documents?.length === 0 && <p className="text-sm text-ink/30 mb-3">No documents yet</p>}
          <ul className="space-y-2 mb-4">
            {assessment.documents?.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-medium truncate" title={doc.originalName}>{doc.originalName}</p>
                  <p className="text-xs text-ink/40">
                    {doc.uploadedBy?.fullName} · {doc.uploadedBy?.role} · {(doc.sizeBytes / 1024).toFixed(0)} KB
                  </p>
                </div>
                {isPreviewable(doc.mimeType) && (
                  <button onClick={() => openPreview(doc)} className="flex-shrink-0 text-xs font-medium text-indigo-650 hover:underline">
                    Preview
                  </button>
                )}
                <button onClick={() => downloadDoc(doc.id, doc.originalName)} className="flex-shrink-0 text-xs font-medium text-indigo-650 hover:underline">
                  Download
                </button>
                {doc.uploadedBy?.id === user.id && (
                  <button onClick={() => deleteDoc(doc.id)} className="flex-shrink-0 text-xs font-medium text-clay hover:underline">
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={uploadDocument} className="flex gap-2">
            <input ref={fileRef} type="file" className="text-xs flex-1" />
            <button type="submit" disabled={uploading} className="bg-ink text-white text-xs font-medium rounded-lg px-4 py-2 hover:bg-indigo-650 disabled:opacity-50">
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-ink/10 p-5">
          <h3 className="font-medium text-ink mb-3">Status &amp; grade</h3>
          <p className="text-sm text-ink/60 capitalize mb-3">Status: <span className="font-medium text-ink">{assessment.status.replace('_', ' ')}</span></p>

          {user.role === 'lecturer' ? (
            <form onSubmit={saveGrade} className="space-y-2">
              <div>
                <label className="text-xs font-medium text-ink/60">Grade</label>
                <input
                  value={gradeInput} onChange={(e) => setGradeInput(e.target.value)}
                  placeholder="e.g. A- or 87/100"
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink/60">Summary feedback</label>
                <textarea
                  value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)}
                  rows={3}
                  placeholder="Overall feedback the student will see"
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" disabled={savingGrade} className="bg-ink text-white text-xs font-medium rounded-lg px-4 py-2 hover:bg-indigo-650 disabled:opacity-50">
                {savingGrade ? 'Saving…' : 'Save grade & feedback'}
              </button>
            </form>
          ) : (
            <>
              <p className="text-sm text-ink/60 mb-2">Grade: <span className="font-medium text-ink">{assessment.grade || 'Not graded yet'}</span></p>
              <p className="text-sm text-ink/60">{assessment.feedbackSummary || 'No summary feedback written yet.'}</p>
            </>
          )}

          <Link to={`/call/${id}`} className="inline-block mt-4 text-xs font-medium text-clay hover:text-clay/70">
            Start a video/audio call about this →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-ink/10 p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-ink">Questions</h3>
          {user.role === 'lecturer' && (
            <button
              onClick={() => showQuestionForm ? resetQuestionForm() : setShowQuestionForm(true)}
              className="text-xs font-medium text-indigo-650 hover:underline"
            >
              {showQuestionForm ? 'Cancel' : '+ Add question'}
            </button>
          )}
        </div>

        {showQuestionForm && (
          <form onSubmit={addQuestion} className="bg-mist rounded-xl p-4 mb-5 space-y-3">
            {editingQuestionId && <p className="text-xs font-medium text-ink/50">Editing question</p>}
            <div className="flex gap-2">
              {['multiple_choice', 'short_answer'].map((t) => (
                <button
                  type="button" key={t}
                  disabled={!!editingQuestionId}
                  onClick={() => setQType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize disabled:opacity-40 disabled:cursor-not-allowed ${qType === t ? 'bg-ink text-white' : 'bg-white text-ink/60 border border-ink/10'}`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
            <textarea
              required value={qPrompt} onChange={(e) => setQPrompt(e.target.value)}
              placeholder="Question prompt"
              rows={2}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            {qType === 'multiple_choice' && (
              <div className="space-y-2">
                {qOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio" name="correctOption" checked={qCorrectIndex === i}
                      onChange={() => setQCorrectIndex(i)}
                      title="Mark as correct answer"
                    />
                    <input
                      required value={opt}
                      onChange={(e) => setQOptions(qOptions.map((o, idx) => idx === i ? e.target.value : o))}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
                    />
                    {qOptions.length > 2 && (
                      <button type="button" onClick={() => {
                        setQOptions(qOptions.filter((_, idx) => idx !== i));
                        if (qCorrectIndex >= qOptions.length - 1) setQCorrectIndex(0);
                      }} className="text-xs text-clay">Remove</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setQOptions([...qOptions, ''])} className="text-xs font-medium text-indigo-650">
                  + Add option
                </button>
                <p className="text-xs text-ink/40">Select the radio button next to the correct option.</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-ink/60">Points</label>
              <input
                type="number" min={1} value={qPoints}
                onChange={(e) => setQPoints(Number(e.target.value))}
                className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-sm"
              />
            </div>
            <button type="submit" disabled={savingQuestion} className="bg-ink text-white text-xs font-medium rounded-lg px-4 py-2 hover:bg-indigo-650 disabled:opacity-50">
              {savingQuestion ? 'Saving…' : (editingQuestionId ? 'Save changes' : 'Add question')}
            </button>
          </form>
        )}

        {assessment.questions?.length === 0 && <p className="text-sm text-ink/30">No questions added yet.</p>}

        <div className="space-y-4">
          {assessment.questions?.map((q, qi) => {
            const answer = q.answer;
            const hasAnswered = answer && (answer.selectedOptionIndex !== null && answer.selectedOptionIndex !== undefined || answer.textResponse);
            return (
              <div key={q.id} className="border border-ink/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-ink">
                    {qi + 1}. {q.prompt}
                    <span className="ml-2 text-xs font-normal text-ink/40">({q.points} pt{q.points !== 1 ? 's' : ''})</span>
                  </p>
                  {user.role === 'lecturer' && (
                    <div className="flex-shrink-0 flex items-center gap-3">
                      <button onClick={() => startEditQuestion(q)} className="text-xs font-medium text-indigo-650 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => deleteQuestion(q.id)} className="text-xs font-medium text-clay hover:underline">
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {q.type === 'multiple_choice' ? (
                  <div className="space-y-1.5 mt-2">
                    {q.options?.map((opt, oi) => {
                      const isSelected = answer?.selectedOptionIndex === oi;
                      const isCorrectOption = q.correctOptionIndex === oi;
                      const revealAnswerKey = q.correctOptionIndex !== undefined;
                      let style = 'border-ink/15';
                      if (revealAnswerKey && isCorrectOption) style = 'border-green-500 bg-green-500/5';
                      else if (isSelected && revealAnswerKey && !isCorrectOption) style = 'border-clay bg-clay/5';
                      return (
                        <label key={oi} className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${style} ${user.role === 'lecturer' ? 'cursor-default' : ''}`}>
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={isSelected}
                            disabled={user.role === 'lecturer'}
                            onChange={() => submitMultipleChoice(q.id, oi)}
                          />
                          <span className="text-ink/80">{opt}</span>
                        </label>
                      );
                    })}
                    {answer && user.role === 'student' && (
                      <p className={`text-xs font-medium mt-1 ${answer.isCorrect ? 'text-green-700' : 'text-clay'}`}>
                        {answer.isCorrect ? `Correct — ${answer.pointsAwarded} pt${answer.pointsAwarded !== 1 ? 's' : ''}` : 'Incorrect'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2">
                    {user.role === 'student' ? (
                      hasAnswered ? (
                        <div>
                          <p className="text-sm text-ink/70 bg-mist rounded-lg px-3 py-2">{answer.textResponse}</p>
                          <p className="text-xs font-medium mt-1 text-ink/50">
                            {answer.pointsAwarded !== null && answer.pointsAwarded !== undefined
                              ? `Graded: ${answer.pointsAwarded} / ${q.points} pts`
                              : 'Submitted — awaiting grading'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <textarea
                            rows={2}
                            value={shortAnswerDrafts[q.id] || ''}
                            onChange={(e) => setShortAnswerDrafts({ ...shortAnswerDrafts, [q.id]: e.target.value })}
                            placeholder="Type your answer…"
                            className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => submitShortAnswer(q.id)}
                            className="bg-ink text-white text-xs font-medium rounded-lg px-4 py-2 h-fit hover:bg-indigo-650"
                          >
                            Submit
                          </button>
                        </div>
                      )
                    ) : (
                      answer?.textResponse ? (
                        <div>
                          <p className="text-sm text-ink/70 bg-mist rounded-lg px-3 py-2 mb-2">{answer.textResponse}</p>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-ink/60">Award points (0–{q.points})</label>
                            <input
                              type="number" min={0} max={q.points}
                              defaultValue={answer.pointsAwarded ?? ''}
                              onBlur={(e) => e.target.value !== '' && gradeShortAnswer(q.id, Number(e.target.value))}
                              className="w-16 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-ink/30">No answer submitted yet.</p>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-ink/10 p-5">
        <h3 className="font-medium text-ink mb-4">Feedback discussion</h3>
        <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
          {assessment.comments?.length === 0 && <p className="text-sm text-ink/30">No comments yet — start the conversation.</p>}
          {assessment.comments?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <span className="w-8 h-8 rounded-full bg-indigo-650/10 text-indigo-650 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                {c.author?.fullName?.split(' ').map(p => p[0]).slice(0, 2).join('')}
              </span>
              <div>
                <p className="text-sm">
                  <span className="font-medium text-ink">{c.author?.fullName}</span>{' '}
                  <span className="text-xs text-ink/40 capitalize">{c.author?.role}</span>
                </p>
                <p className="text-sm text-ink/70">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={submitComment} className="flex gap-2">
          <input
            value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-ink text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-indigo-650">
            Post
          </button>
        </form>
      </div>

      {previewDoc && (
        <div className="fixed inset-0 bg-ink/80 z-50 flex items-center justify-center p-6" onClick={closePreview}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-ink/10">
              <p className="text-sm font-medium text-ink truncate pr-4">{previewDoc.name}</p>
              <button onClick={closePreview} className="flex-shrink-0 text-ink/50 hover:text-ink text-sm font-medium">
                Close ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-mist flex items-center justify-center p-4">
              {previewDoc.mimeType.startsWith('image/') ? (
                <img src={previewDoc.url} alt={previewDoc.name} className="max-w-full max-h-full object-contain rounded-lg" />
              ) : (
                <iframe src={previewDoc.url} title={previewDoc.name} className="w-full h-[70vh] rounded-lg border border-ink/10" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
