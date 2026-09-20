import { useEffect, useState, useRef, useMemo } from 'react';
import { db } from '../config/firebase';
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, getDocs, orderBy, limit
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, sendNotification } from '../utils/notifications.jsx';

/* ─── Helpers ────────────────────────────────────────── */
const deg2rad = (d) => d * (Math.PI / 180);
const calcDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getUrgencyData = (expiryTime, now) => {
  if (!expiryTime) return { label: '', expired: false, type: 'success', pct: 100 };
  const expiry = new Date(expiryTime);
  const diffMs = expiry - now;
  if (diffMs <= 0) return { label: 'Expired', expired: true, type: 'danger', pct: 0 };
  const diffMins = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  const totalMins = (new Date(expiryTime) - new Date(expiryTime) + diffMs) / 60000;
  return {
    label: `${h > 0 ? h + 'h ' : ''}${m}m left`,
    expired: false,
    type: h < 1 ? 'warning' : 'success',
    pct: Math.min(100, Math.round((diffMins / 180) * 100)),
  };
};

const getPriority = (qty) => {
  const n = parseInt(qty, 10) || 0;
  if (n >= 20) return { label: 'High', color: '#ef4444', bg: '#fef2f2', dot: '🔴' };
  if (n >= 10) return { label: 'Medium', color: '#f59e0b', bg: '#fffbeb', dot: '🟡' };
  return { label: 'Low', color: '#10b981', bg: '#ecfdf5', dot: '🟢' };
};

const fmtTime = (ts) => {
  if (!ts) return 'Just now';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ', ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

/* ─── Sub-components ─────────────────────────────────── */
const StatCard = ({ label, value, color, icon, sub }) => (
  <div style={{
    background: '#fff',
    borderRadius: 12,
    padding: '1.1rem 1.25rem',
    borderLeft: `4px solid ${color}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
    </div>
    <div style={{ fontSize: '1.65rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{sub}</div>}
  </div>
);

const UrgencyBar = ({ pct, type }) => {
  const color = type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
  return (
    <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
    </div>
  );
};

/* ─── Available Listing Card ─────────────────────────── */
const AvailableCard = ({ item, onAccept, now }) => {
  const urgency = getUrgencyData(item.expiryTime, now);
  const priority = getPriority(item.quantity);
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept(item.id);
    setAccepting(false);
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      border: '1px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      transition: 'box-shadow 0.2s, transform 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Card top accent */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${priority.color}, ${urgency.type === 'warning' ? '#f59e0b' : '#10b981'})` }} />

      <div style={{ padding: '1rem 1.1rem 0' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
            borderRadius: 20, background: priority.bg, color: priority.color,
            border: `1px solid ${priority.color}22`
          }}>
            {priority.dot} {priority.label} Priority
          </span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
            borderRadius: 20, background: '#dcfce7', color: '#166534'
          }}>
            ✅ Available
          </span>
        </div>

        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: 3 }}>{item.title}</h3>
        <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 10 }}>
          🏫 {item.hostelName}
          {item.distance != null ? ` · 📍 ${item.distance.toFixed(1)} km away` : ''}
        </p>

        {/* Urgency */}
        {item.expiryTime && (
          <>
            <UrgencyBar pct={urgency.pct} type={urgency.type} />
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: urgency.type === 'danger' ? '#ef4444' : urgency.type === 'warning' ? '#f59e0b' : '#059669', marginBottom: 10 }}>
              ⏱ {urgency.label}
            </div>
          </>
        )}

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 12, border: '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Portions</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{item.quantity}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Est. Weight</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>~{((parseInt(item.quantity) || 0) * 0.4).toFixed(1)} kg</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Location</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{item.locationName || 'Main Campus'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Posted</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{fmtTime(item.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '0 1.1rem 1rem', marginTop: 'auto' }}>
        {item.location && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lng}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6',
              padding: '7px 0', border: '1px solid #bfdbfe', borderRadius: 8,
              marginBottom: 8, textDecoration: 'none', background: '#eff6ff',
              transition: 'background 0.2s',
            }}
          >
            🗺️ Get Directions
          </a>
        )}
        <button
          onClick={handleAccept}
          disabled={urgency.expired || accepting}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem',
            background: urgency.expired ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', cursor: urgency.expired ? 'not-allowed' : 'pointer',
            border: 'none', transition: 'opacity 0.2s',
            opacity: accepting ? 0.7 : 1,
          }}
        >
          {accepting ? '⏳ Accepting…' : urgency.expired ? '⛔ Unavailable' : '🤝 Accept Pickup'}
        </button>
      </div>
    </div>
  );
};

