import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', title: '', body: '' });
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: c }] = await Promise.all([
      client.get('/announcements'),
      client.get('/courses')
    ]);
    setAnnouncements(a);
    setCourses(c);
    setLoading(false);
    client.post('/announcements/mark-read').catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const postAnnouncement = async (e) => {
    e.preventDefault();
    setPosting(true);
    try {
      await client.post('/announcements', form);
      setForm({ courseId: '', title: '', body: '' });
      setShowForm(false);
      load();
    } finally {
      setPosting(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement? This can\'t be undone.')) return;
    await client.delete(`/announcements/${id}`);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Announcements</h1>
          <p className="text-ink/50 mt-1">
            {user.role === 'lecturer' ? 'Broadcast updates to an entire class at once.' : 'Updates from your lecturers, newest first.'}
          </p>
        </div>
        {user.role === 'lecturer' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-ink text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-indigo-650 transition-colors"
          >
            {showForm ? 'Cancel' : '+ New announcement'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={postAnnouncement} className="bg-white rounded-2xl border border-ink/10 p-6 mb-8 space-y-3">
          <select
            required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          >
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
          <input
            required placeholder="Title (e.g. Class moved to Room 12 this week)"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <textarea
            required rows={3} placeholder="Details students should know"
            value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={posting} className="bg-ink text-white rounded-lg py-2.5 px-5 text-sm font-medium hover:bg-indigo-650 disabled:opacity-50">
            {posting ? 'Posting…' : 'Post to class'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-ink/40">Loading…</p>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-ink/20 p-12 text-center">
          <p className="text-ink/50">
            {user.role === 'lecturer' ? 'No announcements yet — post your first update above.' : 'No announcements yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-ink/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-indigo-650 uppercase tracking-wide">{a.Course?.code}</p>
                  <h3 className="font-medium text-ink mt-1">{a.title}</h3>
                </div>
                {user.role === 'lecturer' && a.author?.id === user.id && (
                  <button onClick={() => deleteAnnouncement(a.id)} className="flex-shrink-0 text-xs font-medium text-clay hover:underline">
                    Delete
                  </button>
                )}
              </div>
              <p className="text-sm text-ink/70 mt-2">{a.body}</p>
              <p className="text-xs text-ink/40 mt-3">
                {a.author?.fullName} · {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
