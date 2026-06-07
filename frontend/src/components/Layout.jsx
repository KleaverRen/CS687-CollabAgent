import React, { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar";
import ChatDrawer from "./ChatDrawer";
import { useChat } from "../context/ChatContext";

export default function Layout({ children, activePath, projectId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true",
  );
  const [isChatOpen, setIsChatOpen] = useState(
    () => searchParams.get("chat") === "open",
  );
  const { unreadCount } = useChat();

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", isCollapsed);
  }, [isCollapsed]);

  useEffect(() => {
    if (searchParams.get("chat") === "open") {
      setIsChatOpen(true);
    }
  }, [searchParams]);

  const openChat = () => {
    setIsChatOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("chat", "open");
    setSearchParams(nextParams, { replace: true });
  };

  const closeChat = () => {
    setIsChatOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("chat");
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="flex h-screen bg-[#f3f4f5] font-['Inter',sans-serif] overflow-hidden">
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        activePath={activePath}
        projectId={projectId}
      />

      {/* 
        The main container pushes itself right based on the sidebar width on desktop.
        On mobile, the sidebar is hidden and the mobile header sits at top, so we add pt-14.
      */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 md:pt-0 pt-14 ${
          isCollapsed ? "md:ml-20" : "md:ml-60"
        }`}
      >
        <main className="flex-1 overflow-y-auto w-full flex flex-col">
          {children}
        </main>
      </div>

      <button
        type="button"
        className="fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-xl bg-[#0b47c2] text-white shadow-xl transition-colors hover:bg-[#063796] focus:outline-none focus:ring-2 focus:ring-[#0b47c2]/30 focus:ring-offset-2"
        onClick={openChat}
        aria-label="Open chat"
        title="Open chat"
      >
        <MessageSquare className="h-6 w-6" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#ba1a1a] px-1.5 text-[11px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={closeChat}
        projectId={projectId}
      />
    </div>
  );
}
