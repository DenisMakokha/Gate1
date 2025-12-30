import React, { useState, useEffect } from 'react';
import { 
  Shield, Calendar, Trash2, AlertTriangle, CheckCircle, 
  Clock, Settings, RefreshCw, Info, Lock
} from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default function DataProtection() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [settings, setSettings] = useState({
    auto_delete_enabled: false,
    auto_delete_date: '',
    auto_delete_days_after_end: '',
  });
  const [deleteReason, setDeleteReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/media-deletion/status');
      setEvents(response.data || []);
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const openSettings = async (event) => {
    try {
      const response = await api.get(`/media-deletion/event/${event.id}`);
      setSelectedEvent(event);
      setSettings({
        auto_delete_enabled: response.data.auto_delete_enabled || false,
        auto_delete_date: response.data.auto_delete_date || '',
        auto_delete_days_after_end: response.data.auto_delete_days_after_end || '',
      });
      setShowSettingsModal(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await api.put(`/media-deletion/event/${selectedEvent.id}`, settings);
      setShowSettingsModal(false);
      loadEvents();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const triggerDeletion = async () => {
    if (!deleteReason || deleteReason.length < 10) {
      alert('Please provide a reason (at least 10 characters)');
      return;
    }

    try {
      setSaving(true);
      await api.post(`/media-deletion/event/${selectedEvent.id}/trigger`, {
        confirm: true,
        reason: deleteReason,
      });
      setShowDeleteModal(false);
      setDeleteReason('');
      loadEvents();
    } catch (error) {
      console.error('Failed to trigger deletion:', error);
      alert('Failed to trigger deletion');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      deleted: { bg: 'bg-gray-100', text: 'text-gray-600', icon: CheckCircle },
      disabled: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Info },
      pending_deletion: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
      not_configured: { bg: 'bg-gray-100', text: 'text-gray-500', icon: Settings },
    };
    const style = styles[status] || styles.not_configured;
    const Icon = style.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon size={12} />
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 rounded-lg">
            <Shield className="text-red-600" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Data Protection</h1>
        </div>
        <p className="text-gray-600">
          Configure automatic media deletion for events to comply with data protection requirements.
          Videos will be permanently deleted from all editor devices after the specified date.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="text-blue-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-blue-900">How Auto-Delete Works</h3>
            <ul className="mt-2 text-sm text-blue-800 space-y-1">
              <li>• Set a specific date or number of days after event ends</li>
              <li>• Media files are permanently deleted from server storage</li>
              <li>• Deletion tasks are sent to all editor devices (works offline)</li>
              <li>• Metadata is preserved for audit purposes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Event Media Deletion Status</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delete Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Media Files</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{event.name}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {event.end_date || 'Not set'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {event.calculated_delete_date || 'Not configured'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-900 font-medium">{event.media_count}</span>
                    <span className="text-gray-500 text-sm ml-1">files</span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(event.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {event.status !== 'deleted' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openSettings(event)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Configure auto-delete"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete now"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 text-gray-400">
                        <Lock size={18} />
                        <span className="text-xs">Deleted</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No events found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Auto-Delete Settings
              </h3>
              <p className="text-sm text-gray-600 mt-1">{selectedEvent.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.auto_delete_enabled}
                  onChange={(e) => setSettings({ ...settings, auto_delete_enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900">Enable auto-delete</span>
              </label>

              {settings.auto_delete_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delete on specific date
                    </label>
                    <input
                      type="date"
                      value={settings.auto_delete_date}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        auto_delete_date: e.target.value,
                        auto_delete_days_after_end: '' 
                      })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="text-center text-gray-500 text-sm">— OR —</div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Days after event ends
                    </label>
                    <input
                      type="number"
                      value={settings.auto_delete_days_after_end}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        auto_delete_days_after_end: e.target.value,
                        auto_delete_date: '' 
                      })}
                      min="1"
                      max="365"
                      placeholder="e.g., 30"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Media will be deleted this many days after the event end date
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="text-red-600" size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Immediate Deletion
                </h3>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                You are about to permanently delete <strong>{selectedEvent.media_count} media files</strong> from 
                event <strong>"{selectedEvent.name}"</strong>.
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This action cannot be undone. Files will be permanently 
                  deleted from the server and deletion tasks will be sent to all editor devices.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for deletion (required)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Enter the reason for immediate deletion..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteReason('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={triggerDeletion}
                disabled={saving || deleteReason.length < 10}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete All Media'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
