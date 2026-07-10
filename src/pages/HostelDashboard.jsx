import { useState } from 'react';
import { useHostelData } from '../context/HostelDataContext';
import { useAuth } from '../context/AuthContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const HostelDashboard = () => {
  const { userData } = useAuth();
  const { logs, kpis, loading, addFoodLog, listings } = useHostelData();

  const acceptedPickups = listings?.filter(l => l.status === 'Accepted') || [];

  const handlePickedUp = async (pickup) => {
    try {
      const listingRef = doc(db, 'listings', pickup.id);
      await updateDoc(listingRef, {
        status: 'Picked Up'
      });

      // Also update corresponding food log to accurately reflect UI
      if (pickup.logId) {
        const logRef = doc(db, 'foodLogs', pickup.logId);
        await updateDoc(logRef, { status: 'picked-up' });
      } else {
        // Fallback for legacy listings without logId
        const qLogs = query(collection(db, 'foodLogs'), where('hostelId', '==', pickup.hostelId), where('title', '==', pickup.title));
        const snap = await getDocs(qLogs);
        snap.forEach(async (logDoc) => {
          await updateDoc(logDoc.ref, { status: 'picked-up' });
        });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  // Form State
  const [foodItem, setFoodItem] = useState('');
  const [mealType, setMealType] = useState('Lunch');
  const [prepared, setPrepared] = useState('');
  const [consumed, setConsumed] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const surplus = Math.max(0, (Number(prepared) || 0) - (Number(consumed) || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!foodItem || prepared === '' || consumed === '') {
      setMessage("Please fill out all fields.");
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const result = await addFoodLog({ foodItem, mealType, prepared, consumed });

      if (result.surplus > 0) {
        setMessage("Logged successfully! Listing created for surplus food. 🚀");
      } else {
        setMessage("Food log saved. No surplus today - excellent management! ✅");
      }

      setFoodItem('');
      setPrepared('');
      setConsumed('');
    } catch (error) {
      console.error("Error saving log:", error);
      setMessage("Failed to save. Please check your connection.");
    }
    setIsSubmitting(false);
  };

  if (loading) return <div className="subpage-loading"><div className="loading-spinner"></div><p>Loading analytics...</p></div>;

  return (
    <div className="subpage-container">
      <div className="subpage-header">
        <div>
          <h1 className="subpage-title">Analytics Dashboard</h1>
          <p className="subpage-subtitle">{userData?.name}'s Food Management Center</p>
        </div>
      </div>

      {/* KPI Section */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-prepared">
          <span className="kpi-label">TOTAL PREPARED</span>
          <p className="kpi-value">{kpis.prepared}</p>
          <div className="kpi-icon">🍽️</div>
        </div>
        <div className="kpi-card kpi-consumed">
          <span className="kpi-label">TOTAL CONSUMED</span>
          <p className="kpi-value">{kpis.consumed}</p>
          <div className="kpi-icon">✅</div>
        </div>
        <div className="kpi-card kpi-waste">
          <span className="kpi-label">TOTAL WASTE</span>
          <p className="kpi-value">{kpis.waste}</p>
          <div className="kpi-icon">🗑️</div>
        </div>
        <div className={`kpi-card kpi-pct ${kpis.wastePct > 15 ? 'kpi-danger' : ''}`}>
          <span className="kpi-label">WASTE PERCENTAGE</span>
          <p className="kpi-value">{kpis.wastePct}%</p>
          <div className="kpi-icon">📉</div>
        </div>
      </div>

      {/* Active Pickups Section */}
      {acceptedPickups.length > 0 && (
        <div style={{ marginBottom: '2rem', backgroundColor: '#ecfdf5', border: '1px solid #34d399', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#065f46', marginBottom: '1rem', fontWeight: '600' }}>🚚 Active Pickups (NGO En Route)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {acceptedPickups.map(pickup => (
              <div key={pickup.id} style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '0.25rem' }}>{pickup.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Accepted by: <strong style={{color: 'var(--text-main)'}}>{pickup.ngoName || 'An NGO'}</strong>
                </p>
                <button 
                  onClick={() => handlePickedUp(pickup)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px' }}
                >
                  Mark Picked Up ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts & Form Grid */}
      <div className="analytics-grid">
        {/* Input Form */}
        <div className="card analytics-form-card">
          <h2 className="card-section-title">New Meal Entry</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-col form-col-sm">
                <label className="form-label-sm">Category</label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="form-select"
                  id="meal-type-select"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                </select>
              </div>
              <div className="form-col">
                <label className="form-label-sm">Meal Description</label>
                <input
                  type="text"
                  placeholder="e.g. Rice/Dal, Sandwich"
                  value={foodItem}
                  onChange={(e) => setFoodItem(e.target.value)}
                  required
                  id="food-item-input"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Prepared</label>
                <input type="number" min="0" value={prepared} onChange={(e) => setPrepared(e.target.value)} required id="prepared-input" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Consumed</label>
                <input type="number" min="0" value={consumed} onChange={(e) => setConsumed(e.target.value)} required id="consumed-input" />
              </div>
            </div>

            {/* Live surplus preview */}
            {(prepared !== '' && consumed !== '') && (
              <div className="surplus-preview">
                <span>Estimated surplus:</span>
                <strong className={surplus > 0 ? 'surplus-positive' : 'surplus-zero'}>{surplus} units</strong>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSubmitting} id="log-entry-btn">
              {isSubmitting ? 'Saving...' : 'Log Entry'}
            </button>
            {message && <p className="form-message">{message}</p>}
          </form>
        </div>

        {/* Waste Trend Chart */}
        <div className="card analytics-chart-card">
          <h2 className="card-section-title">Waste Trend (Last 15)</h2>
          <div className="chart-container">
            <ResponsiveContainer key={`trend-${logs.length}`}>
              <LineChart data={logs}>
                <XAxis dataKey="title" hide />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f9fafb',
                    fontSize: '0.85rem'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="surplus" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#10b981' }} 
                  activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2 }} 
                  connectNulls={true} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Volume Comparison */}
      <div className="card analytics-volume-card">
        <h2 className="card-section-title">Volume Comparison</h2>
        <div className="chart-container-lg">
          <ResponsiveContainer key={`volume-${logs.length}`}>
            <BarChart data={logs}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="title" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f9fafb',
                  fontSize: '0.85rem'
                }}
              />
              <Legend />
              <Bar dataKey="prepared" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="consumed" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default HostelDashboard;
