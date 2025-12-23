import React, { useState, useEffect } from 'react';
import { backupService } from '../services/api';
import { HardDrive, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

export default function Backups() {
  const [coverage, setCoverage] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coverageRes, pendingRes] = await Promise.all([
        backupService.getCoverage(),
        backupService.getPending({ per_page: 50 }),
      ]);
      setCoverage(coverageRes);
      setPending(pendingRes.data || []);
    } catch (error) {
      console.error('Failed to load backup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          <h1 className="text-2xl font-bold text-gray-900">Backup Management</h1>
          <p className="text-gray-500">Monitor backup coverage and verification status</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Coverage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <HardDrive className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{coverage?.total_media?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">Total Media</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{coverage?.backed_up?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">Backed Up</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{coverage?.verified?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">Verified</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{coverage?.pending?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-lg">
              <span className="text-xl font-bold text-purple-600">{coverage?.coverage_percentage || 0}%</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Coverage</p>
              <div className="w-20 h-2 bg-gray-200 rounded-full mt-1">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${coverage?.coverage_percentage || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Disks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Backup Disks</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {coverage?.disks?.length === 0 && (
            <div className="p-8 text-center text-gray-500">No backup disks registered</div>
          )}
          {coverage?.disks?.map((disk) => (
            <div key={disk.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  disk.status === 'active' ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                  <HardDrive className={`w-6 h-6 ${
                    disk.status === 'active' ? 'text-green-600' : 'text-gray-400'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{disk.name}</p>
                  <p className="text-sm text-gray-500">
                    {disk.purpose} • {disk.backups_count} files • {disk.verified_backups} verified
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    disk.status === 'active' ? 'bg-green-100 text-green-700' :
                    disk.status === 'full' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {disk.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{disk.usage_percentage}% used</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Backups */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Pending Backups</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">File</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Editor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    All files are backed up and verified! 🎉
                  </td>
                </tr>
              )}
              {pending.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 truncate max-w-xs">{item.filename}</p>
                    <p className="text-xs text-gray-500">{item.media_id}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.editor?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{item.event?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatBytes(item.size_bytes)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
