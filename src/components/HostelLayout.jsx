import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HostelDataProvider } from '../context/HostelDataContext';

const HostelLayout = () => {
  const { userData } = useAuth();

  const navItems = [
    { to: '/hostel-dashboard', icon: '📊', label: 'Analytics', end: true },
    { to: '/hostel-dashboard/insights', icon: '✨', label: 'AI Insights' },
    { to: '/hostel-dashboard/logs', icon: '📋', label: 'Food Logs' },
  ];

  return (
    <HostelDataProvider>
      <div className="hostel-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-avatar">
              {(userData?.name || 'H').charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user">
              <span className="sidebar-username">{userData?.name || 'Hostel'}</span>
              <span className="sidebar-role">Food Manager</span>
            </div>
          </div>

          <div className="sidebar-divider"></div>

          <nav className="sidebar-nav">
            <span className="sidebar-section-label">Dashboard</span>
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span className="sidebar-link-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-footer-badge">
              <span className="sidebar-footer-dot"></span>
              <span>Live Sync Active</span>
            </div>
          </div>
        </aside>

        <main className="hostel-main">
          <Outlet />
        </main>
      </div>
    </HostelDataProvider>
  );
};

export default HostelLayout;
