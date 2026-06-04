import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import clsx from "clsx";
import {
  AtSign,
  Bot,
  Check,
  Copy,
  FileText,
  Image,
  Loader2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import Layout from "../components/Layout";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const tabs = [
  {
    id: "rag",
    label: "Knowledge Agent",
    shortLabel: "Knowledge",
    icon: FileText,
    tone: "emerald",
    status: "Searching",
  },
  {
    id: "task",
    label: "Task Orchestrator",
    shortLabel: "Tasks",
    icon: Bot,
    tone: "blue",
    status: "Analyzing",
  },
  {
    id: "meeting",
    label: "Team Coordinator",
    shortLabel: "Team",
    icon: Users,
    tone: "slate",
    status: "Idle",
  },
  {
    id: "feedback",
    label: "Feedback Agent",
    shortLabel: "Feedback",
    icon: FileText,
    tone: "red",
    status: "Idle",
  },
  {
    id: "progress",
    label: "Advisor Analyst",
    shortLabel: "Advisor",
    icon: Sparkles,
    tone: "violet",
    status: "Ready",
  },
];

const roleAgentAccess = {
  student: ["rag", "task", "meeting"],
  advisor: ["feedback", "progress"],
  faculty: ["feedback", "progress"],
};

function getAllowedTabsForRole(role) {
  const normalizedRole = String(role || "").toLowerCase();
  const allowedIds = roleAgentAccess[normalizedRole] || roleAgentAccess.student;
  return tabs.filter((tab) => allowedIds.includes(tab.id));
}

const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const primaryButton = `${buttonBase} bg-[#003fb1] text-white shadow-sm hover:bg-[#0b47c2]`;
const secondaryButton = `${buttonBase} border border-[#c3c5d7] bg-white text-[#191c1d] hover:bg-[#f3f4f5]`;
const fieldClass =
  "w-full rounded-lg border border-[#c3c5d7] bg-white px-3 py-2.5 text-sm text-[#191c1d] outline-none transition-all placeholder:text-[#6b7280] focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/15";
const labelClass =
  "mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-[#4b5563]";

const toneClass = {
  blue: "bg-[#1f5de8] text-white",
  emerald: "bg-[#005438] text-white",
  slate: "bg-[#5f6b7a] text-white",
  red: "bg-[#c51620] text-white",
  violet: "bg-[#6d3fd1] text-white",
};

const actionLabels = {
  ingest: "Document Ingest",
  rag: "Chat Query",
  task: "Task Generation",
  meeting: "Thread Summary",
  feedback: "Feedback Analysis",
  progress: "Progress Report",
  "confirm-task": "Task Confirmation",
};

const workbenchStateVersion = 1;
const maxStoredWorkbenchStateBytes = 250000;

const getSessionGreeting = () => [];

function isStorageQuotaError(error) {
  return (
    error?.name === "QuotaExceededError" ||
    error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error?.code === 22 ||
    error?.code === 1014
  );
}

function readStoredWorkbenchState(projectId) {
  const savedStateKey = `aiworkbench:${projectId || "global"}:state`;
  const stores = [sessionStorage, localStorage];

  for (const store of stores) {
    const savedState = store.getItem(savedStateKey);
    if (!savedState) continue;

    try {
      return JSON.parse(savedState);
    } catch {
      store.removeItem(savedStateKey);
    }
  }

  return null;
}

function writeStoredWorkbenchState(projectId, state) {
  const savedStateKey = `aiworkbench:${projectId || "global"}:state`;
  const serializedState = JSON.stringify(state);

  if (serializedState.length > maxStoredWorkbenchStateBytes) {
    sessionStorage.removeItem(savedStateKey);
    localStorage.removeItem(savedStateKey);
    return;
  }

  try {
    sessionStorage.setItem(savedStateKey, serializedState);
    localStorage.removeItem(savedStateKey);
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    sessionStorage.removeItem(savedStateKey);
    localStorage.removeItem(savedStateKey);
  }
}

function taskDraftSummary(draft, { includeTitle = true } = {}) {
  if (!draft) return "No task draft was generated.";
  const parts = [
    includeTitle ? `- **Title:** ${draft.title || "Untitled task"}` : null,
    draft.description ? `- **Description:** ${draft.description}` : null,
    draft.workstream ? `- **Workstream:** ${draft.workstream}` : null,
    draft.priority ? `- **Priority:** ${draft.priority}` : null,
    draft.assignee_name ? `- **Assignee:** ${draft.assignee_name}` : null,
    draft.complexity ? `- **Complexity/Effort:** ${draft.complexity}` : null,
    draft.blocker ? `- **Potential blocker:** ${draft.blocker}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}

function taskDraftsSummary(drafts) {
  if (!Array.isArray(drafts) || !drafts.length) {
    return "No task drafts were generated.";
  }
  return drafts
    .map(
      (draft, index) =>
        `### ${index + 1}. ${draft.title || "Untitled task"}\n${taskDraftSummary(draft, { includeTitle: false })}`,
    )
    .join("\n\n");
}

function normalizeAgentMarkdown(text) {
  const value = String(text || "");
  if (!/\b(?:Generated|Action items:).*?\b\d+\.\s+Title:/s.test(value)) {
    return value;
  }

  return value
    .replace(
      /(Generated \d+ task drafts?:)\s*/i,
      (_, heading) => `${heading}\n\n`,
    )
    .replace(/(Action items:)\s*/i, (_, heading) => `${heading}\n\n`)
    .replace(/\s*(\d+)\.\s+Title:\s*/g, "\n\n### $1. ")
    .replace(/\s+Description:\s*/g, "\n- **Description:** ")
    .replace(/\s+Workstream:\s*/g, "\n- **Workstream:** ")
    .replace(/\s+Complexity\/Effort:\s*/g, "\n- **Complexity/Effort:** ")
    .replace(/\s+Potential Blocker:\s*/g, "\n- **Potential blocker:** ")
    .replace(/\s+Priority:\s*/g, "\n- **Priority:** ")
    .trim();
}

function taskDraftKey(draft, assignToSelf = false) {
  return [
    String(draft?.title || "")
      .trim()
      .toLowerCase(),
    String(draft?.priority || "")
      .trim()
      .toLowerCase(),
    String(assignToSelf ? "me" : draft?.assignee_name || "")
      .trim()
      .toLowerCase(),
  ].join("|");
}

function normalizeTaskTitle(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function extractConfirmationTitles(messageText) {
  const text = String(messageText || "");
  const titles = [];

  text.split("\n").forEach((line) => {
    const numbered = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
    if (numbered?.[1]) titles.push(numbered[1]);
  });

  [
    /^(?:Created task|Task already exists):\s+(.+)$/m,
    /^(?:Created meeting action|Meeting action already exists):\s+(.+)$/m,
    /^Updated task:\s+(.+)$/m,
  ].forEach((pattern) => {
    const match = text.match(pattern);
    if (match?.[1]) titles.push(match[1]);
  });

  return titles;
}

function getConfirmedDraftState(messages) {
  const taskTitles = new Set();
  const meetingActionsByTitle = new Map();

  messages.forEach((message) => {
    const metadata = message.metadata || {};
    if (metadata.workflow !== "confirm-task") return;

    const metadataTitles = [
      ...(Array.isArray(metadata.createdTitles) ? metadata.createdTitles : []),
      metadata.taskTitle,
      metadata.draftTitle,
    ].filter(Boolean);
    const textTitles = extractConfirmationTitles(message.text);

    [...metadataTitles, ...textTitles].forEach((title) => {
      const key = normalizeTaskTitle(title);
      if (!key) return;
      taskTitles.add(key);

      if (
        metadata.draftType === "meeting_action_confirmation" ||
        /^Created meeting action:|^Meeting action already exists:/m.test(
          String(message.text || ""),
        )
      ) {
        meetingActionsByTitle.set(key, {
          createdTaskId: metadata.taskId || true,
          duplicate: !!metadata.duplicate,
        });
      }
    });
  });

  return { taskTitles, meetingActionsByTitle };
}

class WorkbenchErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[AIWorkbench] Render failure:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className={clsx(
          "m-6",
          "rounded-lg",
          "border",
          "border-[#ffd1ce]",
          "bg-[#fff7f6]",
          "p-6",
          "text-[#191c1d]",
        )}
      >
        <h2 className={clsx("text-lg", "font-bold", "text-[#a40000]")}>
          Something went wrong
        </h2>
        <p className={clsx("mt-2", "text-sm", "leading-6")}>
          The AI Workbench could not render this view. Reload the page or reset
          this panel to continue.
        </p>
        <button
          className={clsx(primaryButton, "mt-4")}
          onClick={() => this.setState({ hasError: false })}
        >
          Reset panel
        </button>
      </div>
    );
  }
}

