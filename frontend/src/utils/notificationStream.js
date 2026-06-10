export function createNotificationStream() {
  if (typeof EventSource === "undefined") return null;

  const token = localStorage.getItem("token");
  const url = token
    ? `/api/notifications/stream?sse_token=${encodeURIComponent(token)}`
    : "/api/notifications/stream";

  return new EventSource(url, { withCredentials: true });
}
