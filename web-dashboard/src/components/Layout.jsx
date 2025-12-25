import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Video,
  AlertTriangle,
  HardDrive,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Search,
  FileText,
  UserCog,
  UserCheck,
  Shield,
  BarChart3,
  Camera,
  Heart,
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout, isAdmin, isGroupLeader, isQA, isBackup } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'group-leader', 'qa', 'backup', 'editor'] },
    { name: '360° Analytics', href: '/analytics-dashboard', icon: BarChart3, roles: ['admin', 'group-leader'] },
    { name: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['admin'] },
    { name: 'Events', href: '/events', icon: Calendar, roles: ['admin'] },
    { name: 'Groups', href: '/groups', icon: Users, roles: ['admin', 'group-leader'] },
    { name: 'Cameras', href: '/cameras', icon: Camera, roles: ['admin'] },
    { name: 'Media', href: '/media', icon: Video, roles: ['admin'] },
    { name: 'Issues', href: '/issues', icon: AlertTriangle, roles: ['admin', 'group-leader', 'qa'] },
    { name: 'Healing Cases', href: '/healing-cases', icon: Heart, roles: ['admin', 'group-leader'] },
    { name: 'Backups', href: '/backups', icon: HardDrive, roles: ['admin', 'backup'] },
    { name: 'Backup Analytics', href: '/backup-analytics', icon: BarChart3, roles: ['admin', 'backup'] },
    { name: 'Storage Forecast', href: '/storage-forecast', icon: HardDrive, roles: ['admin', 'backup'] },
    { name: 'Quality Control', href: '/quality-control', icon: AlertTriangle, roles: ['admin', 'qa', 'group-leader'] },
    { name: 'Data Protection', href: '/data-protection', icon: Shield, roles: ['admin'] },
    { name: 'Users', href: '/users', icon: UserCog, roles: ['admin'] },
    { name: 'Approvals', href: '/approvals', icon: UserCheck, roles: ['admin', 'group-leader'] },
    { name: 'Audit Logs', href: '/audit-logs', icon: FileText, roles: ['admin'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
  ];

  const filteredNav = navigation.filter(item => 
    item.roles.some(role => user?.roles?.includes(role))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G1</span>
            </div>
            <span className="font-semibold text-gray-900">Gate 1 System</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <Link to="/profile" className="flex items-center gap-3 mb-3 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.roles?.[0]}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`${sidebarOpen ? 'lg:pl-64' : ''} transition-all duration-200`}>
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                <Menu className="w-6 h-6 text-gray-500" />
              </button>
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 w-64 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
