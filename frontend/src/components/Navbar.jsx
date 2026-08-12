import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-full text-sm font-medium transition-colors ${
    isActive ? 'bg-ink text-white' : 'text-ink/70 hover:text-ink hover:bg-ink/5'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 bg-mist/90 backdrop-blur border-b border-ink/10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-display text-xl font-semibold text-ink tracking-tight">EduConnect</span>
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink to="/" className={linkClass} end>Dashboard</NavLink>
            <NavLink to="/timetable" className={linkClass}>Timetable</NavLink>
            <NavLink to="/assessments" className={linkClass}>Assessments</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
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
