import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { cameraService, groupService } from '../services/api';
import {
  Camera,
  Plus,
  Search,
  Edit2,
  Trash2,
  CreditCard,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
  Unlink,
} from 'lucide-react';

export default function Cameras() {
  const { activeEvent } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [showModal, setShowModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [formData, setFormData] = useState({
    camera_id: '',
    group_id: '',
    model: '',
    serial_number: '',
    status: 'active',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [search, statusFilter, activeEvent?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!activeEvent?.id) {
        setCameras([]);
        setGroups([]);
        setStats(null);
        return;
      }
      const [camerasRes, groupsRes, statsRes] = await Promise.all([
        cameraService.getAll({ event_id: activeEvent.id, search, status: statusFilter }),
        groupService.getAll({ event_id: activeEvent.id }),
        cameraService.getStats({ event_id: activeEvent.id }),
      ]);
      setCameras(camerasRes.data.data || camerasRes.data);
      setGroups(groupsRes.data.data || groupsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load cameras' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCamera) {
        await cameraService.update(editingCamera.id, formData);
        setMessage({ type: 'success', text: 'Camera updated successfully' });
      } else {
        await cameraService.create(formData);
        setMessage({ type: 'success', text: 'Camera created successfully' });
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Operation failed' });
    }
  };

  const handleDelete = async (camera) => {
    if (!confirm(`Delete camera ${camera.camera_id}?`)) return;
    try {
      await cameraService.delete(camera.id);
      setMessage({ type: 'success', text: 'Camera deleted' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete camera' });
    }
  };

  const openEditModal = (camera) => {
    setEditingCamera(camera);
    setFormData({
      camera_id: camera.camera_id,
      group_id: camera.group_id,
      model: camera.model || '',
      serial_number: camera.serial_number || '',
      status: camera.status,
      notes: camera.notes || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingCamera(null);
    setFormData({
      camera_id: '',
      group_id: '',
      model: '',
      serial_number: '',
      status: 'active',
      notes: '',
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      maintenance: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cameras</h1>
          <p className="text-gray-500">
            Manage cameras and SD card bindings
            {activeEvent?.name ? ` • Active event: ${activeEvent.name}` : ''}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          disabled={!activeEvent?.id}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Camera
        </button>
      </div>

      {!activeEvent?.id && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          You must activate an event before managing cameras.
        </div>
      )}

      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">×</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Total Cameras</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-500">With SD Card</p>
            <p className="text-2xl font-bold text-blue-600">{stats.with_sd_card}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Maintenance</p>
            <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search cameras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* Cameras Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <div key={camera.id} className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{camera.camera_id}</h3>
                    <p className="text-sm text-gray-500">{camera.model || 'No model'}</p>
                  </div>
                </div>
                {getStatusBadge(camera.status)}
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Group:</span>
                  <span className="font-medium">{camera.group?.group_code || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Serial:</span>
                  <span className="font-medium">{camera.serial_number || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">SD Card:</span>
                  {camera.current_sd_card ? (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <CreditCard className="w-4 h-4" />
                      {camera.current_sd_card.sd_card_id}
                    </span>
                  ) : (
                    <span className="text-gray-400">Not bound</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => openEditModal(camera)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(camera)}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">{editingCamera ? 'Edit Camera' : 'Add Camera'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Camera ID *</label>
                <input
                  type="text"
                  value={formData.camera_id}
                  onChange={(e) => setFormData({ ...formData, camera_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group *</label>
                <select
                  value={formData.group_id}
                  onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select group...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.group_code} - {g.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  {editingCamera ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
