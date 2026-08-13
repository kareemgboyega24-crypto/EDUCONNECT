import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import FloatingCallWidget from './components/FloatingCallWidget.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Timetable from './pages/Timetable.jsx';
import Assessments from './pages/Assessments.jsx';
import Announcements from './pages/Announcements.jsx';
import Settings from './pages/Settings.jsx';
import AssessmentDetail from './pages/AssessmentDetail.jsx';
import CallRoom from './pages/CallRoom.jsx';
import Attendance from './pages/Attendance.jsx';

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/call/:roomId" element={<ProtectedRoute><CallRoom /></ProtectedRoute>} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="relative min-h-screen">
                <div
                  className="fixed inset-0 -z-20 bg-cover bg-center"
                  style={{ backgroundImage: "url('/login-bg.jpg')" }}
                />
                <div className="fixed inset-0 -z-10 bg-mist/90" />
                <Navbar />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/timetable" element={<Timetable />} />
                  <Route path="/assessments" element={<Assessments />} />
                  <Route path="/announcements" element={<Announcements />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/assessments/:id" element={<AssessmentDetail />} />
                  <Route path="/courses/:id/attendance" element={<Attendance />} />
                </Routes>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
      <FloatingCallWidget />
    </div>
  );
}
