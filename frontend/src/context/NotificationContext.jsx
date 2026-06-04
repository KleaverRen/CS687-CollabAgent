import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/notifications?limit=25');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }
    refresh();
  }, [refresh, user]);

  useEffect(() => {
    if (!user || typeof EventSource === 'undefined') return undefined;

    const source = new EventSource('/api/notifications/stream', {
      withCredentials: true,
    });

    source.addEventListener('ready', (event) => {
      try {
        const payload = JSON.parse(event.data);
        setUnreadCount(payload.unreadCount || 0);
      } catch {}
    });

    source.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.notification) {
          setNotifications((current) => [
            payload.notification,
            ...current.filter((item) => item.id !== payload.notification.id),
          ].slice(0, 25));
        }
        if (typeof payload.unreadCount === 'number') {
          setUnreadCount(payload.unreadCount);
        } else {
          setUnreadCount((count) => count + 1);
        }
      } catch {}
    });

    source.onerror = () => {
      setError('Live notification connection interrupted.');
    };

    return () => source.close();
  }, [user]);

  const markRead = useCallback(async (id) => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    setNotifications((current) => current.map((item) => (
      item.id === id ? { ...item, is_read: true, read_at: data.notification.read_at } : item
    )));
    setUnreadCount(data.unreadCount || 0);
  }, []);

  const markAllRead = useCallback(async () => {
    const { data } = await api.post('/notifications/read-all', { confirm: true });
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true, read_at: item.read_at || readAt })));
    setUnreadCount(data.unreadCount || 0);
  }, []);

  const value = useMemo(() => ({
    error,
    loading,
    markAllRead,
    markRead,
    notifications,
    refresh,
    unreadCount,
  }), [error, loading, markAllRead, markRead, notifications, refresh, unreadCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
