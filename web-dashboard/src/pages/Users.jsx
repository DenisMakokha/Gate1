import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
  Upload,
  Link,
  Download,
  Copy,
  FileSpreadsheet,
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

function BulkImportModal({ roles, groups, onClose, onSuccess }) {
  const [csvData, setCsvData] = useState('');
  const [selectedRole, setSelectedRole] = useState('editor');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const users = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Skip header row if it looks like headers
      if (i === 0 && line.toLowerCase().includes('name') && line.toLowerCase().includes('email')) {
        continue;
      }
      
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2 && parts[1].includes('@')) {
        users.push({
          name: parts[0],
          email: parts[1],
          phone: parts[2] || '',
        });
      }
    }
    return users;
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    const users = parseCSV(csvData);
    if (users.length === 0) {
      setError('No valid users found in CSV. Format: name,email,phone');
      setLoading(false);
      return;
    }

    try {
      const response = await userService.bulkImport({
        users,
        role: selectedRole,
        group_id: selectedGroup || null,
        send_invitations: false,
      });
      setResult(response);
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvData(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk Import Users
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 text-green-700 rounded-lg">
                <p className="font-medium">Import completed!</p>
                <p className="text-sm mt-1">
                  Created: {result.summary?.created || 0} | 
                  Skipped: {result.summary?.skipped || 0}
                </p>
              </div>
              
              {result.results?.created?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Created Users:</h4>
                  <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-2">
                    {result.results.created.map((u, i) => (
                      <div key={i} className="text-sm py-1">
                        {u.name} ({u.email})
                        {u.temp_password && (
                          <span className="ml-2 text-gray-500">
                            Password: <code className="bg-gray-200 px-1 rounded">{u.temp_password}</code>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.results?.skipped?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-yellow-700">Skipped:</h4>
                  <div className="max-h-32 overflow-y-auto bg-yellow-50 rounded-lg p-2">
                    {result.results.skipped.map((s, i) => (
                      <div key={i} className="text-sm py-1 text-yellow-700">
                        {s.email}: {s.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { onSuccess(); onClose(); }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {roles.map(role => (
                      <option key={role.slug} value={role.slug}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Group (optional)</label>
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No group</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>{group.group_code} - {group.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload CSV or paste data
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSV Data (name,email,phone)
                </label>
                <textarea
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  placeholder="John Doe,john@example.com,+1234567890&#10;Jane Smith,jane@example.com,"
                  rows={8}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  One user per line. Format: name,email,phone (phone is optional)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || !csvData.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Importing...' : <><Upload className="w-4 h-4" /> Import Users</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InvitationModal({ roles, groups, onClose, onSuccess }) {
  const [selectedRole, setSelectedRole] = useState('editor');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [maxUses, setMaxUses] = useState(100);
  const [expiresDays, setExpiresDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await userService.createInvitation({
        role: selectedRole,
        group_id: selectedGroup || null,
        max_uses: maxUses,
        expires_days: expiresDays,
      });
      setInvitation(response.invitation);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(invitation.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link className="w-5 h-5" />
            Create Invitation Link
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {invitation ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 text-green-700 rounded-lg">
                <p className="font-medium">Invitation created!</p>
                <p className="text-sm mt-1">
                  Share this link with users to let them register as {selectedRole}.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invitation Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={invitation.link}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                  />
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-500 space-y-1">
                <p>Max uses: {invitation.max_uses}</p>
                <p>Expires: {new Date(invitation.expires_at).toLocaleDateString()}</p>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role for new users</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {roles.map(role => (
                    <option key={role.slug} value={role.slug}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Group (optional)</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No group</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.group_code} - {group.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
                  <input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(parseInt(e.target.value) || 100)}
                    min={1}
                    max={500}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires in (days)</label>
                  <input
                    type="number"
                    value={expiresDays}
                    onChange={(e) => setExpiresDays(parseInt(e.target.value) || 7)}
                    min={1}
                    max={30}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Link'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const { isAdmin, isTeamLead, isGroupLeader, isQALead, isBackupLead } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showInvitation, setShowInvitation] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });

  // Determine which roles current user can manage
  const getManageableRoles = () => {
    if (isAdmin()) return ['admin', 'team-lead', 'group-leader', 'qa-lead', 'qa', 'backup-lead', 'backup', 'editor'];
    if (isTeamLead()) return ['group-leader', 'qa-lead', 'qa', 'backup-lead', 'backup', 'editor'];
    if (isGroupLeader()) return ['editor'];
    if (isQALead()) return ['qa'];
    if (isBackupLead()) return ['backup'];
    return [];
  };

  // Get page title based on role
  const getPageTitle = () => {
    if (isAdmin()) return { title: 'User Management', subtitle: 'Manage all system users and roles' };
    if (isTeamLead()) return { title: 'Team Management', subtitle: 'Manage team members (except admins)' };
    if (isGroupLeader()) return { title: 'Group Members', subtitle: 'Manage editors in your groups' };
    if (isQALead()) return { title: 'QA Team', subtitle: 'Manage QA team members' };
    if (isBackupLead()) return { title: 'Backup Team', subtitle: 'Manage backup team members' };
    return { title: 'Users', subtitle: '' };
  };

  const manageableRoles = getManageableRoles();
  const pageInfo = getPageTitle();

  useEffect(() => {
    loadData();
  }, [search, roleFilter, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      // For non-admin roles, filter by manageable roles
      const roleFilterParam = roleFilter || (manageableRoles.length < 8 ? manageableRoles.join(',') : '');
      
      const [usersRes, rolesRes, groupsRes] = await Promise.all([
        userService.getAll({ search, role: roleFilterParam, status: statusFilter }),
        userService.getRoles(),
        groupService.getAll(),
      ]);
      
      // Filter users to only show those with manageable roles
      let filteredUsers = usersRes.data || [];
      if (!isAdmin()) {
        filteredUsers = filteredUsers.filter(user => 
          user.roles?.some(r => manageableRoles.includes(r.slug))
        );
      }
      
      setUsers(filteredUsers);
      setPagination({
        current_page: usersRes.current_page,
        last_page: usersRes.last_page,
      });
      
      // Filter roles to only show manageable ones
      const allRoles = rolesRes || [];
      setRoles(allRoles.filter(r => manageableRoles.includes(r.slug)));
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
    'team-lead': 'bg-indigo-100 text-indigo-700',
    'group-leader': 'bg-blue-100 text-blue-700',
    'qa-lead': 'bg-emerald-100 text-emerald-700',
    qa: 'bg-green-100 text-green-700',
    'backup-lead': 'bg-orange-100 text-orange-700',
    backup: 'bg-yellow-100 text-yellow-700',
    editor: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageInfo.title}</h1>
          <p className="text-gray-500">{pageInfo.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Bulk Import"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button
            onClick={() => setShowInvitation(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Create Invitation Link"
          >
            <Link className="w-4 h-4" />
            <span className="hidden sm:inline">Invite Link</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add {isQALead() ? 'QA Member' : isBackupLead() ? 'Backup Member' : isGroupLeader() ? 'Editor' : 'User'}
          </button>
        </div>
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

      {showBulkImport && (
        <BulkImportModal
          roles={roles}
          groups={groups}
          onClose={() => setShowBulkImport(false)}
          onSuccess={loadData}
        />
      )}

      {showInvitation && (
        <InvitationModal
          roles={roles}
          groups={groups}
          onClose={() => setShowInvitation(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
