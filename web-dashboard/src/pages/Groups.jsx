import React, { useState, useEffect } from 'react';
import { groupService, eventService, userService } from '../services/api';
import { Plus, Users, AlertTriangle, CheckCircle, ChevronRight, X, UserPlus } from 'lucide-react';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    event_id: '',
    leader_phone: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [groupsRes, eventsRes] = await Promise.all([
        groupService.getAll(),
        eventService.getActive(),
      ]);
      setGroups(groupsRes.data || []);
      setEvents(eventsRes || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await groupService.create(formData);
      setShowModal(false);
      setFormData({ name: '', description: '', event_id: '', leader_phone: '' });
      loadData();
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const loadMembers = async (groupId) => {
    try {
      const response = await groupService.getMembers(groupId);
      setMembers(response.members || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const handleSelectGroup = async (group) => {
    setSelectedGroup(group);
    await loadMembers(group.id);
  };

  const openAddMemberModal = async () => {
    try {
      const response = await userService.getAll({ per_page: 100 });
      const users = response.data || response || [];
      const memberIds = members.map(m => m.id);
      setAvailableUsers(users.filter(u => !memberIds.includes(u.id)));
      setShowAddMemberModal(true);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedGroup) return;
    try {
      await groupService.addMember(selectedGroup.id, selectedUserId);
      await loadMembers(selectedGroup.id);
      setShowAddMemberModal(false);
      setSelectedUserId('');
    } catch (error) {
      console.error('Failed to add member:', error);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-500">Manage editor groups and team leaders</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          New Group
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">All Groups</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {groups.length === 0 && (
              <div className="p-4 text-center text-gray-500">No groups created yet</div>
            )}
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleSelectGroup(group)}
                className={`w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between ${
                  selectedGroup?.id === group.id ? 'bg-blue-50' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{group.group_code}</span>
                    {group.open_issues > 0 && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        {group.open_issues}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{group.name}</p>
                  <p className="text-xs text-gray-400">{group.members_count || 0} members</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Group Details */}
        <div className="lg:col-span-2">
          {selectedGroup ? (
            <div className="space-y-6">
              {/* Group Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedGroup.group_code} - {selectedGroup.name}
                    </h2>
                    <p className="text-gray-500">{selectedGroup.description || 'No description'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedGroup.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedGroup.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Leader</p>
                    <p className="font-medium text-gray-900">
                      {selectedGroup.leader?.name || 'Not assigned'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Event</p>
                    <p className="font-medium text-gray-900">
                      {selectedGroup.event?.name || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Members */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Team Members</h3>
                  <button
                    onClick={openAddMemberModal}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Member
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {members.length === 0 && (
                    <div className="p-4 text-center text-gray-500">No members in this group</div>
                  )}
                  {members.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium">
                            {member.name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p className="text-gray-900">{member.media_today || 0} files today</p>
                          {member.open_issues > 0 && (
                            <p className="text-red-600">{member.open_issues} issues</p>
                          )}
                        </div>
                        <div className={`w-3 h-3 rounded-full ${
                          member.is_online ? 'bg-green-500' : 'bg-gray-300'
                        }`} title={member.is_online ? 'Online' : 'Offline'} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a group to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Group</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
                <select
                  value={formData.event_id}
                  onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Blue Team - Camera 3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leader Phone</label>
                <input
                  type="tel"
                  value={formData.leader_phone}
                  onChange={(e) => setFormData({ ...formData, leader_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+254..."
                />
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
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add Team Member</h2>
              <button onClick={() => setShowAddMemberModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a user...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>
              {availableUsers.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">No available users to add</p>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={!selectedUserId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Add Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