function ResultBlock({ title, children }) {
  if (!children) return null;
  return (
    <section
      className={clsx(
        "rounded-lg",
        "border",
        "border-[#e1e3e4]",
        "bg-white",
        "p-4",
        "shadow-sm",
      )}
    >
      <h3
        className={clsx(
          "mb-3",
          "text-xs",
          "font-bold",
          "uppercase",
          "tracking-[0.12em]",
          "text-[#737686]",
        )}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function LoadingText({ loading, idle }) {
  if (!loading)
    return <span className={clsx("text-sm", "text-[#737686]")}>{idle}</span>;

  return (
    <div className={clsx("space-y-3")}>
      <div
        className={clsx(
          "flex",
          "items-center",
          "gap-2",
          "text-sm",
          "font-semibold",
          "text-[#303846]",
        )}
      >
        <Loader2
          className={clsx("h-4", "w-4", "animate-spin", "text-[#0b47c2]")}
        />
        Running model...
      </div>
      <div className={clsx("space-y-2")}>
        <div
          className={clsx(
            "h-3",
            "w-full",
            "animate-pulse",
            "rounded",
            "bg-[#dfe5f4]",
          )}
        />
        <div
          className={clsx(
            "h-3",
            "w-5/6",
            "animate-pulse",
            "rounded",
            "bg-[#e8ecf7]",
          )}
        />
        <div
          className={clsx(
            "h-3",
            "w-2/3",
            "animate-pulse",
            "rounded",
            "bg-[#eef1f8]",
          )}
        />
      </div>
    </div>
  );
}

function StreamingMessage({ text, stream = false }) {
  const [visibleLength, setVisibleLength] = useState(stream ? 0 : text.length);

  useEffect(() => {
    if (!stream || !text) {
      setVisibleLength(text.length);
      return undefined;
    }

    setVisibleLength(0);
    const timer = window.setInterval(() => {
      setVisibleLength((length) => {
        if (length >= text.length) {
          window.clearInterval(timer);
          return length;
        }
        return Math.min(text.length, length + 4);
      });
    }, 16);

    return () => window.clearInterval(timer);
  }, [stream, text]);

  return <ReactMarkdown>{text.slice(0, visibleLength)}</ReactMarkdown>;
}

function AgentAvatar({ agent, className }) {
  const Icon = agent.icon;
  return (
    <div
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm",
        toneClass[agent.tone],
        className,
      )}
    >
      <Icon className={clsx("h-5", "w-5")} />
    </div>
  );
}

