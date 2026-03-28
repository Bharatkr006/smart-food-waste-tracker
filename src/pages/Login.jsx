import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Fetch user role for redirection
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.role === 'hostel') {
          navigate('/hostel-dashboard');
        } else if (userData.role === 'ngo') {
          navigate('/ngo-dashboard');
        } else {
          navigate('/'); // fallback
        }
      } else {
        // No user document found, fallback to hostel
        navigate('/hostel-dashboard');
      }
    } catch (err) {
      setError("Failed to login. Please check your credentials.");
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header" style={{ textAlign: 'center' }}>
          <img src="/logo.png?v=2" alt="Smart Food Waste Tracker" style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '1rem' }} />
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>
        {error && <div style={{color: 'var(--primary)', marginBottom: '1rem', textAlign: 'center'}}>{error}</div>}
        <form onSubmit={handleLogin}>
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
              placeholder="Enter your password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%'}} disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
        <div style={{marginTop: '1.5rem', textAlign: 'center'}}>
          <p>Don't have an account? <Link to="/register" style={{color: 'var(--primary)', fontWeight: '600'}}>Sign Up</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
