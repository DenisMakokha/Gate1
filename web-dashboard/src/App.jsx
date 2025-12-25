import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Groups from './pages/Groups';
import Media from './pages/Media';
import Issues from './pages/Issues';
import Backups from './pages/Backups';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Approvals from './pages/Approvals';
import Analytics from './pages/Analytics';
import Cameras from './pages/Cameras';
import HealingCases from './pages/HealingCases';
import BackupAnalytics from './pages/BackupAnalytics';
import QualityControl from './pages/QualityControl';
import StorageForecast from './pages/StorageForecast';
import DataProtection from './pages/DataProtection';

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
          
          <Route path="/events" element={
            <PrivateRoute roles={['admin']}>
              <Events />
            </PrivateRoute>
          } />
          
          <Route path="/groups" element={
            <PrivateRoute roles={['admin', 'group-leader']}>
              <Groups />
            </PrivateRoute>
          } />
          
          <Route path="/media" element={
            <PrivateRoute roles={['admin']}>
              <Media />
            </PrivateRoute>
          } />
          
          <Route path="/issues" element={
            <PrivateRoute roles={['admin', 'group-leader', 'qa']}>
              <Issues />
            </PrivateRoute>
          } />
          
          <Route path="/backups" element={
            <PrivateRoute roles={['admin', 'backup']}>
              <Backups />
            </PrivateRoute>
          } />
          
          <Route path="/backup-analytics" element={
            <PrivateRoute roles={['admin', 'backup']}>
              <BackupAnalytics />
            </PrivateRoute>
          } />
          
          <Route path="/users" element={
            <PrivateRoute roles={['admin']}>
              <Users />
            </PrivateRoute>
          } />
          
          <Route path="/audit-logs" element={
            <PrivateRoute roles={['admin']}>
              <AuditLogs />
            </PrivateRoute>
          } />
          
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
          
          <Route path="/settings" element={
            <PrivateRoute roles={['admin']}>
              <Settings />
            </PrivateRoute>
          } />
          
          <Route path="/approvals" element={
            <PrivateRoute roles={['admin', 'group-leader']}>
              <Approvals />
            </PrivateRoute>
          } />
          
          <Route path="/analytics" element={
            <PrivateRoute roles={['admin']}>
              <Analytics />
            </PrivateRoute>
          } />
          
          <Route path="/cameras" element={
            <PrivateRoute roles={['admin']}>
              <Cameras />
            </PrivateRoute>
          } />
          
          <Route path="/healing-cases" element={
            <PrivateRoute roles={['admin', 'group-leader']}>
              <HealingCases />
            </PrivateRoute>
          } />
          
          <Route path="/quality-control" element={
            <PrivateRoute roles={['admin', 'qa', 'group-leader']}>
              <QualityControl />
            </PrivateRoute>
          } />
          
          <Route path="/storage-forecast" element={
            <PrivateRoute roles={['admin', 'backup']}>
              <StorageForecast />
            </PrivateRoute>
          } />
          
          <Route path="/data-protection" element={
            <PrivateRoute roles={['admin']}>
              <DataProtection />
            </PrivateRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
