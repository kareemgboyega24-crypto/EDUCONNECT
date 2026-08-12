import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function VerifyEmail() {
  const { verify, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verify(email, code);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      await resendCode(email);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mist px-6">
        <div className="text-center">
          <p className="text-ink/60">No email to verify.</p>
          <Link to="/signup" className="text-indigo-650 font-medium">Back to sign up</Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12 bg-cover bg-center relative"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-ink/80" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-semibold text-white drop-shadow-md">Check your email</h1>
          <p className="text-white/80 mt-2 text-sm drop-shadow">
            We sent a 6-digit code to <span className="font-medium text-white">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 space-y-4">
          {error && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{error}</p>}
          {resent && <p className="text-sm text-green-700 bg-green-500/10 rounded-lg px-3 py-2">A new code has been sent.</p>}

          <div>
            <label className="text-xs font-medium text-ink/60">Verification code</label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoFocus
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-3 text-center text-2xl tracking-[0.5em] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-650"
              placeholder="------"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-650 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify and continue'}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full text-sm text-ink/60 hover:text-indigo-650 transition-colors disabled:opacity-50"
          >
            {resending ? 'Sending…' : "Didn't get a code? Resend"}
          </button>
        </form>
      </div>
    </div>
  );
}
