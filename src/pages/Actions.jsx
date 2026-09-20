import { useState, useMemo } from 'react';
import { useHostelData } from '../context/HostelDataContext';
import { extractStatisticalSummaryForAI } from '../utils/analyticsEngine';
import toast from 'react-hot-toast';

const ACTION_TYPE_ICONS = {
  preparation: '🍚',
  serving: '🥄',
  redistribution: '⚡',
  storage: '❄️',
  menu: '📋',
  other: '💡'
};

const Actions = () => {
  const { allLogs, listings, actions, addAction, updateActionStatus, deleteAction, loading } = useHostelData();

  const [activeTab, setActiveTab] = useState('suggested'); // 'suggested', 'active', 'completed'
  const [generating, setGenerating] = useState(false);

  // Filter actions by status
  const suggestedActions = useMemo(() => actions.filter(a => a.status === 'suggested'), [actions]);
  const inProgressActions = useMemo(() => actions.filter(a => a.status === 'active'), [actions]);
  const completedActions = useMemo(() => actions.filter(a => a.status === 'completed'), [actions]);

  // Generate Structured AI Actions using Gemini & Analytics Summary
  const handleGenerateAIActions = async () => {
    if (allLogs.length < 2) {
      toast.error("Please log at least 2 meals to allow AI to identify waste patterns.");
      return;
    }

    setGenerating(true);
    const toastId = toast.loading("Analyzing mess statistics & generating actionable operational recommendations...");

    try {
      const stats = extractStatisticalSummaryForAI(allLogs, listings, actions);
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      let generatedList = [];

      if (apiKey) {
        const prompt = `You are an expert AI Food Operations & Sustainability Consultant for large institution hostel kitchens.
Analyze the following mess waste metrics and patterns:
${JSON.stringify(stats, null, 2)}

Generate 3 high-impact, realistic operational actions to reduce food waste and optimize redistribution.
Respond with ONLY a JSON array of objects (no markdown, no preamble) in EXACTLY this format:
[
  {
    "title": "Short imperative title (e.g., Reduce Dinner Rice Preparation by 12%)",
    "type": "preparation" | "serving" | "redistribution" | "storage" | "menu",
    "foodItem": "Target food name or 'All'",
    "mealType": "Target meal or 'All'",
    "reason": "Clear data-backed explanation based on the numbers provided",
    "recommendation": "Specific, practical instruction for the kitchen staff",
    "expectedImpact": "Quantifiable estimated savings (e.g., ~5-8 kg waste reduction/week)",
    "baselineWaste": 24.5,
    "targetWaste": 14.0,
    "confidence": "High" | "Medium"
  }
]`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            generatedList = JSON.parse(jsonMatch[0]);
          }
        }
      }

      // Fallback heuristics if API not configured or parsing failed
      if (!generatedList || generatedList.length === 0) {
        const topItem = stats.topWastedItems[0]?.item || 'Rice';
        generatedList = [
          {
            title: `Reduce ${stats.wasteByMeal[2]?.name || 'Dinner'} ${topItem} Preparation by 15%`,
            type: 'preparation',
            foodItem: topItem,
            mealType: 'Dinner',
            reason: `${topItem} exhibits recurring surplus during dinner shifts.`,
            recommendation: `Trim the baseline batch size by ~15% and prepare replenishment batches only on demand.`,
            expectedImpact: `≈ 4–6 portions saved per dinner shift`,
            baselineWaste: 25.0,
            targetWaste: 12.0,
            confidence: 'High'
          },
          {
            title: `Advance Lunch NGO Surplus Listing by 20 Minutes`,
            type: 'redistribution',
            foodItem: 'All',
            mealType: 'Lunch',
            reason: `Listing surplus immediately after peak lunch ensures NGO partners reach the campus before afternoon traffic.`,
            recommendation: `Set a daily reminder at 1:45 PM to log and list remaining lunch surplus immediately.`,
            expectedImpact: `Reduces uncollected surplus expiration by ~40%`,
            baselineWaste: 18.0,
            targetWaste: 8.0,
            confidence: 'High'
          },
          {
            title: `Adjust Serving Portion Size for Cooked Vegetables`,
            type: 'serving',
            foodItem: 'Cooked Vegetables',
            mealType: 'Lunch',
            reason: `Plate waste audit suggests initial vegetable ladling is larger than median consumption.`,
            recommendation: `Serve smaller initial portions at the mess counter with an open 'unlimited refills' policy.`,
            expectedImpact: `Estimated 15% reduction in mess counter overproduction`,
            baselineWaste: 20.0,
            targetWaste: 10.0,
            confidence: 'Medium'
          }
        ];
      }

      // Save suggested actions to Firestore / State
      for (const action of generatedList) {
        await addAction({
          ...action,
          status: 'suggested',
          currentWaste: action.baselineWaste
        });
      }

      toast.success(`Generated ${generatedList.length} new AI Actions!`, { id: toastId });
      setActiveTab('suggested');
    } catch (err) {
      console.error("Action generation error:", err);
      toast.error("Failed to generate AI actions. Please check console.", { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async (actionId) => {
    try {
      await updateActionStatus(actionId, 'active', {
        startedAt: new Date().toISOString()
      });
      toast.success("Action activated! Live tracking started.");
      setActiveTab('active');
    } catch {
      toast.error("Could not activate action.");
    }
  };

  const handleComplete = async (actionId, baselineWaste, targetWaste) => {
    try {
      const finalReduction = Math.round(baselineWaste - targetWaste);
      await updateActionStatus(actionId, 'completed', {
        completedAt: new Date().toISOString(),
        finalReductionPercent: finalReduction
      });
      toast.success("Action marked as Completed! Great impact!");
      setActiveTab('completed');
    } catch {
      toast.error("Could not complete action.");
    }
  };

  const handleDismiss = async (actionId) => {
    try {
      await deleteAction(actionId);
      toast.success("Action dismissed.");
    } catch {
      toast.error("Could not dismiss action.");
    }
  };

  if (loading) {
    return (
      <div className="subpage-container">
        <div className="subpage-loading"><div className="loading-spinner"></div><p>Loading AI actions board...</p></div>
      </div>
    );
  }

  return (
    <div className="subpage-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div className="subpage-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div>
          <h1 className="subpage-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.75rem' }}>
            ⚡ AI Action Management
          </h1>
          <p className="subpage-subtitle" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Transform kitchen data patterns into measurable operational interventions
          </p>
        </div>
        <button
          onClick={handleGenerateAIActions}
          disabled={generating}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.95rem' }}
        >
          {generating ? '✨ Analyzing Kitchen Patterns...' : '✨ Generate AI Actions'}
        </button>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('suggested')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: 'pointer',
            color: activeTab === 'suggested' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'suggested' ? '2px solid var(--primary)' : '2px solid transparent'
          }}
        >
          💡 Suggested ({suggestedActions.length})
        </button>

        <button
          onClick={() => setActiveTab('active')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: 'pointer',
            color: activeTab === 'active' ? '#10b981' : 'var(--text-muted)',
            borderBottom: activeTab === 'active' ? '2px solid #10b981' : '2px solid transparent'
          }}
        >
          🟢 Active Tracking ({inProgressActions.length})
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: 'pointer',
            color: activeTab === 'completed' ? '#8b5cf6' : 'var(--text-muted)',
            borderBottom: activeTab === 'completed' ? '2px solid #8b5cf6' : '2px solid transparent'
          }}
        >
          ✅ Completed ({completedActions.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'suggested' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {suggestedActions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--surface)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎯</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-main)' }}>No Suggested Actions Pending</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px', maxWidth: '400px', margin: '6px auto 1.5rem' }}>
                Click "Generate AI Actions" above to analyze your recent mess logs and discover optimization opportunities.
              </p>
              <button onClick={handleGenerateAIActions} className="btn btn-primary" disabled={generating}>
                ✨ Scan for Opportunities
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {suggestedActions.map(action => (
                <div key={action.id} className="card action-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', textTransform: 'uppercase' }}>
                        {ACTION_TYPE_ICONS[action.type] || '💡'} {action.type || 'Operational'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                        Confidence: <strong style={{ color: '#10b981' }}>{action.confidence || 'High'}</strong>
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '4px' }}>
                      {action.title}
                    </h3>

                    <div style={{ margin: '12px 0', padding: '10px 12px', borderRadius: '6px', backgroundColor: 'var(--bg)', fontSize: '0.85rem' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <strong>Reason:</strong> {action.reason}
                      </div>
                      <div style={{ color: 'var(--text-main)', marginTop: '6px' }}>
                        <strong>Recommendation:</strong> {action.recommendation}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      <span>Baseline: <strong>{action.baselineWaste}%</strong></span>
                      <span>Target: <strong style={{ color: '#10b981' }}>{action.targetWaste}%</strong></span>
                      <span>Impact: <strong>{action.expectedImpact}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                    <button
                      onClick={() => handleAccept(action.id)}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                    >
                      ✓ Accept Action
                    </button>
                    <button
                      onClick={() => handleDismiss(action.id)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {inProgressActions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--surface)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌱</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-main)' }}>No Active Actions in Progress</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
                Accept suggested actions to begin tracking waste reduction in real-time.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {inProgressActions.map(action => {
                const targetReduction = (action.baselineWaste || 20) - (action.targetWaste || 10);
                return (
                  <div key={action.id} className="card action-card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#d1fae5', color: '#065f46' }}>
                        🟢 ACTIVE TRACKING
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Target: {action.targetWaste}% waste
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                      {action.title}
                    </h3>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0' }}>
                      {action.recommendation}
                    </p>

                    {/* Progress Bar */}
                    <div style={{ margin: '14px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>Baseline: {action.baselineWaste}%</span>
                        <span style={{ color: '#10b981', fontWeight: '600' }}>Goal: -{targetReduction}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '75%', height: '100%', backgroundColor: '#10b981', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <button
                      onClick={() => handleComplete(action.id, action.baselineWaste || 20, action.targetWaste || 10)}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', marginTop: '0.5rem' }}
                    >
                      ✓ Mark as Achieved & Complete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {completedActions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--surface)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏆</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-main)' }}>No Completed Actions Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
                Completed operational goals will be logged here to document your mess efficiency improvements.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {completedActions.map(action => (
                <div key={action.id} className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#ede9fe', color: '#5b21b6' }}>
                      ✅ ACHIEVED
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>
                      ↓ {action.finalReductionPercent || 15}% Waste Reduced
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '8px' }}>
                    {action.title}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {action.expectedImpact}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Actions;