export default function AIWorkbench() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const sessionIdRef = useRef("");
  const restoredProjectRef = useRef("");
  const confirmingTaskKeysRef = useRef(new Set());
  const [activeTab, setActiveTab] = useState("rag");
  const [loadingAction, setLoadingAction] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("auto");
  const [searchTerm, setSearchTerm] = useState("");
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const [sessionPendingDelete, setSessionPendingDelete] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const [savingSessionTitleId, setSavingSessionTitleId] = useState(null);
  const [ingestionEvents, setIngestionEvents] = useState([]);
  const [chatMessages, setChatMessages] = useState(() => getSessionGreeting());

  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [ragQuery, setRagQuery] = useState("");
  const [ragAnswer, setRagAnswer] = useState(null);

  const [taskRequest, setTaskRequest] = useState("");
  const [taskDraft, setTaskDraft] = useState(null);
  const [taskDrafts, setTaskDrafts] = useState([]);
  const [taskUpdateDraft, setTaskUpdateDraft] = useState(null);

  const [transcript, setTranscript] = useState("");
  const [meetingResult, setMeetingResult] = useState(null);
  const [creatingMeetingActionIds, setCreatingMeetingActionIds] = useState([]);

  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackSeverity, setFeedbackSeverity] = useState("medium");
  const [feedbackResult, setFeedbackResult] = useState(null);

  const [progressReport, setProgressReport] = useState("");
  const [progressPrompt, setProgressPrompt] = useState("");
  const [isEditingReport, setIsEditingReport] = useState(false);

  const isAdvisor = user?.role?.toLowerCase() === "advisor";
  const allowedTabs = useMemo(
    () => getAllowedTabsForRole(user?.role),
    [user?.role],
  );
  const allowedTabIds = useMemo(
    () => new Set(allowedTabs.map((tab) => tab.id)),
    [allowedTabs],
  );
  const defaultTabId = allowedTabs[0]?.id || "rag";
  const activeAgent = useMemo(
    () =>
      allowedTabs.find((tab) => tab.id === activeTab) ||
      allowedTabs[0] ||
      tabs[0],
    [activeTab, allowedTabs],
  );
  const providerValue = selectedProvider === "auto" ? null : selectedProvider;

  const logWorkbenchActivity = useCallback(
    async ({ actionType, status, metadata = {} }) => {
      if (!projectId) return;

      try {
        await api.post("/agents/coordination/activity", {
          projectId,
          actionType,
          status,
          timestamp: new Date().toISOString(),
          metadata: {
            sessionId: sessionIdRef.current,
            activeAgent: activeAgent.label,
            provider: selectedProvider,
            ...metadata,
          },
        });
      } catch (err) {
        console.error("[AIWorkbench] Failed to log activity:", err);
      }
    },
    [activeAgent.label, projectId, selectedProvider],
  );

  const updateSessionList = useCallback((session) => {
    if (!session) return;
    setChatSessions((sessions) => [
      session,
      ...sessions.filter((item) => item.id !== session.id),
    ]);
  }, []);

  const saveWorkbenchMessage = useCallback(
    async (message) => {
      if (!activeChatSessionId) return;
      try {
        const { data } = await api.post(
          `/ai-workbench/sessions/${activeChatSessionId}/messages`,
          {
            sender: message.sender,
            agentId: message.agentId || null,
            text: message.text,
            metadata: {
              clientId: message.id,
              ...(message.metadata || {}),
            },
          },
        );
        updateSessionList({
          ...data.session,
          last_message: data.message?.text || message.text,
        });
      } catch (err) {
        console.error("[AIWorkbench] Failed to save chat message:", err);
      }
    },
    [activeChatSessionId, updateSessionList],
  );

  useEffect(() => {
    sessionIdRef.current = `aiw-${projectId || "global"}-${Date.now()}`;
    restoredProjectRef.current = "";

    const nextState = readStoredWorkbenchState(projectId);

    setActiveTab(
      allowedTabIds.has(nextState?.activeTab)
        ? nextState.activeTab
        : defaultTabId,
    );
    setLoadingAction("");
    setSelectedProvider(nextState?.selectedProvider || "auto");
    setSearchTerm(nextState?.searchTerm || "");
    setIngestionEvents([]);
    setDocTitle(nextState?.docTitle || "");
    setDocContent(nextState?.docContent || "");
    setRagQuery(nextState?.ragQuery || "");
    setRagAnswer(null);
    setTaskRequest(nextState?.taskRequest || "");
    setTaskDraft(null);
    setTaskDrafts([]);
    setTaskUpdateDraft(null);
    setTranscript(nextState?.transcript || "");
    setMeetingResult(null);
    setCreatingMeetingActionIds([]);
    setFeedbackBody(nextState?.feedbackBody || "");
    setFeedbackSeverity(nextState?.feedbackSeverity || "medium");
    setFeedbackResult(null);
    setProgressReport("");
    setProgressPrompt(nextState?.progressPrompt || "");
    setIsEditingReport(false);
    setChatMessages(getSessionGreeting());
    restoredProjectRef.current = projectId || "global";

    if (projectId && user?.id) {
      api
        .post("/agents/coordination/activity", {
          projectId,
          actionType: "Agent Session Initialized",
          status: "success",
          timestamp: new Date().toISOString(),
          metadata: {
            sessionId: sessionIdRef.current,
            userId: user.id,
            role: user.role,
            activeAgent:
              tabs.find((tab) => tab.id === defaultTabId)?.label ||
              "Knowledge Agent",
            provider: "auto",
          },
        })
        .catch((err) =>
          console.error(
            "[AIWorkbench] Failed to log session initialization:",
            err,
          ),
        );
    }
  }, [allowedTabIds, defaultTabId, projectId, user?.id, user?.role]);

  useEffect(() => {
    if (!allowedTabIds.has(activeTab)) {
      setActiveTab(defaultTabId);
    }
  }, [activeTab, allowedTabIds, defaultTabId]);

  const resetWorkbenchOutputs = useCallback(() => {
    setRagAnswer(null);
    setTaskDraft(null);
    setTaskDrafts([]);
    setTaskUpdateDraft(null);
    setMeetingResult(null);
    setCreatingMeetingActionIds([]);
    setFeedbackResult(null);
    setProgressReport("");
    setIsEditingReport(false);
  }, []);

  const mapStoredMessage = useCallback(
    (message) => ({
      id: message.id,
      sender: message.sender,
      agentId: message.agent_id || undefined,
      timestamp: message.created_at,
      text: message.text,
      metadata: message.metadata || {},
      stream: false,
    }),
    [],
  );

  const restoreOutputsFromMessages = useCallback(
    (messages) => {
      resetWorkbenchOutputs();
      const { taskTitles, meetingActionsByTitle } =
        getConfirmedDraftState(messages);

      messages.forEach((message) => {
        const metadata = message.metadata || {};
        if (metadata.workflow === "rag" && metadata.answer) {
          setRagAnswer({
            answer: metadata.answer,
            sources: metadata.sources || [],
          });
        }
        if (metadata.workflow === "task") {
          if (
            metadata.draftType === "task_list" &&
            Array.isArray(metadata.drafts)
          ) {
            setTaskDraft(null);
            setTaskUpdateDraft(null);
            setTaskDrafts(
              metadata.drafts.filter(
                (draft) => !taskTitles.has(normalizeTaskTitle(draft.title)),
              ),
            );
          }
          if (metadata.draftType === "single_task" && metadata.draft) {
            const created = taskTitles.has(
              normalizeTaskTitle(metadata.draft.title),
            );
            setTaskDraft(
              created
                ? {
                    ...metadata.draft,
                    createdTaskId: true,
                  }
                : metadata.draft,
            );
            setTaskDrafts([]);
            setTaskUpdateDraft(null);
          }
          if (metadata.draftType === "task_update" && metadata.updateDraft) {
            setTaskUpdateDraft(metadata.updateDraft);
            setTaskDraft(null);
            setTaskDrafts([]);
          }
        }
        if (metadata.workflow === "meeting" && metadata.meetingResult) {
          setMeetingResult({
            ...metadata.meetingResult,
            actionItemDrafts: metadata.meetingResult.actionItemDrafts?.map(
              (item) => {
                const confirmed = meetingActionsByTitle.get(
                  normalizeTaskTitle(item.title),
                );
                return confirmed ? { ...item, ...confirmed } : item;
              },
            ),
          });
        }
        if (metadata.workflow === "feedback" && metadata.feedbackResult) {
          setFeedbackResult(metadata.feedbackResult);
        }
        if (metadata.workflow === "progress" && metadata.report) {
          setProgressReport(metadata.report);
        }
      });
    },
    [resetWorkbenchOutputs],
  );

  const loadChatMessages = useCallback(
    async (sessionId) => {
      if (!sessionId) return;
      try {
        const { data } = await api.get(
          `/ai-workbench/sessions/${sessionId}/messages`,
        );
        const storedMessages = (data.messages || []).map(mapStoredMessage);
        setChatMessages(
          storedMessages.length ? storedMessages : getSessionGreeting(),
        );
        restoreOutputsFromMessages(storedMessages);
        if (allowedTabIds.has(data.session?.active_agent)) {
          setActiveTab(data.session.active_agent);
        }
      } catch (err) {
        console.error("[AIWorkbench] Failed to load chat messages:", err);
        toast.error("Failed to load chat history.");
      }
    },
    [allowedTabIds, mapStoredMessage, restoreOutputsFromMessages],
  );

  const createChatSession = useCallback(
    async ({ activate = true } = {}) => {
      if (!projectId) return null;
      const { data } = await api.post("/ai-workbench/sessions", {
        projectId,
        activeAgent: defaultTabId,
        title: "New chat",
      });
      updateSessionList(data.session);
      if (activate) {
        setActiveChatSessionId(data.session.id);
        setActiveTab(defaultTabId);
        resetWorkbenchOutputs();
        setChatMessages(getSessionGreeting());
      }
      return data.session;
    },
    [defaultTabId, projectId, resetWorkbenchOutputs, updateSessionList],
  );

  const startEditingSessionTitle = (session) => {
    setEditingSessionId(session.id);
    setEditingSessionTitle(session.title || "New chat");
  };

  const cancelEditingSessionTitle = () => {
    setEditingSessionId(null);
    setEditingSessionTitle("");
    setSavingSessionTitleId(null);
  };

  const saveSessionTitle = async (sessionId) => {
    const title = editingSessionTitle.trim();
    if (!sessionId || !title || savingSessionTitleId) return;

    const previousSessions = chatSessions;
    setSavingSessionTitleId(sessionId);
    setChatSessions((sessions) =>
      sessions.map((session) =>
        session.id === sessionId ? { ...session, title } : session,
      ),
    );

    try {
      const { data } = await api.patch(`/ai-workbench/sessions/${sessionId}`, {
        title,
      });
      setChatSessions((sessions) =>
        sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                ...data.session,
                last_message: session.last_message,
              }
            : session,
        ),
      );
      cancelEditingSessionTitle();
    } catch (err) {
      setChatSessions(previousSessions);
      setSavingSessionTitleId(null);
      toast.error(err.response?.data?.error || "Failed to rename chat.");
    }
  };

  const deleteChatSession = useCallback(
    async (sessionId) => {
      if (!sessionId || deletingSessionId) return;

      setDeletingSessionId(sessionId);
      try {
        await api.delete(`/ai-workbench/sessions/${sessionId}`);

        const remainingSessions = chatSessions.filter(
          (item) => item.id !== sessionId,
        );
        setChatSessions(remainingSessions);

        if (activeChatSessionId === sessionId) {
          const nextSession = remainingSessions[0];
          if (nextSession) {
            resetWorkbenchOutputs();
            setActiveChatSessionId(nextSession.id);
          } else {
            await createChatSession({ activate: true });
          }
        }

        toast.success("Chat deleted.");
        setSessionPendingDelete(null);
      } catch (err) {
        console.error("[AIWorkbench] Failed to delete chat:", err);
        toast.error(err.response?.data?.error || "Failed to delete chat.");
      } finally {
        setDeletingSessionId(null);
      }
    },
    [
      activeChatSessionId,
      chatSessions,
      createChatSession,
      deletingSessionId,
      resetWorkbenchOutputs,
    ],
  );

  useEffect(() => {
    if (!projectId || !user?.id) return undefined;

    let cancelled = false;
    setHistoryLoading(true);

    (async () => {
      try {
        const { data } = await api.get(
          `/ai-workbench/sessions?projectId=${encodeURIComponent(projectId)}`,
        );
        if (cancelled) return;

        const sessions = data.sessions || [];
        setChatSessions(sessions);
        if (sessions.length) {
          setActiveChatSessionId(sessions[0].id);
        } else {
          await createChatSession({ activate: true });
        }
      } catch (err) {
        console.error("[AIWorkbench] Failed to load chat sessions:", err);
        if (!cancelled) toast.error("Failed to load chat history.");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [createChatSession, projectId, user?.id]);

  useEffect(() => {
    if (activeChatSessionId) {
      loadChatMessages(activeChatSessionId);
    }
  }, [activeChatSessionId, loadChatMessages]);

  useEffect(() => {
    if (restoredProjectRef.current !== (projectId || "global")) return;

    writeStoredWorkbenchState(projectId, {
      version: workbenchStateVersion,
      activeTab,
      selectedProvider,
      searchTerm,
      docTitle,
      docContent,
      ragQuery,
      taskRequest,
      transcript,
      feedbackBody,
      feedbackSeverity,
      progressPrompt,
    });
  }, [
    activeTab,
    docContent,
    docTitle,
    feedbackBody,
    feedbackSeverity,
    progressPrompt,
    projectId,
    ragQuery,
    searchTerm,
    selectedProvider,
    taskRequest,
    transcript,
  ]);

  useEffect(() => {
    if (!projectId) return undefined;

    let source = null;
    let retryCount = 0;
    let retryTimeout = null;
    const maxRetry = 5;

    const connectStream = () => {
      if (source) {
        source.close();
      }
      const params = new URLSearchParams({ projectId });
      source = new EventSource(
        `/api/agents/rag/events/stream?${params.toString()}`,
        {
          withCredentials: true,
        },
      );

      source.onopen = () => {
        retryCount = 0;
      };

      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (
            payload?.payload?.projectId &&
            payload.payload.projectId !== projectId
          )
            return;
          setIngestionEvents((events) => [payload, ...events].slice(0, 20));
          retryCount = 0;
        } catch (err) {
          console.error("[AIWorkbench] Failed to parse RAG event:", err);
        }
      };

      source.onerror = () => {
        source.close();
        if (retryCount >= maxRetry) return;
        const delay = Math.min(30000, 1000 * 2 ** retryCount);
        retryTimeout = window.setTimeout(() => {
          retryCount += 1;
          connectStream();
        }, delay);
      };
    };

    connectStream();

    return () => {
      if (source) {
        source.close();
      }
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [projectId]);

  const appendUserMessage = (text) => {
    const message = {
      id: `user-${Date.now()}`,
      sender: "user",
      timestamp: new Date().toISOString(),
      text,
    };
    setChatMessages((messages) => [...messages, message]);
    saveWorkbenchMessage(message);
  };

  const appendAgentMessage = (text, agentId = activeTab, metadata = {}) => {
    const message = {
      id: `agent-${Date.now()}`,
      sender: "agent",
      agentId,
      timestamp: new Date().toISOString(),
      text,
      metadata,
      stream: true,
    };
    setChatMessages((messages) => [...messages, message]);
    saveWorkbenchMessage(message);
  };

  const handleToolSwitch = (nextTab) => {
    if (nextTab === activeTab) return;
    if (!allowedTabIds.has(nextTab)) {
      toast.error("This agent is not available for your role.");
      return;
    }
    const nextAgent = allowedTabs.find((tab) => tab.id === nextTab);
    setActiveTab(nextTab);
    logWorkbenchActivity({
      actionType: "Tool Switch",
      status: "success",
      metadata: {
        fromAgent: activeAgent.label,
        toAgent: nextAgent?.label,
      },
    });
  };

  const runAction = async (key, action) => {
    setLoadingAction(key);
    const actionType = actionLabels[key] || "Agent Request";
    try {
      const result = await action();
      if (result === false) return false;
      const resultMessage =
        result && typeof result === "object" && result.message
          ? result.message
          : `${activeAgent.label} completed ${actionType.toLowerCase()}.`;
      await logWorkbenchActivity({
        actionType: "Agent Response",
        status: "success",
        metadata: {
          workflow: key,
          responseType: actionType,
          ...(result && typeof result === "object"
            ? result.metadata || {}
            : {}),
        },
      });
      appendAgentMessage(resultMessage, activeTab, {
        workflow: key,
        responseType: actionType,
        ...(result && typeof result === "object" ? result.metadata || {} : {}),
      });
      return true;
    } catch (err) {
      await logWorkbenchActivity({
        actionType: "Agent Response",
        status: "failed",
        metadata: {
          workflow: key,
          responseType: actionType,
          error: err.response?.data?.error || err.message,
        },
      });
      toast.error(err.response?.data?.error || "AI request failed.");
      return false;
    } finally {
      setLoadingAction("");
    }
  };

  const ingestDocument = () =>
    runAction("ingest", async () => {
      if (!docTitle.trim() || !docContent.trim()) {
        toast.error("Add a document title and content first.");
        return false;
      }
      await api.post("/agents/rag/ingest", {
        title: docTitle,
        content: docContent,
        projectId,
      });
      const message = `Queued "${docTitle.trim()}" for knowledge indexing.`;
      setDocTitle("");
      setDocContent("");
      toast.success("Document queued for indexing.");
      return {
        message,
        metadata: { documentTitle: docTitle.trim() },
      };
    });

  const askDocuments = () =>
    runAction("rag", async () => {
      if (!ragQuery.trim()) {
        toast.error("Enter a question first.");
        return false;
      }
      const { data } = await api.post("/agents/rag/query", {
        query: ragQuery,
        projectId,
        limit: 3,
        provider: providerValue,
      });
      setRagAnswer(data);
      return {
        message: data.answer || "No answer was generated.",
        metadata: {
          answer: data.answer || "",
          sources: data.sources || [],
          sourceCount: Array.isArray(data.sources) ? data.sources.length : 0,
        },
      };
    });

  const shouldUpdateExistingTask = (request) => {
    const text = String(request || "").toLowerCase();
    if (
      /\b(create|new|add)\b/.test(text) &&
      !/\b(existing|current|already|todo|to do)\b/.test(text)
    )
      return false;
    return (
      /\b(update|change|set|deadline|due|reassign)\b/.test(text) ||
      (/\b(assign)\b/.test(text) &&
        /\b(task|todo|to do|existing|current|already)\b/.test(text))
    );
  };

  const parseTask = () =>
    runAction("task", async () => {
      if (!taskRequest.trim()) {
        toast.error("Describe the task first.");
        return false;
      }

      if (shouldUpdateExistingTask(taskRequest)) {
        const { data } = await api.post("/agents/task/update-existing", {
          request: taskRequest,
          projectId,
          provider: providerValue,
        });
        setTaskDraft(null);
        setTaskDrafts([]);
        setTaskUpdateDraft(data.updateDraft);
        return {
          message: `Prepared task update:\n\n${taskDraftSummary(data.updateDraft)}`,
          metadata: { draftType: "task_update", updateDraft: data.updateDraft },
        };
      }

      const { data } = await api.post("/agents/task/parse", {
        request: taskRequest,
        projectId,
        provider: providerValue,
      });
      setTaskUpdateDraft(null);
      if (Array.isArray(data.drafts) && data.drafts.length) {
        setTaskDraft(null);
        setTaskDrafts(data.drafts);
        return {
          message: `Generated ${data.drafts.length} task draft${data.drafts.length === 1 ? "" : "s"}:\n\n${taskDraftsSummary(data.drafts)}`,
          metadata: {
            draftType: "task_list",
            draftCount: data.drafts.length,
            drafts: data.drafts,
          },
        };
      } else {
        setTaskDrafts([]);
        setTaskDraft(data.draft);
        return {
          message: `Generated task draft:\n\n${taskDraftSummary(data.draft)}`,
          metadata: { draftType: "single_task", draft: data.draft },
        };
      }
    });

  const confirmTask = async (draft, assignToSelf = false) => {
    if (draft.createdTaskId) return false;

    const key = taskDraftKey(draft, assignToSelf);
    if (confirmingTaskKeysRef.current.has(key)) return false;
    confirmingTaskKeysRef.current.add(key);

    try {
      return await runAction("confirm-task", async () => {
        const { data } = await api.post("/agents/task/confirm", {
          draft: assignToSelf ? { ...draft, assignee_name: "me" } : draft,
          projectId,
          user_confirmed: true,
        });

        setTaskDraft((current) =>
          current && taskDraftKey(current, assignToSelf) === key
            ? {
                ...current,
                createdTaskId: data.task?.id || true,
                duplicate: !!data.duplicate,
              }
            : current,
        );

        toast.success(
          data.duplicate
            ? "Task already exists."
            : data.task?.assignee_name
              ? `Task assigned to ${data.task.assignee_name}.`
              : "Task created.",
        );
        return {
          message: data.duplicate
            ? `Task already exists: ${data.task?.title || draft.title || "Untitled task"}`
            : `Created task: ${data.task?.title || draft.title || "Untitled task"}`,
          metadata: {
            draftType: "single_task_confirmation",
            taskId: data.task?.id,
            taskTitle: data.task?.title || draft.title,
            duplicate: !!data.duplicate,
          },
        };
      });
    } finally {
      confirmingTaskKeysRef.current.delete(key);
    }
  };

  const markMeetingActionDraft = (draftId, patch) => {
    setMeetingResult((current) =>
      current
        ? {
            ...current,
            actionItemDrafts: current.actionItemDrafts?.map((item) =>
              item.id === draftId ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
  };

  const confirmMeetingAction = (draft) =>
    runAction("confirm-task", async () => {
      if (draft.createdTaskId || creatingMeetingActionIds.includes(draft.id)) {
        return false;
      }

      setCreatingMeetingActionIds((ids) => [...ids, draft.id]);
      try {
        const { data } = await api.post("/agents/task/confirm", {
          draft: !draft.assignee_name
            ? { ...draft, assignee_name: "me" }
            : draft,
          projectId,
          user_confirmed: true,
        });

        markMeetingActionDraft(draft.id, {
          createdTaskId: data.task?.id || true,
          createdAt: new Date().toISOString(),
        });
        toast.success(
          data.duplicate
            ? "Task already exists."
            : data.task?.assignee_name
              ? `Task assigned to ${data.task.assignee_name}.`
              : "Task created.",
        );
        return {
          message: data.duplicate
            ? `Meeting action already exists: ${data.task?.title || draft.title || "Untitled task"}`
            : `Created meeting action: ${data.task?.title || draft.title || "Untitled task"}`,
          metadata: {
            draftType: "meeting_action_confirmation",
            draftId: draft.id,
            taskId: data.task?.id,
            taskTitle: data.task?.title || draft.title,
            duplicate: !!data.duplicate,
          },
        };
      } finally {
        setCreatingMeetingActionIds((ids) =>
          ids.filter((id) => id !== draft.id),
        );
      }
    });

  const confirmTaskDrafts = (drafts) =>
    runAction("confirm-task", async () => {
      const results = await Promise.allSettled(
        drafts.map((draft) =>
          api.post("/agents/task/confirm", {
            draft,
            projectId,
            user_confirmed: true,
          }),
        ),
      );

      const created = [];
      const failedDrafts = [];
      const errors = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          created.push(result.value.data.task);
        } else {
          failedDrafts.push(drafts[index]);
          errors.push(
            result.reason?.response?.data?.error ||
              result.reason?.message ||
              "Unknown error",
          );
        }
      });

      setTaskDrafts(failedDrafts);

      if (created.length > 0) {
        toast.success(
          `${created.length} task${created.length === 1 ? "" : "s"} created.`,
        );
      }
      if (failedDrafts.length > 0) {
        toast.error(
          `${failedDrafts.length} draft${failedDrafts.length === 1 ? "" : "s"} failed: ${errors.join("; ")}`,
        );
      }

      if (created.length === 0) return false;
      return {
        message: `Created ${created.length} task${created.length === 1 ? "" : "s"}:\n\n${created
          .map(
            (task, index) => `${index + 1}. ${task?.title || "Untitled task"}`,
          )
          .join("\n")}`,
        metadata: {
          draftType: "task_list_confirmation",
          createdCount: created.length,
          createdTitles: created
            .map((task) => task?.title)
            .filter(Boolean),
          createdTaskIds: created.map((task) => task?.id).filter(Boolean),
        },
      };
    });

  const confirmTaskUpdate = (updateDraft) =>
    runAction("confirm-task", async () => {
      const { data } = await api.post("/agents/task/update-existing/confirm", {
        updateDraft,
        projectId,
        user_confirmed: true,
      });
      setTaskUpdateDraft(null);
      toast.success(
        data.task?.assignee_name
          ? `Task updated for ${data.task.assignee_name}.`
          : "Task updated.",
      );
      return {
        message: `Updated task: ${data.task?.title || updateDraft.title || "Untitled task"}`,
        metadata: {
          draftType: "task_update_confirmation",
          taskId: data.task?.id,
          taskTitle: data.task?.title || updateDraft.title,
        },
      };
    });

  const summarizeMeeting = () =>
    runAction("meeting", async () => {
      if (!transcript.trim()) {
        toast.error("Paste meeting notes first.");
        return false;
      }
      const { data } = await api.post("/agents/coordination/meeting", {
        transcript,
        projectId,
        provider: providerValue,
      });
      data.actionItemDrafts = data.actionItemDrafts?.map((item, index) => ({
        ...item,
        id: item.id || `meeting-action-${Date.now()}-${index}`,
      }));
      setMeetingResult(data);
      return {
        message: [
          data.summary || "Meeting summary generated.",
          data.actionItemDrafts?.length
            ? `Action items:\n\n${taskDraftsSummary(data.actionItemDrafts)}`
            : "No action items were identified.",
        ].join("\n\n"),
        metadata: {
          meetingResult: data,
          actionItemCount: data.actionItemDrafts?.length || 0,
        },
      };
    });

  const submitFeedback = () =>
    runAction("feedback", async () => {
      if (!feedbackBody.trim()) {
        toast.error("Add feedback text first.");
        return false;
      }
      const { data } = await api.post("/agents/feedback/submit", {
        projectId,
        body: feedbackBody,
        severity: feedbackSeverity,
        category: "general",
        provider: providerValue,
      });
      setFeedbackResult(data);
      toast.success("Feedback recorded.");
      return {
        message: [
          data.structuredSummary || "Feedback recorded.",
          data.suggestedResponseTemplate
            ? `Suggested response:\n\n${data.suggestedResponseTemplate}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
        metadata: { feedbackId: data.feedback?.id, feedbackResult: data },
      };
    });

  const generateProgressReport = () =>
    runAction("progress", async () => {
      const params = new URLSearchParams({ projectId });
      if (providerValue) params.set("provider", providerValue);
      const { data } = await api.get(
        `/agents/progress/report?${params.toString()}`,
      );
      setProgressReport(data.report);
      return {
        message: data.report || "Progress report generated.",
        metadata: {
          reportLength: data.report?.length || 0,
          report: data.report,
        },
      };
    });

  const runActiveAgent = async () => {
    const prompt = String(composerValue || "").trim();
    if (activeTab !== "progress" && !prompt) {
      toast.error(
        `Enter a ${activeAgent.shortLabel.toLowerCase()} prompt first.`,
      );
      return;
    }

    appendUserMessage(
      prompt || `${activeAgent.label} requested a fresh progress report.`,
    );
    logWorkbenchActivity({
      actionType: "Chat Query",
      status: "submitted",
      metadata: {
        workflow: activeTab,
        promptPreview: prompt.slice(0, 160),
      },
    });

    let completed = false;
    if (activeTab === "rag") completed = await askDocuments();
    else if (activeTab === "task") completed = await parseTask();
    else if (activeTab === "meeting") completed = await summarizeMeeting();
    else if (activeTab === "feedback") completed = await submitFeedback();
    else completed = await generateProgressReport();

    if (completed) clearActiveComposer();
  };

  const renderRag = () => (
    <div className="space-y-4">
      <ResultBlock title="Index Project Document">
        <div
          className={clsx("grid", "gap-3", "lg:grid-cols-[0.8fr_1.2fr_auto]")}
        >
          <input
            className={fieldClass}
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="Document title"
          />
          <textarea
            className={`${fieldClass} min-h-11 resize-y`}
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            placeholder="Paste project documentation here."
          />
          <button
            className={secondaryButton}
            disabled={loadingAction === "ingest"}
            onClick={ingestDocument}
          >
            <Upload className={clsx("h-4", "w-4")} />
            Queue
          </button>
        </div>
      </ResultBlock>

      {ingestionEvents.length > 0 && (
        <ResultBlock title="Ingestion Activity">
          <div className="space-y-2">
            {ingestionEvents.slice(0, 5).map((event) => (
              <div
                key={event.event_id}
                className={clsx(
                  "flex",
                  "items-center",
                  "justify-between",
                  "gap-3",
                  "rounded-lg",
                  "bg-[#f3f6ff]",
                  "p-3",
                  "text-xs",
                  "text-[#434654]",
                )}
              >
                <div>
                  <div className={clsx("font-bold", "text-[#191c1d]")}>
                    {event.topic}
                  </div>
                  <div className="mt-1">
                    {event.payload?.title ||
                      event.payload?.documentId ||
                      "Project knowledge event"}
                  </div>
                </div>
                <time className={clsx("shrink-0", "font-semibold")}>
                  {new Date(event.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            ))}
          </div>
        </ResultBlock>
      )}

      <ResultBlock title="Knowledge Response">
        {ragAnswer ? (
          <div className="space-y-4">
            <p
              className={clsx(
                "whitespace-pre-wrap",
                "text-sm",
                "leading-6",
                "text-[#191c1d]",
              )}
            >
              {ragAnswer.answer}
            </p>
            {ragAnswer.sources?.length > 0 && (
              <div className="space-y-2">
                {ragAnswer.sources.map((source) => (
                  <div
                    key={source.chunkId}
                    className={clsx(
                      "rounded-lg",
                      "bg-[#f3f6ff]",
                      "p-3",
                      "text-xs",
                      "text-[#434654]",
                    )}
                  >
                    <div className={clsx("font-semibold", "text-[#191c1d]")}>
                      {source.documentTitle}
                    </div>
                    <div className="mt-1">{source.snippet}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <LoadingText
            loading={loadingAction === "rag"}
            idle="Ask the knowledge base from the message composer."
          />
        )}
      </ResultBlock>
    </div>
  );

  const renderTask = () => (
    <ResultBlock
      title={
        taskUpdateDraft
          ? "Existing Task Update"
          : taskDrafts.length
            ? "Generated Task List"
            : "Generated Task"
      }
    >
      {taskUpdateDraft ? (
        <div className="space-y-3">
          <dl className={clsx("grid", "gap-3", "text-sm")}>
            <div>
              <dt
                className={clsx(
                  "text-xs",
                  "font-bold",
                  "uppercase",
                  "text-[#737686]",
                )}
              >
                Task
              </dt>
              <dd className={clsx("mt-1", "text-[#191c1d]")}>
                {taskUpdateDraft.title}
              </dd>
            </div>
            <div>
              <dt
                className={clsx(
                  "text-xs",
                  "font-bold",
                  "uppercase",
                  "text-[#737686]",
                )}
              >
                Assignee
              </dt>
              <dd className={clsx("mt-1", "text-[#191c1d]")}>
                {taskUpdateDraft.assignee_name ||
                  taskUpdateDraft.currentAssigneeName ||
                  "Unassigned"}
              </dd>
            </div>
            <div>
              <dt
                className={clsx(
                  "text-xs",
                  "font-bold",
                  "uppercase",
                  "text-[#737686]",
                )}
              >
                Deadline
              </dt>
              <dd className={clsx("mt-1", "text-[#191c1d]")}>
                {taskUpdateDraft.deadline ||
                  (taskUpdateDraft.currentDeadline
                    ? taskUpdateDraft.currentDeadline.slice(0, 10)
                    : "No deadline")}
              </dd>
            </div>
          </dl>
          <button
            className={secondaryButton}
            disabled={loadingAction === "confirm-task"}
            onClick={() => confirmTaskUpdate(taskUpdateDraft)}
          >
            <Check className={clsx("h-4", "w-4")} />
            Apply Update
          </button>
        </div>
      ) : taskDrafts.length ? (
        <div className="space-y-4">
          <div
            className={clsx("flex", "items-center", "justify-between", "gap-3")}
          >
            <p className={clsx("text-sm", "font-semibold", "text-[#191c1d]")}>
              {taskDrafts.length} task drafts ready for review.
            </p>
            <button
              className={secondaryButton}
              disabled={loadingAction === "confirm-task"}
              onClick={() => confirmTaskDrafts(taskDrafts)}
            >
              <Check className={clsx("h-4", "w-4")} />
              Create All
            </button>
          </div>
          <div className="space-y-3">
            {taskDrafts.map((draft, index) => (
              <div
                key={`${draft.title}-${index}`}
                className={clsx(
                  "rounded-lg",
                  "border",
                  "border-[#d5d9e7]",
                  "bg-[#f8f9fb]",
                  "p-4",
                )}
              >
                <div
                  className={clsx(
                    "flex",
                    "flex-wrap",
                    "items-start",
                    "justify-between",
                    "gap-3",
                  )}
                >
                  <div>
                    <p
                      className={clsx(
                        "text-xs",
                        "font-bold",
                        "uppercase",
                        "tracking-wide",
                        "text-[#737686]",
                      )}
                    >
                      {draft.metadata?.workstream || "General"}
                    </p>
                    <h4
                      className={clsx(
                        "mt-1",
                        "text-sm",
                        "font-bold",
                        "text-[#191c1d]",
                      )}
                    >
                      {draft.title}
                    </h4>
                  </div>
                  <span
                    className={clsx(
                      "rounded-full",
                      "bg-white",
                      "px-3",
                      "py-1",
                      "text-xs",
                      "font-bold",
                      "capitalize",
                      "text-[#003fb1]",
                      "ring-1",
                      "ring-[#c8cde0]",
                    )}
                  >
                    {draft.priority}
                  </span>
                </div>
                <p
                  className={clsx(
                    "mt-3",
                    "whitespace-pre-wrap",
                    "text-sm",
                    "leading-6",
                    "text-[#434654]",
                  )}
                >
                  {draft.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : taskDraft ? (
        <div className="space-y-3">
          <dl className={clsx("grid", "gap-3", "text-sm")}>
            <div>
              <dt
                className={clsx(
                  "text-xs",
                  "font-bold",
                  "uppercase",
                  "text-[#737686]",
                )}
              >
                Title
              </dt>
              <dd className={clsx("mt-1", "text-[#191c1d]")}>
                {taskDraft.title}
              </dd>
            </div>
            <div>
              <dt
                className={clsx(
                  "text-xs",
                  "font-bold",
                  "uppercase",
                  "text-[#737686]",
                )}
              >
                Priority
              </dt>
              <dd className={clsx("mt-1", "capitalize", "text-[#191c1d]")}>
                {taskDraft.priority}
              </dd>
            </div>
            <div>
              <dt
                className={clsx(
                  "text-xs",
                  "font-bold",
                  "uppercase",
                  "text-[#737686]",
                )}
              >
                Assignee
              </dt>
              <dd className={clsx("mt-1", "text-[#191c1d]")}>
                {taskDraft.assignee_name || "Unassigned"}
              </dd>
            </div>
          </dl>
          <button
            className={secondaryButton}
            disabled={
              loadingAction === "confirm-task" || taskDraft.createdTaskId
            }
            onClick={() => confirmTask(taskDraft, !taskDraft.assignee_name)}
          >
            <Check className={clsx("h-4", "w-4")} />
            {taskDraft.createdTaskId
              ? taskDraft.duplicate
                ? "Task Exists"
                : "Task Created"
              : taskDraft.assignee_name
                ? "Create Task"
                : "Assign to Me"}
          </button>
        </div>
      ) : (
        <LoadingText
          loading={loadingAction === "task"}
          idle="Describe a task in the composer to draft structured work."
        />
      )}
    </ResultBlock>
  );

  const renderMeeting = () => (
    <ResultBlock title="Summary & Action Items">
      {meetingResult ? (
        <div className="space-y-4">
          <p className={clsx("text-sm", "leading-6", "text-[#191c1d]")}>
            {meetingResult.summary}
          </p>
          <div className="space-y-2">
            {meetingResult.actionItemDrafts?.map((item) => {
              const isCreating = creatingMeetingActionIds.includes(item.id);
              const isCreated = Boolean(item.createdTaskId);

              return (
                <div
                  key={item.id}
                  className={clsx(
                    "flex",
                    "flex-col",
                    "gap-3",
                    "rounded-lg",
                    "bg-[#f3f6ff]",
                    "p-3",
                    "sm:flex-row",
                    "sm:items-center",
                    "sm:justify-between",
                  )}
                >
                  <div>
                    <div
                      className={clsx(
                        "text-sm",
                        "font-semibold",
                        "text-[#191c1d]",
                      )}
                    >
                      {item.title}
                    </div>
                    <div
                      className={clsx(
                        "text-xs",
                        "capitalize",
                        "text-[#737686]",
                      )}
                    >
                      {item.priority} priority ·{" "}
                      {item.assignee_name || "Unassigned"}
                    </div>
                  </div>
                  <button
                    className={secondaryButton}
                    disabled={
                      loadingAction === "confirm-task" ||
                      isCreating ||
                      isCreated
                    }
                    onClick={() => confirmMeetingAction(item)}
                  >
                    {isCreating ? (
                      <Loader2 className={clsx("h-4", "w-4", "animate-spin")} />
                    ) : (
                      <Check className={clsx("h-4", "w-4")} />
                    )}
                    {isCreated
                      ? "Created"
                      : item.assignee_name
                        ? "Create"
                        : "Assign to Me"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <LoadingText
          loading={loadingAction === "meeting"}
          idle="Paste meeting notes in the composer to extract actions."
        />
      )}
    </ResultBlock>
  );

  const renderFeedback = () => (
    <div className="space-y-4">
      <ResultBlock title="Suggested Response">
        <div className={clsx("mb-4", "max-w-xs")}>
          <label className={labelClass}>Severity</label>
          <select
            className={fieldClass}
            value={feedbackSeverity}
            onChange={(e) => setFeedbackSeverity(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        {feedbackResult ? (
          <div className="space-y-4">
            <div>
              <p
                className={clsx(
                  "text-xs",
                  "font-bold",
                  "uppercase",
                  "tracking-wide",
                  "text-[#737686]",
                )}
              >
                Summary
              </p>
              <p
                className={clsx(
                  "mt-1",
                  "text-sm",
                  "leading-6",
                  "text-[#191c1d]",
                )}
              >
                {feedbackResult.structuredSummary}
              </p>
            </div>
            <div>
              <p
                className={clsx(
                  "text-xs",
                  "font-bold",
                  "uppercase",
                  "tracking-wide",
                  "text-[#737686]",
                )}
              >
                Template
              </p>
              <p
                className={clsx(
                  "mt-1",
                  "whitespace-pre-wrap",
                  "text-sm",
                  "leading-6",
                  "text-[#191c1d]",
                )}
              >
                {feedbackResult.suggestedResponseTemplate}
              </p>
            </div>
          </div>
        ) : (
          <LoadingText
            loading={loadingAction === "feedback"}
            idle="Paste advisor feedback in the composer for analysis."
          />
        )}
      </ResultBlock>
    </div>
  );

  const renderProgress = () => (
    <ResultBlock title={isEditingReport ? "Report Editor" : "Report Preview"}>
      {progressReport ? (
        isEditingReport ? (
          <textarea
            className={clsx(
              fieldClass,
              "min-h-[320px] font-mono text-[13px] leading-relaxed",
            )}
            value={progressReport}
            onChange={(e) => setProgressReport(e.target.value)}
            placeholder="Customize the generated report here..."
          />
        ) : (
          <div
            className={clsx(
              "max-w-none",
              "rounded-lg",
              "border",
              "border-[#e1e3e4]",
              "bg-[#f8f9fa]",
              "p-5",
              "text-sm",
              "leading-7",
              "text-[#191c1d]",
              "prose",
              "prose-sm",
            )}
          >
            <ReactMarkdown>{progressReport}</ReactMarkdown>
          </div>
        )
      ) : (
        <LoadingText
          loading={loadingAction === "progress"}
          idle="Generate a weekly progress report from the advisor panel."
        />
      )}
    </ResultBlock>
  );

  const renderWorkflow = () => {
    if (!allowedTabIds.has(activeTab)) {
      return (
        <ResultBlock title="Agent Unavailable">
          <p className="text-sm text-[#434654]">
            This agent is not available for your role.
          </p>
        </ResultBlock>
      );
    }
    if (activeTab === "rag") return renderRag();
    if (activeTab === "task") return renderTask();
    if (activeTab === "meeting") return renderMeeting();
    if (activeTab === "feedback") return renderFeedback();
    return renderProgress();
  };

  const composerValue = {
    rag: ragQuery,
    task: taskRequest,
    meeting: transcript,
    feedback: feedbackBody,
    progress: progressPrompt,
  }[activeTab];

  const updateComposer = (value) => {
    if (activeTab === "rag") setRagQuery(value);
    if (activeTab === "task") setTaskRequest(value);
    if (activeTab === "meeting") setTranscript(value);
    if (activeTab === "feedback") setFeedbackBody(value);
    if (activeTab === "progress") setProgressPrompt(value);
  };

  const clearActiveComposer = () => {
    if (activeTab === "rag") setRagQuery("");
    if (activeTab === "task") setTaskRequest("");
    if (activeTab === "meeting") setTranscript("");
    if (activeTab === "feedback") setFeedbackBody("");
    if (activeTab === "progress") setProgressPrompt("");
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleMessages = normalizedSearch
    ? chatMessages.filter((message) => {
        const messageAgent = tabs.find((tab) => tab.id === message.agentId);
        return `${message.text} ${messageAgent?.label || ""}`
          .toLowerCase()
          .includes(normalizedSearch);
      })
    : chatMessages;
  const visibleSessions = normalizedSearch
    ? chatSessions.filter((session) =>
        `${session.title} ${session.last_message || ""}`
          .toLowerCase()
          .includes(normalizedSearch),
      )
    : chatSessions;
  const activeSession = chatSessions.find(
    (session) => session.id === activeChatSessionId,
  );

  return (
    <Layout activePath={`/projects/${projectId}/ai`} projectId={projectId}>
      <WorkbenchErrorBoundary>
        <div className="flex h-full min-h-0 flex-col bg-[#f3f4f5] text-[#161821]">
          <header className="border-b border-[#e1e3e4] bg-white px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#737686]">
                  {activeSession?.title || "New chat"}
                </p>
                <h1 className="truncate text-xl font-bold text-[#191c1d]">
                  AI Workbench
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex h-10 min-w-[240px] items-center gap-3 rounded-full border border-[#dfe3f0] bg-white px-4 text-[#74798a] focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#4f46e5]/15">
                  <Search className="h-4 w-4 shrink-0" />
                  <input
                    id="ai-workbench-search"
                    className="w-full bg-transparent text-sm text-[#191c1d] outline-none placeholder:text-[#9aa0ae]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search chats and messages"
                  />
                </label>
                <select
                  value={activeTab}
                  onChange={(event) => handleToolSwitch(event.target.value)}
                  className="h-10 rounded-full border border-[#dfe3f0] bg-white px-4 text-sm font-semibold text-[#242733] outline-none focus:border-[#4f46e5]"
                >
                  {allowedTabs.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="h-10 rounded-full border border-[#dfe3f0] bg-white px-4 text-sm font-semibold text-[#6b6f85] outline-none focus:border-[#4f46e5]"
                >
                  <option value="auto">Auto</option>
                  <option value="ollama">Ollama</option>
                  <option value="groq">Groq</option>
                  <option value="gemini">Gemini</option>
                </select>
                <button
                  type="button"
                  className={clsx(primaryButton, "h-10")}
                  disabled={historyLoading}
                  onClick={() => createChatSession({ activate: true })}
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </button>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#dfe3f0] text-[#6b6f85] hover:bg-[#f7f8fc]"
                  aria-label="Workbench options"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          <div
            className={clsx(
              "grid min-h-0 flex-1 overflow-hidden",
              isAdvisor
                ? "xl:grid-cols-[320px_minmax(0,1fr)_300px]"
                : "xl:grid-cols-[320px_minmax(0,1fr)]",
            )}
          >
            <aside className="hidden min-h-0 flex-col border-r border-[#e1e3e4] bg-white xl:flex">
              <div className="border-b border-[#e1e3e4] px-5 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#191c1d]">
                      Chat History
                    </h2>
                    <p className="mt-1 text-xs text-[#737686]">
                      Resume saved workbench sessions.
                    </p>
                  </div>
                  {normalizedSearch && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#4f46e5]"
                      onClick={() => setSearchTerm("")}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className={clsx(primaryButton, "h-10 w-full")}
                  disabled={historyLoading}
                  onClick={() => createChatSession({ activate: true })}
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {historyLoading ? (
                  <LoadingText loading idle="Loading chat history..." />
                ) : visibleSessions.length ? (
                  <div className="space-y-2">
                  {visibleSessions.map((session, index) => {
                    const active = activeChatSessionId === session.id;
                    const sessionAgent =
                      tabs.find((tab) => tab.id === session.active_agent) ||
                      tabs[0];

                    return (
                      <div key={session.id}>
                        {index === 6 && (
                          <div className="px-4 py-3 text-xs font-semibold text-[#9aa0ae]">
                            Last 7 Days
                          </div>
                        )}
                        <article
                          className={clsx(
                            "group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                            active
                              ? "bg-[#d6e0f1] text-[#003fb1]"
                              : "text-[#434654] hover:bg-[#f3f4f5]",
                          )}
                        >
                          <MessageCircle className="h-4 w-4 shrink-0" />
                          {editingSessionId === session.id ? (
                            <div
                              className="min-w-0 flex-1"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                autoFocus
                                value={editingSessionTitle}
                                onChange={(event) =>
                                  setEditingSessionTitle(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    saveSessionTitle(session.id);
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelEditingSessionTitle();
                                  }
                                }}
                                className="h-8 w-full rounded-lg border border-[#c3c5d7] bg-white px-2 text-sm font-semibold text-[#191c1d] outline-none focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/15"
                              />
                              <div className="mt-1 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveSessionTitle(session.id)}
                                  disabled={
                                    savingSessionTitleId === session.id ||
                                    !editingSessionTitle.trim()
                                  }
                                  className="text-[11px] font-bold text-[#003fb1] disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingSessionTitle}
                                  className="text-[11px] font-semibold text-[#737686]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                resetWorkbenchOutputs();
                                setActiveChatSessionId(session.id);
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <h2 className="truncate text-sm font-semibold">
                                {session.title}
                              </h2>
                              <p className="mt-0.5 truncate text-[11px] text-[#8a90a0]">
                                {session.last_message || sessionAgent.label}
                              </p>
                            </button>
                          )}
                          <div
                            className={clsx(
                              "flex shrink-0 items-center gap-1",
                              active || editingSessionId === session.id
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100",
                            )}
                          >
                            {editingSessionId !== session.id && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startEditingSessionTitle(session);
                                }}
                                className="grid h-7 w-7 place-items-center rounded-lg text-[#6b6f85] hover:bg-white"
                                aria-label={`Rename chat ${session.title}`}
                                title="Rename chat"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSessionPendingDelete(session);
                              }}
                              disabled={deletingSessionId === session.id}
                              className="grid h-7 w-7 place-items-center rounded-lg text-[#6b6f85] hover:bg-white disabled:opacity-60"
                              aria-label={`Delete chat ${session.title}`}
                              title="Delete chat"
                            >
                              {deletingSessionId === session.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </article>
                      </div>
                    );
                  })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#e1e3e4] bg-[#f8f9fb] p-4 text-sm text-[#434654]">
                  {normalizedSearch
                    ? "No saved chats match the current search."
                    : "No saved chats yet."}
                  </div>
                )}
              </div>
            </aside>

            <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-36 pt-6 lg:px-10 xl:px-14">
              <div className="mx-auto max-w-4xl space-y-8">
                <div className="mx-auto w-fit rounded-full bg-[#f2f4fa] px-4 py-1.5 text-xs font-semibold text-[#7b8191]">
                  Conversation initiated at{" "}
                  {new Date(
                    chatMessages[0]?.timestamp || Date.now(),
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>

                {visibleMessages.map((message) => {
                  const messageAgent =
                    tabs.find((tab) => tab.id === message.agentId) ||
                    activeAgent;
                  const timeLabel = new Date(
                    message.timestamp,
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const readableAgentText =
                    message.sender === "agent"
                      ? normalizeAgentMarkdown(message.text)
                      : message.text;

                  if (message.sender === "user") {
                    return (
                      <section key={message.id} className="flex gap-3">
                        <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#003fb1] text-sm font-bold text-white">
                          {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center gap-2 text-sm">
                            <span className="font-bold text-[#242733]">
                              {user?.full_name || "User"}
                            </span>
                            <span className="text-xs font-semibold text-[#9aa0ae]">
                              {timeLabel}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#242733]">
                            {message.text}
                          </p>
                        </div>
                      </section>
                    );
                  }

                  return (
                    <section key={message.id} className="flex gap-3">
                      <AgentAvatar agent={messageAgent} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2 text-sm">
                          <span className="font-black uppercase tracking-[0.08em] text-[#003fb1]">
                            {messageAgent.label}
                          </span>
                          <span className="text-xs font-semibold text-[#9aa0ae]">
                            {timeLabel}
                          </span>
                        </div>
                        <div className="prose prose-sm max-w-none text-[#1f2430] prose-p:my-2 prose-p:leading-7 prose-ol:my-3 prose-li:my-1 prose-strong:text-[#161821] prose-pre:rounded-2xl prose-pre:bg-[#111827]">
                          {message.stream ? (
                            <StreamingMessage
                              text={readableAgentText}
                              stream={!!message.stream}
                            />
                          ) : (
                            <ReactMarkdown>{readableAgentText}</ReactMarkdown>
                          )}
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-[#8a90a0]">
                          <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#f2f4fa] hover:text-[#003fb1]"
                            aria-label="Mark response helpful"
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#f2f4fa] hover:text-[#003fb1]"
                            aria-label="Mark response not helpful"
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#f2f4fa] hover:text-[#003fb1]"
                            aria-label="Copy response"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="ml-auto inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold hover:bg-[#f2f4fa] hover:text-[#003fb1]"
                            onClick={runActiveAgent}
                            disabled={
                              Boolean(loadingAction) || !activeChatSessionId
                            }
                          >
                            <RefreshCw className="h-4 w-4" />
                            Regenerate
                          </button>
                        </div>
                      </div>
                    </section>
                  );
                })}

                {visibleMessages.length === 0 && (
                  <div className="mx-auto max-w-lg rounded-[24px] bg-[#f7f8fc] p-6 text-center text-sm text-[#6b6f85]">
                    {normalizedSearch
                      ? "No conversation messages match the current search."
                      : "No messages yet. Send a prompt to start this chat."}
                  </div>
                )}

                <div className="pt-2">{renderWorkflow()}</div>
              </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-white via-white/95 to-white/0 px-5 pb-5 pt-16">
                <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl bg-white p-2 shadow-xl shadow-slate-200 ring-1 ring-[#e1e3e4]">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d6e0f1] text-[#003fb1]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <textarea
                    className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-[#191c1d] outline-none placeholder:text-[#9aa0ae]"
                    value={composerValue}
                    onChange={(e) => updateComposer(e.target.value)}
                    placeholder="What's in your mind? Type '@' to tag an agent..."
                  />
                  <div className="hidden items-center gap-1 text-[#8a90a0] sm:flex">
                    <Paperclip className="h-4 w-4" />
                    <Mic className="h-4 w-4" />
                    <Image className="h-4 w-4" />
                    <AtSign className="h-4 w-4" />
                  </div>
                  <button
                    type="button"
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#003fb1] text-white shadow-sm transition-colors hover:bg-[#0b47c2] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(loadingAction) || !activeChatSessionId}
                    onClick={runActiveAgent}
                    aria-label="Send message"
                  >
                    {loadingAction ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              </div>
            </main>

          {isAdvisor && (
            <aside className="hidden min-h-0 w-[300px] shrink-0 flex-col border-l border-[#e1e3e4] bg-white p-5 2xl:flex">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#242733]">
                  Advisor View
                </h2>
                <Sparkles className="h-5 w-5 text-[#003fb1]" />
              </div>
              <div className="mb-5 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-[#e5e8f3]">
                  <div className="h-full w-[65%] rounded-full bg-[#003fb1]" />
                </div>
                <span className="text-sm font-bold text-[#242733]">65%</span>
              </div>
              <p className="text-sm leading-6 text-[#6b6f85]">
                AI-generated status based on current workbench messages.
              </p>
              <div className="mt-8 space-y-4">
                <button
                  className="w-full rounded-xl border border-[#e1e3e4] bg-white p-4 text-left hover:bg-[#f7f8fc]"
                  onClick={generateProgressReport}
                >
                  <span className="block font-bold text-[#242733]">
                    Generate Weekly Report
                  </span>
                  <span className="mt-1 block text-sm text-[#6b6f85]">
                    Create an advisor-ready project summary.
                  </span>
                </button>
                <button
                  className="w-full rounded-xl border border-[#e1e3e4] bg-white p-4 text-left hover:bg-[#f7f8fc]"
                  onClick={() => handleToolSwitch("feedback")}
                >
                  <span className="block font-bold text-[#242733]">
                    Schedule Peer Review
                  </span>
                  <span className="mt-1 block text-sm text-[#6b6f85]">
                    Engage Feedback Agent for validation.
                  </span>
                </button>
              </div>
              <div className="mt-auto space-y-3">
                {progressReport && (
                  <button
                    className={clsx(secondaryButton, "w-full")}
                    onClick={() => setIsEditingReport(!isEditingReport)}
                  >
                    {isEditingReport ? "View Preview" : "Edit Report"}
                  </button>
                )}
                <button
                  className={clsx(primaryButton, "h-12 w-full")}
                  onClick={generateProgressReport}
                  disabled={loadingAction === "progress"}
                >
                  Export Weekly Report
                </button>
              </div>
            </aside>
          )}
          </div>

        <DeleteConfirmationModal
          open={Boolean(sessionPendingDelete)}
          title="Delete chat?"
          message="This will permanently remove the saved chat history."
          itemName={sessionPendingDelete?.title}
          confirmLabel="Delete Chat"
          loading={deletingSessionId === sessionPendingDelete?.id}
          onCancel={() => {
            if (!deletingSessionId) setSessionPendingDelete(null);
          }}
          onConfirm={() => deleteChatSession(sessionPendingDelete?.id)}
        />
      </div>
      </WorkbenchErrorBoundary>
    </Layout>
  );
}
