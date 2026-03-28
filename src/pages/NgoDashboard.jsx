import { useEffect, useState, useRef } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import MapComponent from '../components/Map';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, sendNotification } from '../utils/notifications.jsx';

const NgoDashboard = () => {
  const { currentUser, userData } = useAuth();
  const [listings, setListings] = useState({ available: [], myAccepted: [] });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const knownIds = useRef([]);
  const previousAcceptedRef = useRef(new Map());
  const navigate = useNavigate();

  // Update current time every minute for the countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  // Haversine formula to calculate distance... (remains same)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);

  useEffect(() => {
    if (!currentUser || !userData) {
      // If user is loaded but data is missing, we might still be loading or unauthorized
      return;
    }

    requestNotificationPermission();
    
    const q = query(
      collection(db, 'listings'), 
      where('status', 'in', ['Available', 'Accepted'])
    );
    const unsubscribeSnap = onSnapshot(q, (querySnapshot) => {
      const fetchedListings = [];
      const currentIds = [];
      
      querySnapshot.forEach((listingDoc) => {
        const listingData = listingDoc.data();
        let distance = null;
        
        if (userData.location && listingData.location) {
          distance = calculateDistance(
            userData.location.lat, 
            userData.location.lng, 
            listingData.location.lat, 
            listingData.location.lng
          );
        }
        
        const listingWithId = { 
          id: listingDoc.id, 
          ...listingData,
          distance: distance
        };
        fetchedListings.push(listingWithId);
        currentIds.push(listingDoc.id);
      });

      // Logic to trigger toast for NEW listings (not on initial load)
      if (knownIds.current.length > 0) {
        const newItems = fetchedListings.filter(item => !knownIds.current.includes(item.id) && item.status === 'Available');
        if (newItems.length > 0) {
          const newTip = newItems[0];
          sendNotification("New Food Alert! 🥘", `${newTip.hostelName} just posted: ${newTip.title}`);
        }
      }
      knownIds.current = currentIds;

      // Filter and sort
      // 1. Current NGO's accepted items
      // 2. Available items
      const myAccepted = fetchedListings.filter(l => l.status === 'Accepted' && l.ngoId === currentUser.uid);
      const available = fetchedListings.filter(l => l.status === 'Available');

      const prevAcceptedMap = previousAcceptedRef.current;
      if (prevAcceptedMap.size > 0) {
        prevAcceptedMap.forEach((prevItem, id) => {
          if (!myAccepted.some(l => l.id === id)) {
            // It was accepted, now it's gone
            sendNotification("Pickup Completed! ✅", `The pickup for ${prevItem.title} from ${prevItem.hostelName} is complete.`);
          }
        });
      }

      // Update ref map
      const newAcceptedMap = new Map();
      myAccepted.forEach(l => newAcceptedMap.set(l.id, l));
      previousAcceptedRef.current = newAcceptedMap;

      const priorityMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
      
      const sortFunction = (a, b) => {
        // First sort by Priority
        const pA = priorityMap[a.priority] || 0;
        const pB = priorityMap[b.priority] || 0;
        if (pA !== pB) return pB - pA;
        
        // Then sort by Created Time (Newest First)
        const tA = a.createdAt?.toMillis() || 0;
        const tB = b.createdAt?.toMillis() || 0;
        if (tA !== tB) return tB - tA;
        
        // Finally sort by distance
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      };

      myAccepted.sort(sortFunction);
      available.sort(sortFunction);

      setListings({ available, myAccepted });
      setLoading(false);
    }, (err) => {
      console.error("NGO Dashboard sync error:", err);
      setLoading(false);
    });

    return () => {
      if (unsubscribeSnap) unsubscribeSnap();
    };
  }, [currentUser, userData]);

  const getUrgencyData = (expiryTime) => {
    if (!expiryTime) return { label: "", expired: false, type: "success" };
    
    const expiry = new Date(expiryTime);
    const diffMs = expiry - currentTime;
    
    if (diffMs <= 0) {
      return { label: "Expired", expired: true, type: "danger" };
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    
    return {
      label: `Expires in ${h > 0 ? h + 'h ' : ''}${m}m`,
      expired: false,
      type: h < 1 ? "warning" : "success"
    };
  };

  const getDynamicPriority = (quantity) => {
    const qty = parseInt(quantity, 10) || 0;
    if (qty >= 20) return 'High';
    if (qty >= 10) return 'Medium';
    return 'Low';
  };

  const handleAccept = async (listingId) => {
    try {
      const listingRef = doc(db, 'listings', listingId);
      await updateDoc(listingRef, {
        status: 'Accepted',
        ngoId: currentUser.uid,
        ngoName: userData.name
      });
    } catch (error) {
      console.error("Error accepting listing", error);
      alert("Failed to accept pickup. Please try again.");
    }
  };

  const handlePickedUp = async (pickup) => {
    try {
      const listingRef = doc(db, 'listings', pickup.id);
      await updateDoc(listingRef, {
        status: 'Picked Up'
      });

      // Also update corresponding food log to accurately reflect UI
      const qLogs = query(collection(db, 'foodLogs'), where('hostelId', '==', pickup.hostelId), where('title', '==', pickup.title));
      const snap = await getDocs(qLogs);
      snap.forEach(async (logDoc) => {
        await updateDoc(logDoc.ref, { status: 'picked-up' });
      });
    } catch (error) {
      console.error("Error marking as picked up:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' on ' + date.toLocaleDateString();
  };

  if (loading) {
    return <div style={{textAlign: 'center', padding: '3rem', color: 'var(--text-muted)'}}>Loading dashboard...</div>;
  }

  const visibleAvailable = listings.available.filter(item => !getUrgencyData(item.expiryTime).expired);

  return (
    <div className="dashboard-layout">
      <div className="container page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">NGO Dashboard</h1>
            <p className="page-subtitle">Welcome back, {userData?.name}</p>
          </div>
        </div>
        
        <h2 style={{marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: '600'}}>Available Food Pickups</h2>
        
        {visibleAvailable.length > 0 && <MapComponent listings={visibleAvailable} />}
        
        {visibleAvailable.length === 0 ? (
           <div style={{
             textAlign: 'center', 
             padding: '4rem 2rem', 
             backgroundColor: 'var(--surface)',
             borderRadius: 'var(--radius-md)',
             color: 'var(--text-muted)',
             border: '1px dashed var(--border)'
           }}>
              <h3 style={{fontSize: '1.15rem', marginBottom: '0.5rem', color: 'var(--text-main)', fontWeight: '500'}}>No Listings Available</h3>
              <p style={{fontSize: '0.95rem'}}>There are currently no active surplus food listings. Please check back later.</p>
           </div>
        ) : (
          <div className="card-grid">
            {visibleAvailable.map((item) => {
              const urgency = getUrgencyData(item.expiryTime);
              
              return (
                <Card 
                  key={item.id}
                  title={item.title}
                  meta={`Posted by: ${item.hostelName} • ${item.distance ? item.distance.toFixed(1) + ' km away' : 'Location Not Shared'}`}
                  badge={urgency.expired ? "Expired" : "Available"} 
                  badgeType={urgency.expired ? "danger" : "success"}
                  topBadge={`${getDynamicPriority(item.quantity) === 'High' ? '🔴' : getDynamicPriority(item.quantity) === 'Medium' ? '🟡' : '🟢'} ${getDynamicPriority(item.quantity)} Priority`}
                  topBadgeType={getDynamicPriority(item.quantity) === 'High' ? 'danger' : getDynamicPriority(item.quantity) === 'Medium' ? 'warning' : 'success'}
                  timer={urgency.label}
                  timerType={urgency.type}
                >
                  <div style={{backgroundColor: 'var(--bg-color)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem'}}>
                     <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                       <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Quantity</span>
                       <span style={{fontWeight: '500', fontSize: '0.9rem'}}>{item.quantity} portions</span>
                     </div>
                     <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-start'}}>
                        <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Location</span>
                        <div style={{textAlign: 'right'}}>
                          <div style={{fontWeight: '500', fontSize: '0.9rem'}}>{item.locationName || 'Main Campus'}</div>
                          {item.location && (
                            <a 
                              href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline'}}
                            >
                              Get Directions (Google Maps) 🗺️
                            </a>
                          )}
                        </div>
                      </div>
                     <div style={{display: 'flex', justifyContent: 'space-between'}}>
                       <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Time</span>
                       <span style={{fontWeight: '500', fontSize: '0.9rem'}}>{formatTime(item.createdAt)}</span>
                     </div>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    style={{width: '100%'}}
                    onClick={() => handleAccept(item.id)}
                    disabled={urgency.expired}
                  >
                    {urgency.expired ? "Pickup Unavailable" : "Accept Pickup"}
                  </button>
                </Card>
              );
            })}
          </div>
        )}

        {listings.myAccepted.length > 0 && (
          <div style={{marginTop: '3rem'}}>
            <h2 style={{marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: '600', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              ✅ My Accepted Pickups
            </h2>
            <div className="card-grid">
              {listings.myAccepted.map((item) => {
                const urgency = getUrgencyData(item.expiryTime);
                return (
                  <Card 
                    key={item.id}
                    title={item.title}
                    meta={`From: ${item.hostelName} • ${item.locationName || 'Main Campus'}`}
                    badge="Accepted" 
                    badgeType="success"
                    topBadge={`📍 Active Pickup (${getDynamicPriority(item.quantity)} Priority)`}
                    topBadgeType="primary"
                    timer={urgency.expired ? "Pickup Expired" : urgency.label}
                    timerType={urgency.expired ? "danger" : urgency.type}
                  >
                     <div style={{backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem'}}>
                        <p style={{fontSize: '0.85rem', color: '#065f46', fontWeight: '500'}}>You have accepted this pickup. Please reach the location soon!</p>
                        {item.location && (
                          <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{marginTop: '0.75rem', width: '100%', fontSize: '0.8rem', padding: '10px 0'}}
                          >
                            Open in Google Maps 🧭
                          </a>
                        )}
                     </div>
                     <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid var(--border)'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                           <span style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>Status</span>
                           <span style={{fontWeight: '600', fontSize: '0.85rem', color: 'var(--primary)'}}>Accepted</span>
                        </div>
                        <button 
                          onClick={() => handlePickedUp(item)}
                          className="btn btn-primary"
                          style={{padding: '6px 14px', fontSize: '0.8rem', borderRadius: '4px'}}
                        >
                          Mark Picked Up ✓
                        </button>
                     </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NgoDashboard;
