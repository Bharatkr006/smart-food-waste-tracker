import { useState, useMemo } from 'react';
import { useHostelData } from '../context/HostelDataContext';
import { useAuth } from '../context/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { calculateImpactTelemetry, calculateImpactTimeSeries } from '../utils/impactCalculator';

const ImpactDashboard = () => {
  const { listings, allLogs, loading } = useHostelData();
  const { userData } = useAuth();

  const impact = useMemo(() => calculateImpactTelemetry(listings, allLogs), [listings, allLogs]);
  const timeSeries = useMemo(() => calculateImpactTimeSeries(listings), [listings]);

  // Interactive Target Simulator State
  const [reductionTargetPct, setReductionTargetPct] = useState(15);
  const [showCertificate, setShowCertificate] = useState(false);

  // Simulated Annual Impact Calculation
  const totalPreparedWeekly = (allLogs || []).slice(-14).reduce((acc, l) => acc + (Number(l.prepared) || 0), 0) / 2 || 200;
  const simulatedWeeklySavedPortions = Math.round(totalPreparedWeekly * (reductionTargetPct / 100));
  const simulatedAnnualValue = simulatedWeeklySavedPortions * 52 * 28;
  const simulatedAnnualCo2 = Number((simulatedWeeklySavedPortions * 0.4 * 2.5 * 52).toFixed(0));

  // Milestone Badges Logic
  const milestones = [
    {
      id: 'first_step',
      title: 'First Step',
      desc: 'Log first surplus meal',
      icon: '🌱',
      progress: Math.min(100, (allLogs.length > 0 ? 100 : 0)),
      achieved: allLogs.length > 0
    },
    {
      id: 'hunger_hero',
      title: 'Hunger Relief Hero',
      desc: 'Redistribute 50 meals to NGOs',
      icon: '🍽️',
      progress: Math.min(100, Math.round((impact.mealsRedistributed / 50) * 100)),
      achieved: impact.mealsRedistributed >= 50
    },
    {
      id: 'carbon_champion',
      title: 'Carbon Mitigator',
      desc: 'Prevent 50 kg CO₂e greenhouse gas',
      icon: '🌍',
      progress: Math.min(100, Math.round((impact.co2eAvoidedKg / 50) * 100)),
      achieved: impact.co2eAvoidedKg >= 50
    },
    {
      id: 'efficiency_master',
      title: 'Zero Waste Vanguard',
      desc: 'Maintain >85% kitchen consumption',
      icon: '🌟',
      progress: Math.min(100, Math.round((impact.esgScore / 85) * 100)),
      achieved: impact.esgScore >= 85
    }
  ];

  if (loading) {
    return (
      <div className="subpage-container">
        <div className="subpage-loading"><div className="loading-spinner"></div><p>Loading sustainability telemetry...</p></div>
      </div>
    );
  }

  return (
    <div className="subpage-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div className="subpage-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem' }}>
        <div>
          <h1 className="subpage-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.75rem' }}>
            🌱 Sustainability & ESG Impact Hub
          </h1>
          <p className="subpage-subtitle" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Quantifiable carbon footprint mitigation, community meal redistribution, and circular economy performance
          </p>
        </div>
        <button
          onClick={() => setShowCertificate(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '0.85rem' }}
        >
          📜 View Sustainability Certificate
        </button>
      </div>

      {/* ESG Leadership Score Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.75rem 2rem',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        boxShadow: '0 10px 25px -5px rgba(6, 95, 70, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Circular Score Meter */}
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            border: '4px solid #34d399',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            flexShrink: 0
          }}>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1, color: '#ffffff' }}>
              {impact.esgGrade}
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#a7f3d0', marginTop: '3px' }}>
              {impact.esgScore}/100
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', backgroundColor: 'rgba(52, 211, 153, 0.25)', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {impact.esgLabel}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#d1fae5' }}>• Verified Mess Entity</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '6px', color: '#ffffff' }}>
              {userData?.name || 'Institution Mess'} Sustainability Performance
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#d1fae5', marginTop: '2px', maxWidth: '550px' }}>
              Your kitchen circularity rating is computed in real-time from consumption efficiency, low landfill waste, and fast NGO surplus redistribution.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Redistribution Ratio</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ffffff' }}>
            {impact.mealsRedistributed > 0 ? `${impact.mealsRedistributed} meals delivered` : 'Ready to redistribute'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#d1fae5' }}>Zero Food Waste Initiative</span>
        </div>
      </div>

      {/* Pipeline Alert: If there is surplus logged awaiting pickup */}
      {impact.activePipelinePortions > 0 && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>🚚</span>
            <div>
              <strong style={{ color: '#92400e', fontSize: '0.95rem' }}>
                Active Rescue Pipeline: {impact.activePipelinePortions} portions (~{impact.potentialDivertedKg} kg)
              </strong>
              <p style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '2px' }}>
                Listed and available for NGO pickup. Completing these pickups will unlock an additional <strong>₹{impact.potentialValue}</strong> value and prevent <strong>{impact.potentialCo2e} kg CO₂e</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Realized Core Impact Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        {/* Meals Redistributed */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderTop: '4px solid #10b981', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>MEALS REDISTRIBUTED</span>
            <span style={{ fontSize: '1.35rem' }}>🍽️</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981', marginTop: '8px' }}>
            {impact.mealsRedistributed}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Portions served to community in need
          </div>
        </div>

        {/* Food Diverted */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderTop: '4px solid #3b82f6', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>FOOD DIVERTED</span>
            <span style={{ fontSize: '1.35rem' }}>⚖️</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#3b82f6', marginTop: '8px' }}>
            {impact.foodDivertedKg} <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>kg</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Saved from decomposing in landfills
          </div>
        </div>

        {/* Financial Value Saved */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderTop: '4px solid #f59e0b', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ESTIMATED VALUE SAVED</span>
            <span style={{ fontSize: '1.35rem' }}>💰</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b', marginTop: '8px' }}>
            ₹{impact.estimatedFinancialValue.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Estimated kitchen procurement value
          </div>
        </div>

        {/* CO2e Emissions Avoided */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderTop: '4px solid #8b5cf6', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>CO₂e EMISSIONS AVOIDED</span>
            <span style={{ fontSize: '1.35rem' }}>🌍</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#8b5cf6', marginTop: '8px' }}>
            {impact.co2eAvoidedKg} <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>kg</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Methane landfill emissions mitigated
          </div>
        </div>
      </div>

      {/* Tangible Environmental Equivalencies Cards */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
            🌐 Tangible Real-World Environmental Equivalencies
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            What your prevented food waste translates to in real-world climate offsets:
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* Car Driving Offset */}
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '6px' }}>🚗</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)' }}>
              {impact.carKmOffset} km
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Gasoline passenger car travel emissions avoided
            </div>
          </div>

          {/* Freshwater Saved */}
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '6px' }}>💧</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#06b6d4' }}>
              {impact.waterSavedLiters.toLocaleString()} L
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              ≈ {impact.showersSaved} full 8-minute showers conserved
            </div>
          </div>

          {/* Clean Energy */}
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '6px' }}>⚡</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#f59e0b' }}>
              {impact.phoneCharges.toLocaleString()} charges
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Smartphone battery full charges equivalent
            </div>
          </div>

          {/* Tree Absorption */}
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '6px' }}>🌳</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#10b981' }}>
              {impact.treeEquivalentYears} tree-yrs
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Annual carbon absorption by urban trees
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Cumulative Impact Trajectory + Sustainability Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Cumulative Trajectory */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>📈 Cumulative Impact Trajectory</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Cumulative growth in meals rescued and greenhouse gas emissions avoided</p>
          </div>

          {timeSeries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>🌱</span>
              <strong>No completed pickups logged yet.</strong>
              <p style={{ fontSize: '0.8rem', marginTop: '4px', maxWidth: '360px', margin: '4px auto 0' }}>
                When partner NGOs accept and complete surplus food pickups from your hostel, real-time trajectory curves will render here.
              </p>
            </div>
          ) : (
            <div style={{ height: '280px', width: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={timeSeries} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorMeals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip 
                    formatter={(val, name) => [`${val}`, name === 'meals' ? 'Meals Rescued' : 'kg CO2e Avoided']}
                    contentStyle={{ backgroundColor: '#111827', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="meals" stroke="#10b981" fillOpacity={1} fill="url(#colorMeals)" name="Meals Rescued" />
                  <Area type="monotone" dataKey="co2eAvoided" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCo2)" name="kg CO2e Avoided" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Milestone Achievements */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>🏆 Sustainability Badges & Milestones</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Track progress towards institutional zero-waste and social impact targets</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {milestones.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', backgroundColor: m.achieved ? '#ecfdf5' : 'var(--surface)', border: m.achieved ? '1px solid #a7f3d0' : '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: m.achieved ? '#065f46' : 'var(--text-main)' }}>
                      {m.title} {m.achieved && '✓'}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: m.achieved ? '#059669' : 'var(--text-muted)' }}>
                      {m.progress}%
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{m.desc}</p>
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#e5e7eb', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${m.progress}%`, height: '100%', backgroundColor: m.achieved ? '#10b981' : '#3b82f6', borderRadius: '3px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Interactive Savings Simulator & Methodology */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Interactive Future Savings Simulator */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>🎯 Kitchen Reduction Target Simulator</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Simulate annual financial and carbon reductions by implementing kitchen batch adjustments
            </p>
          </div>

          <div style={{ backgroundColor: 'var(--surface)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>Kitchen Waste Reduction Goal:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>{reductionTargetPct}%</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="50" 
              step="5" 
              value={reductionTargetPct} 
              onChange={(e) => setReductionTargetPct(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>5% (Conservative)</span>
              <span>25% (Moderate)</span>
              <span>50% (Zero-Waste Goal)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected Annual Savings</span>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f59e0b', marginTop: '2px' }}>
                  ₹{simulatedAnnualValue.toLocaleString()}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Annual Carbon Avoided</span>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                  {simulatedAnnualCo2.toLocaleString()} kg CO₂e
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verified Methodology & NGO Recognition */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
              📐 Environmental Standards & Verification
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Transparent conversion formulas aligned with international ESG standards:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>• Greenhouse Gas Factor:</strong> Standardized at <strong>2.5 kg CO₂e / kg food waste</strong> diverted from anaerobic landfill decomposition (EPA WARM & FAO FLI model).
              </div>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>• Food Portion Standard:</strong> Standardized at <strong>0.40 kg (400g)</strong> per meal portion.
              </div>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>• Embedded Water Footprint:</strong> Standardized at <strong>290 Liters / kg</strong> across agricultural cycles.
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.8rem', color: '#166534' }}>
            🤝 <strong>Active NGO Network:</strong> {impact.ngoPartners.length > 0 ? `${impact.ngoPartners.length} Partner Organizations Connected` : 'Local NGO Network Ready for Instant Redistribution'}
          </div>
        </div>
      </div>

      {/* Modal: Sustainability Certificate */}
      {showCertificate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            padding: '2.5rem',
            border: '8px solid #065f46',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowCertificate(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '1.25rem', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              ✕
            </button>

            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#059669' }}>
              Certificate of Sustainability Achievement
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#111827', margin: '8px 0' }}>
              {userData?.name || 'Institutional Hostel Mess'}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
              Recognized for demonstrated commitment to institutional food waste reduction, circular redistribution, and greenhouse gas mitigation.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#166534' }}>ESG Rating</span>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#065f46' }}>{impact.esgGrade} ({impact.esgScore}/100)</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#166534' }}>Meals Rescued</span>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#065f46' }}>{impact.mealsRedistributed}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#166534' }}>CO₂e Mitigated</span>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#065f46' }}>{impact.co2eAvoidedKg} kg</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
                🖨️ Print / Save as PDF
              </button>
              <button onClick={() => setShowCertificate(false)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpactDashboard;
