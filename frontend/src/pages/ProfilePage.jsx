import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Award,
  Brain,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Github,
  GraduationCap,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const DEFAULT_PROFILE = {
  fullName: "Researcher",
  initials: "R",
  title: "Director of Computational Ethics",
  organization: "CollabAgent AI",
  location: "San Francisco, CA",
  email: "",
  joined: "Joined 2021",
  avatarUrl: "",
  bio: "This researcher has not added a professional overview yet.",
  interests: [
    "Neural Alignment",
    "Ethical AI",
    "Societal Bias",
    "Human-AI Collaboration",
    "Computational Ethics",
    "Bias Detection",
  ],
  publications: [
    {
      title: "Measuring Alignment Drift in Collaborative Agent Systems",
      publisher: "MIT Press",
      year: "2022",
      href: "#alignment-drift",
    },
    {
      title: "Human Review Loops for High-Impact Generative Workflows",
      publisher: "ACM FAccT Proceedings",
      year: "2023",
      href: "#review-loops",
    },
    {
      title: "Bias Detection Under Multi-Agent Summarization",
      publisher: "Journal of Responsible AI",
      year: "2024",
      href: "#bias-detection",
    },
  ],
  academicLinks: {
    google_scholar: "https://scholar.google.com",
    github: "https://github.com",
    orcid: "https://orcid.org",
    cv: "/Aurora-Thorne-CV.pdf",
  },
};

const projects = [
  {
    id: "alignment-metrics",
    title: "Alignment Metrics for Collaborative Agents",
    description:
      "Evaluating agent behavior across shared research workspaces using preference drift, task fidelity, and intervention-aware scoring.",
    status: "High Priority",
    statusTone: "green",
    timestamp: "Updated 2h ago",
    feature: "AI-Insights Enabled",
    progress: 82,
    collaborators: [
      { name: "Maya Lee", initials: "ML", tone: "bg-[#0b47c2]" },
      { name: "Jon Bell", initials: "JB", tone: "bg-[#005438]" },
      { name: "Priya Shah", initials: "PS", tone: "bg-[#6f3cc3]" },
      { name: "Noah Kim", initials: "NK", tone: "bg-[#8a4b08]" },
    ],
    overflow: 3,
  },
  {
    id: "bias-observatory",
    title: "Societal Bias Observatory",
    description:
      "Building longitudinal benchmarks that identify harmful representational patterns in multi-agent research summaries.",
    status: "In Review",
    statusTone: "blue",
    timestamp: "Updated yesterday",
    feature: "Risk Monitor Active",
    progress: 64,
    collaborators: [
      { name: "Elena Park", initials: "EP", tone: "bg-[#0b47c2]" },
      { name: "Owen Grant", initials: "OG", tone: "bg-[#006a60]" },
      { name: "Sam Rivera", initials: "SR", tone: "bg-[#875300]" },
    ],
    overflow: 1,
  },
  {
    id: "governance-lab",
    title: "Governance Sandbox for Human-AI Teams",
    description:
      "A simulation environment for testing consent flows, review checkpoints, and escalation policies before deployment.",
    status: "Planning",
    statusTone: "gray",
    timestamp: "Created 4 days ago",
    feature: "Policy Graph Drafted",
    progress: 38,
    collaborators: [
      { name: "Iris Morgan", initials: "IM", tone: "bg-[#77536d]" },
      { name: "Theo Brooks", initials: "TB", tone: "bg-[#455d7a]" },
    ],
    overflow: 4,
  },
];

const statusStyles = {
  green: "border-[#87d6aa] bg-[#e4f7ed] text-[#005438]",
  blue: "border-[#a8c7fa] bg-[#edf3ff] text-[#0b47c2]",
  gray: "border-[#d7d9e1] bg-[#f3f4f5] text-[#555f6d]",
};

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "R";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatJoinDate(value) {
  if (!value) return DEFAULT_PROFILE.joined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DEFAULT_PROFILE.joined;
  return `Joined ${date.getFullYear()}`;
}

