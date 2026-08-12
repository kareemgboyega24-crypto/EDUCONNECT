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

  const load = async () => {
    const [{ data: a }, { data: c }] = await Promise.all([
      client.get('/assessments'),
      client.get('/courses')
    ]);
    setAssessments(a);
    setCourses(c);
  };

  useEffect(() => { load(); }, []);

  // Teacher only: when they pick a course in the assign form, load that course's roster
  useEffect(() => {
    if (user.role === 'teacher' && form.courseId) {
      client.get(`/courses/${form.courseId}/roster`).then(({ data }) => setRoster(data));
    } else {
      setRoster([]);
    }
  }, [form.courseId, user.role]);

  const createAssessment = async (e) => {
    e.preventDefault();
    await client.post('/assessments', form);
    setForm({ courseId: '', studentId: '', title: '' });
    setShowForm(false);
    load();
  };

  const deleteAssessment = async (e, id) => {
    e.preventDefault(); // don't follow the row's Link navigation
    e.stopPropagation();
    if (!window.confirm('Delete this assessment? This removes it for the student too, and can\'t be undone.')) return;
    await client.delete(`/assessments/${id}`);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Assessments</h1>
          <p className="text-ink/50 mt-1">
            {user.role === 'teacher' ? 'Assign work to students and review what they submit.' : 'Submit reports and track feedback.'}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-ink text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-indigo-650">
          {user.role === 'teacher' ? '+ Assign assessment' : '+ New submission'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createAssessment} className="bg-white rounded-2xl border border-ink/10 p-6 mb-8 grid sm:grid-cols-3 gap-3">
          <select
            required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, studentId: '' })}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
          >
            <option value="">Select course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>

          {user.role === 'teacher' && (
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
            className={`rounded-lg border border-ink/15 px-3 py-2 text-sm ${user.role === 'teacher' ? '' : 'sm:col-span-2'}`}
          />
          <button type="submit" className="sm:col-span-3 bg-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-650">
            {user.role === 'teacher' ? 'Assign to student' : 'Create — then attach your document'}
          </button>
        </form>
      )}

      {assessments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-ink/20 p-12 text-center">
          <p className="text-ink/50">No assessments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Link
              key={a.id} to={`/assessments/${a.id}`}
              className="flex items-center justify-between bg-white rounded-2xl border border-ink/10 p-5 hover:border-indigo-650/40 transition-colors"
            >
              <div>
                <p className="font-medium text-ink">{a.title}</p>
                <p className="text-sm text-ink/50">
                  {a.Course?.code} {user.role === 'teacher' && a.student ? `· ${a.student.fullName}` : ''}
                </p>
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
                {user.role === 'teacher' && (
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
      )}
    </div>
  );
}
