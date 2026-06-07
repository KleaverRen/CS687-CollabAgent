import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import toast, { Toaster, ToastBar } from "react-hot-toast";
import { X } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ChatProvider } from "./context/ChatContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import ProjectsDirectory from "./pages/ProjectsDirectory";
import TaskBoard from "./pages/TaskBoard";
import ProjectOverview from "./pages/ProjectOverview";
import AgentLogs from "./pages/AgentLogs";
import AIWorkbench from "./pages/AIWorkbench";
import TeamCoordinationHub from "./pages/TeamCoordinationHub";
import DocumentManager from "./pages/DocumentManager";
import TimelineView from "./pages/TimelineView";
import ProfilePage from "./pages/ProfilePage";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f5]">
        <svg
          className="animate-spin w-10 h-10 text-[#003fb1]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsDirectory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <TaskBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/tasks"
        element={
          <ProtectedRoute>
            <TaskBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/timeline"
        element={
          <ProtectedRoute>
            <TimelineView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/ai"
        element={
          <ProtectedRoute>
            <AIWorkbench />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/documents"
        element={
          <ProtectedRoute>
            <DocumentManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/team"
        element={
          <ProtectedRoute>
            <TeamCoordinationHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/agents"
        element={
          <ProtectedRoute>
            <AgentLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <ProjectOverview />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ChatProvider>
            <AppRoutes />
          </ChatProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#fff",
                color: "#191c1d",
                border: "1px solid #c3c5d7",
                borderRadius: "12px",
                fontSize: "14px",
                fontFamily: "Inter, sans-serif",
                padding: "10px 36px 10px 14px",
                position: "relative",
              },
              success: { iconTheme: { primary: "#005438", secondary: "#fff" } },
              error: { iconTheme: { primary: "#ba1a1a", secondary: "#fff" } },
            }}
          >
            {(t) => (
              <div style={{ position: "relative" }}>
                <ToastBar toast={t} />
                <button
                  onClick={() => toast.dismiss(t.id)}
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px",
                    color: "#6b7280",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 0,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#191c1d")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#6b7280")
                  }
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </Toaster>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
