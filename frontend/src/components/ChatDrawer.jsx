import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowLeft,
  ChevronDown,
  Edit3,
  ExternalLink,
  MessageCircle,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";

const MAX_LENGTH = 5000;
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;

function initials(name) {
  return (
    String(name || "User")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function extractLinks(content) {
  return [...String(content || "").matchAll(URL_PATTERN)]
    .map((match) => match[0].replace(/[),.]+$/, ""))
    .slice(0, 2);
}

function linkLabel(url) {
  try {
    const parsed = new URL(url);
    const fileName = parsed.pathname.split("/").filter(Boolean).pop();
    return fileName || parsed.hostname;
  } catch {
    return url;
  }
}

function Avatar({ message, user }) {
  const avatarUrl = message?.sender_avatar || user?.avatar_url;
  const name = message?.sender_name || user?.full_name || "User";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#dbe5ff] text-xs font-bold text-[#003fb1]">
      {initials(name)}
    </div>
  );
}

function ConversationIcon({ conversation }) {
  if (conversation.type === "project") {
    return (
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#dbe5ff] text-[#003fb1]">
        <Users className="h-4 w-4" />
      </div>
    );
  }

  if (conversation.other_user?.avatar_url) {
    return (
      <img
        src={conversation.other_user.avatar_url}
        alt=""
        className="h-9 w-9 rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#eef2ff] text-xs font-bold text-[#003fb1]">
      {initials(conversation.title)}
    </div>
  );
}

function ConversationRow({ conversation, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(conversation)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/20"
    >
      <ConversationIcon conversation={conversation} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold text-[#191c1d]">
            {conversation.title}
          </span>
          {conversation.last_message_at ? (
            <span className="flex-shrink-0 text-[11px] text-[#737686]">
              {formatTimestamp(conversation.last_message_at)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-[#737686]">
          {conversation.last_message
            ? `${conversation.last_sender_name ? `${conversation.last_sender_name}: ` : ""}${conversation.last_message}`
            : conversation.subtitle || "No messages yet"}
        </p>
      </div>
      {conversation.unread_count > 0 ? (
        <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-[#ba1a1a] px-1.5 text-[11px] font-bold text-white">
          {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
        </span>
      ) : null}
    </button>
  );
}

function LinkPreviews({ content }) {
  const links = extractLinks(content);
  if (!links.length) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {links.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-[#d8dce7] bg-white/80 px-2 py-1.5 text-xs font-semibold text-[#0b47c2] hover:bg-white"
          onClick={(event) => event.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{linkLabel(url)}</span>
        </a>
      ))}
    </div>
  );
}

export default function ChatDrawer({ isOpen, onClose, projectId }) {
  const { user } = useAuth();
  const {
    activeConversation,
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
    refreshConversations,
    sendMessage,
    sending,
    setActiveConversation,
    startDirectConversation,
  } = useChat();
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const openedForProjectRef = useRef(null);

  const projectConversations = conversations.filter(
    (conversation) => conversation.type === "project",
  );
  const directConversations = conversations.filter(
    (conversation) => conversation.type === "direct",
  );

  useEffect(() => {
    if (!isOpen) return;
    refreshConversations().catch(() => null);
  }, [isOpen, refreshConversations]);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    if (openedForProjectRef.current === projectId) return;
    openedForProjectRef.current = projectId;
    openProjectConversation(projectId).catch(() => null);
  }, [isOpen, openProjectConversation, projectId]);

  useEffect(() => {
    if (isOpen || !openedForProjectRef.current) return;
    openedForProjectRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeConversation) return;
    markConversationRead(activeConversation);
  }, [activeConversation, isOpen, markConversationRead]);

  useEffect(() => {
    if (isOpen) return;
    setContent("");
    setEditingId(null);
    setSelectedContactId("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const node = listRef.current;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    if (nearBottom) {
      window.requestAnimationFrame(() => {
        node.scrollTop = node.scrollHeight;
      });
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      112,
    )}px`;
  }, [content]);

  const canSend = useMemo(() => {
    const trimmed = content.trim();
    return trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !sending;
  }, [content, sending]);

  const handleSend = async () => {
    if (!canSend || !activeConversation) return;
    try {
      await sendMessage(activeConversation, content);
      setContent("");
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      });
    } catch {
      toast.error("Message could not be sent.");
    }
  };

  const handleScroll = () => {
    const node = listRef.current;
    if (!node || !activeConversation) return;
    setShowScrollButton(node.scrollHeight - node.scrollTop - node.clientHeight > 180);
    if (node.scrollTop < 80 && hasMore && !loading) {
      fetchHistory(activeConversation, { append: true }).catch(() => null);
    }
  };

  const handleEdit = async (messageId) => {
    const trimmed = editingContent.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH || !activeConversation) return;
    try {
      await editMessage(activeConversation, messageId, trimmed);
      setEditingId(null);
      setEditingContent("");
    } catch {
      toast.error("Message could not be edited.");
    }
  };

  const handleDelete = async (messageId) => {
    if (!activeConversation) return;
    try {
      await deleteMessage(activeConversation, messageId);
    } catch {
      toast.error("Message could not be deleted.");
    }
  };

  const handleStartDirect = async () => {
    if (!selectedContactId) return;
    try {
      await startDirectConversation(selectedContactId);
      setSelectedContactId("");
    } catch {
      toast.error("Direct conversation could not be started.");
    }
  };

  const showInbox = !activeConversation;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 transition pointer-events-none",
        isOpen && "pointer-events-auto",
      )}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className={clsx(
          "absolute inset-0 bg-[#191c1d]/20 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-label="Close chat overlay"
      />
      <aside
        className={clsx(
          "absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-[#e1e3e4] bg-white shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Chat center"
      >
        <header className="flex min-h-[76px] items-center justify-between border-b border-[#e1e3e4] px-4">
          <div className="flex min-w-0 items-center gap-2">
            {!showInbox ? (
              <button
                type="button"
                onClick={() => setActiveConversation(null)}
                className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-[#434654] hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
                aria-label="Back to chat inbox"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[#191c1d]">
                {showInbox ? "Chat" : activeConversation.title}
              </h2>
              <p className="mt-1 truncate text-xs text-[#737686]">
                {showInbox
                  ? "Project rooms and direct messages"
                  : activeConversation.subtitle || "Conversation"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#434654] hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {showInbox ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-normal text-[#737686]">
                Project rooms
              </h3>
              <div className="space-y-1">
                {loadingConversations && !projectConversations.length ? (
                  <div className="rounded-lg bg-[#f3f4f5] px-3 py-2 text-sm text-[#737686]">
                    Loading conversations...
                  </div>
                ) : null}
                {projectConversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    onOpen={openConversation}
                  />
                ))}
                {!loadingConversations && !projectConversations.length ? (
                  <div className="rounded-lg bg-[#f3f4f5] px-3 py-2 text-sm text-[#737686]">
                    No project rooms available.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-normal text-[#737686]">
                  Direct messages
                </h3>
                <MessageCircle className="h-4 w-4 text-[#737686]" />
              </div>
              <div className="space-y-1">
                {directConversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    onOpen={openConversation}
                  />
                ))}
                {!directConversations.length ? (
                  <div className="rounded-lg bg-[#f3f4f5] px-3 py-2 text-sm text-[#737686]">
                    No direct messages yet.
                  </div>
                ) : null}
              </div>

              <div className="mt-3 rounded-xl border border-[#e1e3e4] p-3">
                <label className="mb-2 block text-xs font-bold text-[#434654]">
                  Start a direct message
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedContactId}
                    onChange={(event) => setSelectedContactId(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-[#c6ccdc] bg-white px-2 py-2 text-sm text-[#191c1d] outline-none focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/15"
                  >
                    <option value="">Select teammate...</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.full_name} ({contact.role})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleStartDirect}
                    disabled={!selectedContactId}
                    className="rounded-lg bg-[#0b47c2] px-3 text-sm font-bold text-white hover:bg-[#063796] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Start
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <>
            <div className="relative min-h-0 flex-1">
              <div
                ref={listRef}
                onScroll={handleScroll}
                className="flex h-full flex-col gap-4 overflow-y-auto px-4 py-5"
              >
                {loading && !messages.length ? (
                  <div className="mt-8 text-center text-sm text-[#737686]">
                    Loading messages...
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-lg border border-[#f0b8b8] bg-[#fff7f7] px-3 py-2 text-sm text-[#a40000]">
                    {error}
                  </div>
                ) : null}
                {!loading && !messages.length ? (
                  <div className="mt-12 text-center text-sm text-[#737686]">
                    No messages yet. Start the conversation!
                  </div>
                ) : null}

                {messages.map((message) => {
                  const isMine = message.sender_id === user?.id;
                  const isDeleted = message.content === "[deleted]";
                  const isEditing = editingId === message.id;
                  return (
                    <div
                      key={message.id}
                      className={clsx(
                        "group flex items-start gap-2",
                        isMine && "justify-end",
                      )}
                    >
                      {!isMine ? (
                        <div className="mt-6 flex-shrink-0">
                          <Avatar message={message} />
                        </div>
                      ) : null}
                      <div className={clsx("max-w-[75%]", isMine && "text-right")}>
                        <div
                          className={clsx(
                            "mb-1 flex items-center gap-2",
                            isMine && "justify-end",
                          )}
                        >
                          <span className="truncate text-xs font-semibold text-[#191c1d]">
                            {message.sender_name}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-normal text-[#596170] ring-1 ring-[#d8dce7]">
                            {message.sender_role}
                          </span>
                        </div>
                        <div
                          className={clsx(
                            "rounded-xl px-3 py-2 text-left text-sm leading-5 shadow-sm",
                            isMine
                              ? "bg-[#003fb1]/10 text-[#191c1d]"
                              : "bg-[#f3f4f5] text-[#191c1d]",
                            isDeleted && "italic text-[#737686]",
                          )}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingContent}
                                onChange={(event) =>
                                  setEditingContent(
                                    event.target.value.slice(0, MAX_LENGTH),
                                  )
                                }
                                className="max-h-28 min-h-[70px] w-full resize-none rounded-lg border border-[#c6ccdc] bg-white px-3 py-2 text-sm outline-none focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/15"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg px-2 py-1 text-xs font-semibold text-[#434654] hover:bg-white"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg bg-[#0b47c2] px-2 py-1 text-xs font-semibold text-white hover:bg-[#063796]"
                                  onClick={() => handleEdit(message.id)}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap break-words text-left">
                                {isDeleted
                                  ? "This message was deleted"
                                  : message.content}
                              </p>
                              {!isDeleted ? (
                                <LinkPreviews content={message.content} />
                              ) : null}
                            </>
                          )}
                        </div>
                        <div
                          className={clsx(
                            "mt-1 flex items-center gap-2 text-[11px] text-[#737686]",
                            isMine && "justify-end",
                          )}
                        >
                          <span>
                            {formatTimestamp(message.created_at)}
                            {message.edited_at && !isDeleted ? " (edited)" : ""}
                          </span>
                          {isMine && !isDeleted && !isEditing ? (
                            <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                className="grid h-6 w-6 place-items-center rounded-md hover:bg-[#eef2ff]"
                                onClick={() => {
                                  setEditingId(message.id);
                                  setEditingContent(message.content);
                                }}
                                aria-label="Edit message"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="grid h-6 w-6 place-items-center rounded-md hover:bg-[#fff1f1]"
                                onClick={() => handleDelete(message.id)}
                                aria-label="Delete message"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {isMine ? (
                        <div className="mt-6 flex-shrink-0">
                          <Avatar message={message} user={user} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {showScrollButton ? (
                <button
                  type="button"
                  className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-[#d8dce7] bg-white text-[#0b47c2] shadow-lg hover:bg-[#f5f7fb]"
                  onClick={() => {
                    if (listRef.current) {
                      listRef.current.scrollTop = listRef.current.scrollHeight;
                    }
                  }}
                  aria-label="Scroll to latest message"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <footer className="border-t border-[#e1e3e4] p-4">
              <div className="rounded-xl border border-[#c6ccdc] bg-white p-2 focus-within:border-[#0b47c2] focus-within:ring-2 focus-within:ring-[#0b47c2]/15">
                <textarea
                  ref={textareaRef}
                  value={content}
                  maxLength={MAX_LENGTH}
                  rows={1}
                  onChange={(event) => setContent(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    activeConversation.type === "direct"
                      ? "Message this teammate"
                      : "Message the project team"
                  }
                  className="max-h-28 min-h-[40px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm text-[#191c1d] outline-none placeholder:text-[#737686]"
                  disabled={sending}
                />
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={clsx(
                      "text-xs",
                      content.length > MAX_LENGTH
                        ? "text-[#a40000]"
                        : "text-[#737686]",
                    )}
                  >
                    {content.length}/{MAX_LENGTH}
                  </span>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-[#0b47c2] text-white transition-colors hover:bg-[#063796] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
