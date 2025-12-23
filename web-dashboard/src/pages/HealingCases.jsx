import React, { useState, useEffect } from 'react';
import { healingCaseService, eventService, groupService } from '../services/api';
import {
  Heart,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Eye,
  Calendar,
  Users,
  FileText,
  Shield,
  Globe,
} from 'lucide-react';

export default function HealingCases() {
  const [cases, setCases] = useState([]);
  const [events, setEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [editingCase, setEditingCase] = useState(null);
  const [formData, setFormData] = useState({
    event_id: '',
    group_id: '',
    person_name: '',
    description: '',
    healing_date: '',
    status: 'pending',
  });

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [casesRes, eventsRes, groupsRes, statsRes] = await Promise.all([
        healingCaseService.getAll({ search, status: statusFilter }),
        eventService.getAll(),
        groupService.getAll(),
        healingCaseService.getStats(),
      ]);
      setCases(casesRes.data.data || casesRes.data);
      setEvents(eventsRes.data.data || eventsRes.data);
      setGroups(groupsRes.data.data || groupsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load healing cases' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCase) {
        await healingCaseService.update(editingCase.id, formData);
        setMessage({ type: 'success', text: 'Healing case updated' });
      } else {
        await healingCaseService.create(formData);
        setMessage({ type: 'success', text: 'Healing case created' });
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Operation failed' });
    }
  };

  const handleVerify = async (healingCase) => {
    try {
      await healingCaseService.verify(healingCase.id);
      setMessage({ type: 'success', text: 'Case verified successfully' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to verify case' });
    }
  };

  const handlePublish = async (healingCase) => {
    try {
      await healingCaseService.publish(healingCase.id);
      setMessage({ type: 'success', text: 'Case published successfully' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to publish case' });
    }
  };

  const handleDelete = async (healingCase) => {
    if (!confirm(`Delete healing case ${healingCase.case_id}?`)) return;
    try {
      await healingCaseService.delete(healingCase.id);
      setMessage({ type: 'success', text: 'Case deleted' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete case' });
    }
  };

  const openEditModal = (healingCase) => {
    setEditingCase(healingCase);
    setFormData({
      event_id: healingCase.event_id,
      group_id: healingCase.group_id,
      person_name: healingCase.person_name,
      description: healingCase.description,
      healing_date: healingCase.healing_date?.split('T')[0] || '',
      status: healingCase.status,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingCase(null);
    setFormData({
      event_id: '',
      group_id: '',
      person_name: '',
      description: '',
      healing_date: '',
      status: 'pending',
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700',
      verified: 'bg-blue-100 text-blue-700',
      published: 'bg-green-100 text-green-700',
    };
    const icons = {
      pending: <AlertCircle className="w-3 h-3" />,
      verified: <Shield className="w-3 h-3" />,
      published: <Globe className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Healing Cases</h1>
          <p className="text-gray-500">Document and manage healing testimonies</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Case
        </button>
      </div>

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white">
            <p className="text-rose-100 text-sm">Total Cases</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Verified</p>
            <p className="text-2xl font-bold text-blue-600">{stats.verified}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-500">Published</p>
            <p className="text-2xl font-bold text-green-600">{stats.published}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-500">This Month</p>
            <p className="text-2xl font-bold text-purple-600">{stats.this_month}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No healing cases found</h3>
          <p className="text-gray-500">Start documenting healing testimonies</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Case</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Person</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Event</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((healingCase) => (
                  <tr key={healingCase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center">
                          <Heart className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{healingCase.case_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{healingCase.person_name}</p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">{healingCase.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900">{healingCase.event?.event_code || '-'}</p>
                      <p className="text-sm text-gray-500">{healingCase.group?.group_code}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(healingCase.healing_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(healingCase.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedCase(healingCase); setShowDetailModal(true); }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {healingCase.status === 'pending' && (
                          <button
                            onClick={() => handleVerify(healingCase)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Verify"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        )}
                        {healingCase.status === 'verified' && (
                          <button
                            onClick={() => handlePublish(healingCase)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Publish"
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(healingCase)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(healingCase)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">{editingCase ? 'Edit Healing Case' : 'Add Healing Case'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event *</label>
                  <select
                    value={formData.event_id}
                    onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                    required
                  >
                    <option value="">Select event...</option>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>{e.event_code} - {e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group *</label>
                  <select
                    value={formData.group_id}
                    onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                    required
                  >
                    <option value="">Select group...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.group_code} - {g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Person Name *</label>
                <input
                  type="text"
                  value={formData.person_name}
                  onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Healing Date *</label>
                <input
                  type="date"
                  value={formData.healing_date}
                  onChange={(e) => setFormData({ ...formData, healing_date: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 resize-none"
                  rows={4}
                  required
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
                  className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700"
                >
                  {editingCase ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedCase.case_id}</h3>
                  {getStatusBadge(selectedCase.status)}
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Person Name</p>
                <p className="font-medium text-gray-900">{selectedCase.person_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Healing Date</p>
                <p className="font-medium text-gray-900">{new Date(selectedCase.healing_date).toLocaleDateString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Event</p>
                  <p className="font-medium text-gray-900">{selectedCase.event?.event_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Group</p>
                  <p className="font-medium text-gray-900">{selectedCase.group?.group_code}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-xl">{selectedCase.description}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Close
              </button>
              {selectedCase.status === 'pending' && (
                <button
                  onClick={() => { handleVerify(selectedCase); setShowDetailModal(false); }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Verify Case
                </button>
              )}
              {selectedCase.status === 'verified' && (
                <button
                  onClick={() => { handlePublish(selectedCase); setShowDetailModal(false); }}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700"
                >
                  Publish Case
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
