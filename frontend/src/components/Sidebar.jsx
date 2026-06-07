import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  activePath,
  projectId,
}) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const globalItems = [
    { label: "Home", icon: Home, href: "/dashboard" },
    { label: "Projects", icon: FolderOpen, href: "/projects" },
    { label: "Profile", icon: User, href: "/profile" },
  ];
  const contextItems = [];
  if (projectId) {
    contextItems.push({
      label: "Overview",
      icon: BarChart3,
      href: `/projects/${projectId}`,
    });
    contextItems.push({
      label: "Task Board",
      icon: ClipboardList,
      href: `/projects/${projectId}/tasks`,
    });
    contextItems.push({
      label: "Timeline",
      icon: CalendarDays,
      href: `/projects/${projectId}/timeline`,
    });
    contextItems.push({
      label: "Team Hub",
      icon: Users,
      href: `/projects/${projectId}/team`,
    });
    contextItems.push({
      label: "AI Workbench",
      icon: Sparkles,
      href: `/projects/${projectId}/ai`,
    });
    contextItems.push({
      label: "Documents",
      icon: FileText,
      href: `/projects/${projectId}/documents`,
    });
    contextItems.push({
      label: "Agent Logs",
      icon: Bot,
      href: `/projects/${projectId}/agents`,
    });
  }

  const renderItem = (item) => {
    const active = activePath === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.label}
        to={item.href}
        title={isCollapsed ? item.label : undefined}
        className={`flex items-center rounded-xl text-sm font-medium transition-colors ${
          active
            ? "bg-[#d6e0f1] text-[#003fb1]"
            : "text-[#434654] hover:bg-[#f3f4f5]"
        } ${
          isCollapsed
            ? "mx-auto h-11 w-11 justify-center p-0"
            : "w-full gap-3 px-3 py-2.5"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
        {!isCollapsed && (
          <span className="whitespace-nowrap">{item.label}</span>
        )}
      </Link>
    );
  };

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    window.location.href = "/";
  };

  const roleLabel = { advisor: "🎓 Advisor", student: "📚 Student" };

  return (
    <>
      {/* Sidebar (desktop) */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 bottom-0 bg-white border-r border-[#e1e3e4] z-30 transition-all duration-300 overflow-visible ${isCollapsed ? "w-20" : "w-60"}`}
      >
        <div
          className={`flex items-center px-5 py-4 border-b border-[#e1e3e4] h-16 ${isCollapsed ? "justify-center" : "justify-between"}`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <svg
              className="w-6 h-6 text-[#003fb1] shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            {!isCollapsed && (
              <span className="font-bold text-[#003fb1] text-lg whitespace-nowrap">
                CollabAgent
              </span>
            )}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-5 overflow-hidden">
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#737686]">
                Global
              </div>
            )}
            {globalItems.map(renderItem)}
          </div>
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#737686]">
                {projectId ? "Project" : null}
              </div>
            )}
            {contextItems.map(renderItem)}
          </div>
        </nav>
        <div className="p-4 border-t border-[#e1e3e4] flex flex-col gap-3">
          <div
            className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}
          >
            <div className="w-9 h-9 shrink-0 rounded-full bg-[#003fb1] text-white flex items-center justify-center text-sm font-bold">
              {user?.full_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#191c1d] truncate">
                  {user?.full_name || "Demo User"}
                </p>
                <p className="text-xs text-[#737686] truncate">
                  {roleLabel[user?.role] || user?.role}
                </p>
              </div>
            )}
          </div>
          <NotificationBell
            compact={isCollapsed}
            align="left"
            vertical="up"
            className={isCollapsed ? "mx-auto" : ""}
          />
          <button
            type="button"
            onClick={() => {
              /* TODO: open settings */
            }}
            className={`h-9 flex items-center rounded-lg border border-[#e1e3e4] text-[#434654] hover:bg-[#f3f4f5] transition-colors ${
              isCollapsed
                ? "mx-auto h-11 w-11 justify-center rounded-xl"
                : "w-full justify-start px-3 gap-3 border-transparent bg-transparent"
            }`}
            title="Settings"
          >
            <Settings className="h-4 w-4 shrink-0" strokeWidth={2} />
            {!isCollapsed && <span>Settings</span>}
          </button>
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Sign Out" : undefined}
            className={`h-9 flex items-center justify-center text-xs font-semibold text-[#ba1a1a] border border-[#e1e3e4] rounded-lg hover:bg-[#ffdad6] transition-colors ${isCollapsed ? "mx-auto h-11 w-11 rounded-xl px-0" : "w-full"}`}
          >
            {isCollapsed ? (
              <LogOut className="h-5 w-5" strokeWidth={2} />
            ) : (
              "Sign Out"
            )}
          </button>
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-4 top-20 grid h-8 w-8 place-items-center rounded-lg border border-[#d8dde6] bg-white text-[#596170] shadow-sm transition-colors hover:text-[#003fb1] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={2} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#e1e3e4] flex items-center px-4 h-14">
        <div className="flex items-center gap-2 flex-1">
          <svg
            className="w-5 h-5 text-[#003fb1]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          <span className="font-bold text-[#003fb1]">CollabAgent</span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 text-[#434654]"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                menuOpen
                  ? "M6 18L18 6M6 6l12 12"
                  : "M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              }
            />
          </svg>
        </button>
        <NotificationBell compact />
        {menuOpen && (
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-[#e1e3e4] p-4 space-y-2 shadow-lg">
            {[...globalItems, ...contextItems].map((item) => (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setMenuOpen(false)}
                className={`w-full block px-3 py-2.5 text-sm rounded-lg ${activePath === item.href ? "text-[#003fb1] bg-[#d6e0f1]" : "text-[#434654] hover:bg-[#f3f4f5]"}`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2.5 text-sm text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg"
            >
              Sign Out
            </button>
          </div>
        )}
      </header>
    </>
  );
}