function mapProfile(row) {
  if (!row) return DEFAULT_PROFILE;
  const fullName = row.full_name || DEFAULT_PROFILE.fullName;
  return {
    id: row.id,
    fullName,
    initials: getInitials(fullName),
    title: row.job_title || DEFAULT_PROFILE.title,
    organization:
      row.organization || row.institution || DEFAULT_PROFILE.organization,
    location: row.location || DEFAULT_PROFILE.location,
    email: row.email || "",
    joined: formatJoinDate(row.created_at),
    avatarUrl: row.avatar_url || "",
    bio: row.bio || DEFAULT_PROFILE.bio,
    interests:
      Array.isArray(row.research_interests) && row.research_interests.length
        ? row.research_interests
        : DEFAULT_PROFILE.interests,
    publications:
      Array.isArray(row.publications) && row.publications.length
        ? row.publications
        : DEFAULT_PROFILE.publications,
    academicLinks: {
      ...DEFAULT_PROFILE.academicLinks,
      ...(row.academic_links || {}),
    },
  };
}

function buildExternalLinks(academicLinks = DEFAULT_PROFILE.academicLinks) {
  return [
    {
      label: "Google Scholar",
      href: academicLinks.google_scholar,
      icon: GraduationCap,
      tone: "text-[#174ea6]",
    },
    {
      label: "GitHub",
      href: academicLinks.github,
      icon: Github,
      tone: "text-[#24292f]",
    },
    {
      label: "ORCID ID",
      href: academicLinks.orcid,
      icon: Award,
      tone: "text-[#4c7f00]",
    },
    {
      label: "Resume / CV",
      href: academicLinks.cv,
      icon: Download,
      tone: "text-[#7a4d00]",
      download: true,
    },
  ].filter((item) => item.href);
}

