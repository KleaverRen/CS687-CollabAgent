import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ProjectsDirectory from './pages/ProjectsDirectory';
import TaskBoard from './pages/TaskBoard';
import ProjectOverview from './pages/ProjectOverview';
import AgentLogs from './pages/AgentLogs';
import AIWorkbench from './pages/AIWorkbench';
import TeamCoordinationHub from './pages/TeamCoordinationHub';
import DocumentManager from './pages/DocumentManager';
import TimelineView from './pages/TimelineView';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f5]">
        <svg className="animate-spin w-10 h-10 text-[#003fb1]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
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
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#191c1d',
                border: '1px solid #c3c5d7',
                borderRadius: '12px',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
              },
              success: { iconTheme: { primary: '#005438', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ba1a1a', secondary: '#fff' } },
            }}
          />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
