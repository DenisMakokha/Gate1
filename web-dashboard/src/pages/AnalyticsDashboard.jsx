import React, { useState, useEffect } from 'react';
import { dashboardService, eventService } from '../services/api';
import {
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  HardDrive,
  Activity,
  RefreshCw,
  Bell,
  Zap,
  Target,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  Minus,
  BarChart3,
  Timer,
  Trash2,
  Eject,
  FileWarning,
  Circle,
} from 'lucide-react';

function ProgressBar({ percentage, color = 'sky', size = 'md' }) {
  const colors = {
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  };
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3' };
  
  return (
    <div className={`w-full bg-gray-200 rounded-full ${heights[size]}`}>
      <div
        className={`${heights[size]} rounded-full ${colors[color]} transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend, trendValue }) {
  const colors = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : 
               trend === 'down' ? <TrendingDown className="w-4 h-4" /> : 
               <Minus className="w-4 h-4" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function AlertItem({ alert }) {
  const severityColors = {
    critical: 'border-red-200 bg-red-50',
    warning: 'border-amber-200 bg-amber-50',
    info: 'border-sky-200 bg-sky-50',
  };
  const severityIcons = {
    critical: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <AlertCircle className="w-5 h-5 text-sky-500" />,
  };

  return (
    <div className={`p-3 rounded-lg border ${severityColors[alert.severity]} flex items-start gap-3`}>
      {severityIcons[alert.severity]}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 text-sm">{alert.title}</div>
        <div className="text-gray-600 text-xs mt-0.5">{alert.message}</div>
        <div className="text-gray-400 text-xs mt-1">{alert.time_ago} • {alert.user}</div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [timeData, setTimeData] = useState(null);
  const [incidentData, setIncidentData] = useState(null);
  const [sdCardData, setSdCardData] = useState(null);
  const [comparativeData, setComparativeData] = useState(null);
  const [predictiveData, setPredictiveData] = useState(null);
  const [alertsData, setAlertsData] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    loadAllData();
  }, [selectedEvent]);

  const loadEvents = async () => {
    try {
      const response = await eventService.getAll();
      setEvents(response.data || response || []);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [time, incidents, sdCards, comparative, predictive, alerts] = await Promise.all([
        dashboardService.getTimeAnalytics(selectedEvent || undefined),
        dashboardService.getIncidents(selectedEvent || undefined, 7),
        dashboardService.getSdCardLifecycle(selectedEvent || undefined),
        dashboardService.getComparative(selectedEvent || undefined),
        dashboardService.getPredictive(selectedEvent || undefined),
        dashboardService.getAlerts(selectedEvent || undefined),
      ]);
      setTimeData(time);
      setIncidentData(incidents);
      setSdCardData(sdCards);
      setComparativeData(comparative);
      setPredictiveData(predictive);
      setAlertsData(alerts);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !timeData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'time', label: 'Time Analytics', icon: Clock },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'sdcards', label: 'SD Cards', icon: HardDrive },
    { id: 'leaderboard', label: 'Leaderboard', icon: Award },
    { id: 'planning', label: 'Planning', icon: Target },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 text-sm">360° view of workflow operations</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Real-time Alerts Banner */}
      {alertsData?.summary?.critical > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <Bell className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-red-900">
              {alertsData.summary.critical} Critical Alert{alertsData.summary.critical > 1 ? 's' : ''}
            </div>
            <div className="text-red-700 text-sm">Immediate attention required</div>
          </div>
          <button
            onClick={() => setActiveTab('incidents')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            View Alerts
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Processing Rate"
              value={`${timeData?.summary?.files_per_hour_24h || 0}/hr`}
              subtitle={`${timeData?.summary?.total_files_24h || 0} files in 24h`}
              icon={Zap}
              color="sky"
            />
            <StatCard
              title="Active Alerts"
              value={alertsData?.summary?.total || 0}
              subtitle={`${alertsData?.summary?.critical || 0} critical`}
              icon={Bell}
              color={alertsData?.summary?.critical > 0 ? 'red' : 'emerald'}
            />
            <StatCard
              title="ETA Completion"
              value={predictiveData?.eta?.copies_formatted || 'N/A'}
              subtitle={`${predictiveData?.pending_work?.total || 0} pending`}
              icon={Timer}
              color="purple"
            />
            <StatCard
              title="Online Editors"
              value={predictiveData?.resources?.online_editors || 0}
              subtitle={predictiveData?.resources?.status === 'understaffed' ? 'Need more staff' : 'Optimal'}
              icon={Users}
              color={predictiveData?.resources?.status === 'understaffed' ? 'amber' : 'emerald'}
            />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Alerts */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Alerts</h3>
                <span className="text-xs text-gray-500">{alertsData?.summary?.total || 0} total</span>
              </div>
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {alertsData?.alerts?.slice(0, 5).map((alert, idx) => (
                  <AlertItem key={idx} alert={alert} />
                ))}
                {(!alertsData?.alerts || alertsData.alerts.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-300" />
                    <p>No active alerts</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top Performers */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Top Performers Today</h3>
              </div>
              <div className="p-4 space-y-3">
                {comparativeData?.editor_leaderboard?.slice(0, 5).map((editor, idx) => (
                  <div key={editor.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-gray-100 text-gray-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{editor.name}</div>
                      <div className="text-xs text-gray-500">{editor.files_this_week} this week</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{editor.files_today}</div>
                      <div className={`text-xs flex items-center gap-1 ${
                        editor.trend === 'up' ? 'text-emerald-600' : 
                        editor.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {editor.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : 
                         editor.trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                        {editor.change_percent > 0 ? '+' : ''}{editor.change_percent}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hourly Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Files Processed (Last 12 Hours)</h3>
            <div className="flex items-end gap-2 h-32">
              {timeData?.hourly_breakdown?.map((hour, idx) => {
                const maxFiles = Math.max(...(timeData.hourly_breakdown?.map(h => h.files) || [1]));
                const height = maxFiles > 0 ? (hour.files / maxFiles) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '100px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-sky-500 rounded-t transition-all"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{hour.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'time' && (
        <div className="space-y-6">
          {/* Time Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Avg Session Duration"
              value={`${timeData?.summary?.avg_session_minutes || 0} min`}
              icon={Clock}
              color="sky"
            />
            <StatCard
              title="Avg Files/Session"
              value={timeData?.summary?.avg_files_per_session || 0}
              icon={Activity}
              color="emerald"
            />
            <StatCard
              title="Files/Hour (24h)"
              value={timeData?.summary?.files_per_hour_24h || 0}
              icon={Zap}
              color="purple"
            />
            <StatCard
              title="Total (24h)"
              value={timeData?.summary?.total_files_24h || 0}
              icon={BarChart3}
              color="amber"
            />
          </div>

          {/* Editor Efficiency */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Editor Efficiency (Last 8 Hours)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Editor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Files</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sessions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Files/Hour</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {timeData?.editor_efficiency?.map((editor) => (
                    <tr key={editor.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Circle className={`w-2.5 h-2.5 ${editor.is_online ? 'fill-emerald-500 text-emerald-500' : 'fill-gray-300 text-gray-300'}`} />
                          <span className="font-medium text-gray-900">{editor.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{editor.files_last_8h}</td>
                      <td className="px-4 py-3 text-right">{editor.sessions_last_8h}</td>
                      <td className="px-4 py-3 text-right font-bold text-sky-600">{editor.files_per_hour}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          editor.is_online ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {editor.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottlenecks */}
          {timeData?.bottlenecks?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Bottlenecks Detected
              </h3>
              <div className="space-y-2">
                {timeData.bottlenecks.map((session) => (
                  <div key={session.session_id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium">{session.editor}</span>
                      <span className="text-gray-500 mx-2">•</span>
                      <span>Camera {session.camera}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{session.files_copied}/{session.files_detected} files</div>
                      <div className="text-xs text-amber-600">{session.duration_minutes} min elapsed</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="space-y-6">
          {/* Incident Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Incidents"
              value={incidentData?.summary?.total_incidents || 0}
              subtitle="Last 7 days"
              icon={AlertTriangle}
              color="amber"
            />
            <StatCard
              title="File Deletions"
              value={incidentData?.summary?.deletions || 0}
              icon={Trash2}
              color="red"
            />
            <StatCard
              title="Early Removals"
              value={incidentData?.summary?.early_removals || 0}
              icon={Eject}
              color="amber"
            />
            <StatCard
              title="Repeat Offenders"
              value={incidentData?.summary?.repeat_offenders || 0}
              icon={Users}
              color={incidentData?.summary?.repeat_offenders > 0 ? 'red' : 'emerald'}
            />
          </div>

          {/* Repeat Offenders */}
          {incidentData?.repeat_offenders?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-900 mb-3">⚠️ Repeat Offenders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {incidentData.repeat_offenders.map((user) => (
                  <div key={user.id} className="bg-white rounded-lg p-3">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{user.email}</div>
                    <div className="flex gap-3 mt-2 text-xs">
                      {user.deletions > 0 && <span className="text-red-600">{user.deletions} deletions</span>}
                      {user.early_removals > 0 && <span className="text-amber-600">{user.early_removals} early removals</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incident Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deletions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-900">File Deletions</h3>
              </div>
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                {incidentData?.deletions?.map((del) => (
                  <div key={del.id} className="p-2 bg-red-50 rounded-lg text-sm">
                    <div className="font-medium text-red-900">{del.user}</div>
                    <div className="text-red-700 text-xs">{del.details}</div>
                    <div className="text-red-500 text-xs mt-1">{new Date(del.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {(!incidentData?.deletions || incidentData.deletions.length === 0) && (
                  <div className="text-center py-4 text-gray-500 text-sm">No deletions recorded</div>
                )}
              </div>
            </div>

            {/* Early Removals */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Eject className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-gray-900">Early SD Removals</h3>
              </div>
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                {incidentData?.early_removals?.map((rem) => (
                  <div key={rem.id} className="p-2 bg-amber-50 rounded-lg text-sm">
                    <div className="font-medium text-amber-900">{rem.user} - Camera {rem.camera}</div>
                    <div className="text-amber-700 text-xs">{rem.files_pending} files not copied</div>
                    <div className="text-amber-500 text-xs mt-1">{new Date(rem.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {(!incidentData?.early_removals || incidentData.early_removals.length === 0) && (
                  <div className="text-center py-4 text-gray-500 text-sm">No early removals recorded</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sdcards' && (
        <div className="space-y-6">
          {/* SD Card Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Total SD Cards"
              value={sdCardData?.summary?.total_cards || 0}
              icon={HardDrive}
              color="sky"
            />
            <StatCard
              title="Currently In Use"
              value={sdCardData?.summary?.in_use || 0}
              icon={Activity}
              color="emerald"
            />
            <StatCard
              title="Available"
              value={sdCardData?.summary?.available || 0}
              icon={CheckCircle}
              color="sky"
            />
            <StatCard
              title="Avg Reliability"
              value={`${sdCardData?.summary?.avg_reliability || 100}%`}
              icon={Target}
              color={sdCardData?.summary?.avg_reliability < 90 ? 'amber' : 'emerald'}
            />
          </div>

          {/* Problematic Cards */}
          {sdCardData?.problematic_cards?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-900 mb-3">⚠️ Cards Needing Attention</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sdCardData.problematic_cards.map((card) => (
                  <div key={card.id} className="bg-white rounded-lg p-3">
                    <div className="font-medium">Camera {card.camera_number}{card.sd_label}</div>
                    <div className="text-xs text-gray-500">{card.hardware_id}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar percentage={card.reliability_score} color="amber" size="sm" />
                      <span className="text-xs text-amber-600">{card.reliability_score}%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{card.early_removals} early removals</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Cards Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">All SD Cards</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sessions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Files</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Reliability</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sdCardData?.cards?.map((card) => (
                    <tr key={card.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">Camera {card.camera_number}{card.sd_label}</div>
                        <div className="text-xs text-gray-500">{card.hardware_id}</div>
                      </td>
                      <td className="px-4 py-3 text-right">{card.total_sessions}</td>
                      <td className="px-4 py-3 text-right">{card.total_files_processed}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16">
                            <ProgressBar
                              percentage={card.reliability_score}
                              color={card.reliability_score >= 90 ? 'emerald' : card.reliability_score >= 70 ? 'amber' : 'red'}
                              size="sm"
                            />
                          </div>
                          <span className="text-xs">{card.reliability_score}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          card.status === 'in_use' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {card.status === 'in_use' ? 'In Use' : 'Available'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {card.last_used ? new Date(card.last_used).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Group Comparison */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Group Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Today</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Yesterday</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">This Week</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Backup %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comparativeData?.group_comparison?.map((group) => (
                    <tr key={group.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{group.group_code}</div>
                        <div className="text-xs text-gray-500">{group.member_count} members</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{group.files_today}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{group.files_yesterday}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{group.files_this_week}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16">
                            <ProgressBar percentage={group.backup_percentage} color="emerald" size="sm" />
                          </div>
                          <span className="text-xs">{group.backup_percentage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {group.trend === 'up' ? (
                          <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : group.trend === 'down' ? (
                          <TrendingDown className="w-5 h-5 text-red-500 mx-auto" />
                        ) : (
                          <Minus className="w-5 h-5 text-gray-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Editor Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">🏆 Editor Leaderboard</h3>
            </div>
            <div className="p-4 space-y-3">
              {comparativeData?.editor_leaderboard?.map((editor, idx) => (
                <div key={editor.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' :
                    idx === 1 ? 'bg-gray-200 text-gray-700' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{editor.name}</div>
                    <div className="text-xs text-gray-500">{editor.files_this_week} files this week</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{editor.files_today}</div>
                    <div className={`text-xs flex items-center justify-end gap-1 ${
                      editor.trend === 'up' ? 'text-emerald-600' : 
                      editor.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {editor.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : 
                       editor.trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                      {editor.change_percent > 0 ? '+' : ''}{editor.change_percent}% vs yesterday
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'planning' && (
        <div className="space-y-6">
          {/* Pending Work */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Pending Copies"
              value={predictiveData?.pending_work?.copies || 0}
              icon={Activity}
              color="sky"
            />
            <StatCard
              title="Pending Backups"
              value={predictiveData?.pending_work?.backups || 0}
              icon={HardDrive}
              color="amber"
            />
            <StatCard
              title="Pending Verification"
              value={predictiveData?.pending_work?.verification || 0}
              icon={CheckCircle}
              color="purple"
            />
            <StatCard
              title="Total Pending"
              value={predictiveData?.pending_work?.total || 0}
              icon={Target}
              color="red"
            />
          </div>

          {/* ETA & Resources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ETA */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Estimated Completion Time</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-sky-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Copies ETA</div>
                    <div className="text-2xl font-bold text-sky-700">{predictiveData?.eta?.copies_formatted || 'N/A'}</div>
                  </div>
                  <Timer className="w-8 h-8 text-sky-500" />
                </div>
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Backups ETA</div>
                    <div className="text-2xl font-bold text-amber-700">{predictiveData?.eta?.backups_formatted || 'N/A'}</div>
                  </div>
                  <Timer className="w-8 h-8 text-amber-500" />
                </div>
                <div className="text-sm text-gray-500 text-center">
                  Based on {predictiveData?.processing_rate?.files_per_hour || 0} files/hour processing rate
                </div>
              </div>
            </div>

            {/* Resources */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Resource Status</h3>
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  predictiveData?.resources?.status === 'understaffed' ? 'bg-red-50' :
                  predictiveData?.resources?.status === 'overstaffed' ? 'bg-amber-50' : 'bg-emerald-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Status</div>
                      <div className={`text-xl font-bold capitalize ${
                        predictiveData?.resources?.status === 'understaffed' ? 'text-red-700' :
                        predictiveData?.resources?.status === 'overstaffed' ? 'text-amber-700' : 'text-emerald-700'
                      }`}>
                        {predictiveData?.resources?.status || 'Unknown'}
                      </div>
                    </div>
                    <Users className={`w-8 h-8 ${
                      predictiveData?.resources?.status === 'understaffed' ? 'text-red-500' :
                      predictiveData?.resources?.status === 'overstaffed' ? 'text-amber-500' : 'text-emerald-500'
                    }`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold">{predictiveData?.resources?.online_editors || 0}</div>
                    <div className="text-xs text-gray-500">Online Editors</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold">{predictiveData?.resources?.recommended_editors || 0}</div>
                    <div className="text-xs text-gray-500">Recommended</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500 text-center">
                  Workload: {predictiveData?.resources?.workload_per_editor || 0} files per editor
                </div>
              </div>
            </div>
          </div>

          {/* Editor Workload */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Editor Workload Distribution</h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {predictiveData?.editor_workload?.map((editor) => (
                <div key={editor.id} className={`p-3 rounded-lg border ${
                  editor.status === 'overloaded' ? 'border-red-200 bg-red-50' :
                  editor.status === 'busy' ? 'border-amber-200 bg-amber-50' :
                  editor.status === 'available' ? 'border-emerald-200 bg-emerald-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Circle className={`w-2.5 h-2.5 ${
                        editor.is_online ? 'fill-emerald-500 text-emerald-500' : 'fill-gray-300 text-gray-300'
                      }`} />
                      <span className="font-medium">{editor.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      editor.status === 'overloaded' ? 'bg-red-200 text-red-700' :
                      editor.status === 'busy' ? 'bg-amber-200 text-amber-700' :
                      editor.status === 'available' ? 'bg-emerald-200 text-emerald-700' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {editor.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-bold">{editor.pending_files}</span> files pending
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
