import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';

export default function Attendance() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get(`/courses/${id}/attendance`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Could not load attendance'));
  }, [id]);

  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—';
  const dayKey = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const groupedByDay = data
    ? data.records.reduce((groups, r) => {
        const key = dayKey(r.joinedAt);
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
        return groups;
      }, {})
    : {};
  const orderedDays = Object.keys(groupedByDay).sort(
    (a, b) => new Date(groupedByDay[b][0].joinedAt) - new Date(groupedByDay[a][0].joinedAt)
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link to="/" className="text-sm text-ink/50 hover:text-indigo-650">← Back to dashboard</Link>

      <div className="mt-4 mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Call attendance</h1>
        <p className="text-ink/50 mt-1">Grouped by session day, so each class meeting is separate.</p>
      </div>

      {error && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{error}</p>}

      {data && (
        <>
          <div className="bg-white rounded-2xl border border-ink/10 p-5 mb-6 inline-block">
            <p className="text-3xl font-display font-semibold text-ink">{data.uniqueStudentCount}</p>
            <p className="text-sm text-ink/50">unique {data.uniqueStudentCount === 1 ? 'student has' : 'students have'} attended, across all sessions</p>
          </div>

          {orderedDays.length === 0 ? (
            <div className="bg-white rounded-2xl border border-ink/10 p-6 text-center">
              <p className="text-sm text-ink/30">No one has joined a call for this course yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {orderedDays.map((day) => {
                const records = groupedByDay[day];
                const dayStudentCount = new Set(records.filter(r => r.role === 'student').map(r => r.userId)).size;
                return (
                  <div key={day} className="bg-white rounded-2xl border border-ink/10 overflow-hidden">
                    <div className="px-5 py-3 bg-mist border-b border-ink/10 flex items-center justify-between">
                      <p className="font-medium text-ink">{day}</p>
                      <p className="text-xs text-ink/50">{dayStudentCount} {dayStudentCount === 1 ? 'student' : 'students'} this session</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-ink/40 uppercase tracking-wide border-b border-ink/10">
                          <th className="px-5 py-3">Name</th>
                          <th className="px-5 py-3">Student ID</th>
                          <th className="px-5 py-3">Role</th>
                          <th className="px-5 py-3">Joined</th>
                          <th className="px-5 py-3">Left</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id} className="border-b border-ink/5 last:border-0">
                            <td className="px-5 py-3 font-medium text-ink">{r.fullName}</td>
                            <td className="px-5 py-3 text-ink/50">{r.studentIdNumber || '—'}</td>
                            <td className="px-5 py-3 text-ink/50 capitalize">{r.role}</td>
                            <td className="px-5 py-3 text-ink/50">{fmtTime(r.joinedAt)}</td>
                            <td className="px-5 py-3 text-ink/50">{r.leftAt ? fmtTime(r.leftAt) : <span className="text-green-700">In call</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
