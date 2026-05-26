import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

const typeLabels = {
  'project.assignment': 'Assignment',
  'project.updated': 'Project',
  'task.assigned': 'Task',
  'task.updated': 'Task',
};

function formatTime(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function NotificationBell({ compact = false, align = 'right', vertical = 'down' }) {
  const { loading, markAllRead, markRead, notifications, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={clsx(
          'relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#e1e3e4] bg-white text-[#434654] hover:bg-[#f3f4f5]',
          compact && 'border-transparent bg-transparent'
        )}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#ba1a1a] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={clsx(
          'absolute z-[70] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[#d8dde6] bg-white shadow-xl',
          vertical === 'up' ? 'bottom-full mb-2' : 'mt-2',
          align === 'left' ? 'left-0' : 'right-0'
        )}>
          <div className="flex items-center justify-between border-b border-[#e1e3e4] px-4 py-3">
            <div>
              <div className="text-sm font-bold text-[#191c1d]">Notifications</div>
              <div className="text-xs text-[#737686]">{unreadCount} unread</div>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[#003fb1] hover:bg-[#f0f4ff] disabled:text-[#9ca3af]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Read all
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-[#737686]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#737686]">No notifications yet.</div>
            ) : (
              notifications.map((notification) => {
                const unread = !notification.read_at;
                const content = (
                  <div
                    className={clsx(
                      'block border-b border-[#eef1f5] px-4 py-3 text-left last:border-0 hover:bg-[#f6f8fb]',
                      unread && 'bg-[#f0f4ff]'
                    )}
                    onClick={() => unread && markRead(notification.id)}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#003fb1]">
                        {typeLabels[notification.type] || notification.category}
                      </span>
                      <span className="text-[10px] font-semibold text-[#737686]">{formatTime(notification.created_at)}</span>
                    </div>
                    <div className="text-sm font-bold leading-snug text-[#191c1d]">{notification.title}</div>
                    {notification.body && (
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#555f6d]">{notification.body}</div>
                    )}
                    {notification.project_name && (
                      <div className="mt-2 text-[11px] font-semibold text-[#737686]">{notification.project_name}</div>
                    )}
                  </div>
                );

                if (notification.action_url) {
                  return (
                    <Link key={notification.id} to={notification.action_url} onClick={() => setOpen(false)}>
                      {content}
                    </Link>
                  );
                }

                return <button key={notification.id} type="button" className="w-full">{content}</button>;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
