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
  ChevronRight,
  Bell,
  Search,
  FileText,
  UserCog,
  UserCheck,
  Shield,
  BarChart3,
  Camera,
  Heart,
  CheckCircle,
  Database,
  Cog,
  Moon,
  Sun,
  Clock,
  Activity,
  HelpCircle,
  Download,
  Target,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ConnectionStatus, LiveStatus } from './StatusPills';

export default function Layout({ children }) {
  const { user, logout, isAdmin, isGroupLeader, isQA, isBackup } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState(['overview']);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [showNotifications, setShowNotifications] = useState(false);

  // Apply dark mode class to html element
  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const menuStructure = [
    {
      id: 'overview',
      name: 'Overview',
      icon: LayoutDashboard,
      roles: ['admin', 'team-lead', 'group-leader', 'qa', 'backup', 'editor'],
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'team-lead', 'group-leader', 'qa', 'backup', 'editor'] },
        { name: 'Live Operations', href: '/live-operations', icon: Activity, roles: ['admin', 'team-lead', 'group-leader'] },
        { name: 'Analytics', href: '/analytics-dashboard', icon: BarChart3, roles: ['admin', 'team-lead', 'group-leader'] },
      ]
    },
    {
      id: 'operations',
      name: 'Operations',
      icon: Calendar,
      roles: ['admin', 'team-lead', 'group-leader'],
      items: [
        { name: 'Events', href: '/events', icon: Calendar, roles: ['admin', 'team-lead'] },
        { name: 'Groups', href: '/groups', icon: Users, roles: ['admin', 'team-lead', 'group-leader'] },
        { name: 'Work Allocation', href: '/work-allocation', icon: Target, roles: ['admin', 'team-lead', 'group-leader'] },
        { name: 'Cameras', href: '/cameras', icon: Camera, roles: ['admin', 'team-lead'] },
      ]
    },
    {
      id: 'media',
      name: 'Media',
      icon: Video,
      roles: ['admin', 'team-lead', 'group-leader', 'qa'],
      items: [
        { name: 'Search & Playback', href: '/search', icon: Search, roles: ['admin', 'team-lead', 'group-leader', 'qa'] },
        { name: 'Media Library', href: '/media', icon: Video, roles: ['admin', 'team-lead'] },
        { name: 'Quality Control', href: '/quality-control', icon: CheckCircle, roles: ['admin', 'team-lead', 'qa', 'group-leader'] },
        { name: 'Issues', href: '/issues', icon: AlertTriangle, roles: ['admin', 'team-lead', 'group-leader', 'qa'] },
        { name: 'Healing Cases', href: '/healing-cases', icon: Heart, roles: ['admin', 'team-lead', 'group-leader'] },
      ]
    },
    {
      id: 'storage',
      name: 'Storage',
      icon: Database,
      roles: ['admin', 'team-lead', 'backup'],
      items: [
        { name: 'Backups', href: '/backups', icon: HardDrive, roles: ['admin', 'team-lead', 'backup'] },
        { name: 'Storage Forecast', href: '/storage-forecast', icon: BarChart3, roles: ['admin', 'team-lead', 'backup'] },
        { name: 'Data Protection', href: '/data-protection', icon: Shield, roles: ['admin', 'team-lead'] },
      ]
    },
    {
      id: 'admin',
      name: 'Administration',
      icon: Cog,
      roles: ['admin', 'team-lead', 'group-leader', 'qa-lead', 'backup-lead'],
      items: [
        { name: 'Users', href: '/users', icon: UserCog, roles: ['admin', 'team-lead', 'group-leader', 'qa-lead', 'backup-lead'] },
        { name: 'Shifts', href: '/shifts', icon: Clock, roles: ['admin', 'team-lead', 'group-leader'] },
        { name: 'Reports', href: '/reports', icon: Download, roles: ['admin', 'team-lead', 'group-leader'] },
        { name: 'Activity Feed', href: '/activity-feed', icon: Activity, roles: ['admin', 'team-lead', 'group-leader'] },
        { name: 'Approvals', href: '/approvals', icon: UserCheck, roles: ['admin', 'team-lead', 'group-leader'] },
        { name: 'Audit Logs', href: '/audit-logs', icon: FileText, roles: ['admin'] },
        { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
      ]
    },
    {
      id: 'support',
      name: 'Support',
      icon: HelpCircle,
      roles: ['admin', 'team-lead', 'group-leader', 'qa', 'qa-lead', 'backup', 'backup-lead', 'editor'],
      items: [
        { name: 'Help & Docs', href: '/help', icon: HelpCircle, roles: ['admin', 'team-lead', 'group-leader', 'qa', 'qa-lead', 'backup', 'backup-lead', 'editor'] },
      ]
    },
  ];

  const filteredMenu = menuStructure
    .filter(section => section.roles.some(role => user?.roles?.includes(role)))
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.some(role => user?.roles?.includes(role)))
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G1</span>
            </div>
            <div>
              <span className="font-semibold text-gray-900">Gate 1 System</span>
              <span className="block text-[10px] text-gray-400">Powered by Nelium Systems</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {filteredMenu.map((section) => {
            const isExpanded = expandedSections.includes(section.id);
            const hasActiveItem = section.items.some(item => location.pathname === item.href);
            
            return (
              <div key={section.id} className="space-y-1">
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    hasActiveItem ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="w-5 h-5" />
                    {section.name}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="ml-4 space-y-1">
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-blue-100 text-blue-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
            <div className="flex items-center gap-2">
              {/* Status Pills */}
              <div className="hidden lg:flex items-center gap-2 mr-2">
                <ConnectionStatus online={true} />
                <LiveStatus isLive={true} label="System Live" />
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700"
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                    <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Notifications</span>
                      <Link
                        to="/notifications"
                        onClick={() => setShowNotifications(false)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        View all
                      </Link>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <div className="p-3 hover:bg-gray-50 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">New Issue Reported</p>
                        <p className="text-xs text-gray-500 mt-0.5">Camera CAM-042 reported corrupt file</p>
                        <p className="text-xs text-gray-400 mt-1">5 min ago</p>
                      </div>
                      <div className="p-3 hover:bg-gray-50 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">Backup Completed</p>
                        <p className="text-xs text-gray-500 mt-0.5">Daily backup completed successfully</p>
                        <p className="text-xs text-gray-400 mt-1">1 hour ago</p>
                      </div>
                      <div className="p-3 hover:bg-gray-50">
                        <p className="text-sm font-medium text-gray-900">Storage Warning</p>
                        <p className="text-xs text-gray-500 mt-0.5">DISK-003 is at 85% capacity</p>
                        <p className="text-xs text-gray-400 mt-1">3 hours ago</p>
                      </div>
                    </div>
                    <div className="p-2 border-t border-gray-100">
                      <Link
                        to="/notifications"
                        onClick={() => setShowNotifications(false)}
                        className="block w-full text-center text-sm text-gray-600 hover:text-gray-900 py-2"
                      >
                        See all notifications
                      </Link>
                    </div>
                  </div>
                )}
              </div>
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
