import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Gavel,
  Search,
  Settings,
  Sparkles,
  ThumbsUp,
  Users,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import api from "../utils/api";

const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButton = `${buttonBase} bg-[#0b47c2] text-white hover:bg-[#063796]`;
const secondaryButton = `${buttonBase} border border-[#aeb6cb] bg-white text-[#303846] hover:bg-[#f5f7fb]`;

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function SectionCard({
  children,
  className,
  as: Component = "section",
  ...props
}) {
  return (
    <Component
      className={clsx(
        "rounded-lg border border-[#c6ccdc] bg-white shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

function MetricRing({ value, colorClass, label, helper, ariaLabel }) {
  const normalized = clampPercent((value / 5) * 100);

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="grid h-24 w-24 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${colorClass} ${normalized}%, #e4e6ea 0)`,
        }}
        role="img"
        aria-label={ariaLabel}
      >
        <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white text-base font-medium text-[#191c1d]">
          {value.toFixed(1)}
        </div>
      </div>
      <h3 className="mt-5 text-sm font-bold text-[#191c1d]">{label}</h3>
      <p className="mt-1 max-w-[190px] text-sm leading-5 text-[#434654]">
        {helper}
      </p>
    </div>
  );
}

class TeamHubErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[TeamCoordinationHub] Render failure:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Layout activePath="/dashboard">
        <div className="mx-auto flex min-h-full w-full max-w-4xl items-center justify-center p-6">
          <SectionCard className="p-6">
            <h1 className="text-lg font-bold text-[#a40000]">
              Team Coordination Hub could not render
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#434654]">
              Refresh the page or return to the dashboard. The rest of the
              application is unaffected.
            </p>
            <Link className={clsx(primaryButton, "mt-5")} to="/dashboard">
              Return to Dashboard
            </Link>
          </SectionCard>
        </div>
      </Layout>
    );
  }
}

