import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { eventService, exportService, reportsService } from '../services/api';
import {
  FileText,
  Download,
  Calendar,
  Users,
  Video,
  HardDrive,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  File,
  Clock,
  CheckCircle,
} from 'lucide-react';

const reportTypes = [
  {
    id: 'daily-summary',
    name: 'Daily Summary',
    description: 'Overview of daily operations including media count, issues, and editor activity',
    icon: Calendar,
    formats: ['pdf', 'xlsx'],
    category: 'operations',
  },
  {
    id: 'event-report',
    name: 'Event Report',
    description: 'Complete report for a specific event including all statistics and media',
    icon: BarChart3,
    formats: ['pdf', 'xlsx'],
    category: 'operations',
  },
  {
    id: 'media-export',
    name: 'Media Inventory',
    description: 'Export list of all media files with metadata and status',
    icon: Video,
    formats: ['xlsx', 'csv'],
    category: 'media',
  },
  {
    id: 'issues-report',
    name: 'Issues Report',
    description: 'List of all issues with resolution status and timeline',
    icon: AlertTriangle,
    formats: ['pdf', 'xlsx'],
    category: 'quality',
  },
  {
    id: 'backup-report',
    name: 'Backup Status',
    description: 'Backup coverage and verification report by disk and event',
    icon: HardDrive,
    formats: ['pdf', 'xlsx'],
    category: 'storage',
  },
  {
    id: 'editor-performance',
    name: 'Editor Performance',
    description: 'Performance metrics and productivity stats for editors',
    icon: Users,
    formats: ['pdf', 'xlsx'],
    category: 'team',
  },
  {
    id: 'healing-cases',
    name: 'Healing Cases',
    description: 'Export healing case records with patient info and status',
    icon: FileText,
    formats: ['xlsx', 'csv'],
    category: 'media',
  },
  {
    id: 'audit-logs',
    name: 'Audit Trail',
    description: 'System audit logs for compliance and tracking',
    icon: FileText,
    formats: ['xlsx', 'csv'],
    category: 'admin',
  },
];

const categoryLabels = {
  operations: 'Operations',
  media: 'Media',
  quality: 'Quality Control',
  storage: 'Storage',
  team: 'Team',
  admin: 'Administration',
};

export default function Reports() {
  const { activeEvent } = useAuth();
  const [selectedReport, setSelectedReport] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [eventId, setEventId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [recentReports, setRecentReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!activeEvent?.id) return;
    setEventId(String(activeEvent.id));
  }, [activeEvent?.id]);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await eventService.getAll({ status: 'active' });
        const list = res?.data || res?.events || res || [];
        setEvents(Array.isArray(list) ? list : []);
      } catch (e) {
        setEvents([]);
      }
    };
    loadEvents();
  }, []);

  const groupedReports = useMemo(() => {
    return reportTypes.reduce((acc, report) => {
      if (!acc[report.category]) acc[report.category] = [];
      acc[report.category].push(report);
      return acc;
    }, {});
  }, []);

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const isoDate = (value) => {
    if (!value) return '';
    try {
      return new Date(value).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  };

  const reportFilename = (base, ext) => {
    const stamp = isoDate(new Date());
    return `${base}_${stamp}.${ext}`;
  };

  const handleGenerate = async (reportId, format) => {
    setGenerating(true);
    setErrorMessage('');
    try {
      const report = reportTypes.find(r => r.id === reportId);
      if (!report) {
        throw new Error('Unknown report type');
      }

      const params = {
        event_id: eventId || undefined,
        from_date: dateRange.start || undefined,
        to_date: dateRange.end || undefined,
      };

      // CSV exports (real downloads)
      if (reportId === 'media-export') {
        const blob = await exportService.exportMedia(params);
        downloadBlob(blob, reportFilename('media_export', 'csv'));
      } else if (reportId === 'issues-report') {
        const blob = await exportService.exportIssues(params);
        downloadBlob(blob, reportFilename('issues_export', 'csv'));
      } else if (reportId === 'backup-report') {
        const blob = await exportService.backupReport(params);
        downloadBlob(blob, reportFilename('backup_report', 'csv'));
      } else if (reportId === 'editor-performance') {
        const blob = await exportService.editorPerformance(params);
        downloadBlob(blob, reportFilename('editor_performance', 'csv'));
      } else if (reportId === 'healing-cases') {
        const blob = await exportService.exportHealingCases(params);
        downloadBlob(blob, reportFilename('healing_cases_export', 'csv'));
      } else if (reportId === 'audit-logs') {
        const blob = await exportService.exportAuditLogs(params);
        downloadBlob(blob, reportFilename('audit_logs_export', 'csv'));
      } else if (reportId === 'daily-summary') {
        const data = await reportsService.dailySummary({
          date: dateRange.start || undefined,
          event_id: eventId || undefined,
        });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, reportFilename('daily_summary', 'json'));
      } else if (reportId === 'event-report') {
        if (!eventId) {
          throw new Error('Please select an event');
        }
        const data = await reportsService.eventReport(eventId, { event_id: eventId });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, reportFilename(`event_report_${eventId}`, 'json'));
      } else {
        throw new Error('This report type is not implemented yet');
      }

      const newReport = {
        id: Date.now(),
        name: `${report.name} - ${new Date().toLocaleDateString()}`,
        type: format,
        size: 'downloaded',
        time: 'Just now',
      };
      setRecentReports((prev) => [newReport, ...prev.slice(0, 9)]);
      setSelectedReport(null);
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">Generate and download system reports</p>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Types */}
        <div className="lg:col-span-2 space-y-6">
          {Object.entries(groupedReports).map(([category, reports]) => (
            <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">{categoryLabels[category]}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <report.icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{report.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{report.description}</p>
                        <div className="flex items-center gap-2 mt-3">
                          {report.formats.map((format) => (
                            <button
                              key={format}
                              onClick={() => setSelectedReport({ ...report, format })}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              {format === 'pdf' ? (
                                <File className="w-4 h-4 text-red-500" />
                              ) : (
                                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                              )}
                              {format.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Reports */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Reports</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentReports.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No recent reports
                </div>
              ) : (
                recentReports.map((report) => (
                  <div key={report.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {report.type === 'pdf' ? (
                        <File className="w-8 h-8 text-red-500" />
                      ) : (
                        <FileSpreadsheet className="w-8 h-8 text-green-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {report.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {report.size} • {report.time}
                        </p>
                      </div>
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <Download className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-blue-100">Reports this month</span>
                <span className="font-semibold">24</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-100">Total downloads</span>
                <span className="font-semibold">156</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-100">Storage used</span>
                <span className="font-semibold">48 MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Generate Report</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Report Type</p>
                <p className="font-medium">{selectedReport.name} ({selectedReport.format.toUpperCase()})</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {selectedReport.id === 'event-report' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event
                  </label>
                  <select
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select event...</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={String(ev.id)}>
                        {ev.event_code || ev.code || ev.name} {ev.name ? `- ${ev.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleGenerate(selectedReport.id, selectedReport.format)}
                  disabled={generating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
