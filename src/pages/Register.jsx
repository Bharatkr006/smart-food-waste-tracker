import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('hostel'); // 'hostel' or 'ngo'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null); // { lat, lng }
  const [detecting, setDetecting] = useState(false);
  const navigate = useNavigate();

  const handleDetectLocation = () => {
    setDetecting(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setDetecting(false);
      },
      (err) => {
        setError("Error detecting location: " + err.message);
        setDetecting(false);
      }
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Store user data in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        name,
        email,
        address,
        role,
        location: location || { lat: 28.6139, lng: 77.2090 }, // Default to New Delhi if not detected
        createdAt: new Date().toISOString()
      });
      
      // Redirect based on role
      navigate(role === 'hostel' ? '/hostel-dashboard' : '/ngo-dashboard');
    } catch (err) {
      setError(err.message || "Failed to register.");
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create an Account</h1>
          <p>Join the Food Redistribution Network</p>
        </div>
        {error && <div style={{color: 'var(--primary)', margin: '1rem 0', textAlign: 'center', backgroundColor: '#f8d7da', padding: '10px', borderRadius: '4px'}}>{error}</div>}
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label>Name</label>
            <input 
              type="text" 
              placeholder="Enter your name or organization name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Address / Location Name</label>
            <input 
              type="text" 
              placeholder="e.g. Green Valley Hostel, Sector 12" 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="Enter your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="Create a password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="hostel">Hostel (Donor)</option>
              <option value="ngo">NGO (Receiver)</option>
            </select>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Location
              {location && <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '600' }}>✓ Detected</span>}
            </label>
            <button 
              type="button" 
              onClick={handleDetectLocation} 
              className="btn" 
              style={{ 
                width: '100%', 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '0.9rem'
              }}
              disabled={detecting}
            >
              {detecting ? "Detecting..." : location ? "Update My Location" : "🛰️ Detect My Current Location"}
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Required to find donors or NGOs near you.
            </p>
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '0.5rem'}} disabled={loading}>
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>
        <div style={{marginTop: '1.5rem', textAlign: 'center'}}>
          <p>Already have an account? <Link to="/login" style={{color: 'var(--primary)', fontWeight: '600'}}>Login</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;
