import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const ChatContext = createContext(null);
const PAGE_SIZE = 50;

function upsertMessage(list, message) {
  if (!message?.id) return list;
  const next = [...list.filter((item) => item.id !== message.id), message];
  next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return next;
}

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { notifications, markRead } = useNotifications();
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const messagesRef = useRef([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const unreadCount = useMemo(() => notifications.filter((notification) => (
    notification.type === 'chat.message'
    && notification.project_id === activeProjectId
    && !notification.is_read
  )).length, [activeProjectId, notifications]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    setError('');
  }, []);

  const fetchHistory = useCallback(async (projectId, { append = false } = {}) => {
    if (!projectId) return [];
    setLoading(true);
    setError('');
    try {
      const currentMessages = messagesRef.current;
      const before = append && currentMessages.length ? currentMessages[0].created_at : null;
      const params = { limit: PAGE_SIZE };
      if (before) params.before = before;
      const { data } = await api.get(`/projects/${projectId}/chat`, { params });
      const nextMessages = data.messages || [];
      setHasMore(nextMessages.length === PAGE_SIZE);
      setMessages((current) => (append ? [...nextMessages, ...current] : nextMessages));
      return nextMessages;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load chat history.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (projectId, content) => {
    setSending(true);
    setError('');
    try {
      const { data } = await api.post(`/projects/${projectId}/chat`, { content });
      setMessages((current) => upsertMessage(current, data.message));
      return data.message;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message.');
      throw err;
    } finally {
      setSending(false);
    }
  }, []);

  const editMessage = useCallback(async (projectId, messageId, content) => {
    const { data } = await api.patch(`/projects/${projectId}/chat/${messageId}`, { content });
    setMessages((current) => upsertMessage(current, data.message));
    return data.message;
  }, []);

  const deleteMessage = useCallback(async (projectId, messageId) => {
    await api.delete(`/projects/${projectId}/chat/${messageId}`);
    setMessages((current) => current.map((message) => (
      message.id === messageId
        ? { ...message, content: '[deleted]', edited_at: new Date().toISOString() }
        : message
    )));
  }, []);

  const markProjectChatRead = useCallback(async (projectId) => {
    const unread = notifications.filter((notification) => (
      notification.type === 'chat.message'
      && notification.project_id === projectId
      && !notification.is_read
    ));
    await Promise.all(unread.map((notification) => markRead(notification.id).catch(() => null)));
  }, [markRead, notifications]);

  useEffect(() => {
    if (!user || typeof EventSource === 'undefined') return undefined;

    const source = new EventSource('/api/notifications/stream', {
      withCredentials: true,
    });

    source.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const notification = payload.notification;
        const message = notification?.metadata?.message;
        if (
          notification?.type === 'chat.message'
          && message?.project_id
          && message.project_id === activeProjectId
        ) {
          setMessages((current) => upsertMessage(current, message));
        }
      } catch {}
    });

    return () => source.close();
  }, [activeProjectId, user]);

  const value = useMemo(() => ({
    activeProjectId,
    clearMessages,
    deleteMessage,
    editMessage,
    error,
    fetchHistory,
    hasMore,
    loading,
    markProjectChatRead,
    messages,
    sendMessage,
    sending,
    setActiveProjectId,
    unreadCount,
  }), [
    activeProjectId,
    clearMessages,
    deleteMessage,
    editMessage,
    error,
    fetchHistory,
    hasMore,
    loading,
    markProjectChatRead,
    messages,
    sendMessage,
    sending,
    unreadCount,
  ]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
