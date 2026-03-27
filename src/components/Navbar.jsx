import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser: user, userData } = useAuth();
  const navigate = useNavigate();

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

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🥘</span>
          <span>Smart Food Waste Tracker</span>
        </Link>
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
