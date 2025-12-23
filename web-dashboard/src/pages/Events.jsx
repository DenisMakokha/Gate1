import React, { useState, useEffect } from 'react';
import { eventService } from '../services/api';
import { Plus, Calendar, MapPin, Users, Video, CheckCircle, Clock } from 'lucide-react';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
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
      await eventService.create(formData);
      setShowModal(false);
      setFormData({ name: '', description: '', location: '', start_date: '', end_date: '' });
      loadEvents();
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  const handleActivate = async (id) => {
    try {
      await eventService.activate(id);
      loadEvents();
    } catch (error) {
      console.error('Failed to activate event:', error);
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
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-500',
  };

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
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          New Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{event.name}</h3>
                  <p className="text-sm text-gray-500">{event.code}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[event.status]}`}>
                  {event.status}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(event.start_date).toLocaleDateString()}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
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

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
              {event.status === 'draft' && (
                <button
                  onClick={() => handleActivate(event.id)}
                  className="flex-1 text-center py-2 text-sm font-medium text-green-700 hover:bg-green-100 rounded"
                >
                  Activate
                </button>
              )}
              {event.status === 'active' && (
                <button
                  onClick={() => handleComplete(event.id)}
                  className="flex-1 text-center py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded"
                >
                  Complete
                </button>
              )}
              <button className="flex-1 text-center py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Event</h2>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
