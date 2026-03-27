import { useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const HostelDashboard = () => {
  const { currentUser, userData } = useAuth();
  const [listings, setListings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State... (rest of state remains same)
  const [foodItem, setFoodItem] = useState('');
  const [mealType, setMealType] = useState('Lunch');
  const [prepared, setPrepared] = useState('');
  const [consumed, setConsumed] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // AI Insights State
  const [insight, setInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    
    let unsubscribeListings = null;
    let unsubscribeLogs = null;

    // Subscribe to Active Listings
    const qListings = query(
      collection(db, 'listings'), 
      where('hostelId', '==', currentUser.uid)
    );
    unsubscribeListings = onSnapshot(qListings, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      fetched.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setListings(fetched);
      setLoading(false);
    });

    // Subscribe to Historical Logs (Last 15)
    // Subscribe to Historical Logs (Simplified query to avoid index requirements)
    const qLogs = query(
      collection(db, 'foodLogs'),
      where('hostelId', '==', currentUser.uid)
    );
    unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = fetchedLogs
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
        .slice(0, 15);
      setLogs([...sorted].reverse());
    }, (err) => {
      console.error("FoodLogs fetch error:", err);
    });

    return () => {
      if (unsubscribeListings) unsubscribeListings();
      if (unsubscribeLogs) unsubscribeLogs();
    };
  }, [currentUser]);

  // KPI Calculations
  const calculateKPIs = () => {
    if (logs.length === 0) return { prepared: 0, consumed: 0, waste: 0, wastePct: 0 };
    const totalPrepared = logs.reduce((acc, curr) => acc + (Number(curr.prepared) || 0), 0);
    const totalConsumed = logs.reduce((acc, curr) => acc + (Number(curr.consumed) || 0), 0);
    const totalWaste = Math.max(0, totalPrepared - totalConsumed);
    const wastePct = totalPrepared > 0 ? ((totalWaste / totalPrepared) * 100).toFixed(1) : 0;
    return { prepared: totalPrepared, consumed: totalConsumed, waste: totalWaste, wastePct };
  };

  const kpis = calculateKPIs();
  const surplus = Math.max(0, (Number(prepared) || 0) - (Number(consumed) || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!foodItem || prepared === '' || consumed === '') {
      setMessage("Please fill out all fields.");
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    const surplusVal = Number(surplus) || 0;
    const priority = surplusVal > 50 ? 'High' : surplusVal >= 20 ? 'Medium' : 'Low';
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    try {
      const fullTitle = `${mealType} - ${foodItem}`;

      // 1. Save to global 'foodLogs' (Always)
      await addDoc(collection(db, 'foodLogs'), {
        hostelId: currentUser.uid,
        hostelName: userData?.name || 'My Hostel',
        title: fullTitle,
        prepared: Number(prepared),
        consumed: Number(consumed),
        surplus: surplusVal,
        createdAt: serverTimestamp()
      });

      // 2. Save to 'listings' (Only if surplus exists)
      if (surplusVal > 0) {
        await addDoc(collection(db, 'listings'), {
          hostelId: currentUser.uid,
          hostelName: userData?.name || 'My Hostel',
          title: fullTitle,
          quantity: `${surplusVal}`,
          location: userData?.location || { lat: 28.6139, lng: 77.2090 },
          locationName: userData?.address || 'Main Campus',
          status: 'Available',
          priority,
          expiryTime: expiryTime.toISOString(),
          createdAt: serverTimestamp()
        });
        setMessage("Logged successfully! Listing created for surplus food. 🚀");
      } else {
        setMessage("Food log saved. No surplus today - excellent management! ✅");
      }

      setFoodItem('');
      setPrepared('');
      setConsumed('');
      console.log("Log stored successfully in foodLogs collection.");
    } catch (error) {
      console.error("Error saving log:", error);
      setMessage("Failed to save. Please check your connection.");
    }
    setIsSubmitting(false);
  };

  const generateInsights = async () => {
    if (logs.length === 0) {
      setInsight("No previous data available for AI analysis yet.");
      return;
    }
    setLoadingInsight(true);
    setInsight('');
    
    try {
      const promptData = logs.slice(-10).map(l => 
        `Item: ${l.title}, Prepared: ${l.prepared}, Consumed: ${l.consumed}, Waste: ${l.surplus}`
      ).join(' | ');

      const prompt = `Analyze these last 10 food logs for a hostel mess: ${promptData}. 
      Give 3 specific tips in EXACTLY this JSON format (no preamble, no markdown code blocks):
      {
        "prep": "precise quantity suggestion for tomorrow",
        "storage": "storage or recipe tip for leftovers",
        "milestone": "waste-reduction observation"
      }
      Keep it very professional and concise.`;
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setInsight({ error: "Gemini API key is missing. Please check your .env.local file." });
        setLoadingInsight(false);
        return;
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || response.statusText || `Status ${response.status}`;
        setInsight({ error: `AI Error: ${errorMsg}. Please verify your API key.` });
      } else {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        try {
          // Attempt to extract JSON even if AI adds clutter
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
          setInsight(parsed);
        } catch (e) {
          console.error("JSON Parse Error", e);
          setInsight({ milestone: text || "AI is currently refining your insights... please refresh." });
        }
      }
    } catch (err) {
      console.error("AI Insight Error:", err);
      setInsight("Error connecting to AI service. Please check your internet connection.");
    }
    setLoadingInsight(false);
  };

  if (loading) return <div style={{textAlign: 'center', padding: '3rem'}}>Loading analytics...</div>;

  return (
    <div className="dashboard-layout">
      <div className="container page-content" style={{ maxWidth: '1000px' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics Dashboard</h1>
            <p className="page-subtitle">{userData?.name}'s Food Management Center</p>
          </div>
        </div>

        {/* KPI Section */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem'}}>
          <div className="card" style={{padding: '1rem', borderTop: '4px solid var(--primary)'}}>
             <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600'}}>TOTAL PREPARED</span>
             <p style={{fontSize: '1.75rem', fontWeight: '700', marginTop: '0.5rem'}}>{kpis.prepared}</p>
          </div>
          <div className="card" style={{padding: '1rem', borderTop: '4px solid #3b82f6'}}>
             <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600'}}>TOTAL CONSUMED</span>
             <p style={{fontSize: '1.75rem', fontWeight: '700', marginTop: '0.5rem'}}>{kpis.consumed}</p>
          </div>
          <div className="card" style={{padding: '1rem', borderTop: '4px solid #f97316'}}>
             <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600'}}>TOTAL WASTE</span>
             <p style={{fontSize: '1.75rem', fontWeight: '700', marginTop: '0.5rem'}}>{kpis.waste}</p>
          </div>
          <div className="card" style={{padding: '1rem', borderTop: '4px solid #ef4444', backgroundColor: kpis.wastePct > 15 ? '#fef2f2' : 'var(--surface)'}}>
             <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600'}}>WASTE PERCENTAGE</span>
             <p style={{fontSize: '1.75rem', fontWeight: '700', marginTop: '0.5rem', color: kpis.wastePct > 15 ? '#dc2626' : 'inherit'}}>{kpis.wastePct}%</p>
          </div>
        </div>

        {/* Charts & Form Grid */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem'}}>
          {/* Input Form */}
          <div className="card">
            <h2 style={{fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '600'}}>New Meal Entry</h2>
            <form onSubmit={handleSubmit}>
              <div style={{display: 'flex', gap: '0.75rem', marginBottom: '1rem'}}>
                <div style={{flex: '0 0 120px'}}>
                  <label style={{fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)'}}>Category</label>
                  <select 
                    value={mealType} 
                    onChange={(e)=>setMealType(e.target.value)}
                    style={{width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', backgroundColor: '#f9fafb'}}
                  >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Dinner">Dinner</option>
                    <option value="Snack">Snack</option>
                  </select>
                </div>
                <div style={{flex: 1}}>
                  <label style={{fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)'}}>Meal Description</label>
                  <input type="text" placeholder="e.g. Rice/Dal, Sandwich" value={foodItem} onChange={(e)=>setFoodItem(e.target.value)} required />
                </div>
              </div>
              <div style={{display: 'flex', gap: '1rem'}}>
                <div className="form-group" style={{flex: 1}}>
                  <label>Prepared</label>
                  <input type="number" min="0" value={prepared} onChange={(e)=>setPrepared(e.target.value)} required />
                </div>
                <div className="form-group" style={{flex: 1}}>
                  <label>Consumed</label>
                  <input type="number" min="0" value={consumed} onChange={(e)=>setConsumed(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{width: '100%'}} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Log Entry'}
              </button>
              {message && <p style={{fontSize: '0.85rem', marginTop: '0.75rem', color: 'var(--primary)', fontWeight: '500'}}>{message}</p>}
            </form>
          </div>

          {/* Waste Trend Chart */}
          <div className="card">
            <h2 style={{fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '600'}}>Waste Trend (Last 15)</h2>
            <div style={{width: '100%', height: '220px'}}>
              <ResponsiveContainer>
                <LineChart data={logs}>
                  <XAxis dataKey="title" hide />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="surplus" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Analysis Bar Chart */}
        <div className="card" style={{marginBottom: '2rem'}}>
          <h2 style={{fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600'}}>Volume Comparison</h2>
          <div style={{width: '100%', height: '280px'}}>
            <ResponsiveContainer>
              <BarChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="title" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="prepared" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="consumed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insight Box */}
        <div className="card" style={{backgroundColor: '#f0fdfa', borderColor: '#ccfbf1', marginBottom: '2rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
             <h2 style={{fontSize: '1.1rem', fontWeight: '600', color: '#0f766e'}}>✨ AI Performance Insights</h2>
             <button onClick={generateInsights} className="btn" style={{backgroundColor: '#0f766e', color: 'white', fontSize: '0.8rem', padding: '6px 14px'}} disabled={loadingInsight}>
                {loadingInsight ? 'Analyzing...' : 'Refresh Insights'}
             </button>
          </div>
          {insight ? (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem'}}>
              {insight.error ? (
                <div style={{gridColumn: '1 / -1', color: '#dc2626', backgroundColor: '#fef2f2', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #fee2e2', fontSize: '0.9rem'}}>
                  ⚠️ {insight.error}
                </div>
              ) : (
                <>
                  <div style={{backgroundColor: 'white', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #99f6e4', boxShadow: 'var(--shadow-sm)'}}>
                    <h4 style={{fontSize: '0.8rem', color: '#0f766e', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px'}}>
                      📈 PREP SUGGESTION
                    </h4>
                    <p style={{fontSize: '0.9rem', color: '#134e4a', lineHeight: '1.5'}}>{insight.prep}</p>
                  </div>
                  <div style={{backgroundColor: 'white', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #99f6e4', boxShadow: 'var(--shadow-sm)'}}>
                    <h4 style={{fontSize: '0.8rem', color: '#0f766e', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px'}}>
                      🍳 STORAGE & RECIPE
                    </h4>
                    <p style={{fontSize: '0.9rem', color: '#134e4a', lineHeight: '1.5'}}>{insight.storage}</p>
                  </div>
                  <div style={{backgroundColor: 'white', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #99f6e4', boxShadow: 'var(--shadow-sm)'}}>
                    <h4 style={{fontSize: '0.8rem', color: '#0f766e', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px'}}>
                      🏆 PERFORMANCE MILESTONE
                    </h4>
                    <p style={{fontSize: '0.9rem', color: '#134e4a', lineHeight: '1.5'}}>{insight.milestone}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '1rem'}}>
              <p style={{color: '#0f766e', fontSize: '0.9rem', opacity: 0.8}}>Click refresh to analyze your recent logs and get advanced data-driven prep adjustments.</p>
            </div>
          )}
        </div>

        {/* History Table */}
        <div className="card" style={{overflowX: 'auto'}}>
          <h2 style={{fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '600'}}>Historical Food Logs</h2>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem'}}>
            <thead>
              <tr style={{borderBottom: '1.5px solid var(--border)', textAlign: 'left'}}>
                <th style={{padding: '12px 8px'}}>Item</th>
                <th style={{padding: '12px 8px'}}>Prepared</th>
                <th style={{padding: '12px 8px'}}>Consumed</th>
                <th style={{padding: '12px 8px'}}>Surplus</th>
                <th style={{padding: '12px 8px'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? [...logs].reverse().map(log => (
                <tr key={log.id} style={{borderBottom: '1px solid var(--border)'}}>
                  <td style={{padding: '12px 8px'}}>{log.title}</td>
                  <td style={{padding: '12px 8px'}}>{log.prepared}</td>
                  <td style={{padding: '12px 8px'}}>{log.consumed}</td>
                  <td style={{padding: '12px 8px', color: log.surplus > 0 ? 'var(--primary)' : 'inherit', fontWeight: log.surplus > 0 ? '600' : '400'}}>{log.surplus}</td>
                  <td style={{padding: '12px 8px'}}>
                    <span style={{fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: log.surplus > 0 ? '#eff6ff' : '#ecfdf5', color: log.surplus > 0 ? '#2563eb' : '#059669'}}>
                      {log.surplus > 0 ? 'Surplus Listed' : 'Zero Waste'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{padding: '24px', textAlign: 'center', color: 'var(--text-muted)'}}>No logs recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HostelDashboard;
