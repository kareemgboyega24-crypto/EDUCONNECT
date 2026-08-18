import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPassword() {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('request'); // 'request' -> 'reset'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await forgotPassword(email);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend code');
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords don\u2019t match');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, newPassword);
      navigate('/login', { state: { passwordReset: true } });
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
          <h1 className="font-display text-4xl font-semibold text-white drop-shadow-md">
            {step === 'request' ? 'Reset your password' : 'Check your email'}
          </h1>
          <p className="text-white/80 mt-2 text-sm drop-shadow">
            {step === 'request'
              ? 'Works for both lecturer and student accounts.'
              : <>We sent a 6-digit code to <span className="font-medium text-white">{email}</span></>}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleRequest} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 space-y-4">
            {error && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{error}</p>}

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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-650 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending\u2026' : 'Send reset code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 space-y-4">
            {error && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{error}</p>}
            {resent && <p className="text-sm text-green-700 bg-green-500/10 rounded-lg px-3 py-2">A new code has been sent.</p>}

            <div>
              <label className="text-xs font-medium text-ink/60">Reset code</label>
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
            <div>
              <label className="text-xs font-medium text-ink/60">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-650"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink/60">Confirm new password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-650"
                placeholder="Re-enter new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-ink text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-650 transition-colors disabled:opacity-50"
            >
              {loading ? 'Resetting\u2026' : 'Reset password'}
            </button>

            <button
              type="button"
              onClick={handleResend}
              className="w-full text-sm text-ink/60 hover:text-indigo-650 transition-colors"
            >
              Didn't get a code? Resend
            </button>
          </form>
        )}

        <p className="text-center text-sm text-white/80 mt-6 drop-shadow">
          <Link to="/login" className="text-white font-medium underline underline-offset-2">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
