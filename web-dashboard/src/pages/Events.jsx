import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/api';
import { Plus, Calendar, MapPin, Users, Video, CheckCircle, Clock, Eye, X, Trash2, AlertTriangle, Play, Zap } from 'lucide-react';

// Calculate remaining time for an event
function getRemainingTime(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diff = end - now;
  
  if (diff <= 0) return { expired: true, text: 'Ended' };
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return { expired: false, text: `${days}d ${hours}h remaining` };
  if (hours > 0) return { expired: false, text: `${hours}h ${minutes}m remaining` };
  return { expired: false, text: `${minutes}m remaining` };
}

export default function Events() {
  const { refreshActiveEvent } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(null);
  const [conflictEvent, setConflictEvent] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activating, setActivating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '17:00',
    auto_delete_enabled: true,
    auto_delete_days_after_end: 30,
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await eventService.getAll();
      setEvents(response.data || []);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Combine date and time into datetime strings
      const submitData = {
        ...formData,
        start_datetime: formData.start_date && formData.start_time 
          ? `${formData.start_date}T${formData.start_time}:00` 
          : null,
        end_datetime: formData.end_date && formData.end_time 
          ? `${formData.end_date}T${formData.end_time}:00` 
          : null,
      };
      if (editingEvent?.id) {
        await eventService.update(editingEvent.id, submitData);
      } else {
        await eventService.create(submitData);
      }
      setShowModal(false);
      setEditingEvent(null);
      setFormData({ 
        name: '', 
        description: '', 
        location: '', 
        start_date: '', 
        start_time: '09:00',
        end_date: '', 
        end_time: '17:00',
        auto_delete_enabled: true,
        auto_delete_days_after_end: 30,
      });
      loadEvents();
    } catch (error) {
      console.error(editingEvent?.id ? 'Failed to update event:' : 'Failed to create event:', error);
    }
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      name: '',
      description: '',
      location: '',
      start_date: '',
      start_time: '09:00',
      end_date: '',
      end_time: '17:00',
      auto_delete_enabled: true,
      auto_delete_days_after_end: 30,
    });
    setShowModal(true);
  };

  const openEditModal = (event) => {
    if (!event) return;
    setEditingEvent(event);
    setFormData({
      name: event.name ?? '',
      description: event.description ?? '',
      location: event.location ?? '',
      start_date: (event.start_datetime ?? event.start_date ?? '').slice(0, 10),
      start_time: event.start_datetime ? new Date(event.start_datetime).toISOString().slice(11, 16) : '09:00',
      end_date: (event.end_datetime ?? event.end_date ?? '').slice(0, 10),
      end_time: event.end_datetime ? new Date(event.end_datetime).toISOString().slice(11, 16) : '17:00',
      auto_delete_enabled: event.auto_delete_enabled ?? true,
      auto_delete_days_after_end: event.auto_delete_days_after_end ?? 30,
    });
    setShowModal(true);
  };

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const options = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleString(undefined, options);
  };

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const handleActivate = async (id, force = false) => {
    setActivating(true);
    try {
      const response = await eventService.activate(id, force);
      // Refresh the active event in context
      if (refreshActiveEvent) {
        await refreshActiveEvent();
      }
      loadEvents();
      setShowConfirmModal(false);
      setPendingActivation(null);
      setConflictEvent(null);
    } catch (error) {
      // Handle conflict - another event is active
      if (error?.code === 'ACTIVE_EVENT_EXISTS' || error?.response?.data?.code === 'ACTIVE_EVENT_EXISTS') {
        const activeEvent = error?.active_event || error?.response?.data?.active_event;
        setConflictEvent(activeEvent);
        setPendingActivation(id);
        setShowConfirmModal(true);
      } else {
        console.error('Failed to activate event:', error);
      }
    } finally {
      setActivating(false);
    }
  };

  const handleForceActivate = async () => {
    if (pendingActivation) {
      await handleActivate(pendingActivation, true);
    }
  };

  const handleComplete = async (id) => {
    try {
      await eventService.complete(id);
      loadEvents();
    } catch (error) {
      console.error('Failed to complete event:', error);
    }
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700 ring-2 ring-green-400 ring-offset-1',
    completed: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-500',
  };

  // Sort events: active first, then by start date
  const sortedEvents = [...events].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    return new Date(b.start_date) - new Date(a.start_date);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500">Manage healing service events</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          New Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedEvents.map((event) => {
          const isActive = event.status === 'active';
          const remaining = isActive ? getRemainingTime(event.end_datetime || event.end_date) : null;
          
          return (
            <div 
              key={event.id} 
              className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all ${
                isActive 
                  ? 'border-2 border-green-400 ring-4 ring-green-100' 
                  : 'border border-gray-100'
              }`}
            >
              {/* Active Event Banner */}
              {isActive && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="font-semibold text-sm">RUNNING NOW</span>
                  </div>
                  {remaining && !remaining.expired && (
                    <span className="text-white/90 text-sm font-medium">
                      {remaining.text}
                    </span>
                  )}
                  {remaining?.expired && (
                    <span className="text-yellow-200 text-sm font-medium">
                      Past end date
                    </span>
                  )}
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`font-semibold ${isActive ? 'text-green-700' : 'text-gray-900'}`}>
                      {event.name}
                    </h3>
                    <p className="text-sm text-gray-500">{event.code}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[event.status]}`}>
                    {isActive ? (
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Active
                      </span>
                    ) : event.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDateTime(event.start_datetime || event.start_date)}</span>
                  </div>
                  {(event.end_datetime || event.end_date) && (
                    <div className={`flex items-center gap-2 ${isActive ? 'text-green-600 font-medium' : ''}`}>
                      <Clock className="w-4 h-4" />
                      <span>Ends: {formatDateTime(event.end_datetime || event.end_date)}</span>
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  {event.auto_delete_enabled && (
                    <div className="flex items-center gap-2 text-orange-600">
                      <Trash2 className="w-4 h-4" />
                      <span>Auto-delete {event.auto_delete_days_after_end || 30}d after end</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-sm">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Video className="w-4 h-4" />
                    <span>{event.media_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>{event.groups_count || 0} groups</span>
                  </div>
                </div>
              </div>

              <div className={`px-6 py-3 border-t flex gap-2 ${isActive ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                {event.status === 'draft' && (
                  <button
                    onClick={() => handleActivate(event.id)}
                    disabled={activating}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {activating ? 'Activating...' : 'Activate Event'}
                  </button>
                )}
                {event.status === 'active' && (
                  <button
                    onClick={() => handleComplete(event.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Complete
                  </button>
                )}
                <button
                  onClick={() => openEditModal(event)}
                  className="flex-1 text-center py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => { setSelectedEvent(event); setShowDetailModal(true); }}
                  className="flex-1 text-center py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                >
                  View Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingEvent?.id ? 'Edit Event' : 'Create New Event'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Data Protection Settings */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700">Data Protection</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="auto_delete"
                    checked={formData.auto_delete_enabled}
                    onChange={(e) => setFormData({ ...formData, auto_delete_enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="auto_delete" className="text-sm text-gray-700">
                    Auto-delete media from editor devices after event
                  </label>
                </div>
                {formData.auto_delete_enabled && (
                  <div className="ml-7">
                    <label className="block text-sm text-gray-600 mb-1">
                      Delete files <span className="font-medium">{formData.auto_delete_days_after_end}</span> days after event ends
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="90"
                      value={formData.auto_delete_days_after_end}
                      onChange={(e) => setFormData({ ...formData, auto_delete_days_after_end: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1 day</span>
                      <span>30 days</span>
                      <span>90 days</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingEvent(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingEvent?.id ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {showDetailModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedEvent.name}</h2>
                <p className="text-sm text-gray-500">{selectedEvent.code}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[selectedEvent.status]}`}>
                  {selectedEvent.status}
                </span>
              </div>
              
              {selectedEvent.description && (
                <div>
                  <span className="text-gray-500 text-sm">Description</span>
                  <p className="text-gray-900 mt-1">{selectedEvent.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 text-sm">Start</span>
                  <p className="text-gray-900 font-medium">
                    {formatDateTime(selectedEvent.start_datetime || selectedEvent.start_date)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">End</span>
                  <p className="text-gray-900 font-medium">
                    {formatDateTime(selectedEvent.end_datetime || selectedEvent.end_date)}
                  </p>
                </div>
              </div>

              {/* Data Protection Info */}
              {selectedEvent.auto_delete_enabled && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Trash2 className="w-4 h-4" />
                    <span className="font-medium text-sm">Data Protection Active</span>
                  </div>
                  <p className="text-sm text-orange-600 mt-1">
                    Media files will be auto-deleted from editor devices {selectedEvent.auto_delete_days_after_end || 30} days after event ends
                  </p>
                </div>
              )}
              
              {selectedEvent.location && (
                <div>
                  <span className="text-gray-500 text-sm">Location</span>
                  <p className="text-gray-900">{selectedEvent.location}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedEvent.media_count || 0}</p>
                  <p className="text-sm text-gray-500">Media Files</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedEvent.groups_count || 0}</p>
                  <p className="text-sm text-gray-500">Groups</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activation Conflict Modal */}
      {showConfirmModal && conflictEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Another Event is Active</h2>
                <p className="text-sm text-gray-500">Only one event can be active at a time</p>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium text-green-700">Currently Running</span>
              </div>
              <p className="font-semibold text-gray-900">{conflictEvent.name}</p>
              <p className="text-sm text-gray-500">{conflictEvent.code}</p>
              {conflictEvent.end_date && (
                <p className="text-sm text-gray-600 mt-1">
                  Ends: {formatDateTime(conflictEvent.end_date)}
                </p>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Activating a new event will automatically mark <strong>{conflictEvent.name}</strong> as completed. 
              Do you want to proceed?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingActivation(null);
                  setConflictEvent(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleForceActivate}
                disabled={activating}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {activating ? 'Switching...' : 'Switch Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
