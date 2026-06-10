import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';
import { createNotificationStream } from '../utils/notificationStream';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const notificationsRef = useRef([]);
  const unreadCountRef = useRef(0);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/notifications?limit=25');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setError('Failed to load notifications.');
    } finally {
      if (!silent) setLoading(false);
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
    if (!user) return undefined;

    const interval = window.setInterval(() => {
      refresh({ silent: true }).catch(() => null);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [refresh, user]);

  useEffect(() => {
    if (!user) return undefined;

    const source = createNotificationStream();
    if (!source) return undefined;

    source.onopen = () => setError('');

    source.addEventListener('ready', (event) => {
      try {
        const payload = JSON.parse(event.data);
        setUnreadCount(payload.unreadCount || 0);
      } catch {}
    });

    source.addEventListener('heartbeat', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (typeof payload.unreadCount !== 'number') return;
        if (payload.unreadCount > unreadCountRef.current) {
          refresh({ silent: true }).catch(() => null);
        } else {
          setUnreadCount(payload.unreadCount);
        }
      } catch {}
    });

    source.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const incoming = payload.notification;
        const wasUnread = incoming
          ? notificationsRef.current.some(
            (item) => item.id === incoming.id && !item.is_read,
          )
          : false;
        const isNewUnread = Boolean(
          incoming && !incoming.is_read && !wasUnread,
        );

        if (payload.action === 'read_all') {
          const readAt = new Date().toISOString();
          setNotifications((current) => current.map((item) => ({
            ...item,
            is_read: true,
            read_at: item.read_at || readAt,
          })));
        } else if (incoming) {
          setNotifications((current) => [
            incoming,
            ...current.filter((item) => item.id !== incoming.id),
          ].slice(0, 25));
        }

        if (typeof payload.unreadCount === 'number') {
          setUnreadCount((current) => (
            isNewUnread ? Math.max(payload.unreadCount, current + 1) : payload.unreadCount
          ));
        } else if (isNewUnread) {
          setUnreadCount((count) => count + 1);
        } else {
          refresh().catch(() => null);
        }
      } catch {}
    });

    source.onerror = () => {
      setError('Live notification connection interrupted.');
    };

    return () => source.close();
  }, [refresh, user]);

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
