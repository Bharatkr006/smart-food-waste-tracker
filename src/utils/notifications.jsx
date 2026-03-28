import toast from 'react-hot-toast';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

export const sendNotification = (title, body, icon = '🔔') => {
  // 1. In-App Notification (Toast)
  toast.success(
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <strong style={{ fontSize: '1rem', marginBottom: '4px' }}>{title}</strong>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{body}</span>
    </div>,
    {
      icon,
      duration: 5000,
      position: 'top-right',
      style: {
        background: 'var(--bg-color)',
        color: 'var(--text-main)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)'
      }
    }
  );

  // 2. Browser/OS Push Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico', // assuming there is a favicon.ico
      });
    } catch (e) {
      console.warn("Failed to send native notification", e);
    }
  }
};