function Card({
  children,
  className = "",
  as: Component = "section",
  ...props
}) {
  return (
    <Component
      className={`rounded-2xl border border-[#e1e3e4] bg-white shadow-sm ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

function ProfileAvatar({ user }) {
  const [hasImageError, setHasImageError] = useState(false);
  const showImage = user.avatarUrl && !hasImageError;

  return (
    <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
      {showImage ? (
        <img
          src={user.avatarUrl}
          alt={`${user.fullName} profile portrait`}
          onError={() => setHasImageError(true)}
          className="h-full w-full rounded-full object-cover ring-4 ring-white"
        />
      ) : (
        <div
          aria-label={`${user.fullName} profile initials`}
          className="grid h-full w-full place-items-center rounded-full bg-[#0b47c2] text-3xl font-bold text-white ring-4 ring-white"
        >
          {user.initials}
        </div>
      )}
      <span className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full border-4 border-white bg-[#005438] text-white shadow-sm">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Verified profile</span>
      </span>
    </div>
  );
}

function MetadataChip({ icon: Icon, children, href }) {
  const content = (
    <>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </>
  );

  const classes =
    "inline-flex max-w-full items-center gap-2 rounded-full border border-[#d8dde6] bg-[#f8f9fb] px-3 py-2 text-sm font-medium text-[#434654] transition-colors hover:border-[#b8c0ce] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30";

  return href ? (
    <a className={classes} href={href}>
      {content}
    </a>
  ) : (
    <span className={classes}>{content}</span>
  );
}

function EditProfileModal({ user, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    fullName: user.fullName,
    title: user.title,
    organization: user.organization,
    location: user.location,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    interests: user.interests.join(", "),
  });
  const [error, setError] = useState("");
  const fullNameInputRef = useRef(null);

  useEffect(() => {
    fullNameInputRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.fullName.trim() || !form.title.trim() || !form.bio.trim()) {
      setError("Name, title, and bio are required.");
      return;
    }
    onSave({
      full_name: form.fullName.trim(),
      job_title: form.title.trim(),
      organization: form.organization.trim(),
      location: form.location.trim(),
      avatar_url: form.avatarUrl.trim(),
      bio: form.bio.trim(),
      research_interests: form.interests
        .split(",")
        .map((interest) => interest.trim())
        .filter(Boolean),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-[#e1e3e4] bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="edit-profile-title"
              className="text-xl font-bold text-[#191c1d]"
            >
              Edit profile
            </h2>
            <p className="mt-1 text-sm text-[#555f6d]">
              Update the researcher summary shown on this profile.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#555f6d] transition-colors hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
            aria-label="Close edit profile modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div
            className="mb-4 rounded-xl border border-[#ffdad6] bg-[#fff4f2] px-4 py-3 text-sm font-medium text-[#ba1a1a]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[#191c1d]">
              Full name
            </span>
            <input
              ref={fullNameInputRef}
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
              disabled={saving}
              className="mt-2 h-11 w-full rounded-xl border border-[#c3c5d7] px-3 text-sm text-[#191c1d] outline-none transition-colors focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#191c1d]">
              Job title
            </span>
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              disabled={saving}
              className="mt-2 h-11 w-full rounded-xl border border-[#c3c5d7] px-3 text-sm text-[#191c1d] outline-none transition-colors focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#191c1d]">
                Organization
              </span>
              <input
                value={form.organization}
                onChange={(event) =>
                  updateField("organization", event.target.value)
                }
                disabled={saving}
                className="mt-2 h-11 w-full rounded-xl border border-[#c3c5d7] px-3 text-sm text-[#191c1d] outline-none transition-colors focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#191c1d]">
                Location
              </span>
              <input
                value={form.location}
                onChange={(event) =>
                  updateField("location", event.target.value)
                }
                disabled={saving}
                className="mt-2 h-11 w-full rounded-xl border border-[#c3c5d7] px-3 text-sm text-[#191c1d] outline-none transition-colors focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-[#191c1d]">
              Avatar URL
            </span>
            <input
              value={form.avatarUrl}
              onChange={(event) => updateField("avatarUrl", event.target.value)}
              disabled={saving}
              placeholder="https://example.com/avatar.jpg"
              className="mt-2 h-11 w-full rounded-xl border border-[#c3c5d7] px-3 text-sm text-[#191c1d] outline-none transition-colors focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#191c1d]">Bio</span>
            <textarea
              value={form.bio}
              onChange={(event) => updateField("bio", event.target.value)}
              disabled={saving}
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-[#c3c5d7] px-3 py-3 text-sm leading-6 text-[#191c1d] outline-none transition-colors focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#191c1d]">
              Research interests
            </span>
            <input
              value={form.interests}
              onChange={(event) => updateField("interests", event.target.value)}
              disabled={saving}
              className="mt-2 h-11 w-full rounded-xl border border-[#c3c5d7] px-3 text-sm text-[#191c1d] outline-none transition-colors focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 rounded-xl border border-[#c3c5d7] px-5 text-sm font-semibold text-[#434654] transition-colors hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-xl bg-[#0b47c2] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#063796] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProfileHeader({ profile, onSave, saving }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <Card className="p-5 sm:p-7" aria-labelledby="profile-heading">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <ProfileAvatar user={profile} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  id="profile-heading"
                  className="text-2xl font-bold text-[#191c1d] sm:text-3xl"
                >
                  {profile.fullName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f7ed] px-2.5 py-1 text-xs font-bold text-[#005438]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Verified
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-[#434654]">
                {profile.title}
              </p>
              <p className="text-sm font-medium text-[#0b47c2]">
                @ {profile.organization}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0b47c2] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#063796] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30 focus:ring-offset-2"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit Profile
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-[#e1e3e4] bg-[#f8f9fb] p-4">
          <h2 className="sr-only">Professional overview</h2>
          <p className="whitespace-pre-line text-sm leading-6 text-[#434654]">
            {profile.bio}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <MetadataChip icon={MapPin}>{profile.location}</MetadataChip>
          {profile.email ? (
            <MetadataChip icon={Mail} href={`mailto:${profile.email}`}>
              {profile.email}
            </MetadataChip>
          ) : null}
          <MetadataChip icon={CheckCircle2}>{profile.joined}</MetadataChip>
        </div>
      </Card>

      {isEditing ? (
        <EditProfileModal
          user={profile}
          saving={saving}
          onClose={() => {
            if (!saving) setIsEditing(false);
          }}
          onSave={async (payload) => {
            await onSave(payload);
            setIsEditing(false);
          }}
        />
      ) : null}
    </>
  );
}

function CollaboratorStack({ collaborators, overflow }) {
  return (
    <div className="flex items-center" aria-label="Project collaborators">
      {collaborators.slice(0, 4).map((person, index) => (
        <div
          key={person.name}
          title={person.name}
          className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm ${person.tone}`}
          style={{ marginLeft: index === 0 ? 0 : -8 }}
        >
          {person.initials}
        </div>
      ))}
      {overflow > 0 ? (
        <span className="-ml-2 grid h-8 min-w-8 place-items-center rounded-full border-2 border-white bg-[#f3f4f5] px-2 text-[11px] font-bold text-[#555f6d] shadow-sm">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function ProjectContextMenu({ projectTitle }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const actions = ["Open project", "Share summary", "Archive"];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Open actions for ${projectTitle}`}
        onClick={() => setIsOpen((current) => !current)}
        className="grid h-9 w-9 place-items-center rounded-lg text-[#555f6d] transition-colors hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-[#e1e3e4] bg-white p-1.5 shadow-lg"
        >
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-[#434654] transition-colors hover:bg-[#f3f4f5] focus:bg-[#f3f4f5] focus:outline-none"
            >
              {action}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProjectCard({ project }) {
  const cappedProgress = Math.max(0, Math.min(project.progress, 100));

  return (
    <article className="rounded-2xl border border-[#e1e3e4] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[project.statusTone]}`}
          >
            {project.status}
          </span>
          <p className="mt-2 text-xs font-medium text-[#737686]">
            {project.timestamp}
          </p>
        </div>
        <ProjectContextMenu projectTitle={project.title} />
      </div>

      <h3 className="text-base font-bold leading-6 text-[#191c1d]">
        {project.title}
      </h3>
      <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-[#555f6d]">
        {project.description}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <CollaboratorStack
          collaborators={project.collaborators}
          overflow={project.overflow}
        />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f8f9fb] px-2.5 py-1 text-xs font-bold text-[#0b47c2]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {project.feature}
        </span>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#555f6d]">
          <span>Completion</span>
          <span>{cappedProgress}%</span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-[#e9edf3]"
          role="progressbar"
          aria-label={`${project.title} completion`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={cappedProgress}
        >
          <div
            className="h-full rounded-full bg-[#0b47c2]"
            style={{ width: `${cappedProgress}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function ActiveProjects() {
  const hasProjects = Array.isArray(projects) && projects.length > 0;

  return (
    <section aria-labelledby="active-projects-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2
            id="active-projects-heading"
            className="text-xl font-bold text-[#191c1d]"
          >
            Active Projects
          </h2>
          <p className="mt-1 text-sm text-[#555f6d]">
            Current research initiatives and collaboration health.
          </p>
        </div>
        <Link
          to="/projects"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-bold text-[#0b47c2] transition-colors hover:bg-[#edf3ff] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
        >
          View All
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {hasProjects ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed p-8 text-center">
          <p className="font-semibold text-[#191c1d]">
            No active projects available.
          </p>
          <p className="mt-1 text-sm text-[#555f6d]">
            New research workspaces will appear here after they are created.
          </p>
        </Card>
      )}
    </section>
  );
}

function ResearchInterests({ interests }) {
  const tags = Array.isArray(interests) ? interests : [];

  return (
    <Card className="p-5" aria-labelledby="interests-heading">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4f7ed] text-[#005438]">
          <FlaskConical className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 id="interests-heading" className="text-lg font-bold text-[#191c1d]">
          Research Interests
        </h2>
      </div>
      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((interest) => (
            <span
              key={interest}
              className="rounded-full border border-[#d8dde6] bg-[#f8f9fb] px-3 py-2 text-sm font-semibold text-[#434654] transition-colors hover:border-[#a8c7fa] hover:bg-[#edf3ff]"
            >
              {interest}
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#c3c5d7] p-4 text-sm text-[#555f6d]">
          No research interests have been added yet.
        </div>
      )}
    </Card>
  );
}

function PublicationsCard({ publications }) {
  const items = Array.isArray(publications) ? publications : [];
  const hasPublications = items.length > 0;

  return (
    <Card
      className="flex min-h-[22rem] flex-col p-5"
      aria-labelledby="publications-heading"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#0b47c2]">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id="publications-heading"
            className="text-lg font-bold text-[#191c1d]"
          >
            Recent Publications
          </h2>
          <p className="text-sm text-[#555f6d]">
            Selected peer-reviewed research.
          </p>
        </div>
      </div>

      {hasPublications ? (
        <ul className="flex-1 divide-y divide-[#e1e3e4]">
          {items.map((publication) => (
            <li key={publication.title} className="py-4 first:pt-0">
              <a
                href={publication.href || "#"}
                className="font-bold leading-6 text-[#191c1d] transition-colors hover:text-[#0b47c2] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
              >
                {publication.title}
              </a>
              <p className="mt-1 text-sm italic text-[#555f6d]">
                {publication.publisher || "Independent Research"},{" "}
                {publication.year || "n.d."}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#c3c5d7] p-6 text-center text-sm text-[#555f6d]">
          Publications could not be loaded.
        </div>
      )}

      <a
        href="#all-publications"
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c3c5d7] bg-white px-4 text-sm font-bold text-[#434654] transition-colors hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
      >
        Explore All Publications
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </Card>
  );
}

function AcademicPresence({ academicLinks }) {
  const externalLinks = buildExternalLinks(academicLinks);

  return (
    <Card className="p-5" aria-labelledby="presence-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff6e5] text-[#7a4d00]">
            <Brain className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2
            id="presence-heading"
            className="text-lg font-bold text-[#191c1d]"
          >
            Academic Presence
          </h2>
        </div>
      </div>

      {externalLinks.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {externalLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                target={item.download ? undefined : "_blank"}
                rel={item.download ? undefined : "noreferrer"}
                download={item.download ? true : undefined}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#e1e3e4] bg-[#f8f9fb] px-3 py-3 text-sm font-bold text-[#191c1d] transition-colors hover:border-[#c3c5d7] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon
                    className={`h-5 w-5 shrink-0 ${item.tone}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.download ? (
                  <Download
                    className="h-4 w-4 shrink-0 text-[#737686]"
                    aria-hidden="true"
                  />
                ) : (
                  <ExternalLink
                    className="h-4 w-4 shrink-0 text-[#737686]"
                    aria-hidden="true"
                  />
                )}
              </a>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#c3c5d7] p-4 text-sm text-[#555f6d]">
          No external profiles have been added yet.
        </div>
      )}
    </Card>
  );
}

export default function ProfilePage() {
  const { setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/users/profile");
      setProfile(mapProfile(data.user));
    } catch {
      setError("Profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async (payload) => {
    setSaving(true);
    try {
      const { data } = await api.patch("/users/profile", payload);
      const nextProfile = mapProfile(data.user);
      setProfile(nextProfile);
      setUser?.((current) =>
        current
          ? {
              ...current,
              full_name: data.user.full_name,
              avatar_url: data.user.avatar_url,
              institution: data.user.institution,
              job_title: data.user.job_title,
              location: data.user.location,
              organization: data.user.organization,
              bio: data.user.bio,
            }
          : current,
      );
      toast.success("Profile updated.");
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        "Failed to update profile.";
      toast.error(message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout activePath="/profile">
      <div className="w-full max-w-7xl px-4 py-5 sm:px-6 md:px-8 md:py-8">
        {error ? (
          <div
            className="mb-5 rounded-xl border border-[#ffdad6] bg-[#fff4f2] px-4 py-3 text-sm font-medium text-[#ba1a1a]"
            role="alert"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={loadProfile}
                className="h-9 rounded-lg border border-[#ffb4ab] px-3 text-sm font-bold text-[#ba1a1a] transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/20"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-6">
              <div className="h-80 animate-pulse rounded-2xl border border-[#e1e3e4] bg-white" />
              <div className="grid gap-4 xl:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-72 animate-pulse rounded-2xl border border-[#e1e3e4] bg-white"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="h-52 animate-pulse rounded-2xl border border-[#e1e3e4] bg-white" />
              <div className="h-56 animate-pulse rounded-2xl border border-[#e1e3e4] bg-white" />
            </div>
          </div>
        ) : profile ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-6">
              <ProfileHeader
                profile={profile}
                onSave={handleSaveProfile}
                saving={saving}
              />
              <ActiveProjects />
              <PublicationsCard publications={profile.publications} />
            </div>

            <aside className="space-y-6" aria-label="Researcher details">
              <ResearchInterests interests={profile.interests} />
              <AcademicPresence academicLinks={profile.academicLinks} />
            </aside>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
