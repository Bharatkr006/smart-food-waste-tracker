import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import HostelDashboard from './pages/HostelDashboard';
import AIInsights from './pages/AIInsights';
import FoodLogs from './pages/FoodLogs';
import NgoDashboard from './pages/NgoDashboard';
import Navbar from './components/Navbar';
import HostelLayout from './components/HostelLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function AppRoutes() {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <div style={{textAlign: 'center', padding: '3rem'}}>Initializing...</div>;

  return (
    <Routes>
      <Route path="/" element={
        currentUser ? (
          userData?.role === 'hostel' ? <Navigate to="/hostel-dashboard" /> : <Navigate to="/ngo-dashboard" />
        ) : <Navigate to="/login" />
      } />
      <Route path="/login" element={!currentUser ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!currentUser ? <Register /> : <Navigate to="/" />} />

      {/* Hostel Dashboard - Nested Routes with Sidebar Layout */}
      <Route
        path="/hostel-dashboard"
        element={
          <ProtectedRoute requiredRole="hostel">
            <HostelLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HostelDashboard />} />
        <Route path="insights" element={<AIInsights />} />
        <Route path="logs" element={<FoodLogs />} />
      </Route>

      <Route
        path="/ngo-dashboard"
        element={
          <ProtectedRoute requiredRole="ngo">
            <NgoDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Toaster />
          <Navbar />
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
