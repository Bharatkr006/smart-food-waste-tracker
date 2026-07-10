import { useState } from 'react';
import { useHostelData } from '../context/HostelDataContext';

const AIInsights = () => {
  const { logs, loading } = useHostelData();
  const [insight, setInsight] = useState(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [history, setHistory] = useState([]);

  const generateInsights = async () => {
    if (logs.length === 0) {
      setInsight({ error: "No previous data available for AI analysis yet. Start logging meals to get insights." });
      return;
    }
    setLoadingInsight(true);
    setInsight(null);

    try {
      const promptData = logs.slice(-10).map(l =>
        `Item: ${l.title}, Prepared: ${l.prepared}, Consumed: ${l.consumed}, Waste: ${l.surplus}`
      ).join(' | ');

      const prompt = `Analyze these last 10 food logs for a hostel mess: ${promptData}. 
      Give 6 specific tips in EXACTLY this JSON format (no preamble, no markdown code blocks):
      {
        "prep": "precise quantity suggestion for tomorrow",
        "storage": "storage tip for the current surplus",
        "milestone": "waste-reduction observation or positive reinforcement",
        "conservation": "best practices to conserve food before it goes to waste",
        "reuse": "creative ways to safely repurpose prepared surplus food",
        "community": "suggestion on how to better engage with local NGOs or students based on surplus"
      }
      Keep it very professional and concise.`;

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setInsight({ error: "Gemini API key is missing. Please add VITE_GEMINI_API_KEY to your .env.local file." });
        setLoadingInsight(false);
        return;
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
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
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
          setInsight(parsed);
          setHistory(prev => [{ ...parsed, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
        } catch (e) {
          console.error("JSON Parse Error", e);
          setInsight({ milestone: text || "AI is currently refining your insights... please refresh." });
        }
      }
    } catch (err) {
      console.error("AI Insight Error:", err);
      setInsight({ error: "Error connecting to AI service. Please check your internet connection." });
    }
    setLoadingInsight(false);
  };

  if (loading) return <div className="subpage-loading"><div className="loading-spinner"></div><p>Loading data...</p></div>;

  return (
    <div className="subpage-container">
      <div className="subpage-header">
        <div>
          <h1 className="subpage-title">AI Performance Insights</h1>
          <p className="subpage-subtitle">Gemini-powered analysis of your food management patterns</p>
        </div>
        <button
          onClick={generateInsights}
          className="btn btn-ai"
          disabled={loadingInsight}
          id="generate-insights-btn"
        >
          {loadingInsight ? (
            <>
              <span className="btn-spinner"></span>
              Analyzing...
            </>
          ) : (
            <>✨ Generate Insights</>
          )}
        </button>
      </div>



      {/* Loading Skeleton */}
      {loadingInsight && !insight && (
        <div className="ai-skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="ai-skeleton-card">
              <div className="skeleton-line skeleton-sm"></div>
              <div className="skeleton-line skeleton-lg"></div>
              <div className="skeleton-line skeleton-md"></div>
            </div>
          ))}
        </div>
      )}

      {/* Insight Cards */}
      {insight && !loadingInsight && (
        <div className="ai-insights-grid">
          {insight.error ? (
            <div className="ai-error-card">
              <span className="ai-error-icon">⚠️</span>
              <p>{insight.error}</p>
            </div>
          ) : (
            <>
              <div className="ai-insight-card ai-insight-prep">
                <div className="ai-insight-icon-wrap ai-icon-blue">
                  <span>📈</span>
                </div>
                <h3 className="ai-insight-label">Preparation Suggestion</h3>
                <p className="ai-insight-text">{insight.prep}</p>
              </div>

              <div className="ai-insight-card ai-insight-storage">
                <div className="ai-insight-icon-wrap ai-icon-amber">
                  <span>🥡</span>
                </div>
                <h3 className="ai-insight-label">Storage Optimization</h3>
                <p className="ai-insight-text">{insight.storage}</p>
              </div>

              <div className="ai-insight-card ai-insight-milestone">
                <div className="ai-insight-icon-wrap ai-icon-emerald">
                  <span>🏆</span>
                </div>
                <h3 className="ai-insight-label">Performance Milestone</h3>
                <p className="ai-insight-text">{insight.milestone}</p>
              </div>

              <div className="ai-insight-card ai-insight-conservation">
                <div className="ai-insight-icon-wrap ai-icon-purple">
                  <span>🌱</span>
                </div>
                <h3 className="ai-insight-label">Food Conservation</h3>
                <p className="ai-insight-text">{insight.conservation}</p>
              </div>
              
              <div className="ai-insight-card ai-insight-reuse">
                <div className="ai-insight-icon-wrap ai-icon-rose">
                  <span>♻️</span>
                </div>
                <h3 className="ai-insight-label">Creative Reuse</h3>
                <p className="ai-insight-text">{insight.reuse}</p>
              </div>

              <div className="ai-insight-card ai-insight-community">
                <div className="ai-insight-icon-wrap ai-icon-indigo">
                  <span>🤝</span>
                </div>
                <h3 className="ai-insight-label">Community Engagement</h3>
                <p className="ai-insight-text">{insight.community}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {!insight && !loadingInsight && (
        <div className="ai-empty-state">
          <div className="ai-empty-icon">🤖</div>
          <h3>Ready to Analyze</h3>
          <p>Click "Generate Insights" to get AI-powered recommendations based on your recent food logs.</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="ai-history-section">
          <h2 className="ai-history-title">Recent Analysis History</h2>
          <div className="ai-history-list">
            {history.map((h, idx) => (
              <div key={idx} className="ai-history-item">
                <span className="ai-history-time">{h.timestamp}</span>
                <span className="ai-history-preview">{h.prep?.substring(0, 80)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsights;
