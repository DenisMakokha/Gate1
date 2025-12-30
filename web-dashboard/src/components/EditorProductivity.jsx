import React, { useState, useEffect } from 'react';
import { dashboardService } from '../services/api';
import { 
  TrendingUp, Clock, RefreshCw, Users, Copy, FileEdit, 
  HardDrive, Award, BarChart3, Activity
} from 'lucide-react';

export default function EditorProductivity({ eventId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today'); // today, hourly

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await dashboardService.getTimeAnalytics(eventId);
      setData(response);
    } catch (error) {
      console.error('Failed to load productivity data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const maxHourlyCount = data?.hourly_activity?.length > 0 
    ? Math.max(...data.hourly_activity.map(h => h.count)) 
    : 1;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Editor Productivity</h2>
              <p className="text-sm text-gray-500">Performance metrics and efficiency tracking</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-sky-600 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium">Avg Session</span>
            </div>
            <p className="text-2xl font-bold text-sky-700">
              {Math.round(data?.avg_session_minutes || 0)} min
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Copy className="w-5 h-5" />
              <span className="text-sm font-medium">Files/Session</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {Math.round(data?.avg_files_per_session || 0)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Activity className="w-5 h-5" />
              <span className="text-sm font-medium">Files/Hour</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">
              {data?.files_per_hour || 0}
            </p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">Active Editors</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">
              {data?.active_editors_today || 0}
            </p>
          </div>
        </div>

        {/* Hourly Activity Chart */}
        {data?.hourly_activity?.length > 0 && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-500" />
              Hourly Activity (Last 24h)
            </h3>
            <div className="flex items-end gap-1 h-32">
              {data.hourly_activity.map((hour, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-sky-500 rounded-t transition-all hover:bg-sky-600"
                    style={{ 
                      height: `${(hour.count / maxHourlyCount) * 100}%`,
                      minHeight: hour.count > 0 ? '4px' : '0'
                    }}
                    title={`${hour.hour}: ${hour.count} files`}
                  />
                  <span className="text-xs text-gray-400 mt-1 rotate-45 origin-left">
                    {hour.hour?.split(':')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editor Efficiency Leaderboard */}
        {data?.editor_efficiency?.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Editor Efficiency (Files/Hour)
            </h3>
            <div className="space-y-3">
              {data.editor_efficiency.slice(0, 10).map((editor, idx) => (
                <div 
                  key={editor.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' :
                    idx === 1 ? 'bg-gray-200 text-gray-700' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{editor.name}</p>
                    <p className="text-xs text-gray-500">
                      {editor.files_last_8_hours || 0} files in last 8 hours
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sky-600">{editor.files_per_hour || 0}</p>
                    <p className="text-xs text-gray-500">files/hr</p>
                  </div>
                  <div className="w-24">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-sky-500"
                        style={{ 
                          width: `${Math.min(100, (editor.files_per_hour / (data.editor_efficiency[0]?.files_per_hour || 1)) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Peak Hours Insight */}
        {data?.peak_hours && (
          <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-indigo-600" />
              <div>
                <p className="font-medium text-indigo-700">Peak Productivity Hours</p>
                <p className="text-sm text-indigo-600">
                  {data.peak_hours.join(', ')} - Schedule critical tasks during these times
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
