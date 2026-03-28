import { Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser: user, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const role = userData?.role;
  const dashboardLink = role === 'ngo' ? '/ngo-dashboard' : '/hostel-dashboard';
  const isHostelDashboard = location.pathname.startsWith('/hostel-dashboard');

  const toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  };

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Mobile sidebar toggle - only on hostel dashboard */}
          {user && role === 'hostel' && isHostelDashboard && (
            <button
              onClick={toggleSidebar}
              className="sidebar-toggle"
              aria-label="Toggle sidebar"
              id="sidebar-toggle-btn"
            >
              ☰
            </button>
          )}
          <Link to="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png?v=2" alt="Logo" style={{ height: '32px', width: '32px', objectFit: 'contain' }} />
            <span>Smart Food Waste Tracker</span>
          </Link>
        </div>
        <ul className="navbar-nav">
          {user ? (
            <>
              <li><Link to={dashboardLink} className="nav-link">Dashboard</Link></li>
              <li><Link to="/profile" className="nav-link">Settings ⚙️</Link></li>
              <li><button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 16px' }}>Logout</button></li>
            </>
          ) : (
             <>
               <li><Link to="/login" className="nav-link">Login</Link></li>
               <li><Link to="/register" className="btn btn-primary" style={{ padding: '6px 16px' }}>Sign Up</Link></li>
             </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