/* ─── Accepted Pickup Card ───────────────────────────── */
const AcceptedCard = ({ item, onMarkPickedUp, now }) => {
  const urgency = getUrgencyData(item.expiryTime, now);
  const priority = getPriority(item.quantity);
  const [marking, setMarking] = useState(false);

  const handleMark = async () => {
    setMarking(true);
    await onMarkPickedUp(item);
    setMarking(false);
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      border: '2px solid #a7f3d0',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
      <div style={{ padding: '1rem 1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: '#dcfce7', color: '#065f46' }}>
            📍 Active Pickup
          </span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
            borderRadius: 20, background: priority.bg, color: priority.color,
          }}>
            {priority.dot} {priority.label}
          </span>
        </div>

        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: 3 }}>{item.title}</h3>
        <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 10 }}>
          🏫 From {item.hostelName} · 📦 {item.quantity} portions (~{((parseInt(item.quantity) || 0) * 0.4).toFixed(1)} kg)
        </p>

        {item.expiryTime && (
          <>
            <UrgencyBar pct={urgency.pct} type={urgency.type} />
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: urgency.type === 'danger' ? '#ef4444' : urgency.type === 'warning' ? '#f59e0b' : '#059669', marginBottom: 10 }}>
              ⏱ {urgency.expired ? 'Pickup window expired' : urgency.label}
            </div>
          </>
        )}

        {/* Confirmed notice */}
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
          <p style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600, marginBottom: 4 }}>
            ✅ You've confirmed this pickup. Head to the location!
          </p>
          <p style={{ fontSize: '0.75rem', color: '#047857' }}>
            Location: <strong>{item.locationName || 'Main Campus'}</strong>
          </p>
        </div>

        {/* Impact preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Meals', value: item.quantity, icon: '🍽️' },
            { label: 'CO₂e', value: `${((parseInt(item.quantity) || 0) * 0.4 * 2.5).toFixed(1)}kg`, icon: '🌍' },
            { label: 'Value', value: `₹${((parseInt(item.quantity) || 0) * 28).toLocaleString()}`, icon: '💰' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 6px', textAlign: 'center', border: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: '0.9rem' }}>{icon}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>{value}</div>
              <div style={{ fontSize: '0.6rem', color: '#9ca3af' }}>{label}</div>
            </div>
          ))}
        </div>

        {item.location && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lng}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6', padding: '7px 0',
              border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 10,
              textDecoration: 'none', background: '#eff6ff',
            }}
          >
            🧭 Open in Google Maps
          </a>
        )}

        <button
          onClick={handleMark}
          disabled={marking}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem',
            background: marking ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: '#fff', border: 'none', cursor: marking ? 'not-allowed' : 'pointer',
            opacity: marking ? 0.8 : 1,
          }}
        >
          {marking ? '⏳ Updating…' : '✅ Mark as Picked Up'}
        </button>
      </div>
    </div>
  );
};

/* ─── History Row ────────────────────────────────────── */
const HistoryRow = ({ item }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 16px', borderRadius: 10, background: '#fff',
    border: '1px solid #e5e7eb', marginBottom: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }}>
    <span style={{ fontSize: '1.5rem' }}>✅</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>From {item.hostelName} · {fmtTime(item.updatedAt || item.createdAt)}</div>
    </div>
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>{item.quantity} meals</div>
      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>~₹{((parseInt(item.quantity) || 0) * 28).toLocaleString()}</div>
    </div>
  </div>
);

