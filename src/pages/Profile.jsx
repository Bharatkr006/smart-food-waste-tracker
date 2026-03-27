import { useState } from 'react';
import { db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { currentUser, userData, updateUser } = useAuth();
  const [address, setAddress] = useState(userData?.address || '');
  const [location, setLocation] = useState(userData?.location || null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(newLocation);
        setMessage("Current GPS location captured! 📍");
      }, (error) => {
        console.error("Error getting location", error);
        alert("Could not get your location. Please ensure location permissions are enabled.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsUpdating(true);
    setMessage('');

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updateData = {
        address,
        location
      };
      
      await updateDoc(userRef, updateData);
      updateUser(updateData);
      setMessage("Profile updated successfully! ✅");
      
      // Redirect back to dashboard after 1.5s
      setTimeout(() => {
        navigate(userData.role === 'hostel' ? '/hostel-dashboard' : '/ngo-dashboard');
      }, 1500);
      
    } catch (error) {
      console.error("Update error", error);
      setMessage("Failed to update profile. Please try again.");
    }
    setIsUpdating(false);
  };

  return (
    <div className="dashboard-layout">
      <div className="container page-content" style={{maxWidth: '500px'}}>
        <div className="page-header" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
          <h1 className="page-title">Profile Settings</h1>
          <p className="page-subtitle">Update your location and address details</p>
        </div>

        <div className="card">
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Organization Name</label>
              <input type="text" value={userData?.name || ''} disabled style={{backgroundColor: '#f3f4f6', cursor: 'not-allowed'}} />
            </div>

            <div className="form-group">
              <label>Role</label>
              <input type="text" value={userData?.role?.toUpperCase() || ''} disabled style={{backgroundColor: '#f3f4f6', cursor: 'not-allowed'}} />
            </div>

            <div className="form-group">
              <label>Full Address</label>
              <textarea 
                placeholder="Enter your detailed address..." 
                value={address} 
                onChange={(e) => setAddress(e.target.value)}
                required
                style={{height: '100px', resize: 'none'}}
              />
            </div>

            <div className="form-group">
              <label>GPS Coordinates</label>
              <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center'}}>
                <div style={{flex: 1, padding: '8px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', border: '1px solid var(--border)'}}>
                  {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'No coordinates set'}
                </div>
                <button type="button" onClick={handleGetLocation} className="btn btn-primary" style={{padding: '8px 12px', fontSize: '0.8rem'}}>
                  📍 Get GPS
                </button>
              </div>
              <p style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>
                Use "Get GPS" button while standing at your location for better accuracy.
              </p>
            </div>

            <div style={{marginTop: '2rem'}}>
              <button type="submit" className="btn btn-primary" style={{width: '100%'}} disabled={isUpdating}>
                {isUpdating ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
              <button type="button" className="btn btn-secondary" style={{width: '100%', marginTop: '0.75rem'}} onClick={() => navigate(-1)}>
                Cancel
              </button>
            </div>

            {message && <p style={{marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: message.includes('✅') ? 'var(--primary)' : 'red', fontWeight: '500'}}>{message}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
