import { useState, useMemo } from 'react';
import { useHostelData } from '../context/HostelDataContext';

const FoodLogs = () => {
  const { allLogs, loading, updateLogStatus, createListingFromLog } = useHostelData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMeal, setFilterMeal] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const LOGS_PER_PAGE = 12;

  // Filtered & paginated logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      const matchesSearch = log.title?.toLowerCase().includes(searchTerm.toLowerCase());
      const mealCategory = log.title?.split(' - ')[0] || '';
      const matchesMeal = filterMeal === 'all' || mealCategory === filterMeal;
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'surplus' && log.surplus > 0) ||
        (filterStatus === 'zero-waste' && log.surplus === 0);
      return matchesSearch && matchesMeal && matchesStatus;
    });
  }, [allLogs, searchTerm, filterMeal, filterStatus]);

  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * LOGS_PER_PAGE,
    currentPage * LOGS_PER_PAGE
  );

  // Summary stats
  const stats = useMemo(() => {
    const total = allLogs.length;
    const surplusCount = allLogs.filter(l => l.surplus > 0).length;
    const zeroWaste = allLogs.filter(l => l.surplus === 0).length;
    const totalSurplus = allLogs.reduce((acc, l) => acc + (l.surplus || 0), 0);
    return { total, surplusCount, zeroWaste, totalSurplus };
  }, [allLogs]);

  const handleStore = async (log) => {
    setActionLoading(log.id);
    setActionMessage('');
    try {
      await updateLogStatus(log.id, 'stored');
      setActionMessage(`"${log.title}" marked as stored internally.`);
    } catch (err) {
      console.error(err);
      setActionMessage('Failed to update. Please try again.');
    }
    setActionLoading(null);
    setTimeout(() => setActionMessage(''), 3000);
  };

  const handleListForNGO = async (log) => {
    setActionLoading(log.id);
    setActionMessage('');
    try {
      await createListingFromLog(log);
      setActionMessage(`"${log.title}" listed for NGO pickup! 🚀`);
    } catch (err) {
      console.error(err);
      setActionMessage('Failed to create listing. Please try again.');
    }
    setActionLoading(null);
    setTimeout(() => setActionMessage(''), 3000);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (log) => {
    if (log.status === 'picked-up') return { text: 'Picked Up', class: 'badge-success' };
    if (log.status === 'stored') return { text: 'Stored', class: 'badge-stored' };
    if (log.status === 'listed-for-ngo') return { text: 'Listed for NGO', class: 'badge-listed' };
    if (log.surplus > 0) return { text: 'Surplus', class: 'badge-warning' };
    return { text: 'Zero Waste', class: 'badge-success' };
  };

  if (loading) return <div className="subpage-loading"><div className="loading-spinner"></div><p>Loading logs...</p></div>;

  return (
    <div className="subpage-container">
      <div className="subpage-header">
        <div>
          <h1 className="subpage-title">Historical Food Logs</h1>
          <p className="subpage-subtitle">Complete history of all your meal entries</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="logs-stats-bar">
        <div className="logs-stat">
          <span className="logs-stat-value">{stats.total}</span>
          <span className="logs-stat-label">Total Logs</span>
        </div>
        <div className="logs-stat">
          <span className="logs-stat-value logs-stat-warning">{stats.surplusCount}</span>
          <span className="logs-stat-label">With Surplus</span>
        </div>
        <div className="logs-stat">
          <span className="logs-stat-value logs-stat-success">{stats.zeroWaste}</span>
          <span className="logs-stat-label">Zero Waste</span>
        </div>
        <div className="logs-stat">
          <span className="logs-stat-value">{stats.totalSurplus}</span>
          <span className="logs-stat-label">Total Surplus Units</span>
        </div>
      </div>

      {/* Filters */}
      <div className="logs-filters">
        <div className="logs-search-wrap">
          <span className="logs-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by item name..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="logs-search-input"
            id="search-logs-input"
          />
        </div>
        <select
          value={filterMeal}
          onChange={(e) => { setFilterMeal(e.target.value); setCurrentPage(1); }}
          className="logs-filter-select"
          id="filter-meal-select"
        >
          <option value="all">All Meals</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
          <option value="Snack">Snack</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="logs-filter-select"
          id="filter-status-select"
        >
          <option value="all">All Status</option>
          <option value="surplus">Surplus Only</option>
          <option value="zero-waste">Zero Waste Only</option>
        </select>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div className="logs-action-toast">
          {actionMessage}
        </div>
      )}

      {/* Logs Table */}
      <div className="logs-table-container">
        <table className="logs-table" id="food-logs-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Date</th>
              <th>Prepared</th>
              <th>Consumed</th>
              <th>Surplus</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length > 0 ? paginatedLogs.map(log => {
              const status = getStatusBadge(log);
              const canAct = log.surplus > 0 && (!log.status || log.status === 'pending');
              const isActing = actionLoading === log.id;

              return (
                <tr key={log.id} className="logs-table-row">
                  <td className="logs-td-item">
                    <span className="logs-item-name">{log.title}</span>
                  </td>
                  <td className="logs-td-date">{formatDate(log.createdAt)}</td>
                  <td>{log.prepared}</td>
                  <td>{log.consumed}</td>
                  <td className={log.surplus > 0 ? 'logs-td-surplus' : ''}>
                    {log.surplus}
                  </td>
                  <td>
                    <span className={`logs-badge ${status.class}`}>{status.text}</span>
                  </td>
                  <td className="logs-td-actions">
                    {canAct ? (
                      <div className="logs-action-btns">
                        <button
                          className="logs-btn logs-btn-store"
                          onClick={() => handleStore(log)}
                          disabled={isActing}
                          title="Store surplus internally"
                        >
                          {isActing ? '...' : '📦 Store'}
                        </button>
                        <button
                          className="logs-btn logs-btn-ngo"
                          onClick={() => handleListForNGO(log)}
                          disabled={isActing}
                          title="List surplus for NGO pickup"
                        >
                          {isActing ? '...' : '🤝 List for NGO'}
                        </button>
                      </div>
                    ) : (
                      <span className="logs-action-done">—</span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="7" className="logs-empty">
                  {allLogs.length === 0 ? 'No logs recorded yet.' : 'No logs match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="logs-pagination">
          <button
            className="logs-page-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            ← Previous
          </button>
          <div className="logs-page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="logs-page-ellipsis">...</span>}
                  <button
                    className={`logs-page-num ${currentPage === p ? 'active' : ''}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                </span>
              ))
            }
          </div>
          <button
            className="logs-page-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default FoodLogs;
