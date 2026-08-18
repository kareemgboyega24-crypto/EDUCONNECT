import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: u }, { data: c }] = await Promise.all([
      client.get('/admin/stats'),
      client.get('/admin/users'),
      client.get('/admin/courses')
    ]);
    setStats(s);
    setUsers(u);
    setCourses(c);
    setLoading(false);
  };

  useEffect(() => {
    if (user.role === 'admin') load();
  }, []);

  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const toggleActive = async (u) => {
    if (u.id === user.id) return;
    await client.patch(`/admin/users/${u.id}`, { active: !u.active });
    load();
  };

  const changeRole = async (u, role) => {
    if (role === u.role) return;
    if (!window.confirm(`Change ${u.fullName}'s role to ${role}?`)) return;
    await client.patch(`/admin/users/${u.id}`, { role });
    load();
  };

  const deleteCourse = async (course) => {
    if (!window.confirm(`Delete "${course.name}"? This removes its timetable, assessments, documents, and attendance records. This can't be undone.`)) return;
    await client.delete(`/admin/courses/${course.id}`);
    load();
  };

  if (loading) return <div className="max-w-6xl mx-auto px-6 py-10 text-ink/40">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Admin overview</h1>
      <p className="text-ink/50 mb-8">Institution-wide view across every account and course.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total users" value={stats.userCount} />
        <StatCard label="Lecturers" value={stats.teacherCount} />
        <StatCard label="Students" value={stats.studentCount} />
        <StatCard label="Courses" value={stats.courseCount} />
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'users' ? 'bg-ink text-white' : 'bg-white text-ink/60 border border-ink/10'}`}
        >
          Users
        </button>
        <button
          onClick={() => setTab('courses')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'courses' ? 'bg-ink text-white' : 'bg-white text-ink/60 border border-ink/10'}`}
        >
          Courses
        </button>
      </div>

      {tab === 'users' ? (
        <div className="bg-white rounded-2xl border border-ink/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mist text-ink/60 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Email</th>
                <th className="text-left px-5 py-3 font-medium">Role</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Verified</th>
                <th className="text-right px-5 py-3 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-ink/5">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ backgroundColor: u.avatarColor }}
                      >
                        {u.fullName.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </span>
                      <span className="text-ink font-medium">{u.fullName}</span>
                      {u.id === user.id && <span className="text-xs text-ink/40">(you)</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink/60">{u.email}</td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      disabled={u.id === user.id}
                      className="rounded-lg border border-ink/15 px-2 py-1 text-xs capitalize disabled:opacity-50"
                    >
                      <option value="student">Student</option>
                      <option value="lecturer">Lecturer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${u.active ? 'bg-green-500/10 text-green-700' : 'bg-clay/10 text-clay'}`}>
                      {u.active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink/60 text-xs">{u.emailVerified ? 'Yes' : 'No'}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={u.id === user.id}
                      className="text-xs font-medium text-clay hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {u.active ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mist text-ink/60 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Course</th>
                <th className="text-left px-5 py-3 font-medium">Lecturer</th>
                <th className="text-left px-5 py-3 font-medium">Enrolled</th>
                <th className="text-left px-5 py-3 font-medium">Assessments</th>
                <th className="text-right px-5 py-3 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-t border-ink/5">
                  <td className="px-5 py-3">
                    <p className="text-ink font-medium">{c.name}</p>
                    <p className="text-xs text-ink/40">{c.code}</p>
                  </td>
                  <td className="px-5 py-3 text-ink/60">{c.teacher?.fullName || '—'}</td>
                  <td className="px-5 py-3 text-ink/60">{c.enrollmentCount}</td>
                  <td className="px-5 py-3 text-ink/60">{c.assessmentCount}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => deleteCourse(c)} className="text-xs font-medium text-clay hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-ink/30">No courses yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-ink/10 p-5">
      <p className="text-2xl font-semibold text-ink font-display">{value}</p>
      <p className="text-xs text-ink/50 mt-1">{label}</p>
    </div>
  );
}