function TeamMemberCard({ member }) {
  const alignment = clampPercent(member.alignment);

  return (
    <article className="rounded-lg border border-[#c6ccdc] bg-[#fafbfc] p-4">
      <div className="flex items-start gap-3">
        <img
          src={member.avatar}
          alt=""
          className="h-12 w-12 rounded-lg object-cover ring-1 ring-[#c6ccdc]"
          onError={(event) => {
            event.currentTarget.src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%23d6e0f1'/%3E%3Ctext x='50%25' y='53%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='24' fill='%23003fb1'%3ECA%3C/text%3E%3C/svg%3E";
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-[#191c1d]">
                {member.name}
              </h3>
              <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-[0.18em] text-[#303846]">
                {member.role}
              </p>
            </div>
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-[#006d45]"
              aria-label={member.status}
            />
          </div>
          <div className="mt-4">
            <div
              className="h-2 overflow-hidden rounded-full bg-[#e5e7eb]"
              role="progressbar"
              aria-label={`${member.name} role alignment`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={alignment}
            >
              <div
                className="h-full rounded-full bg-[#0b47c2]"
                style={{ width: `${alignment}%` }}
              />
            </div>
            <div className="mt-2 text-right text-sm text-[#434654]">
              {alignment}% Alignment
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TeamComposition({ members, onAccept, onDismiss, optimizationState }) {
  return (
    <SectionCard className="min-h-[520px] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#0b47c2]" />
          <h2 className="text-lg font-medium text-[#191c1d]">
            Team Composition
          </h2>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#84efbd] px-4 py-2 text-sm font-medium text-[#005438]">
          <CheckCircle2 className="h-4 w-4" />
          Balanced
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {members.length ? (
          members.map((member) => (
            <TeamMemberCard key={member.id} member={member} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[#c6ccdc] p-5 text-sm text-[#434654] md:col-span-2">
            No active members are assigned to this project yet.
          </div>
        )}
      </div>

      {optimizationState !== "dismissed" && (
        <div
          className={clsx(
            "mt-8 rounded-lg border p-5",
            optimizationState === "accepted"
              ? "border-[#84efbd] bg-[#f3fff8]"
              : "border-[#0b47c2] bg-gradient-to-br from-white to-[#f6fff9]",
          )}
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.08em] text-[#003fb1]">
            <Sparkles className="h-5 w-5" />
            AI Optimization Recommendation
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#191c1d]">
            Based on Sarah's high performance in technical writing, CollabAgent
            suggests shifting <strong>Documentation Oversight</strong> to her
            role, freeing Jordan to focus on{" "}
            <strong>Stakeholder Communication</strong>.
          </p>
          {optimizationState === "accepted" ? (
            <p className="mt-4 text-sm font-semibold text-[#005438]">
              Optimization accepted. The updated role plan is queued for the
              next sync.
            </p>
          ) : (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className={primaryButton}
                onClick={onAccept}
                aria-label="Accept AI role optimization recommendation"
              >
                Accept Optimization
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={onDismiss}
                aria-label="Dismiss AI role optimization recommendation"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function AccountabilityPulse({ risks, completedCheckins, totalCheckins }) {
  const weeklySync =
    totalCheckins > 0
      ? Math.round((completedCheckins / totalCheckins) * 100)
      : 88;

  return (
    <SectionCard className="p-5 sm:p-6" aria-labelledby="accountability-title">
      <div className="flex items-center gap-3">
        <Zap className="h-5 w-5 text-[#d00000]" />
        <h2
          id="accountability-title"
          className="text-xl font-medium text-[#191c1d]"
        >
          Accountability Pulse
        </h2>
      </div>

      <div className="mt-5 space-y-4">
        {risks.length > 0 ? (
          risks.map((risk) => (
            <article
              key={risk.id}
              className="border-l-4 border-[#d00000] bg-white px-4 py-4 shadow-sm"
              role="status"
            >
              <p className="text-sm font-medium uppercase tracking-[0.08em] text-[#d00000]">
                Flagged:{" "}
                {risk.risk_type?.replace(/_/g, " ").toUpperCase() ||
                  "RISK DETECTED"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#191c1d]">
                <strong>Risk</strong>: {risk.description}
                {risk.suggested_action && (
                  <span className="block mt-1 text-[#434654]">
                    Suggested action: {risk.suggested_action}
                  </span>
                )}
              </p>
            </article>
          ))
        ) : (
          <article
            className="border-l-4 border-[#006d45] bg-white px-4 py-4 shadow-sm"
            role="status"
          >
            <p className="text-sm font-medium text-[#006d45]">
              No active risks detected
            </p>
            <p className="mt-2 text-sm leading-6 text-[#191c1d]">
              All team members are up to date with their commitments.
            </p>
          </article>
        )}

        <div className="border-l-4 border-[#0b47c2] bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[#191c1d]">
              Weekly Sync Pulse
            </h3>
            <span className="text-sm font-bold text-[#003fb1]">
              {weeklySync}%
            </span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e7eb]"
            role="progressbar"
            aria-label="Weekly sync pulse"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={weeklySync}
          >
            <div
              className="h-full rounded-full bg-[#0b47c2]"
              style={{ width: `${weeklySync}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-[#434654]">Next sync in 4 hours</p>
        </div>

        <div className="flex items-center justify-between gap-3 px-2 py-3 text-sm">
          <span className="text-[#434654]">Check-ins Completed</span>
          <span className="font-bold text-[#191c1d]">
            {completedCheckins}/{totalCheckins}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

function FeedbackRequestCard({ feedbackItems, onOpenFeedback, selectedId }) {
  return (
    <SectionCard
      className="p-5 sm:p-6"
      aria-labelledby="pending-feedback-title"
    >
      <h2
        id="pending-feedback-title"
        className="text-sm font-medium uppercase tracking-[0.22em] text-[#303846]"
      >
        Feedback Center
      </h2>
      <div className="mt-5 space-y-2">
        {feedbackItems.length > 0 ? (
          feedbackItems.map((request) => (
            <button
              key={request.id}
              type="button"
              className={clsx(
                "flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-sm text-[#191c1d] transition-colors hover:bg-[#f3f6ff] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30",
                selectedId === String(request.rawId) && "bg-[#f0f4ff]",
              )}
              onClick={() => onOpenFeedback(request)}
              aria-label={`Open pending peer review: ${request.label}`}
            >
              <span
                className={clsx(
                  "h-2 w-2 rounded-full",
                  request.priority ? "bg-[#0b47c2]" : "bg-[#c3c5d7]",
                )}
                aria-hidden="true"
              />
              <span className="flex-1">{request.label}</span>
              <ChevronRight className="h-4 w-4 text-[#191c1d]" />
            </button>
          ))
        ) : (
          <div className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-sm text-[#434654]">
            No pending feedback requests.
          </div>
        )}
      </div>
      <button
        type="button"
        className={clsx(
          secondaryButton,
          "mt-6 w-full border-[#0b47c2] text-[#003fb1]",
        )}
        onClick={() => {
          if (feedbackItems[0]) {
            onOpenFeedback(feedbackItems[0]);
          }
        }}
        disabled={!feedbackItems.length}
        aria-label="Open full feedback center"
      >
        Open Full Center
      </button>
    </SectionCard>
  );
}

function AdvisorFeedbackDetail({ feedback }) {
  if (!feedback) return null;

  return (
    <SectionCard className="p-5 sm:p-6" aria-labelledby="advisor-feedback-detail">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="advisor-feedback-detail"
            className="text-sm font-medium uppercase tracking-[0.22em] text-[#303846]"
          >
            Advisor Feedback
          </h2>
          <p className="mt-2 text-sm font-semibold text-[#191c1d]">
            {feedback.advisor_name || "Advisor"}
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold capitalize text-[#003fb1]">
          {feedback.severity || "medium"}
        </span>
      </div>
      <div className="mt-4 rounded-lg bg-[#f8f9fb] p-4 text-sm leading-6 text-[#191c1d]">
        {feedback.body}
      </div>
      <dl className="mt-4 grid gap-3 text-xs text-[#555f6d] sm:grid-cols-3">
        <div>
          <dt className="font-bold uppercase tracking-wide text-[#303846]">Category</dt>
          <dd className="mt-1 capitalize">{feedback.category || "general"}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide text-[#303846]">Status</dt>
          <dd className="mt-1 capitalize">{feedback.status || "posted"}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide text-[#303846]">Posted</dt>
          <dd className="mt-1">
            {feedback.created_at
              ? new Date(feedback.created_at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Unknown"}
          </dd>
        </div>
      </dl>
    </SectionCard>
  );
}

function FeedbackCenter({
  sentimentTags,
  collaborationIndex,
  accountabilityRating,
}) {
  return (
    <SectionCard className="p-5 sm:p-6" aria-labelledby="feedback-center-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <ThumbsUp className="h-5 w-5 text-[#0b47c2]" />
          <h2
            id="feedback-center-title"
            className="text-base font-medium text-[#191c1d]"
          >
            Peer Feedback Center
          </h2>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-[#303846]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#006d45]" />
            Accountability
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#0b47c2]" />
            Collaboration
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr_1.1fr]">
        <div className="flex justify-center lg:border-r lg:border-[#c6ccdc] lg:pr-8">
          <MetricRing
            value={collaborationIndex}
            colorClass="#0b47c2"
            label="Collaboration Index"
            helper="Based on recent peer feedback activity"
            ariaLabel={`Collaboration Index score ${collaborationIndex.toFixed(1)} out of 5`}
          />
        </div>
        <div className="flex justify-center lg:border-r lg:border-[#c6ccdc] lg:pr-8">
          <MetricRing
            value={accountabilityRating}
            colorClass="#006d45"
            label="Accountability Rating"
            helper="Consistent but missing small syncs"
            ariaLabel={`Accountability Rating score ${accountabilityRating.toFixed(1)} out of 5`}
          />
        </div>
        <div className="flex flex-col justify-center">
          <h3 className="text-sm font-medium uppercase tracking-[0.22em] text-[#303846]">
            Recent Feedback Sentiments
          </h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {sentimentTags.length > 0 ? (
              sentimentTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#dfe6f2] px-3 py-1.5 text-xs font-bold text-[#303846]"
                >
                  "{tag}"
                </span>
              ))
            ) : (
              <span className="text-sm text-[#434654]">
                No feedback data yet
              </span>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ConsensusCenter({ teamMembers }) {
  const [supported, setSupported] = useState(false);

  return (
    <SectionCard
      className="overflow-hidden border-[#0b47c2]"
      aria-labelledby="consensus-title"
    >
      <div className="flex flex-col gap-3 bg-[#225bdc] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Gavel className="h-5 w-5" />
          <h2 id="consensus-title" className="text-lg font-medium">
            Mediated Consensus Center
          </h2>
        </div>
        <span className="w-fit rounded bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]">
          Active Mediation
        </span>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.08em] text-[#003fb1]">
            Pending Friction Point
          </p>
          <article className="mt-5 rounded bg-[#f0f1f3] p-5">
            <h3 className="font-bold text-[#191c1d]">
              Dataset Selection Disagreement
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#303846]">
              Jordan favors the 2023 OpenSource set, while Sarah argues for the
              restricted University Repository.
            </p>
            <div
              className="mt-5 flex -space-x-2"
              aria-label="Participants: Jordan and Sarah"
            >
              {teamMembers.slice(0, 2).map((member) => (
                <img
                  key={member.id}
                  src={member.avatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover ring-2 ring-white"
                />
              ))}
            </div>
          </article>
        </div>

        <div className="border-t border-[#c6ccdc] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-[#e7edf9] text-[#0b47c2]">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-[#003fb1]">
                CollabAgent Agent Proposal
              </h3>
              <p className="mt-2 text-sm italic leading-6 text-[#191c1d]">
                "I recommend a hybrid approach: Use the OpenSource set for
                initial training and the University Repository for validation to
                ensure academic uniqueness."
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={clsx(primaryButton, "sm:flex-1")}
              onClick={() => {
                setSupported(true);
                toast.success("Proposal support recorded.");
              }}
              aria-pressed={supported}
              aria-label="Support the mediated dataset proposal"
            >
              {supported ? "Proposal Supported" : "Support Proposal"}
            </button>
            <button
              type="button"
              className={clsx(secondaryButton, "sm:flex-1")}
              onClick={() => toast.success("Alternative proposal flow opened.")}
              aria-label="Propose an alternative mediation plan"
            >
              Propose Alternative
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function HubToolbar() {
  return (
    <header className="border-b border-[#c6ccdc] bg-white/70 px-4 py-4 backdrop-blur md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative w-full max-w-md">
          <span className="sr-only">Search team resources</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#191c1d]" />
          <input
            type="search"
            placeholder="Search team resources..."
            className="h-11 w-full rounded-xl border border-transparent bg-[#f3f4f5] pl-12 pr-4 text-sm text-[#191c1d] outline-none transition-all placeholder:text-[#596170] focus:border-[#0b47c2] focus:bg-white focus:ring-2 focus:ring-[#0b47c2]/20"
          />
        </label>
        <div className="flex items-center gap-3 text-[#191c1d]">
          {[
            { label: "Agent briefings", icon: Bot },
            { label: "Notifications", icon: ClipboardCheck },
            { label: "Settings", icon: Settings },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className="grid h-10 w-10 place-items-center rounded-lg hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
              aria-label={label}
              onClick={() => toast.success(`${label} opened.`)}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
          <div className="ml-2 h-8 w-px bg-[#c6ccdc]" />
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0f3d4a] text-sm font-bold text-white">
            JC
          </div>
        </div>
      </div>
    </header>
  );
}

const DEFAULT_MEMBER_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%23d6e0f1'/%3E%3Ctext x='50%25' y='53%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='24' fill='%23003fb1'%3EME%3C/text%3E%3C/svg%3E";

function TeamCoordinationHubContent() {
  const { id: projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [optimizationState, setOptimizationState] = useState("pending");
  const [project, setProject] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [risks, setRisks] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [metrics, setMetrics] = useState({
    completedCheckins: 12,
    totalCheckins: 14,
  });
  const [sentimentTags, setSentimentTags] = useState([]);
  const [collaborationIndex, setCollaborationIndex] = useState(4.8);
  const [accountabilityRating, setAccountabilityRating] = useState(4.2);
  const [loading, setLoading] = useState(true);

  const projectHref = useMemo(() => `/projects/${projectId}`, [projectId]);
  const selectedFeedbackId = searchParams.get("feedbackId");

  const handleOpenFeedback = useCallback(
    (feedback) => {
      setSelectedFeedback(feedback);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("feedbackId", String(feedback.rawId || feedback.id));
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Map a project member to the TeamMemberCard shape
  const mapMember = useCallback(
    (member) => ({
      id: member.id,
      name: member.full_name,
      role: member.member_role === "owner" ? "Coordinator" : "Lead Researcher",
      alignment: member.member_role === "owner" ? 85 : 92,
      avatar: member.avatar_url || DEFAULT_MEMBER_AVATAR,
      status:
        member.member_role === "owner"
          ? "Role load stable"
          : "High technical writing fit",
    }),
    [],
  );

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const [projRes, risksRes, feedbackRes] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api
            .get(`/agents/progress/risks?projectId=${projectId}`)
            .catch(() => ({ data: [] })),
          api
            .get(`/agents/feedback/open?projectId=${projectId}`)
            .catch(() => ({ data: [] })),
        ]);

        const projectData = projRes.data.project;
        setProject(projectData);

        // Map project members to team member cards
        const rawMembers = projectData.members || [];
        setTeamMembers(rawMembers.map(mapMember));

        // Risks for accountability pulse
        const riskData = risksRes.data || [];
        setRisks(Array.isArray(riskData) ? riskData : []);

        // Open feedback for feedback center
        const feedbackData = feedbackRes.data || [];
        const fbItems = Array.isArray(feedbackData) ? feedbackData : [];
        setFeedbackItems(
          fbItems.map((fb) => ({
            id: fb.id,
            rawId: fb.id,
            label: `${fb.category ? `${fb.category}: ` : ""}${fb.body?.slice(0, 60) || "Feedback item"}${fb.body?.length > 60 ? "..." : ""}`,
            priority: fb.severity === "high" || fb.severity === "urgent",
            ...fb,
          })),
        );

        let selected = selectedFeedbackId
          ? fbItems.find((fb) => String(fb.id) === String(selectedFeedbackId))
          : null;
        if (!selected && selectedFeedbackId) {
          try {
            const detailRes = await api.get(`/agents/feedback/${selectedFeedbackId}`);
            selected = detailRes.data?.feedback || null;
          } catch (err) {
            console.error("[TeamCoordinationHub] Failed to load feedback detail:", err);
          }
        }
        setSelectedFeedback(selected || fbItems[0] || null);

        // Compute sentiment tags from feedback categories
        const categories = [
          ...new Set(fbItems.map((fb) => fb.category).filter(Boolean)),
        ];
        setSentimentTags(
          categories.length > 0
            ? categories.map((c) => c.charAt(0).toUpperCase() + c.slice(1))
            : ["Highly Responsive", "Clear Detail", "Proactive Solver"],
        );

        // Compute metrics from feedback and risks
        const completed = fbItems.filter(
          (fb) => fb.status === "resolved" || fb.status === "responded",
        ).length;
        const total = fbItems.length;
        setMetrics({
          completedCheckins: total > 0 ? completed : 12,
          totalCheckins: total > 0 ? total : 14,
        });

        // Collaboration index (compute from feedback ratio)
        if (total > 0) {
          const ratio = completed / total;
          setCollaborationIndex(
            Math.min(5, Math.round((3 + ratio * 2) * 10) / 10),
          );
          setAccountabilityRating(
            Math.min(5, Math.round((2.5 + ratio * 2.5) * 10) / 10),
          );
        }
      } catch (err) {
        console.error("[TeamCoordinationHub] Failed to load data:", err);
        toast.error("Failed to load some team data. Using defaults.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, mapMember, selectedFeedbackId]);

  if (loading) {
    return (
      <Layout activePath={`/projects/${projectId}/team`} projectId={projectId}>
        <HubToolbar />
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-[#e1e3e4] rounded w-3/4" />
            <div className="h-8 bg-[#e1e3e4] rounded w-1/2" />
            <div className="grid gap-6 lg:grid-cols-[2fr_0.95fr]">
              <div className="h-[520px] bg-[#e1e3e4] rounded-lg" />
              <div className="space-y-6">
                <div className="h-48 bg-[#e1e3e4] rounded-lg" />
                <div className="h-48 bg-[#e1e3e4] rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout activePath={`/projects/${projectId}/team`} projectId={projectId}>
      <HubToolbar />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <nav
          className="flex flex-wrap items-center gap-2 text-xs text-[#596170]"
          aria-label="Breadcrumb"
        >
          <Link to="/projects" className="hover:text-[#003fb1]">
            Projects
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to={projectHref} className="hover:text-[#003fb1]">
            {project?.name || "Project"}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-bold text-[#003fb1]">
            Team Coordination Hub
          </span>
        </nav>

        <div className="mt-3">
          <h1 className="text-xl font-medium text-[#191c1d]">
            Team Coordination Hub
          </h1>
          <p className="mt-1 max-w-3xl text-base leading-6 text-[#191c1d]">
            Synchronizing human intelligence with AI-driven organizational
            insights for academic excellence.
          </p>
        </div>

        <div className="mt-9 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(290px,0.95fr)]">
          <TeamComposition
            members={teamMembers}
            optimizationState={optimizationState}
            onAccept={() => {
              setOptimizationState("accepted");
              toast.success("Optimization accepted.");
            }}
            onDismiss={() => {
              setOptimizationState("dismissed");
              toast.success("Optimization dismissed.");
            }}
          />
          <div className="space-y-6">
            <AccountabilityPulse
              risks={risks}
              completedCheckins={metrics.completedCheckins}
              totalCheckins={metrics.totalCheckins}
            />
            <FeedbackRequestCard
              feedbackItems={feedbackItems}
              onOpenFeedback={handleOpenFeedback}
              selectedId={selectedFeedback ? String(selectedFeedback.id) : ""}
            />
            <AdvisorFeedbackDetail feedback={selectedFeedback} />
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <FeedbackCenter
            sentimentTags={sentimentTags}
            collaborationIndex={collaborationIndex}
            accountabilityRating={accountabilityRating}
          />
          <ConsensusCenter teamMembers={teamMembers} />
        </div>
      </div>
    </Layout>
  );
}

export default function TeamCoordinationHub() {
  return (
    <TeamHubErrorBoundary>
      <TeamCoordinationHubContent />
    </TeamHubErrorBoundary>
  );
}
