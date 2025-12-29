import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Toasts from './components/Toasts';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Overview
import Dashboard from './pages/Dashboard';
import AnalyticsDashboard from './pages/AnalyticsDashboard';

// Operations
import Events from './pages/Events';
import Groups from './pages/Groups';
import Cameras from './pages/Cameras';

// Media & Quality
import Media from './pages/Media';
import QualityControl from './pages/QualityControl';
import Issues from './pages/Issues';
import HealingCases from './pages/HealingCases';

// Storage
import Backups from './pages/Backups';
import StorageForecast from './pages/StorageForecast';
import DataProtection from './pages/DataProtection';

// Administration
import Users from './pages/Users';
import Approvals from './pages/Approvals';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

// New Features
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Shifts from './pages/Shifts';
import ActivityFeed from './pages/ActivityFeed';
import Help from './pages/Help';
import WorkAllocation from './pages/WorkAllocation';
import LiveOperations from './pages/LiveOperations';
import Search from './pages/Search';

function PrivateRoute({ children, roles }) {
  const { user, loading, hasAnyRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (roles && !hasAnyRole(roles)) {
    return <Navigate to="/" />;
  }

  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          
          {/* Overview */}
          <Route path="/analytics-dashboard" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <AnalyticsDashboard />
            </PrivateRoute>
          } />
          <Route path="/live-operations" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <LiveOperations />
            </PrivateRoute>
          } />
          
          {/* Operations */}
          <Route path="/events" element={
            <PrivateRoute roles={['admin', 'team-lead']}>
              <Events />
            </PrivateRoute>
          } />
          <Route path="/groups" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <Groups />
            </PrivateRoute>
          } />
          <Route path="/cameras" element={
            <PrivateRoute roles={['admin', 'team-lead']}>
              <Cameras />
            </PrivateRoute>
          } />
          
          {/* Media & Quality */}
          <Route path="/search" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader', 'qa', 'qa-lead']}>
              <Search />
            </PrivateRoute>
          } />
          <Route path="/media" element={
            <PrivateRoute roles={['admin', 'team-lead']}>
              <Media />
            </PrivateRoute>
          } />
          <Route path="/quality-control" element={
            <PrivateRoute roles={['admin', 'team-lead', 'qa', 'qa-lead', 'group-leader']}>
              <QualityControl />
            </PrivateRoute>
          } />
          <Route path="/issues" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader', 'qa', 'qa-lead']}>
              <Issues />
            </PrivateRoute>
          } />
          <Route path="/healing-cases" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <HealingCases />
            </PrivateRoute>
          } />
          
          {/* Storage */}
          <Route path="/backups" element={
            <PrivateRoute roles={['admin', 'team-lead', 'backup', 'backup-lead']}>
              <Backups />
            </PrivateRoute>
          } />
          <Route path="/storage-forecast" element={
            <PrivateRoute roles={['admin', 'team-lead', 'backup', 'backup-lead']}>
              <StorageForecast />
            </PrivateRoute>
          } />
          <Route path="/data-protection" element={
            <PrivateRoute roles={['admin', 'team-lead']}>
              <DataProtection />
            </PrivateRoute>
          } />
          
          {/* Administration */}
          <Route path="/users" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader', 'qa-lead', 'backup-lead']}>
              <Users />
            </PrivateRoute>
          } />
          <Route path="/approvals" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <Approvals />
            </PrivateRoute>
          } />
          <Route path="/audit-logs" element={
            <PrivateRoute roles={['admin']}>
              <AuditLogs />
            </PrivateRoute>
          } />
          <Route path="/settings" element={
            <PrivateRoute roles={['admin']}>
              <Settings />
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
          
          {/* New Features */}
          <Route path="/notifications" element={
            <PrivateRoute>
              <Notifications />
            </PrivateRoute>
          } />
          <Route path="/reports" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <Reports />
            </PrivateRoute>
          } />
          <Route path="/shifts" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <Shifts />
            </PrivateRoute>
          } />
          <Route path="/activity-feed" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <ActivityFeed />
            </PrivateRoute>
          } />
          <Route path="/help" element={
            <PrivateRoute>
              <Help />
            </PrivateRoute>
          } />
          <Route path="/work-allocation" element={
            <PrivateRoute roles={['admin', 'team-lead', 'group-leader']}>
              <WorkAllocation />
            </PrivateRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Toasts />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