/* ─── Main NGO Dashboard ─────────────────────────────── */
const NgoDashboard = () => {
  const { currentUser, userData } = useAuth();
  const [listings, setListings] = useState({ available: [], myAccepted: [] });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'accepted' | 'history'
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('priority'); // 'priority' | 'distance' | 'quantity' | 'time'
  const [now, setNow] = useState(new Date());
  const knownIds = useRef([]);
  const prevAcceptedRef = useRef(new Map());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* Real-time listings */
  useEffect(() => {
    if (!currentUser || !userData) {
      if (!currentUser) setLoading(false);
      return;
    }
    requestNotificationPermission();

    const q = query(collection(db, 'listings'), where('status', 'in', ['Available', 'Accepted']));
    const unsub = onSnapshot(q, (snap) => {
      const all = [];
      snap.forEach((d) => {
        const data = d.data();
        let distance = null;
        if (userData.location && data.location) {
          distance = calcDistance(userData.location.lat, userData.location.lng, data.location.lat, data.location.lng);
        }
        all.push({ id: d.id, ...data, distance });
      });

      // New-listing notifications
      if (knownIds.current.length > 0) {
        const newItems = all.filter(i => !knownIds.current.includes(i.id) && i.status === 'Available');
        if (newItems.length > 0) {
          sendNotification('New Food Alert! 🥘', `${newItems[0].hostelName} posted: ${newItems[0].title}`);
        }
      }
      knownIds.current = all.map(i => i.id);

      const myAccepted = all.filter(l => l.status === 'Accepted' && l.ngoId === currentUser.uid);
      const available = all.filter(l => l.status === 'Available');

      // Pickup-complete notifications
      prevAcceptedRef.current.forEach((prev, id) => {
        if (!myAccepted.some(l => l.id === id)) {
          sendNotification('Pickup Completed! ✅', `Pickup for ${prev.title} from ${prev.hostelName} is marked complete.`);
        }
      });
      const map = new Map();
      myAccepted.forEach(l => map.set(l.id, l));
      prevAcceptedRef.current = map;

      setListings({ available, myAccepted });
      setLoading(false);
    }, (err) => { console.error('NGO sync error:', err); setLoading(false); });

    return () => unsub();
  }, [currentUser, userData]);

  /* Pickup history */
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'listings'),
      where('ngoId', '==', currentUser.uid),
      where('status', '==', 'Picked Up'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [currentUser]);

  const handleAccept = async (listingId) => {
    try {
      await updateDoc(doc(db, 'listings', listingId), {
        status: 'Accepted',
        ngoId: currentUser.uid,
        ngoName: userData.name,
      });
    } catch (e) {
      console.error(e);
      alert('Failed to accept. Please retry.');
    }
  };

  const handlePickedUp = async (pickup) => {
    try {
      await updateDoc(doc(db, 'listings', pickup.id), { status: 'Picked Up' });
      if (pickup.logId) {
        await updateDoc(doc(db, 'foodLogs', pickup.logId), { status: 'picked-up' });
      } else {
        const snap = await getDocs(query(collection(db, 'foodLogs'), where('hostelId', '==', pickup.hostelId), where('title', '==', pickup.title)));
        snap.forEach(async (d) => updateDoc(d.ref, { status: 'picked-up' }));
      }
    } catch (e) {
      console.error(e);
      alert('Failed to update. Please retry.');
    }
  };

  /* Sort + filter */
  const priorityMap = { High: 3, Medium: 2, Low: 1 };
  const sortFn = (a, b) => {
    if (sortBy === 'quantity') return (parseInt(b.quantity) || 0) - (parseInt(a.quantity) || 0);
    if (sortBy === 'distance') {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    }
    if (sortBy === 'time') return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
    // priority (default)
    const pA = priorityMap[getPriority(a.quantity).label] || 0;
    const pB = priorityMap[getPriority(b.quantity).label] || 0;
    return pB !== pA ? pB - pA : (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
  };

  const filterSearch = (list) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(i => i.title?.toLowerCase().includes(q) || i.hostelName?.toLowerCase().includes(q) || i.locationName?.toLowerCase().includes(q));
  };

  const visibleAvailable = useMemo(() => filterSearch(listings.available.filter(i => !getUrgencyData(i.expiryTime, now).expired)).sort(sortFn), [listings.available, search, sortBy, now]);
  const visibleAccepted = useMemo(() => listings.myAccepted.slice().sort(sortFn), [listings.myAccepted, sortBy]);

  /* Lifetime stats */
  const totalMeals = history.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
  const totalKg = (totalMeals * 0.4).toFixed(1);
  const totalCo2 = (totalMeals * 0.4 * 2.5).toFixed(1);
  const totalValue = totalMeals * 28;

  const tabs = [
    { id: 'available', label: 'Available', count: visibleAvailable.length, color: '#10b981' },
    { id: 'accepted', label: 'My Pickups', count: visibleAccepted.length, color: '#3b82f6' },
    { id: 'history', label: 'History', count: history.length, color: '#8b5cf6' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading NGO portal…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <div className="container page-content">

        {/* ── Hero Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
          borderRadius: 16, padding: '1.75rem 2rem', color: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem',
          boxShadow: '0 10px 30px -5px rgba(6,95,70,0.35)',
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              NGO Food Rescue Portal
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              Welcome, {userData?.name || 'Partner NGO'} 👋
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#d1fae5', marginTop: 4 }}>
              {visibleAvailable.length > 0
                ? `🔔 ${visibleAvailable.length} surplus listing${visibleAvailable.length > 1 ? 's' : ''} available for pickup right now`
                : 'No active listings at the moment. Check back soon.'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#a7f3d0', marginBottom: 2 }}>Lifetime Impact</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalMeals} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>meals rescued</span></div>
            <div style={{ fontSize: '0.8rem', color: '#d1fae5' }}>{totalKg} kg · {totalCo2} kg CO₂e saved</div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.9rem', marginBottom: '1.5rem' }}>
          <StatCard label="Available Now" value={visibleAvailable.length} color="#10b981" icon="🟢" sub={`${visibleAvailable.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0)} total portions`} />
          <StatCard label="Active Pickups" value={visibleAccepted.length} color="#3b82f6" icon="🚚" sub="Currently accepted by you" />
          <StatCard label="Completed Rescues" value={history.length} color="#8b5cf6" icon="✅" sub={`${totalMeals} portions total`} />
          <StatCard label="Est. Value Rescued" value={`₹${totalValue.toLocaleString()}`} color="#f59e0b" icon="💰" sub={`CO₂e: ${totalCo2} kg avoided`} />
        </div>

        {/* ── Tabs + Toolbar ── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: '1.25rem', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {/* Tab row */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  flex: 1, padding: '13px 8px', fontWeight: 700, fontSize: '0.85rem',
                  color: activeTab === t.id ? t.color : '#6b7280',
                  borderBottom: activeTab === t.id ? `3px solid ${t.color}` : '3px solid transparent',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === t.id ? `3px solid ${t.color}` : '3px solid transparent',
                  cursor: 'pointer', transition: 'color 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {t.label}
                <span style={{
                  fontSize: '0.65rem', fontWeight: 800, padding: '1px 7px',
                  borderRadius: 20, background: activeTab === t.id ? t.color : '#f3f4f6',
                  color: activeTab === t.id ? '#fff' : '#6b7280',
                }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search + Sort (only for available) */}
          {activeTab === 'available' && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="🔍 Search by food name, hostel, or location…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', color: '#374151', fontWeight: 600, minWidth: 150 }}
              >
                <option value="priority">Sort: Priority</option>
                <option value="distance">Sort: Distance</option>
                <option value="quantity">Sort: Quantity</option>
                <option value="time">Sort: Newest</option>
              </select>
            </div>
          )}
        </div>

        {/* ── Tab Content ── */}

        {activeTab === 'available' && (
          visibleAvailable.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '4rem 2rem',
              background: '#f9fafb', borderRadius: 14, border: '2px dashed #e5e7eb', color: '#6b7280',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🍽️</div>
              <h3 style={{ fontSize: '1.1rem', color: '#374151', fontWeight: 700, marginBottom: 6 }}>
                {search ? 'No listings match your search' : 'No Surplus Available Right Now'}
              </h3>
              <p style={{ fontSize: '0.85rem' }}>
                {search ? 'Try a different search term.' : 'Partner hostels will post surplus food here. You\'ll be notified instantly when new listings appear.'}
              </p>
              {search && (
                <button onClick={() => setSearch('')} style={{ marginTop: 12, padding: '8px 20px', background: '#10b981', color: '#fff', borderRadius: 8, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {visibleAvailable.map(item => (
                <AvailableCard key={item.id} item={item} onAccept={handleAccept} now={now} />
              ))}
            </div>
          )
        )}

        {activeTab === 'accepted' && (
          visibleAccepted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f9fafb', borderRadius: 14, border: '2px dashed #e5e7eb', color: '#6b7280' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🚚</div>
              <h3 style={{ fontSize: '1.1rem', color: '#374151', fontWeight: 700, marginBottom: 6 }}>No Active Pickups</h3>
              <p style={{ fontSize: '0.85rem' }}>Accept a listing from the Available tab to start a rescue mission!</p>
              <button onClick={() => setActiveTab('available')} style={{ marginTop: 12, padding: '8px 20px', background: '#10b981', color: '#fff', borderRadius: 8, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                Browse Available →
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {visibleAccepted.map(item => (
                <AcceptedCard key={item.id} item={item} onMarkPickedUp={handlePickedUp} now={now} />
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          <div>
            {/* History stats banner */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.75rem', marginBottom: '1.25rem',
            }}>
              {[
                { label: 'Total Pickups', value: history.length, icon: '📦', color: '#8b5cf6' },
                { label: 'Meals Rescued', value: totalMeals, icon: '🍽️', color: '#10b981' },
                { label: 'Food (kg)', value: `${totalKg} kg`, icon: '⚖️', color: '#3b82f6' },
                { label: 'CO₂e Avoided', value: `${totalCo2} kg`, icon: '🌍', color: '#06b6d4' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #e5e7eb', borderTop: `3px solid ${color}`, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem' }}>{icon}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color, marginTop: 4 }}>{value}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{label}</div>
                </div>
              ))}
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f9fafb', borderRadius: 14, border: '2px dashed #e5e7eb', color: '#6b7280' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📜</div>
                <h3 style={{ fontSize: '1.1rem', color: '#374151', fontWeight: 700, marginBottom: 6 }}>No Completed Pickups Yet</h3>
                <p style={{ fontSize: '0.85rem' }}>Your completed pickup history will appear here. Start rescuing food!</p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: 10 }}>
                  Showing last {history.length} completed pickups
                </div>
                {history.map(item => <HistoryRow key={item.id} item={item} />)}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default NgoDashboard;
