import { useState, useMemo } from 'react';
import { useHostelData } from '../context/HostelDataContext';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';
import {
  filterLogs,
  computeCoreMetrics,
  computeMostWastedItems,
  computeWasteByMeal,
  computeWasteByCategory,
  computeWasteByDayOfWeek,
  computeRescueFunnel,
  computeBaselineComparison,
  FOOD_CATEGORIES,
  MEAL_TYPES
} from '../utils/analyticsEngine';

const Analytics = () => {
  const { allLogs, listings, loading } = useHostelData();

  // Filter State
  const [dateRange, setDateRange] = useState('30days');
  const [mealType, setMealType] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [trendUnit, setTrendUnit] = useState('portions'); // 'portions' or 'wasteRate'

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return filterLogs(allLogs, { dateRange, mealType, category, status });
  }, [allLogs, dateRange, mealType, category, status]);

  // Aggregated Analytics
  const metrics = useMemo(() => computeCoreMetrics(filteredLogs, listings), [filteredLogs, listings]);
  const baseline = useMemo(() => computeBaselineComparison(allLogs, dateRange === '7days' ? 7 : 30), [allLogs, dateRange]);
  const funnelData = useMemo(() => computeRescueFunnel(filteredLogs, listings), [filteredLogs, listings]);
  const mostWasted = useMemo(() => computeMostWastedItems(filteredLogs), [filteredLogs]);
  const wasteByMeal = useMemo(() => computeWasteByMeal(filteredLogs), [filteredLogs]);
  const wasteByCategory = useMemo(() => computeWasteByCategory(filteredLogs), [filteredLogs]);
  const wasteByDay = useMemo(() => computeWasteByDayOfWeek(filteredLogs), [filteredLogs]);

  // Historical chronological trend
  const trendData = useMemo(() => {
    return [...filteredLogs]
      .reverse()
      .slice(-15)
      .map(l => {
        const title = l.foodItem || (l.title?.includes('-') ? l.title.split('-')[1] : l.title) || 'Meal';
        const prep = Number(l.prepared) || 0;
        const cons = Number(l.consumed) || 0;
        const surp = Number(l.surplus) || 0;
        const rate = prep > 0 ? Number(((surp / prep) * 100).toFixed(1)) : 0;
        return {
          name: title.length > 12 ? title.slice(0, 10) + '...' : title,
          prepared: prep,
          consumed: cons,
          surplus: surp,
          wasteRate: rate,
          fullTitle: l.title
        };
      });
  }, [filteredLogs]);

  const resetFilters = () => {
    setDateRange('30days');
    setMealType('all');
    setCategory('all');
    setStatus('all');
  };

  const isFiltered = dateRange !== '30days' || mealType !== 'all' || category !== 'all' || status !== 'all';

  if (loading) {
    return (
      <div className="subpage-container">
        <div className="subpage-loading"><div className="loading-spinner"></div><p>Loading analytics engine...</p></div>
      </div>
    );
  }

  return (
    <div className="subpage-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div className="subpage-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div>
          <h1 className="subpage-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.75rem' }}>
            📊 Waste Intelligence & Analytics
          </h1>
          <p className="subpage-subtitle" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Multi-dimensional measurement of mess consumption, waste patterns, and rescue efficiency
          </p>
        </div>
        {isFiltered && (
          <button 
            onClick={resetFilters} 
            className="btn btn-secondary" 
            style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '20px' }}
          >
            ✕ Reset Filters
          </button>
        )}
      </div>

      {/* Multi-Dimensional Filter Toolbar */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>
            <span>🔍 Filter & Segment Data</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: 'var(--surface)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            Showing <strong>{filteredLogs.length}</strong> of {allLogs.length} logged meals
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '1rem',
          alignItems: 'center'
        }}>
          {/* Time Range */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Time Range
            </label>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="today">📅 Today</option>
              <option value="7days">📅 Last 7 Days</option>
              <option value="30days">📅 Last 30 Days</option>
              <option value="this_month">📅 This Month</option>
              <option value="all">📅 All Time</option>
            </select>
          </div>

          {/* Meal Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Meal Shift
            </label>
            <select 
              value={mealType} 
              onChange={(e) => setMealType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="all">🍽️ All Meals</option>
              {MEAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Food Category */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Category
            </label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="all">🥘 All Categories</option>
              {FOOD_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rescue Status
            </label>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="all">⚡ All Status</option>
              <option value="pending">⏳ Pending Surplus</option>
              <option value="listed-for-ngo">🚀 Listed for NGO</option>
              <option value="picked-up">✅ Picked Up</option>
              <option value="zero-waste">🌟 Zero Waste</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        {/* Total Prepared */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderTop: '4px solid #3b82f6', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TOTAL PREPARED</span>
            <span style={{ fontSize: '1.25rem' }}>🍲</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '8px' }}>
            {metrics.totalPrepared} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>portions</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Consumption: <strong style={{ color: '#10b981' }}>{metrics.consumptionRate}%</strong>
          </div>
        </div>

        {/* Total Consumed */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderTop: '4px solid #10b981', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TOTAL CONSUMED</span>
            <span style={{ fontSize: '1.25rem' }}>🍽️</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#10b981', marginTop: '8px' }}>
            {metrics.totalConsumed} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>portions</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Eaten by students/residents
          </div>
        </div>

        {/* Net Waste Rate */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderTop: '4px solid #f59e0b', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>NET WASTE RATE</span>
            <span style={{ fontSize: '1.25rem' }}>📉</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '8px' }}>
            {metrics.wasteRate}%
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {baseline.deltas.wasteRateDelta <= 0 ? (
              <span style={{ color: '#10b981', fontWeight: '700' }}>↓ {Math.abs(baseline.deltas.wasteRateDelta)}%</span>
            ) : (
              <span style={{ color: '#ef4444', fontWeight: '700' }}>↑ {baseline.deltas.wasteRateDelta}%</span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>vs previous period</span>
          </div>
        </div>

        {/* Redistribution Rate */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderTop: '4px solid #8b5cf6', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>REDISTRIBUTION RATE</span>
            <span style={{ fontSize: '1.25rem' }}>🤝</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#8b5cf6', marginTop: '8px' }}>
            {metrics.redistributionRate}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {metrics.totalDiverted} portions rescued by NGOs
          </div>
        </div>
      </div>

      {/* Row 1: Food Rescue Funnel + Waste by Meal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Food Rescue Funnel */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>🎯 Food Rescue Funnel</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Full operational lifecycle from preparation to NGO pickup</p>
            </div>
            <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '700' }}>
              {metrics.totalPrepared > 0 ? ((metrics.totalDiverted / (metrics.totalSurplus || 1)) * 100).toFixed(0) : 0}% Rescued
            </span>
          </div>

          <div style={{ height: '280px', width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 45, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
                <YAxis dataKey="stage" type="category" stroke="var(--text-muted)" fontSize={11} width={90} />
                <Tooltip 
                  formatter={(value, name, item) => [`${value} portions`, item.payload.description]} 
                  contentStyle={{ backgroundColor: '#111827', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Waste Rate by Meal */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>🍽️ Waste Rate by Meal Shift</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Surplus percentage generated across Breakfast, Lunch, Dinner & Snacks</p>
          </div>

          <div style={{ height: '280px', width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={wasteByMeal} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis unit="%" stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  formatter={(val) => [`${val}% Waste Rate`, 'Surplus / Prepared']}
                  contentStyle={{ backgroundColor: '#111827', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="wasteRate" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Most Wasted Food Items + Waste Pattern by Day */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Most Wasted Items Breakdown */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>🍚 Top Most Wasted Foods</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Items generating the largest share of total mess surplus</p>
          </div>

          {mostWasted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No food log data available yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mostWasted.map((item, idx) => (
                <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                      {idx + 1}. {item.name}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      <strong>{item.totalSurplus}</strong> portions ({item.wastePercentage}% waste rate)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, Math.max(8, item.shareOfTotalWaste))}%`, 
                        height: '100%', 
                        backgroundColor: idx === 0 ? '#ef4444' : idx === 1 ? '#f59e0b' : '#3b82f6',
                        borderRadius: '4px' 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waste Pattern by Day of Week */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>📅 Day-of-Week Waste Pattern</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Identify weekday vs weekend procurement and student attendance shifts</p>
          </div>

          <div style={{ height: '240px', width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={wasteByDay} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} />
                <YAxis unit="%" stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  formatter={(val, name, item) => [`${val}% Waste Rate`, item.payload.fullName]}
                  contentStyle={{ backgroundColor: '#111827', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="wasteRate" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Historical Waste Trend with Unit Toggle */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>📈 Historical Waste Trend</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Sequential meal log tracking showing preparation, consumption, and surplus</p>
          </div>
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setTrendUnit('portions')}
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderRadius: '6px',
                backgroundColor: trendUnit === 'portions' ? '#ffffff' : 'transparent',
                color: trendUnit === 'portions' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: trendUnit === 'portions' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              Portions
            </button>
            <button
              onClick={() => setTrendUnit('wasteRate')}
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderRadius: '6px',
                backgroundColor: trendUnit === 'wasteRate' ? '#ffffff' : 'transparent',
                color: trendUnit === 'wasteRate' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: trendUnit === 'wasteRate' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              Waste %
            </button>
          </div>
        </div>

        <div style={{ height: '300px', width: '100%', minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={300}>
            {trendUnit === 'portions' ? (
              <BarChart data={trendData} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip 
                  formatter={(val, name) => [`${val} portions`, name === 'prepared' ? 'Prepared' : name === 'consumed' ? 'Consumed' : 'Surplus']}
                  labelFormatter={(label, item) => item?.[0]?.payload?.fullTitle || label}
                  contentStyle={{ backgroundColor: '#111827', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="prepared" fill="#3b82f6" name="Prepared" radius={[4, 4, 0, 0]} />
                <Bar dataKey="consumed" fill="#10b981" name="Consumed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="surplus" fill="#ef4444" name="Surplus" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={trendData} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis unit="%" stroke="var(--text-muted)" fontSize={11} />
                <Tooltip 
                  formatter={(val) => [`${val}%`, 'Waste Rate']}
                  labelFormatter={(label, item) => item?.[0]?.payload?.fullTitle || label}
                  contentStyle={{ backgroundColor: '#111827', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }}
                />
                <Line type="monotone" dataKey="wasteRate" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="Waste Rate (%)" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
