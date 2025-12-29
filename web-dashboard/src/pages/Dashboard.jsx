import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { dashboardService } from '../services/api';
import EditorStatus from '../components/EditorStatus';
import WorkflowProgress from '../components/WorkflowProgress';
import LiveActivityFeed from '../components/LiveActivityFeed';
import SessionBanner from '../components/SessionBanner';
import AttentionModal from '../components/AttentionModal';
import {
  Video,
  AlertTriangle,
  HardDrive,
  Users,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  Camera,
  Wifi,
  Circle,
  RefreshCw,
  Calendar,
  MapPin,
  Zap,
  Play,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Calculate remaining time for an event
function getRemainingTime(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diff = end - now;
  
  if (diff <= 0) return { expired: true, text: 'Event ended', days: 0, hours: 0 };
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  let text = '';
  if (days > 0) text = `${days}d ${hours}h remaining`;
  else if (hours > 0) text = `${hours}h ${minutes}m remaining`;
  else text = `${minutes}m remaining`;
  
  return { expired: false, text, days, hours, minutes };
}

// Active Event Hero Card
function ActiveEventCard({ event }) {
  if (!event) {
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium opacity-90">No Active Event</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">Activate an Event to Begin</h2>
            <p className="text-white/80 text-sm">All operations are scoped to the active event. Go to Events to activate one.</p>
          </div>
          <Link
            to="/events"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Go to Events
          </Link>
        </div>
      </div>
    );
  }

  const remaining = getRemainingTime(event.end_datetime || event.end_date);
  const startDate = new Date(event.start_datetime || event.start_date);
  const endDate = event.end_datetime || event.end_date ? new Date(event.end_datetime || event.end_date) : null;

  return (
    <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-medium opacity-90">ACTIVE EVENT</span>
            </div>
            <h2 className="text-3xl font-bold mb-1">{event.name}</h2>
            <p className="text-white/80 text-sm">{event.code}</p>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6" />
            <span className="text-lg font-semibold">Running</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
              <Calendar className="w-3 h-3" />
              Started
            </div>
            <div className="font-semibold">
              {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>
          {endDate && (
            <div className="bg-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                <Clock className="w-3 h-3" />
                Ends
              </div>
              <div className="font-semibold">
                {endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            </div>
          )}
          {event.location && (
            <div className="bg-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                <MapPin className="w-3 h-3" />
                Location
              </div>
              <div className="font-semibold truncate">{event.location}</div>
            </div>
          )}
          {remaining && (
            <div className={`rounded-lg p-3 ${remaining.expired ? 'bg-yellow-500/30' : 'bg-white/10'}`}>
              <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                <Activity className="w-3 h-3" />
                Time Left
              </div>
              <div className="font-semibold">
                {remaining.expired ? 'Past end date' : remaining.text}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 opacity-70" />
              <span>{event.media_count || 0} media files</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 opacity-70" />
              <span>{event.groups_count || 0} groups</span>
            </div>
          </div>
          <Link
            to="/events"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Manage Event
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function IssuesList({ issues }) {
  const severityColors = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Recent Issues</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {issues?.length === 0 && (
          <div className="p-4 text-center text-gray-500">No open issues</div>
        )}
        {issues?.map((issue) => (
          <div key={issue.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{issue.type.replace('_', ' ')}</p>
                <p className="text-sm text-gray-500">Reported by {issue.reporter}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[issue.severity]}`}>
                {issue.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupsHealth({ groups }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Groups Health</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {groups?.map((group) => (
          <div key={group.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{group.code}</p>
              <p className="text-sm text-gray-500">{group.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {group.open_issues > 0 ? (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  {group.open_issues} issues
                </span>
              ) : (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  Healthy
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, activeEvent, isAdmin, isTeamLead, isGroupLeader, isQALead, isQA, isBackupLead, isBackup } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activityItems, setActivityItems] = useState([]);
  const [sessionState, setSessionState] = useState('IDLE');
  const [attentionModal, setAttentionModal] = useState({ open: false, reason: null, details: null });

  // Generate activity items from dashboard data
  const generateActivityFromData = useCallback((dashData) => {
    const items = [];
    const now = Date.now();
    
    // Add recent issues as activity
    if (dashData?.recent_issues) {
      dashData.recent_issues.slice(0, 5).forEach((issue, idx) => {
        items.push({
          id: `issue-${issue.id || idx}`,
          source: 'issues',
          kind: issue.severity === 'critical' ? 'error' : 'warning',
          title: `Issue: ${issue.type?.replace('_', ' ') || 'Unknown'}`,
          message: `Reported by ${issue.reporter || 'Unknown'}`,
          details: issue,
          createdAt: now - (idx * 60000),
        });
      });
    }

    // Add system status updates
    if (dashData?.overview) {
      if (dashData.overview.active_sessions > 0) {
        items.push({
          id: 'sessions-active',
          source: 'session',
          kind: 'info',
          title: `${dashData.overview.active_sessions} Active Sessions`,
          message: 'SD cards currently being processed',
          createdAt: now - 120000,
        });
      }
      if (dashData.overview.pending_backups > 0) {
        items.push({
          id: 'backups-pending',
          source: 'backup',
          kind: dashData.overview.pending_backups > 10 ? 'warning' : 'info',
          title: `${dashData.overview.pending_backups} Pending Backups`,
          message: 'Files awaiting backup verification',
          createdAt: now - 180000,
        });
      }
    }

    // Sort by createdAt descending
    items.sort((a, b) => b.createdAt - a.createdAt);
    return items;
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [activeEvent?.id]);

  const loadDashboard = async () => {
    try {
      let response;
      if (isAdmin()) {
        response = await dashboardService.getAdmin(activeEvent?.id);
      } else if (isTeamLead()) {
        response = await dashboardService.getAdmin(activeEvent?.id);
      } else if (isGroupLeader()) {
        response = await dashboardService.getGroupLeader();
      } else if (isQALead() || isQA()) {
        response = await dashboardService.getQA();
      } else if (isBackupLead() || isBackup()) {
        response = await dashboardService.getBackup();
      } else {
        response = await dashboardService.getEditor();
      }
      setData(response);
      
      // Generate activity items
      const activities = generateActivityFromData(response);
      setActivityItems(activities);

      // Determine session state based on data
      if (response?.overview?.active_sessions > 0) {
        setSessionState('SESSION_ACTIVE');
      } else if (response?.overview?.open_issues > 5) {
        setSessionState('ATTENTION_REQUIRED');
      }

    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Dashboard Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    toast.info('Refreshing', 'Updating dashboard data...');
    await loadDashboard();
    toast.success('Updated', 'Dashboard data refreshed');
  };

  const handleAttentionAction = (action) => {
    toast.success('Action Recorded', `Decision: ${action.id}`);
    setAttentionModal({ open: false, reason: null, details: null });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Admin Dashboard - "GLOBAL COMMAND VIEW" per blueprint
  if (isAdmin() && data?.overview) {
    return (
      <div className="space-y-6">
        {/* Attention Modal */}
        <AttentionModal
          open={attentionModal.open}
          onClose={() => setAttentionModal({ open: false, reason: null, details: null })}
          reason={attentionModal.reason}
          severity={attentionModal.severity}
          title={attentionModal.title}
          message={attentionModal.message}
          details={attentionModal.details}
          onAction={handleAttentionAction}
        />

        {/* Active Event Hero Card */}
        <ActiveEventCard event={activeEvent} />

        {/* Session State Banner */}
        {sessionState !== 'IDLE' && (
          <SessionBanner
            state={sessionState}
            eventName={data.overview.active_event_name}
            onAction={(action) => {
              if (action === 'review') {
                setAttentionModal({
                  open: true,
                  reason: 'ATTENTION_REQUIRED',
                  severity: 'warning',
                  title: 'Issues Require Attention',
                  message: `There are ${data.overview.open_issues} open issues that need review.`,
                  details: { openIssues: data.overview.open_issues, criticalIssues: data.overview.critical_issues },
                });
              }
            }}
            dismissible
            onDismiss={() => setSessionState('IDLE')}
          />
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Global Command View</h1>
            <p className="text-gray-500">System-wide situational awareness — signals, not metrics</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/events"
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">Events</div>
                <div className="text-xs text-gray-500">Activate / switch active event</div>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </Link>
          <Link
            to="/issues"
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">Issues</div>
                <div className="text-xs text-gray-500">Triage and assign</div>
              </div>
              <div className="p-2 rounded-lg bg-red-50 text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </Link>
          <Link
            to="/users"
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">Users</div>
                <div className="text-xs text-gray-500">Invite and manage access</div>
              </div>
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">Operational Status</div>
                <div className="text-xs text-gray-500">Fast read on risk and throughput</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  (data.overview.critical_issues || 0) > 0 ? 'bg-red-100 text-red-700' :
                  (data.overview.open_issues || 0) > 5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {(data.overview.critical_issues || 0) > 0 ? 'Critical' : (data.overview.open_issues || 0) > 5 ? 'Attention' : 'Stable'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Open Issues</div>
                <div className="text-xl font-bold text-gray-900">{data.overview.open_issues || 0}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Critical</div>
                <div className="text-xl font-bold text-gray-900">{data.overview.critical_issues || 0}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Pending Backups</div>
                <div className="text-xl font-bold text-gray-900">{data.overview.pending_backups || 0}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Active Sessions</div>
                <div className="text-xl font-bold text-gray-900">{data.overview.active_sessions || 0}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">Editors Online</div>
                <div className="text-xs text-gray-500">Last 2 minutes</div>
              </div>
              <Wifi className="w-4 h-4 text-green-600" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-gray-900">{data.overview.online_agents || 0}</div>
              <div className="text-sm text-gray-500">/ {data.overview.total_editors || 0}</div>
            </div>
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Backup Coverage</div>
              <div className="text-xl font-bold text-gray-900">{data.overview.backup_coverage || 0}%</div>
            </div>
          </div>
        </div>

        {/* Primary KPIs - Signals per blueprint */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            title="Active SD Sessions"
            value={data.overview.active_sessions || 0}
            icon={Activity}
            color="blue"
            subtitle="Currently copying"
          />
          <StatCard
            title="Cameras Healthy"
            value={data.overview.cameras_healthy || 0}
            icon={Camera}
            color="green"
            subtitle={`${data.overview.cameras_attention || 0} need attention`}
          />
          <StatCard
            title="Open Issues"
            value={data.overview.open_issues || 0}
            icon={AlertTriangle}
            color="red"
            subtitle={`${data.overview.critical_issues || 0} critical`}
          />
          <StatCard
            title="Pending Backups"
            value={data.overview.pending_backups || 0}
            icon={HardDrive}
            color="yellow"
          />
          <StatCard
            title="Early Removals"
            value={data.overview.early_removals_today || 0}
            icon={AlertTriangle}
            color={data.overview.early_removals_today > 0 ? 'red' : 'green'}
            subtitle="Today"
          />
        </div>

        {/* Secondary row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Media Today</span>
              <Video className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.overview.media_today || 0}
              <span className="text-sm font-normal text-gray-500 ml-2">files indexed</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Media</span>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.overview.total_media || 0}
              <span className="text-sm font-normal text-gray-500 ml-2">files indexed</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Cameras Needing Attention</span>
              <Camera className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.overview.cameras_attention || 0}
              <span className="text-sm font-normal text-gray-500 ml-2">cameras</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <IssuesList issues={data.recent_issues} />
          <GroupsHealth groups={data.groups_health} />
          <LiveActivityFeed 
            items={activityItems} 
            maxItems={10}
            title="Live Activity"
            showRefresh
            onRefresh={handleRefresh}
            compact
          />
        </div>

        {/* Workflow Progress */}
        <WorkflowProgress />

        {/* Editor Online Status */}
        <EditorStatus />
      </div>
    );
  }

  // Team Lead Dashboard - Same as Admin but labeled for Team Lead
  if (isTeamLead() && data?.overview) {
    return (
      <div className="space-y-6">
        {/* Active Event Hero Card */}
        <ActiveEventCard event={activeEvent} />

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Command</h1>
          <p className="text-gray-500">Event operations oversight — real-time situational awareness</p>
        </div>

        {/* Primary KPIs - Same as Admin */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            title="Active SD Sessions"
            value={data.overview.active_sessions || 0}
            icon={Activity}
            color="blue"
            subtitle="Currently copying"
          />
          <StatCard
            title="Cameras Healthy"
            value={data.overview.cameras_healthy || 0}
            icon={Camera}
            color="green"
            subtitle={`${data.overview.cameras_attention || 0} need attention`}
          />
          <StatCard
            title="Open Issues"
            value={data.overview.open_issues || 0}
            icon={AlertTriangle}
            color="red"
            subtitle={`${data.overview.critical_issues || 0} critical`}
          />
          <StatCard
            title="Pending Backups"
            value={data.overview.pending_backups || 0}
            icon={HardDrive}
            color="yellow"
          />
          <StatCard
            title="Early Removals"
            value={data.overview.early_removals_today || 0}
            icon={AlertTriangle}
            color={data.overview.early_removals_today > 0 ? 'red' : 'green'}
            subtitle="Today"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IssuesList issues={data.recent_issues} />
          <GroupsHealth groups={data.groups_health} />
        </div>

        {/* Workflow Progress */}
        <WorkflowProgress />

        {/* Editor Online Status */}
        <EditorStatus />
      </div>
    );
  }

  // Group Leader Dashboard - "TEAM CONTROL VIEW" per blueprint (scoped to their group)
  if (isGroupLeader() && data?.groups) {
    return (
      <div className="space-y-6">
        {/* Active Event Hero Card */}
        <ActiveEventCard event={activeEvent} />

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Control View</h1>
          <p className="text-gray-500">Your group's operations — no global data, only your team</p>
        </div>

        {/* Group-scoped KPIs per blueprint */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Editors Online"
            value={data.team_stats?.online_members || 0}
            icon={Wifi}
            color="green"
            subtitle={`of ${data.team_stats?.total_members || 0} total`}
          />
          <StatCard
            title="Active Sessions"
            value={data.team_stats?.active_sessions || 0}
            icon={Activity}
            color="blue"
            subtitle="In your group"
          />
          <StatCard
            title="Open Issues"
            value={data.groups?.reduce((sum, g) => sum + g.open_issues, 0) || 0}
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            title="Backup Completion"
            value={`${data.team_stats?.backup_percentage || 0}%`}
            icon={HardDrive}
            color={data.team_stats?.backup_percentage >= 80 ? 'green' : 'yellow'}
            subtitle="Group only"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editors in Group */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">My Team</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {data.groups?.map((group) => (
                <div key={group.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{group.code} - {group.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-sm">
                        <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                        {group.online_count || 0} online
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-600">{group.member_count} members</span>
                    <span className="text-red-600">{group.open_issues} issues</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <IssuesList issues={data.recent_issues} />
        </div>

        {/* Scoped workflow and status */}
        <WorkflowProgress />
        <EditorStatus />

        {/* Scope reminder */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
          <strong>📋 Scoped View</strong> — You only see data from your assigned groups. No global search or unrelated data.
        </div>
      </div>
    );
  }

  // QA Dashboard - "ISSUE WORKBENCH" per blueprint (only issues, never clean footage)
  if ((isQALead() || isQA()) && data?.issue_summary) {
    const severityData = data.severity_distribution || { critical: 0, high: 0, medium: 0, low: 0 };
    const totalIssues = Object.values(severityData).reduce((a, b) => a + b, 0);
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isQALead() ? 'QA Lead Workbench' : 'Issue Workbench'}
          </h1>
          <p className="text-gray-500">
            Issue review only — you never see clean footage, only problems to resolve
          </p>
        </div>

        {/* Issue Queue Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Open Queue" value={data.issue_summary.open || 0} icon={Clock} color="blue" />
          <StatCard title="Acknowledged" value={data.issue_summary.acknowledged || 0} icon={Activity} color="yellow" />
          <StatCard title="In Progress" value={data.issue_summary.in_progress || 0} icon={TrendingUp} color="purple" />
          <StatCard title="Resolved Today" value={data.issue_summary.resolved_today || 0} icon={CheckCircle} color="green" />
        </div>

        {/* Severity Distribution - per blueprint */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Severity Distribution</h3>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{severityData.critical || 0}</div>
              <div className="text-xs text-red-600">Critical</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-700">{severityData.high || 0}</div>
              <div className="text-xs text-orange-600">High</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">{severityData.medium || 0}</div>
              <div className="text-xs text-yellow-600">Medium</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">{severityData.low || 0}</div>
              <div className="text-xs text-gray-600">Low</div>
            </div>
          </div>
          {totalIssues > 0 && (
            <div className="h-3 flex rounded-full overflow-hidden">
              <div className="bg-red-500" style={{ width: `${(severityData.critical / totalIssues) * 100}%` }} />
              <div className="bg-orange-500" style={{ width: `${(severityData.high / totalIssues) * 100}%` }} />
              <div className="bg-yellow-500" style={{ width: `${(severityData.medium / totalIssues) * 100}%` }} />
              <div className="bg-gray-400" style={{ width: `${(severityData.low / totalIssues) * 100}%` }} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Critical Issues Queue */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Critical Issues Queue</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {data.critical_issues?.length === 0 && (
                <div className="p-4 text-center text-gray-500">No critical issues</div>
              )}
              {data.critical_issues?.map((issue) => (
                <div key={issue.id} className="p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{issue.type?.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-500">
                        Camera {issue.camera_number || issue.media?.camera_number || '?'} • {issue.group?.group_code}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                      Critical
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cameras with Repeated Issues - per blueprint */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Cameras with Repeated Issues</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {(data.problem_cameras || []).length === 0 && (
                <div className="p-4 text-center text-gray-500">No cameras flagged</div>
              )}
              {(data.problem_cameras || []).map((cam) => (
                <div key={cam.camera_number} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">Camera {cam.camera_number}</span>
                  </div>
                  <span className="text-red-600 text-sm">{cam.issue_count} issues</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QA Scope Reminder */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-700">
          <strong>🔒 QA Access</strong> — You can only view and resolve issues. No access to names, regions, or clean footage.
        </div>
      </div>
    );
  }

  // Backup Dashboard - "ARCHIVE INTEGRITY VIEW" per blueprint
  if ((isBackupLead() || isBackup()) && data?.coverage) {
    const coverage = data.coverage;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isBackupLead() ? 'Archive Integrity Lead' : 'Archive Integrity View'}
          </h1>
          <p className="text-gray-500">
            Coverage and verification status — you see integrity, not content
          </p>
        </div>

        {/* Primary KPIs per blueprint */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            title="Pending Backups" 
            value={coverage.pending || 0} 
            icon={Clock} 
            color={coverage.pending > 10 ? 'red' : 'yellow'}
            subtitle="By editor"
          />
          <StatCard 
            title="Disks In Use" 
            value={coverage.disks_in_use || 0} 
            icon={HardDrive} 
            color="blue" 
          />
          <StatCard 
            title="Verification Failures" 
            value={coverage.verification_failures || 0} 
            icon={AlertTriangle} 
            color={coverage.verification_failures > 0 ? 'red' : 'green'}
          />
          <StatCard 
            title="Coverage" 
            value={`${coverage.coverage_percentage || 0}%`} 
            icon={CheckCircle} 
            color={coverage.coverage_percentage >= 90 ? 'green' : 'yellow'}
          />
        </div>

        {/* Coverage Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Backup Coverage</h3>
          <div className="grid grid-cols-3 gap-4 mb-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{coverage.total_media || 0}</div>
              <div className="text-sm text-gray-500">Total Files</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{coverage.backed_up || 0}</div>
              <div className="text-sm text-gray-500">Backed Up</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{coverage.verified || 0}</div>
              <div className="text-sm text-gray-500">Verified</div>
            </div>
          </div>
          <div className="overflow-hidden h-4 flex rounded-full bg-gray-200">
            <div
              style={{ width: `${coverage.coverage_percentage}%` }}
              className="bg-green-500 transition-all duration-500"
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0%</span>
            <span>{coverage.coverage_percentage}% backed up</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending by Editor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Pending by Editor</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {(data.pending_by_editor || []).length === 0 && (
                <div className="p-4 text-center text-gray-500">All caught up!</div>
              )}
              {(data.pending_by_editor || []).map((editor) => (
                <div key={editor.id} className="p-4 flex items-center justify-between">
                  <span className="font-medium">{editor.name}</span>
                  <span className={`text-sm ${editor.pending > 5 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {editor.pending} pending
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Disk Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Disk Rotation Status</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {(data.disk_status || []).length === 0 && (
                <div className="p-4 text-center text-gray-500">No disk data</div>
              )}
              {(data.disk_status || []).map((disk) => (
                <div key={disk.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">{disk.label}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    disk.status === 'active' ? 'bg-green-100 text-green-700' :
                    disk.status === 'full' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {disk.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Backup Scope Reminder */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          <strong>💾 Archive View</strong> — You see coverage and verification, not file contents. Focus on integrity, not media.
        </div>
      </div>
    );
  }

  // Default/Editor Dashboard
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500">Your activity overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Files Indexed Today"
          value={data?.today?.files_indexed || 0}
          icon={Video}
          color="blue"
        />
        <StatCard
          title="Issues Reported"
          value={data?.today?.issues_reported || 0}
          icon={AlertTriangle}
          color="yellow"
        />
        <StatCard
          title="Backups Verified"
          value={data?.today?.backups_verified || 0}
          icon={CheckCircle}
          color="green"
        />
      </div>
    </div>
  );
}
