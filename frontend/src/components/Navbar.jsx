import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client';

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-full text-sm font-medium transition-colors ${
    isActive ? 'bg-ink text-white' : 'text-ink/70 hover:text-ink hover:bg-ink/5'
  }`;

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef();

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    const checkUnread = () => {
      client.get('/announcements/unread-count')
        .then(({ data }) => setUnreadCount(data.count))
        .catch(() => {});
      client.get('/notifications/unread-count')
        .then(({ data }) => setNotifUnreadCount(data.count))
        .catch(() => {});
    };
    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const goToAnnouncements = () => {
    navigate('/announcements');
    setUnreadCount(0);
  };

  const toggleNotifDropdown = () => {
    const opening = !showNotifDropdown;
    setShowNotifDropdown(opening);
    if (opening) {
      client.get('/notifications').then(({ data }) => setNotifications(data)).catch(() => {});
      client.post('/notifications/mark-read').catch(() => {});
      setNotifUnreadCount(0);
    }
  };

  const clickNotification = (n) => {
    setShowNotifDropdown(false);
    if (n.link) navigate(n.link);
  };

  return (
    <header className="sticky top-0 z-30 bg-mist/90 backdrop-blur border-b border-ink/10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-display text-xl font-semibold text-ink tracking-tight">EduConnect</span>
          <nav className="hidden sm:flex items-center gap-1">
            {user.role === 'admin' ? (
              <NavLink to="/admin" className={linkClass} end>Admin</NavLink>
            ) : (
              <>
                <NavLink to="/" className={linkClass} end>Dashboard</NavLink>
                <NavLink to="/timetable" className={linkClass}>Timetable</NavLink>
                <NavLink to="/assessments" className={linkClass}>Assessments</NavLink>
                <NavLink to="/announcements" className={linkClass}>Announcements</NavLink>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user.role !== 'admin' && (
            <button
              onClick={goToAnnouncements}
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/5 transition-colors"
              title="Announcements"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-clay text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {user.role !== 'admin' && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={toggleNotifDropdown}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/5 transition-colors"
                title="Notifications"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                {notifUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-clay text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl border border-ink/10 shadow-xl overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-ink/10">
                    <p className="text-sm font-medium text-ink">Notifications</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-ink/40 px-4 py-6 text-center">Nothing yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => clickNotification(n)}
                          className="w-full text-left px-4 py-3 hover:bg-mist transition-colors border-b border-ink/5 last:border-b-0"
                        >
                          <p className="text-sm text-ink/80">{n.message}</p>
                          <p className="text-xs text-ink/40 mt-1">{timeAgo(n.createdAt)}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ backgroundColor: user.avatarColor }}
            >
              {user.fullName.split(' ').map(p => p[0]).slice(0, 2).join('')}
            </span>
            <div className="hidden sm:block leading-tight">
              <p className="text-sm font-medium text-ink">{user.fullName}</p>
              <p className="text-xs text-ink/50 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="text-sm font-medium text-ink/60 hover:text-indigo-650 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-sm font-medium text-ink/60 hover:text-clay transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
