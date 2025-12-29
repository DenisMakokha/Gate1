import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { registrationService, groupService } from '../services/api';
import {
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Mail,
  Phone,
  Calendar,
  FileText,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  Users,
  ChevronDown,
} from 'lucide-react';

export default function Approvals() {
  const { activeEvent } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [approvalModal, setApprovalModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  
  const [approvalData, setApprovalData] = useState({ group_id: '', notes: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [inviteData, setInviteData] = useState({ email: '', group_id: '' });

  useEffect(() => {
    loadData();
  }, [activeEvent?.id]);

  const extractArray = (res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.items)) return res.items;
    return [];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, groupsRes] = await Promise.all([
        registrationService.getPending(),
        groupService.getAll({ event_id: activeEvent?.id }),
      ]);
      setPendingUsers(extractArray(usersRes));
      setGroups(extractArray(groupsRes));
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalData.group_id) {
      setMessage({ type: 'error', text: 'Please select a group' });
      return;
    }
    setActionLoading('approve');
    try {
      await registrationService.approve(selectedUser.id, approvalData);
      setMessage({ type: 'success', text: `${selectedUser.name} has been approved` });
      setPendingUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setApprovalModal(false);
      setSelectedUser(null);
      setApprovalData({ group_id: '', notes: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to approve user' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading('reject');
    try {
      await registrationService.reject(selectedUser.id, { reason: rejectReason });
      setMessage({ type: 'success', text: `Registration rejected` });
      setPendingUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setRejectModal(false);
      setSelectedUser(null);
      setRejectReason('');
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to reject' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteData.email) {
      setMessage({ type: 'error', text: 'Please enter an email address' });
      return;
    }
    setActionLoading('invite');
    try {
      await registrationService.sendInvitation(inviteData);
      setMessage({ type: 'success', text: `Invitation sent to ${inviteData.email}` });
      setInviteModal(false);
      setInviteData({ email: '', group_id: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to send invitation' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registration Approvals</h1>
          <p className="text-gray-500">Manage pending user registrations</p>
        </div>
        <button
          onClick={() => setInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          <Send className="w-4 h-4" />
          Send Invitation
        </button>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
          <button
            onClick={() => setMessage({ type: '', text: '' })}
            className="ml-auto text-current opacity-50 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {!activeEvent?.id && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          No active event. You can review registrations, but group assignment will be unavailable until an event is activated.
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100">Pending Approvals</p>
              <p className="text-3xl font-bold mt-1">{pendingUsers.length}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100">Active Groups</p>
              <p className="text-3xl font-bold mt-1">{groups.length}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Quick Action</p>
              <p className="text-lg font-medium mt-1">Invite New Editor</p>
            </div>
            <button
              onClick={() => setInviteModal(true)}
              className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <UserPlus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Pending Users List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Pending Registrations</h2>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Pending Registrations</h3>
            <p className="text-gray-500">All registration requests have been processed</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingUsers.map((user) => (
              <div key={user.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {user.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(user.created_at)}
                        </span>
                      </div>
                      {user.registration_notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 mt-0.5 text-gray-400" />
                            <span>{user.registration_notes}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setRejectModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setApprovalModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {approvalModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Approve Registration</h3>
                <p className="text-sm text-gray-500">{selectedUser.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Group <span className="text-red-500">*</span>
                </label>
                <select
                  value={approvalData.group_id}
                  onChange={(e) => setApprovalData({ ...approvalData, group_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select a group...</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.group_code} - {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={approvalData.notes}
                  onChange={(e) => setApprovalData({ ...approvalData, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  rows={3}
                  placeholder="Any notes about this approval..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setApprovalModal(false);
                  setSelectedUser(null);
                  setApprovalData({ group_id: '', notes: '' });
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading === 'approve'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
              >
                {actionLoading === 'approve' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <UserX className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reject Registration</h3>
                <p className="text-sm text-gray-500">{selectedUser.name}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={3}
                placeholder="Reason for rejection..."
              />
              <p className="mt-2 text-sm text-gray-500">
                The user will be notified via email with this reason.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setRejectModal(false);
                  setSelectedUser(null);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === 'reject'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium transition-colors"
              >
                {actionLoading === 'reject' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Send Invitation</h3>
                <p className="text-sm text-gray-500">Invite a new editor to join</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="editor@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pre-assign to Group (optional)
                </label>
                <select
                  value={inviteData.group_id}
                  onChange={(e) => setInviteData({ ...inviteData, group_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No group (assign later)</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.group_code} - {group.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setInviteModal(false);
                  setInviteData({ email: '', group_id: '' });
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={actionLoading === 'invite'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                {actionLoading === 'invite' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
