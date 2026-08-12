import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Timetable() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', dayOfWeek: 0, startTime: '09:00', endTime: '10:00', location: '' });

  const load = async () => {
    const [{ data: tt }, { data: c }] = await Promise.all([
      client.get('/timetable'),
      client.get('/courses')
    ]);
    setEntries(tt);
    setCourses(c);
  };

  useEffect(() => { load(); }, []);

  const addEntry = async (e) => {
    e.preventDefault();
    await client.post('/timetable', form);
    setShowForm(false);
    load();
  };

  const removeEntry = async (id) => {
    await client.delete(`/timetable/${id}`);
    load();
  };

  const grouped = DAYS.map((label, idx) => ({
    label,
    items: entries.filter(e => e.dayOfWeek === idx).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Your timetable</h1>
          <p className="text-ink/50 mt-1">Weekly schedule across all your courses.</p>
        </div>
        {user.role === 'teacher' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-ink text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-indigo-650"
          >
            + Add slot
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={addEntry} className="bg-white rounded-2xl border border-ink/10 p-6 mb-8 grid sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-ink/60">Course</label>
            <select
              required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            >
              <option value="">Select course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">Day</label>
            <select
              value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            >
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">Start</label>
            <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">End</label>
            <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
          <input
            placeholder="Room / location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <button type="submit" className="sm:col-span-3 bg-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-650">
            Add to timetable
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {grouped.map(({ label, items }) => (
          <div key={label} className="bg-white rounded-2xl border border-ink/10 p-5">
            <h3 className="font-display font-semibold text-ink mb-3">{label}</h3>
            {items.length === 0 ? (
              <p className="text-sm text-ink/30">No classes</p>
            ) : (
              <ul className="space-y-3">
                {items.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-indigo-650 pl-3">
                    <p className="text-sm font-medium text-ink">{entry.Course?.name}</p>
                    <p className="text-xs text-ink/50">{entry.startTime}–{entry.endTime} {entry.location && `· ${entry.location}`}</p>
                    {user.role === 'teacher' && (
                      <button onClick={() => removeEntry(entry.id)} className="text-xs text-clay/70 hover:text-clay mt-1">Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
