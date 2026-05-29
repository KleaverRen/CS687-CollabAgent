import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../utils/api";
import toast from "react-hot-toast";
import clsx from "clsx";

// ── Pure helpers (outside component to avoid re-creation) ────────────────────

const EVENT_ICON_MAP = [
  ["task", "📋"],
  ["meeting", "🗣️"],
  ["document", "📄"],
  ["feedback", "💬"],
  ["ai_workbench", "✨"],
];

function getEventIcon(type) {
  for (const [keyword, icon] of EVENT_ICON_MAP) {
    if (type.includes(keyword)) return icon;
  }
  return "🤖";
}

const METADATA_HIDDEN_KEYS = [
  "actionType",
  "status",
  "role",
  "sessionId",
  "userId",
];

function formatMetadata(metadata) {
  if (!metadata) return null;
  const entries = Object.entries(metadata).filter(
    ([k]) => !METADATA_HIDDEN_KEYS.includes(k),
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="bg-[#f8f9fb] border border-[#e1e3e4] rounded-xl p-3"
        >
          <p className="text-[10px] font-bold text-[#737686] uppercase tracking-wider mb-1">
            {key.replace(/([A-Z])/g, " $1").replace("_", " ")}
          </p>
          {typeof value === "object" ? (
            <pre className="text-xs font-semibold text-[#191c1d] whitespace-pre-wrap break-words line-clamp-5 m-0">
              {JSON.stringify(value, null, 2)}
            </pre>
          ) : (
            <p className="text-xs font-semibold text-[#191c1d] line-clamp-3">
              {String(value)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

const EVENT_TYPE_LABELS = [
  { value: "all", label: "All" },
  { value: "task", label: "Tasks" },
  { value: "meeting", label: "Meetings" },
  { value: "document", label: "Documents" },
  { value: "feedback", label: "Feedback" },
  { value: "ai_workbench", label: "AI Workbench" },
];

const PAGE_SIZE = 50;

// ── Component ────────────────────────────────────────────────────────────────

export default function AgentLogs() {
  const { id } = useParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(null);
  const cursorRef = useRef(null);
  const abortRef = useRef(null);

  // ── Fetch logs (with cursor pagination) ──────────────────────────────────
  const fetchLogs = useCallback(
    async ({ silent = false, append = false, before = null } = {}) => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (silent) {
        // no-op for silent refresh – keep existing UI state
      } else if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const params = new URLSearchParams({
          projectId: id,
          limit: String(PAGE_SIZE),
        });
        if (before) params.set("before", before);

        const res = await api.get(
          `/agents/coordination/activity?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        const data = res.data;
        // Support both new { logs, hasMore } shape and legacy array shape
        const incoming = Array.isArray(data) ? data : data.logs || [];
        const more = Array.isArray(data)
          ? incoming.length >= PAGE_SIZE
          : !!data.hasMore;

        setLogs((prev) => (append ? [...prev, ...incoming] : incoming));
        setHasMore(more);
        setLastUpdated(new Date());

        if (incoming.length > 0) {
          cursorRef.current = incoming[incoming.length - 1].created_at;
        }
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED")
          return;
        console.error(err);
        if (!silent) {
          setError("Failed to load agent logs. Please try again.");
        }
        if (!silent) toast.error("Failed to load agent logs");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [id],
  );

  // ── Initial load + polling ───────────────────────────────────────────────
  useEffect(() => {
    fetchLogs();
    const intervalId = setInterval(() => fetchLogs({ silent: true }), 5000);
    return () => {
      clearInterval(intervalId);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchLogs]);

  // ── Document title ───────────────────────────────────────────────────────
  useEffect(() => {
    document.title = "Agent Logs – CollabAgent";
    return () => {
      document.title = "CollabAgent";
    };
  }, []);

  // ── Load more ────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (cursorRef.current) {
      fetchLogs({ append: true, before: cursorRef.current });
    }
  }, [fetchLogs]);

  // ── Filtered logs ────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    if (activeFilter === "all") return logs;
    return logs.filter((log) => (log.event_type || "").includes(activeFilter));
  }, [logs, activeFilter]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Layout activePath={`/projects/${id}/agents`} projectId={id}>
      <div className="p-5 md:p-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#191c1d]">
              Agent Activity Logs
            </h1>
            <p className="text-sm text-[#555f6d] mt-1">
              Real-time event stream from the Team Coordination Agent.
            </p>
            {lastUpdated && (
              <p className="text-[11px] text-[#9ca3af] mt-1">
                Last updated{" "}
                {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                {" · auto-refreshes every 5 s"}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              cursorRef.current = null;
              fetchLogs();
            }}
            className="h-10 px-5 bg-white border border-[#c3c5d7] text-[#191c1d] rounded-xl text-sm font-bold hover:bg-[#f3f4f5] transition-colors shadow-sm"
          >
            Refresh
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {EVENT_TYPE_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-colors border",
                activeFilter === value
                  ? "bg-[#003fb1] text-white border-[#003fb1]"
                  : "bg-white text-[#434654] border-[#c3c5d7] hover:bg-[#f3f4f5]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 bg-white border border-[#e1e3e4] rounded-2xl animate-pulse w-full"
              />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white border border-[#ba1a1a]/30 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="font-semibold text-[#191c1d] mb-2">
              Unable to load logs
            </h3>
            <p className="text-sm text-[#555f6d] mb-4">{error}</p>
            <button
              onClick={() => fetchLogs()}
              className="h-9 px-5 bg-[#003fb1] text-white rounded-xl text-sm font-bold hover:bg-[#002d7a] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredLogs.length === 0 && logs.length === 0 ? (
          <div className="bg-white border border-dashed border-[#c3c5d7] rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="font-semibold text-[#191c1d] mb-2">
              No activity logged yet
            </h3>
            <p className="text-sm text-[#555f6d]">
              Agents are standing by to coordinate your research.
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white border border-dashed border-[#c3c5d7] rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-semibold text-[#191c1d] mb-2">
              No matching logs
            </h3>
            <p className="text-sm text-[#555f6d]">
              No activity matches the selected filter. Try a different category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredLogs.map((log) => (
              <LogCard key={log.id} log={log} />
            ))}

            {/* Load more */}
            {hasMore && activeFilter === "all" && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="h-10 w-full max-w-xs rounded-xl border border-[#c3c5d7] text-sm font-bold text-[#434654] hover:bg-[#f3f4f5] disabled:opacity-60 transition-colors"
                >
                  {loadingMore ? "Loading…" : "Load older logs"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── Log card sub-component (memoized) ────────────────────────────────────────

const LogCard = React.memo(function LogCard({ log }) {
  const summaryText = log.metadata?.summary;
  const description = log.metadata?.description || log.metadata?.title;

  return (
    <div className="bg-white border border-[#e1e3e4] rounded-2xl p-5 shadow-sm hover:border-[#003fb1]/30 transition-all group">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#f3f4f5] flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-[#d6e0f1] transition-colors">
          {getEventIcon(log.event_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <h3 className="text-base font-bold text-[#191c1d] capitalize">
              {(log.metadata?.actionType || log.event_type).replace(".", " ")}
            </h3>
            <span className="text-xs font-medium text-[#737686] bg-[#f3f4f5] px-2.5 py-1 rounded-full w-fit">
              {new Date(log.created_at).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>

          {/* Actor + role + status */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#434654]">
            <span className="font-semibold text-[#191c1d]">
              {log.actor_name || "System Agent"}
            </span>
            {log.metadata?.role && (
              <span className="px-2 py-0.5 bg-[#d6e0f1] text-[#003fb1] text-[10px] font-bold rounded-full uppercase tracking-tight">
                {log.metadata.role}
              </span>
            )}
            {log.metadata?.status && (
              <span
                className={clsx(
                  "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tight",
                  log.metadata.status === "success"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-[#eef1f6] text-[#434654]",
                )}
              >
                {log.metadata.status}
              </span>
            )}
          </div>

          {/* Prominent description / summary */}
          {(summaryText || description) && (
            <p className="mt-2 text-sm text-[#555f6d] leading-relaxed line-clamp-3">
              {summaryText || description}
            </p>
          )}

          {/* Remaining metadata */}
          {formatMetadata(log.metadata)}
        </div>
      </div>
    </div>
  );
});
