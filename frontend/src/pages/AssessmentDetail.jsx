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
    // socket event will append it; also refresh as a fallback
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

  const deleteDoc = async (docId) => {
    if (!window.confirm('Delete this file? This can\'t be undone.')) return;
    await client.delete(`/documents/${docId}`);
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
            {user.role === 'teacher' && ` · ${assessment.student?.fullName}`}
          </p>
        </div>
        {user.role === 'teacher' && (
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
        {/* Documents */}
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

        {/* Grade / summary */}
        <div className="bg-white rounded-2xl border border-ink/10 p-5">
          <h3 className="font-medium text-ink mb-3">Status &amp; grade</h3>
          <p className="text-sm text-ink/60 capitalize mb-3">Status: <span className="font-medium text-ink">{assessment.status.replace('_', ' ')}</span></p>

          {user.role === 'teacher' ? (
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

      {/* Comment thread */}
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
    </div>
  );
}
