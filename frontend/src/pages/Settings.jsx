import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { user, updateAccount } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    setNameMessage('');
    try {
      await updateAccount({ fullName });
      setNameMessage('Saved.');
      setTimeout(() => setNameMessage(''), 3000);
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords don\u2019t match');
      return;
    }
    setSavingPassword(true);
    try {
      await updateAccount({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password updated.');
      setTimeout(() => setPasswordMessage(''), 3000);
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Account settings</h1>
      <p className="text-ink/50 mb-8">{user.email} · <span className="capitalize">{user.role}</span></p>

      <div className="bg-white rounded-2xl border border-ink/10 p-6 mb-6">
        <h3 className="font-medium text-ink mb-4">Profile</h3>
        <form onSubmit={saveName} className="space-y-3">
          {nameMessage && <p className="text-sm text-green-700 bg-green-500/10 rounded-lg px-3 py-2">{nameMessage}</p>}
          <div>
            <label className="text-xs font-medium text-ink/60">Full name</label>
            <input
              required value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={savingName || fullName === user.fullName} className="bg-ink text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-indigo-650 disabled:opacity-50">
            {savingName ? 'Saving…' : 'Save name'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-ink/10 p-6">
        <h3 className="font-medium text-ink mb-4">Change password</h3>
        <form onSubmit={savePassword} className="space-y-3">
          {passwordError && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-green-700 bg-green-500/10 rounded-lg px-3 py-2">{passwordMessage}</p>}
          <div>
            <label className="text-xs font-medium text-ink/60">Current password</label>
            <input
              type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">New password</label>
            <input
              type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60">Confirm new password</label>
            <input
              type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={savingPassword} className="bg-ink text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-indigo-650 disabled:opacity-50">
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
