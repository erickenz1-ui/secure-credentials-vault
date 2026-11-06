import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GlobalStyle } from './styles/theme';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CredentialsPage from './pages/CredentialsPage';
import TeamsPage from './pages/TeamsPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';

// Protected Route component
const ProtectedRoute = ({ children, requiredRoles }) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredRoles && !hasRole(requiredRoles)) return <Navigate to="/dashboard" />;

  return <Layout>{children}</Layout>;
};

// Public Route (redirect to dashboard if logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (user) return <Navigate to="/dashboard" />;

  return children;
};

function App() {
  return (
    <AuthProvider>
      <GlobalStyle />
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/credentials"
            element={
              <ProtectedRoute>
                <CredentialsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <TeamsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          {/* Audit Logs Route */}
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
                <AuditPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;