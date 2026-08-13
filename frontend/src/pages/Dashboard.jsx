import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [showJoinCourse, setShowJoinCourse] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [joinCourseId, setJoinCourseId] = useState('');
  const [message, setMessage] = useState('');

  const loadCourses = async () => {
    setLoading(true);
    const { data } = await client.get('/courses');
    setCourses(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user.role !== 'admin') loadCourses();
  }, []);

  if (user.role === 'admin') return <Navigate to="/admin" replace />;

  const createCourse = async (e) => {
    e.preventDefault();
    await client.post('/courses', form);
    setForm({ name: '', code: '', description: '' });
    setShowNewCourse(false);
    loadCourses();
  };

  const joinCourse = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await client.post(`/courses/${joinCourseId}/enroll`);
      setJoinCourseId('');
      setShowJoinCourse(false);
      loadCourses();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not join that course');
    }
  };

  const deleteCourse = async (courseId, courseName) => {
    if (!window.confirm(`Delete "${courseName}"? This also removes its timetable, assessments, documents, and attendance records — for every enrolled student too. This can't be undone.`)) return;
    await client.delete(`/courses/${courseId}`);
    loadCourses();
  };

  const downloadGrades = (courseId, courseCode) => {
    client.get(`/courses/${courseId}/grades/export`, { responseType: 'blob' }).then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${courseCode}-grades.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Welcome back, {user.fullName.split(' ')[0]}
          </h1>
          <p className="text-ink/50 mt-1">
            {user.role === 'teacher' ? 'Your courses at a glance.' : 'Courses you\'re enrolled in.'}
          </p>
        </div>

        {user.role === 'teacher' ? (
          <button
            onClick={() => setShowNewCourse(!showNewCourse)}
            className="bg-ink text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-indigo-650 transition-colors"
          >
            + New course
          </button>
        ) : (
          <button
            onClick={() => setShowJoinCourse(!showJoinCourse)}
            className="bg-ink text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-indigo-650 transition-colors"
          >
            + Join a course
          </button>
        )}
      </div>

      {showNewCourse && (
        <form onSubmit={createCourse} className="bg-white rounded-2xl border border-ink/10 p-6 mb-8 grid sm:grid-cols-3 gap-3">
          <input
            required placeholder="Course name (e.g. Algorithms II)"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm sm:col-span-1"
          />
          <input
            required placeholder="Course code (e.g. CS-204)"
            value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm sm:col-span-1"
          />
          <input
            placeholder="Short description (optional)"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm sm:col-span-1"
          />
          <button type="submit" className="sm:col-span-3 bg-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-650">
            Create course
          </button>
        </form>
      )}

      {showJoinCourse && (
        <form onSubmit={joinCourse} className="bg-white rounded-2xl border border-ink/10 p-6 mb-8 space-y-3">
          <p className="text-sm text-ink/60">Ask your teacher for the course ID to join.</p>
          {message && <p className="text-sm text-clay">{message}</p>}
          <div className="flex gap-3">
            <input
              required placeholder="Course ID"
              value={joinCourseId} onChange={(e) => setJoinCourseId(e.target.value)}
              className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            <button type="submit" className="bg-ink text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-indigo-650">
              Join
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-ink/40">Loading courses…</p>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-ink/20 p-12 text-center">
          <p className="text-ink/50">
            {user.role === 'teacher' ? 'No courses yet — create your first one above.' : 'You haven\'t joined a course yet.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div key={course.id} className="bg-white rounded-2xl border border-ink/10 p-5 hover:border-indigo-650/40 transition-colors">
              <p className="text-xs font-medium text-indigo-650 uppercase tracking-wide">{course.code}</p>
              <h3 className="font-display text-lg font-semibold text-ink mt-1">{course.name}</h3>
              {course.description && <p className="text-sm text-ink/50 mt-1">{course.description}</p>}
              {user.role === 'teacher' && (
                <button
                  onClick={() => navigator.clipboard.writeText(course.id)}
                  className="text-xs text-ink/40 hover:text-indigo-650 mt-3 flex items-center gap-1 transition-colors"
                  title="Click to copy course ID"
                >
                  <span className="break-all">{course.id}</span>
                  <span className="flex-shrink-0 text-indigo-650">Copy</span>
                </button>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-2 mt-4">
                <Link to="/timetable" className="text-xs font-medium text-ink/60 hover:text-indigo-650">Schedule</Link>
                <Link to="/assessments" className="text-xs font-medium text-ink/60 hover:text-indigo-650">Assessments</Link>
                <Link to={`/call/${course.id}`} className="text-xs font-medium text-clay hover:text-clay/70">Start call</Link>
                {user.role === 'teacher' && (
                  <>
                    <Link to={`/courses/${course.id}/attendance`} className="text-xs font-medium text-ink/60 hover:text-indigo-650">Attendance</Link>
                    <button
                      onClick={() => downloadGrades(course.id, course.code)}
                      className="text-xs font-medium text-ink/60 hover:text-indigo-650"
                    >
                      Export grades
                    </button>
                    <button
                      onClick={() => deleteCourse(course.id, course.name)}
                      className="text-xs font-medium text-clay/70 hover:text-clay hover:underline"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
