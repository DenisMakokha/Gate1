import React, { useState, useEffect } from 'react';
import { userService, groupService } from '../services/api';
import {
  Users as UsersIcon,
  Plus,
  Search,
  Edit,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';

function UserModal({ user, roles, groups, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    roles: user?.roles?.map(r => r.slug) || ['editor'],
    is_active: user?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = { ...formData };
      if (!data.password) delete data.password;
      
      if (user) {
        await userService.update(user.id, data);
      } else {
        if (!data.password) {
          setError('Password is required for new users');
          setLoading(false);
          return;
        }
        await userService.create(data);
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (roleSlug) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleSlug)
        ? prev.roles.filter(r => r !== roleSlug)
        : [...prev.roles, roleSlug]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{user ? 'Edit User' : 'Create User'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {user ? 'New Password (leave blank to keep current)' : 'Password'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              {...(!user && { required: true })}
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <button
                  key={role.slug}
                  type="button"
                  onClick={() => toggleRole(role.slug)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    formData.roles.includes(role.slug)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {role.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ user, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await userService.delete(user.id);
      onConfirm();
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Delete User</h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });

  useEffect(() => {
    loadData();
  }, [search, roleFilter, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, groupsRes] = await Promise.all([
        userService.getAll({ search, role: roleFilter, status: statusFilter }),
        userService.getRoles(),
        groupService.getAll(),
      ]);
      setUsers(usersRes.data || []);
      setPagination({
        current_page: usersRes.current_page,
        last_page: usersRes.last_page,
      });
      setRoles(rolesRes || []);
      setGroups(groupsRes.data || groupsRes || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await userService.toggleStatus(user.id);
      loadData();
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleSave = () => {
    closeModal();
    loadData();
  };

  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    'group-leader': 'bg-blue-100 text-blue-700',
    qa: 'bg-green-100 text-green-700',
    backup: 'bg-yellow-100 text-yellow-700',
    editor: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage system users and their roles</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role.slug} value={role.slug}>{role.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roles</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {user.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map((role) => (
                          <span
                            key={role.slug}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${roleColors[role.slug] || 'bg-gray-100 text-gray-700'}`}
                          >
                            {role.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {user.is_active ? (
                          <>
                            <UserCheck className="w-3 h-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <UserX className="w-3 h-3" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => setDeletingUser(user)}
                          className="p-2 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-12">
                <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <UserModal
          user={editingUser}
          roles={roles}
          groups={groups}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {deletingUser && (
        <DeleteConfirmModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onConfirm={() => {
            setDeletingUser(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
