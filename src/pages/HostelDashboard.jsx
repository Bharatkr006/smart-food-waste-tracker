import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useHostelData } from '../context/HostelDataContext';
import { useAuth } from '../context/AuthContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FOOD_CATEGORIES, WASTE_TYPES } from '../utils/analyticsEngine';

const HostelDashboard = () => {
  const { userData } = useAuth();
  const { logs, kpis, actions, rescueFunnel, loading, addFoodLog, listings } = useHostelData();

  const acceptedPickups = listings?.filter(l => l.status === 'Accepted') || [];
  const activeActions = actions?.filter(a => a.status === 'active') || [];
  const suggestedActions = actions?.filter(a => a.status === 'suggested') || [];

  const handlePickedUp = async (pickup) => {
    try {
      if (!db) return;
      const listingRef = doc(db, 'listings', pickup.id);
      await updateDoc(listingRef, {
        status: 'Picked Up',
        pickedUpAt: new Date().toISOString()
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
  const [category, setCategory] = useState('grains');
  const [wasteType, setWasteType] = useState('overproduction');
  const [unit, setUnit] = useState('portions');
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
      const result = await addFoodLog({
        foodItem,
        mealType,
        category,
        wasteType,
        unit,
        prepared,
        consumed
      });

      if (result.surplus > 0) {
        setMessage("Logged successfully! Listing automatically created for NGO pickup. 🚀");
      } else {
        setMessage("Food log saved. Zero waste achieved on this meal! 🌟");
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

  if (loading) return <div className="subpage-loading"><div className="loading-spinner"></div><p>Loading dashboard...</p></div>;

  return (
    <div className="subpage-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="subpage-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="subpage-title">Operations Overview</h1>
          <p className="subpage-subtitle">{userData?.name || 'Hostel Mess'} Kitchen Intelligence</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/hostel-dashboard/analytics" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            📊 Deep Analytics
          </Link>
          <Link to="/hostel-dashboard/actions" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            ⚡ AI Actions ({suggestedActions.length})
          </Link>
        </div>
      </div>

      {/* AI Action Notification Banner */}
      {(suggestedActions.length > 0 || activeActions.length > 0) && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.25rem' }}>⚡</span>
            <div>
              <strong style={{ color: '#1e40af', fontSize: '0.9rem' }}>
                {activeActions.length > 0 ? `${activeActions.length} Active Reduction Goals in Progress` : `${suggestedActions.length} New AI Action Recommendations Ready`}
              </strong>
              <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>
                {activeActions.length > 0 ? activeActions[0].title : 'Review opportunities to trim surplus batches & optimize donation timing.'}
              </div>
            </div>
          </div>
          <Link to="/hostel-dashboard/actions" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Open Actions Board →
          </Link>
        </div>
      )}

      {/* Core KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-prepared">
          <span className="kpi-label">TOTAL PREPARED</span>
          <p className="kpi-value">{kpis.totalPrepared}</p>
          <div className="kpi-icon">🍽️</div>
        </div>
        <div className="kpi-card kpi-consumed">
          <span className="kpi-label">TOTAL CONSUMED</span>
          <p className="kpi-value">{kpis.totalConsumed}</p>
          <div className="kpi-icon">✅</div>
        </div>
        <div className="kpi-card kpi-waste">
          <span className="kpi-label">TOTAL SURPLUS</span>
          <p className="kpi-value">{kpis.totalSurplus}</p>
          <div className="kpi-icon">🍲</div>
        </div>
        <div className={`kpi-card kpi-pct ${kpis.wasteRate > 15 ? 'kpi-danger' : ''}`}>
          <span className="kpi-label">NET WASTE RATE</span>
          <p className="kpi-value">{kpis.wasteRate}%</p>
          <div className="kpi-icon">📉</div>
        </div>
      </div>

      {/* Active Pickups Section (NGO En Route) */}
      {acceptedPickups.length > 0 && (
        <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #34d399', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', color: '#065f46', fontWeight: '700' }}>🚚 Active Pickups (NGO Partner En Route)</h2>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#a7f3d0', color: '#065f46' }}>
              {acceptedPickups.length} In Transit
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {acceptedPickups.map(pickup => (
              <div key={pickup.id} style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{pickup.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Accepted by: <strong style={{ color: 'var(--text-main)' }}>{pickup.ngoName || 'NGO Partner'}</strong> ({pickup.quantity} portions)
                </p>
                <button 
                  onClick={() => handlePickedUp(pickup)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                >
                  Confirm Handover & Picked Up ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Food Rescue Funnel + Volume Comparison */}
      <div className="analytics-grid">
        {/* Input Form with Enhanced Categorization */}
        <div className="card analytics-form-card" style={{ padding: '1.5rem' }}>
          <h2 className="card-section-title" style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '1rem' }}>
            📝 Log Mess Meal
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-row">
              <div className="form-col form-col-sm">
                <label className="form-label-sm">Meal Type</label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="form-select"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snacks">Snacks</option>
                </select>
              </div>
              <div className="form-col">
                <label className="form-label-sm">Food Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-select"
                >
                  {FOOD_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label-sm">Meal Description</label>
              <input
                type="text"
                placeholder="e.g. Steamed Basmati Rice & Dal Makhani"
                value={foodItem}
                onChange={(e) => setFoodItem(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Prepared</label>
                <input type="number" min="0" value={prepared} onChange={(e) => setPrepared(e.target.value)} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Consumed</label>
                <input type="number" min="0" value={consumed} onChange={(e) => setConsumed(e.target.value)} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-col" style={{ flex: 1 }}>
                <label className="form-label-sm">Primary Waste Driver</label>
                <select value={wasteType} onChange={(e) => setWasteType(e.target.value)} className="form-select">
                  {WASTE_TYPES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </div>
              <div className="form-col" style={{ width: '110px' }}>
                <label className="form-label-sm">Unit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="form-select">
                  <option value="portions">Portions</option>
                  <option value="kg">Kg</option>
                </select>
              </div>
            </div>

            {/* Live surplus preview */}
            {(prepared !== '' && consumed !== '') && (
              <div className="surplus-preview" style={{ padding: '10px', backgroundColor: 'var(--bg)', borderRadius: '6px', fontSize: '0.85rem' }}>
                <span>Calculated Surplus:</span>
                <strong className={surplus > 0 ? 'surplus-positive' : 'surplus-zero'} style={{ marginLeft: '6px' }}>
                  {surplus} {unit} {surplus > 0 ? '(Will be listed for NGO)' : '(Zero Waste)'}
                </strong>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '4px' }} disabled={isSubmitting}>
              {isSubmitting ? 'Saving Log...' : 'Log Meal Entry'}
            </button>
            {message && <p className="form-message" style={{ fontSize: '0.85rem', marginTop: '6px' }}>{message}</p>}
          </form>
        </div>

        {/* Food Rescue Funnel Mini View */}
        <div className="card analytics-chart-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="card-section-title" style={{ fontSize: '1.15rem', fontWeight: '600' }}>
              🎯 Food Rescue Funnel
            </h2>
            <Link to="/hostel-dashboard/analytics" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
              Detailed View →
            </Link>
          </div>

          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rescueFunnel} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
                <YAxis dataKey="stage" type="category" stroke="var(--text-muted)" fontSize={11} width={80} />
                <Tooltip 
                  formatter={(val, name, item) => [`${val} portions`, item.payload.description]}
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Volume Comparison */}
      <div className="card analytics-volume-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="card-section-title" style={{ fontSize: '1.15rem', fontWeight: '600' }}>
            📊 Recent Meal Volume Comparison
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Prepared vs Consumed
          </span>
        </div>

        <div className="chart-container-lg" style={{ height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={logs}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="title" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
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
              <Bar dataKey="prepared" fill="#3b82f6" name="Prepared" radius={[4, 4, 0, 0]} />
              <Bar dataKey="consumed" fill="#10b981" name="Consumed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default HostelDashboard;

