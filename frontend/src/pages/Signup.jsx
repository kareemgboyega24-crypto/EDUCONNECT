import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [adminInviteCode, setAdminInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signup(fullName, email, password, role, adminInviteCode);
      navigate('/verify', { state: { email: result.email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12 bg-cover bg-center relative"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-ink/80" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-semibold text-white drop-shadow-md">EduConnect</h1>
          <p className="text-white/80 mt-2 text-sm drop-shadow">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 space-y-4">
          {error && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="text-xs font-medium text-ink/60">I am a…</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {['student', 'teacher', 'admin'].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-lg py-2 text-sm font-medium capitalize border transition-colors ${
                    role === r ? 'bg-ink text-white border-ink' : 'bg-white border-ink/15 text-ink/70 hover:border-ink/30'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {role === 'admin' && (
            <div>
              <label className="text-xs font-medium text-ink/60">Admin invite code</label>
              <input
                required
                value={adminInviteCode}
                onChange={(e) => setAdminInviteCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-650"
                placeholder="Provided by your institution"
              />
              <p className="text-xs text-ink/40 mt-1">Admin accounts require a private invite code. Contact your existing administrator if you don't have one.</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-ink/60">Full name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-650"
              placeholder="Ada Lovelace"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-650"
              placeholder="you@school.edu"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-650"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-650 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-white/80 mt-6 drop-shadow">
          Already have an account? <Link to="/login" className="text-white font-medium underline underline-offset-2">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
