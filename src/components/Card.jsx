const Card = ({ title, meta, children, badge, badgeType, topBadge, topBadgeType, timer, timerType }) => {
  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
           {topBadge && (
             <span className={`badge badge-${topBadgeType || 'success'}`} style={{ alignSelf: 'flex-start', fontSize: '0.65rem', padding: '2px 8px' }}>
               {topBadge}
             </span>
           )}
           <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>
         </div>
         {badge && (
           <span className={`badge badge-${badgeType || 'success'}`}>
             {badge}
           </span>
         )}
      </div>
      
      {meta && <p className="card-meta" style={{ marginBottom: timer ? '0.5rem' : '1rem' }}>{meta}</p>}
      
      {timer && (
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '600', 
          color: timerType === 'danger' ? '#ef4444' : timerType === 'warning' ? '#f59e0b' : '#10b981',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>⏱️</span> {timer}
        </div>
      )}

      <div className="card-body">
        {children}
      </div>
    </div>
  );
};

export default Card;
