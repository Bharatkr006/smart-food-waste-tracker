import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import HostelDashboard from './pages/HostelDashboard';
import NgoDashboard from './pages/NgoDashboard';
import Navbar from './components/Navbar';
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
      <Route 
        path="/hostel-dashboard" 
        element={
          <ProtectedRoute requiredRole="hostel">
            <HostelDashboard />
          </ProtectedRoute>
        } 
      />
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

import Profile from './pages/Profile';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Navbar />
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
