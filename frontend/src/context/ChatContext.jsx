import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../utils/api";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";

const ChatContext = createContext(null);
const PAGE_SIZE = 50;

function conversationKey(conversation) {
  if (!conversation) return null;
  if (conversation.id) return conversation.id;
  if (conversation.type === "project") return `project:${conversation.project_id}`;
  if (conversation.type === "direct") return `direct:${conversation.conversation_id}`;
  return null;
}

function messageBelongsToConversation(message, conversation) {
  if (!message || !conversation) return false;
  if (conversation.type === "project") {
    return message.project_id === conversation.project_id;
  }
  return message.conversation_id === conversation.conversation_id;
}

function upsertMessage(list, message) {
  if (!message?.id) return list;
  const next = [...list.filter((item) => item.id !== message.id), message];
  next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return next;
}

function unreadMatchesConversation(notification, conversation) {
  if (!notification || !conversation || notification.is_read) return false;
  if (conversation.type === "project") {
    return (
      notification.type === "chat.message" &&
      notification.project_id === conversation.project_id
    );
  }
  return (
    notification.type === "chat.direct_message" &&
    notification.metadata?.conversation_id === conversation.conversation_id
  );
}

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { notifications, markRead } = useNotifications();
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const messagesRef = useRef([]);
  const activeConversationRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const unreadCount = useMemo(
    () => {
      const conversationUnread = conversations.reduce(
        (total, conversation) => total + (conversation.unread_count || 0),
        0,
      );
      const notificationUnread = notifications.filter(
        (notification) =>
          !notification.is_read &&
          ["chat.message", "chat.direct_message"].includes(notification.type),
      ).length;
      return Math.max(conversationUnread, notificationUnread);
    },
    [conversations, notifications],
  );

  const refreshConversations = useCallback(async () => {
    if (!user) return [];
    setLoadingConversations(true);
    try {
      const { data } = await api.get("/chat/conversations");
      const next = data.conversations || [];
      setConversations(next);
      return next;
    } finally {
      setLoadingConversations(false);
    }
  }, [user]);

  const refreshContacts = useCallback(async () => {
    if (!user) return [];
    const { data } = await api.get("/chat/contacts");
    const next = data.contacts || [];
    setContacts(next);
    return next;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setContacts([]);
      setActiveConversation(null);
      setMessages([]);
      return;
    }
    refreshConversations().catch(() => null);
    refreshContacts().catch(() => null);
  }, [refreshContacts, refreshConversations, user]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    setError("");
  }, []);

  const fetchHistory = useCallback(
    async (conversation = activeConversationRef.current, { append = false } = {}) => {
      if (!conversation) return [];
      setLoading(true);
      setError("");
      try {
        const currentMessages = messagesRef.current;
        const before =
          append && currentMessages.length
            ? currentMessages[0].created_at
            : null;
        const params = { limit: PAGE_SIZE };
        if (before) params.before = before;
        const url =
          conversation.type === "project"
            ? `/projects/${conversation.project_id}/chat`
            : `/chat/direct/${conversation.conversation_id}/messages`;
        const { data } = await api.get(url, { params });
        const nextMessages = data.messages || [];
        setHasMore(nextMessages.length === PAGE_SIZE);
        setMessages((current) =>
          append ? [...nextMessages, ...current] : nextMessages,
        );
        return nextMessages;
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load chat history.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const openConversation = useCallback(
    async (conversation) => {
      const key = conversationKey(conversation);
      const normalized =
        conversations.find((item) => conversationKey(item) === key) ||
        conversation;
      setActiveConversation(normalized);
      clearMessages();
      await fetchHistory(normalized);
      return normalized;
    },
    [clearMessages, conversations, fetchHistory],
  );

  const openProjectConversation = useCallback(
    async (projectId) => {
      if (!projectId) return null;
      const current = conversations.find(
        (conversation) =>
          conversation.type === "project" &&
          conversation.project_id === projectId,
      );
      return openConversation(
        current || {
          id: `project:${projectId}`,
          type: "project",
          project_id: projectId,
          title: "Project chat",
        },
      );
    },
    [conversations, openConversation],
  );

  const startDirectConversation = useCallback(
    async (recipientId) => {
      const { data } = await api.post("/chat/direct", {
        recipient_id: recipientId,
      });
      const nextConversations = await refreshConversations();
      const conversation = nextConversations.find(
        (item) =>
          item.type === "direct" &&
          item.conversation_id === data.conversation_id,
      );
      if (conversation) await openConversation(conversation);
      return conversation || data;
    },
    [openConversation, refreshConversations],
  );

  const sendMessage = useCallback(
    async (conversation, content) => {
      setSending(true);
      setError("");
      try {
        const url =
          conversation.type === "project"
            ? `/projects/${conversation.project_id}/chat`
            : `/chat/direct/${conversation.conversation_id}/messages`;
        const { data } = await api.post(url, { content });
        setMessages((current) => upsertMessage(current, data.message));
        refreshConversations().catch(() => null);
        return data.message;
      } catch (err) {
        setError(err.response?.data?.error || "Failed to send message.");
        throw err;
      } finally {
        setSending(false);
      }
    },
    [refreshConversations],
  );

  const editMessage = useCallback(
    async (conversation, messageId, content) => {
      const url =
        conversation.type === "project"
          ? `/projects/${conversation.project_id}/chat/${messageId}`
          : `/chat/direct/${conversation.conversation_id}/messages/${messageId}`;
      const { data } = await api.patch(url, { content });
      setMessages((current) => upsertMessage(current, data.message));
      refreshConversations().catch(() => null);
      return data.message;
    },
    [refreshConversations],
  );

  const deleteMessage = useCallback(
    async (conversation, messageId) => {
      const url =
        conversation.type === "project"
          ? `/projects/${conversation.project_id}/chat/${messageId}`
          : `/chat/direct/${conversation.conversation_id}/messages/${messageId}`;
      await api.delete(url);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: "[deleted]",
                edited_at: new Date().toISOString(),
              }
            : message,
        ),
      );
      refreshConversations().catch(() => null);
    },
    [refreshConversations],
  );

  const markConversationRead = useCallback(
    async (conversation) => {
      const unread = notifications.filter((notification) =>
        unreadMatchesConversation(notification, conversation),
      );
      await Promise.all(
        unread.map((notification) =>
          markRead(notification.id).catch(() => null),
        ),
      );
      refreshConversations().catch(() => null);
    },
    [markRead, notifications, refreshConversations],
  );

  useEffect(() => {
    if (!user || typeof EventSource === "undefined") return undefined;

    const source = new EventSource("/api/notifications/stream", {
      withCredentials: true,
    });

    const handleMessage = (message) => {
      const active = activeConversationRef.current;
      if (messageBelongsToConversation(message, active)) {
        setMessages((current) => upsertMessage(current, message));
      }
      refreshConversations().catch(() => null);
    };

    source.addEventListener("notification", (event) => {
      try {
        const payload = JSON.parse(event.data);
        const message =
          payload.chatEvent?.message || payload.notification?.metadata?.message;
        if (
          ["created", "updated", "deleted", undefined].includes(
            payload.chatEvent?.action,
          )
        ) {
          handleMessage(message);
        }
      } catch {}
    });

    return () => source.close();
  }, [refreshConversations, user]);

  const value = useMemo(
    () => ({
      activeConversation,
      clearMessages,
      contacts,
      conversations,
      deleteMessage,
      editMessage,
      error,
      fetchHistory,
      hasMore,
      loading,
      loadingConversations,
      markConversationRead,
      messages,
      openConversation,
      openProjectConversation,
      refreshContacts,
      refreshConversations,
      sendMessage,
      sending,
      setActiveConversation,
      startDirectConversation,
      unreadCount,
    }),
    [
      activeConversation,
      clearMessages,
      contacts,
      conversations,
      deleteMessage,
      editMessage,
      error,
      fetchHistory,
      hasMore,
      loading,
      loadingConversations,
      markConversationRead,
      messages,
      openConversation,
      openProjectConversation,
      refreshContacts,
      refreshConversations,
      sendMessage,
      sending,
      startDirectConversation,
      unreadCount,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
