import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isCollapsed, setIsCollapsed, activePath, projectId }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard',  icon: '🏠', href: '/dashboard' },
  ];
  if (projectId) {
    navItems.push({ label: 'Overview', icon: '📊', href: `/projects/${projectId}` });
  }
  navItems.push({ label: 'Task Board', icon: '📋', href: '/tasks' });

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    window.location.href = '/';
  };

  const roleLabel = { researcher: '🔬 Researcher', project_lead: '📊 Project Lead', faculty: '🎓 Faculty', student: '📚 Student' };

  return (
    <>
      {/* Sidebar (desktop) */}
      <aside className={`hidden md:flex flex-col fixed left-0 top-0 bottom-0 bg-white border-r border-[#e1e3e4] z-30 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-60'}`}>
        <div className={`flex items-center px-5 py-4 border-b border-[#e1e3e4] h-16 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <svg className="w-6 h-6 text-[#003fb1] shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            {!isCollapsed && <span className="font-bold text-[#003fb1] text-lg whitespace-nowrap">CollabAgent</span>}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const active = activePath === item.href;
            return (
              <Link key={item.label} to={item.href} title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-[#d6e0f1] text-[#003fb1]' : 'text-[#434654] hover:bg-[#f3f4f5]'
                }`}>
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-[#e1e3e4] flex flex-col gap-3">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 shrink-0 rounded-full bg-[#003fb1] text-white flex items-center justify-center text-sm font-bold">
              {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#191c1d] truncate">{user?.full_name || 'Demo User'}</p>
                <p className="text-xs text-[#737686] truncate">{roleLabel[user?.role] || user?.role}</p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} title={isCollapsed ? 'Sign Out' : undefined}
            className={`h-9 flex items-center justify-center text-xs font-semibold text-[#ba1a1a] border border-[#e1e3e4] rounded-lg hover:bg-[#ffdad6] transition-colors ${isCollapsed ? 'px-0' : 'w-full'}`}>
            {isCollapsed ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg> : 'Sign Out'}
          </button>
        </div>
        
        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-[#e1e3e4] rounded-full flex items-center justify-center text-slate-400 hover:text-[#003fb1] shadow-sm z-40 transition-transform"
        >
          <svg className={`w-3 h-3 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#e1e3e4] flex items-center px-4 h-14">
        <div className="flex items-center gap-2 flex-1">
          <svg className="w-5 h-5 text-[#003fb1]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          <span className="font-bold text-[#003fb1]">CollabAgent</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-[#434654]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"} />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-[#e1e3e4] p-4 space-y-2 shadow-lg">
            {navItems.map(item => (
              <Link key={item.label} to={item.href} onClick={() => setMenuOpen(false)}
                className={`w-full block px-3 py-2.5 text-sm rounded-lg ${activePath === item.href ? 'text-[#003fb1] bg-[#d6e0f1]' : 'text-[#434654] hover:bg-[#f3f4f5]'}`}>
                {item.label}
              </Link>
            ))}
            <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 text-sm text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg">Sign Out</button>
          </div>
        )}
      </header>
    </>
  );
}
