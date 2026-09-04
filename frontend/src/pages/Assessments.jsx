import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_STYLES = {
  assigned: 'bg-ink/10 text-ink',
  submitted: 'bg-indigo-650/10 text-indigo-650',
  reviewed: 'bg-green-500/10 text-green-700',
  needs_revision: 'bg-clay/10 text-clay'
};

export default function Assessments() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [roster, setRoster] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', studentId: '', title: '' });
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkQuestions, setBulkQuestions] = useState([]);
  const [showQuestionBuilder, setShowQuestionBuilder] = useState(false);
  const [qType, setQType] = useState('multiple_choice');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptions, setQOptions] = useState(['', '']);
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [qPoints, setQPoints] = useState(1);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const load = async () => {
    const [{ data: a }, { data: c }] = await Promise.all([
      client.get('/assessments'),
      client.get('/courses')
    ]);
    setAssessments(a);
    setCourses(c);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (user.role === 'lecturer' && form.courseId) {
      client.get(`/courses/${form.courseId}/roster`).then(({ data }) => setRoster(data));
    } else {
      setRoster([]);
    }
  }, [form.courseId, user.role]);

  const createAssessment = async (e) => {
    e.preventDefault();
    if (bulkMode) {
      setBulkSubmitting(true);
      try {
        const { data } = await client.post('/assessments/bulk-assign', {
          courseId: form.courseId,
          title: form.title,
          questions: bulkQuestions
        });
        alert(`Assigned to ${data.count} student${data.count !== 1 ? 's' : ''}.`);
        resetForm();
        load();
      } finally {
        setBulkSubmitting(false);
      }
      return;
    }
    await client.post('/assessments', form);
    resetForm();
    load();
  };

  const resetForm = () => {
    setForm({ courseId: '', studentId: '', title: '' });
    setBulkMode(false);
    setBulkQuestions([]);
    setShowQuestionBuilder(false);
    setShowForm(false);
  };

  const addLocalQuestion = (e) => {
    e.preventDefault();
    const q = {
      type: qType,
      prompt: qPrompt,
      points: qPoints,
      ...(qType === 'multiple_choice' ? { options: qOptions.filter((o) => o.trim()), correctOptionIndex: qCorrectIndex } : {})
    };
    setBulkQuestions([...bulkQuestions, q]);
    setQPrompt('');
    setQOptions(['', '']);
    setQCorrectIndex(0);
    setQPoints(1);
    setShowQuestionBuilder(false);
  };

  const removeLocalQuestion = (index) => {
    setBulkQuestions(bulkQuestions.filter((_, i) => i !== index));
  };

  const deleteAssessment = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this assessment? This removes it for the student too, and can\'t be undone.')) return;
    await client.delete(`/assessments/${id}`);
    load();
  };

  // Group assessments by course so items from different courses are never
  // visually mixed together - previously this was one flat list with only a
  // small course-code label distinguishing entries, which made it look like
  // an assessment "belonged" to the wrong course even though the underlying
  // data was always correctly scoped to a single courseId.
  const groupedByCourse = assessments.reduce((groups, a) => {
    const key = a.Course?.id || 'unknown';
    if (!groups[key]) groups[key] = { course: a.Course, items: [] };
    groups[key].items.push(a);
    return groups;
  }, {});
  const courseGroups = Object.values(groupedByCourse).sort((x, y) =>
    (x.course?.code || '').localeCompare(y.course?.code || '')
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Assessments</h1>
          <p className="text-ink/50 mt-1">
            {user.role === 'lecturer' ? 'Assign work to students and review what they submit.' : 'Submit reports and track feedback.'}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-ink text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-indigo-650">
          {user.role === 'lecturer' ? '+ Assign assessment' : '+ New submission'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createAssessment} className="bg-white rounded-2xl border border-ink/10 p-6 mb-8 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <select
              required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, studentId: '' })}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
            >
              <option value="">Select course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>

            {user.role === 'lecturer' && !bulkMode && (
              <select
                required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
                disabled={!form.courseId}
              >
                <option value="">
                  {form.courseId ? (roster.length ? 'Select student' : 'No students enrolled yet') : 'Pick a course first'}
                </option>
                {roster.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            )}

            <input
              required placeholder="Title (e.g. Lab Report 3)" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`rounded-lg border border-ink/15 px-3 py-2 text-sm ${user.role === 'lecturer' && !bulkMode ? '' : 'sm:col-span-2'}`}
            />
          </div>

          {user.role === 'lecturer' && (
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" checked={bulkMode} onChange={(e) => setBulkMode(e.target.checked)} />
              Assign to the entire class instead of one student
            </label>
          )}

          {user.role === 'lecturer' && bulkMode && (
            <div className="bg-mist rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-ink/60">Optional: build a quiz once, and every enrolled student gets their own copy of these questions.</p>

              {bulkQuestions.length > 0 && (
                <ul className="space-y-1.5">
                  {bulkQuestions.map((q, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-ink/10">
                      <span className="text-ink/80 truncate">{i + 1}. {q.prompt} <span className="text-ink/40 text-xs">({q.type.replace('_', ' ')}, {q.points} pt{q.points !== 1 ? 's' : ''})</span></span>
                      <button type="button" onClick={() => removeLocalQuestion(i)} className="flex-shrink-0 text-xs font-medium text-clay ml-2">Remove</button>
                    </li>
                  ))}
                </ul>
              )}

              {showQuestionBuilder ? (
                <div className="bg-white rounded-lg p-3 space-y-2 border border-ink/10">
                  <div className="flex gap-2">
                    {['multiple_choice', 'short_answer'].map((t) => (
                      <button
                        type="button" key={t} onClick={() => setQType(t)}
                        className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${qType === t ? 'bg-ink text-white' : 'bg-mist text-ink/60'}`}
                      >
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  <textarea
                    required value={qPrompt} onChange={(e) => setQPrompt(e.target.value)}
                    placeholder="Question prompt" rows={2}
                    className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                  />
                  {qType === 'multiple_choice' && (
                    <div className="space-y-1.5">
                      {qOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="radio" name="bulkCorrectOption" checked={qCorrectIndex === i} onChange={() => setQCorrectIndex(i)} />
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
                      <button type="button" onClick={() => setQOptions([...qOptions, ''])} className="text-xs font-medium text-indigo-650">+ Add option</button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-ink/60">Points</label>
                    <input type="number" min={1} value={qPoints} onChange={(e) => setQPoints(Number(e.target.value))} className="w-16 rounded-lg border border-ink/15 px-2 py-1 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={addLocalQuestion} className="bg-ink text-white text-xs font-medium rounded-lg px-4 py-2 hover:bg-indigo-650">
                      Add question
                    </button>
                    <button type="button" onClick={() => setShowQuestionBuilder(false)} className="text-xs font-medium text-ink/50">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowQuestionBuilder(true)} className="text-xs font-medium text-indigo-650">
                  + Add a question to this quiz
                </button>
              )}
            </div>
          )}

          <button type="submit" disabled={bulkSubmitting} className="w-full bg-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-650 disabled:opacity-50">
            {bulkSubmitting
              ? 'Assigning…'
              : user.role === 'lecturer'
                ? (bulkMode ? 'Assign to entire class' : 'Assign to student')
                : 'Create — then attach your document'}
          </button>
        </form>
      )}

      {assessments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-ink/20 p-12 text-center">
          <p className="text-ink/50">No assessments yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {courseGroups.map(({ course, items }) => (
            <div key={course?.id || 'unknown'}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-display text-lg font-semibold text-ink">{course?.name || 'Unknown course'}</h2>
                {course?.code && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-650/10 text-indigo-650">{course.code}</span>
                )}
              </div>
              <div className="space-y-3">
                {items.map((a) => (
                  <Link
                    key={a.id} to={`/assessments/${a.id}`}
                    className="flex items-center justify-between bg-white rounded-2xl border border-ink/10 p-5 hover:border-indigo-650/40 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-ink">{a.title}</p>
                      {user.role === 'lecturer' && a.student && (
                        <p className="text-sm text-ink/50">{a.student.fullName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {a.grade && (
                        <span className="text-xs font-medium px-3 py-1 rounded-full bg-mist text-ink border border-ink/10">
                          Grade: {a.grade}
                        </span>
                      )}
                      <span className={`text-xs font-medium px-3 py-1 rounded-full capitalize ${STATUS_STYLES[a.status]}`}>
                        {a.status.replace('_', ' ')}
                      </span>
                      {user.role === 'lecturer' && (
                        <button
                          onClick={(e) => deleteAssessment(e, a.id)}
                          className="text-xs font-medium text-clay/70 hover:text-clay hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
