import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mediaService } from '../services/api';
import { Search, Video, Filter, Download, Eye, AlertTriangle, Play, X, Lock } from 'lucide-react';

// Video Playback Modal Component
function PlaybackModal({ media, onClose }) {
  if (!media) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">{media.filename}</h3>
            <p className="text-sm text-gray-500">{media.media_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="aspect-video bg-black">
          {media.preview_url ? (
            <video
              controls
              autoPlay
              className="w-full h-full"
              src={media.preview_url}
            >
              Your browser does not support video playback.
            </video>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Video className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p>Preview not available</p>
                <p className="text-sm">File is stored on backup disk</p>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Person:</span>
              <span className="ml-2 font-medium">{media.full_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Condition:</span>
              <span className="ml-2 font-medium">{media.condition || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Region:</span>
              <span className="ml-2 font-medium">{media.region || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <span className="ml-2 font-medium">{media.status}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Media() {
  const { activeEvent, isQA, isQALead, isBackup, isBackupLead, isAdmin, isTeamLead, isGroupLeader } = useAuth();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playbackMedia, setPlaybackMedia] = useState(null);
  
  // Role-based access: QA can only search by issue, not by name/region per blueprint
  const isQARole = isQA() || isQALead();
  const isBackupRole = isBackup() || isBackupLead();
  const hasFullSearch = isAdmin() || isTeamLead() || isGroupLeader();
  
  const [filters, setFilters] = useState({
    full_name: '',
    condition: '',
    region: '',
    status: '',
    type: '',
    page: 1,
  });
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  useEffect(() => {
    loadMedia();
  }, [filters, activeEvent?.id]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '')
      );
      if (activeEvent?.id) {
        params.event_id = activeEvent.id;
      }
      const response = await mediaService.search(params);
      setMedia(response.data || []);
      setPagination({
        current_page: response.current_page || 1,
        last_page: response.last_page || 1,
        total: response.total || 0,
      });
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters({ ...filters, page: 1 });
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
  };

  const statusColors = {
    indexed: 'bg-gray-100 text-gray-700',
    synced: 'bg-blue-100 text-blue-700',
    backed_up: 'bg-yellow-100 text-yellow-700',
    verified: 'bg-green-100 text-green-700',
    issue: 'bg-red-100 text-red-700',
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Media Search</h1>
        <p className="text-gray-500">
          {isQARole 
            ? 'Search media with issues — you cannot search by name or region'
            : isBackupRole
            ? 'View backup status — you see coverage, not content'
            : 'Search and browse all indexed media files'
          }
        </p>
      </div>
      
      {/* Role restriction notice */}
      {isQARole && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-700 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          <span><strong>QA Access:</strong> You can only search by issue status. Name, region, and clean footage are hidden.</span>
        </div>
      )}
      {isBackupRole && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          <span><strong>Backup Access:</strong> You see file status and coverage only. No content playback available.</span>
        </div>
      )}

      {/* Search Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Name - hidden for QA and Backup */}
            {hasFullSearch && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={filters.full_name}
                  onChange={(e) => setFilters({ ...filters, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Search name..."
                />
              </div>
            )}
            {/* Condition - hidden for Backup */}
            {!isBackupRole && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
                <input
                  type="text"
                  value={filters.condition}
                  onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Cripple"
                />
              </div>
            )}
            {/* Region - hidden for QA and Backup */}
            {hasFullSearch && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Region</label>
                <input
                  type="text"
                  value={filters.region}
                  onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Kisumu"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="indexed">Indexed</option>
                <option value="synced">Synced</option>
                <option value="backed_up">Backed Up</option>
                <option value="verified">Verified</option>
                <option value="issue">Has Issues</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="before">Before</option>
                <option value="after">After</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">File</th>
                  {hasFullSearch && <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Person</th>}
                  {!isBackupRole && <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Condition</th>}
                  {hasFullSearch && <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Region</th>}
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {media.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No media found. Try adjusting your search filters.
                    </td>
                  </tr>
                )}
                {media.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Video className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-xs">{item.filename}</p>
                          <p className="text-xs text-gray-500">{item.media_id}</p>
                        </div>
                      </div>
                    </td>
                    {hasFullSearch && (
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-gray-900">{item.full_name || '-'}</p>
                        <p className="text-xs text-gray-500">{item.age ? `${item.age} years` : '-'}</p>
                      </div>
                    </td>
                    )}
                    {!isBackupRole && <td className="px-6 py-4 text-sm text-gray-900">{item.condition || '-'}</td>}
                    {hasFullSearch && <td className="px-6 py-4 text-sm text-gray-900">{item.region || '-'}</td>}
                    <td className="px-6 py-4 text-sm text-gray-500">{formatBytes(item.size_bytes)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[item.status]}`}>
                          {item.status}
                        </span>
                        {item.issues?.length > 0 && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {/* Playback - available for Admin, Team Lead, Group Leader, and QA (for issues only) */}
                        {!isBackupRole && (hasFullSearch || (isQARole && item.issues?.length > 0)) && (
                          <button 
                            onClick={() => setPlaybackMedia(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded" 
                            title="Play"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => setPlaybackMedia(item)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded" 
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.current_page - 1)}
                disabled={pagination.current_page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.current_page + 1)}
                disabled={pagination.current_page === pagination.last_page}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Playback Modal */}
      {playbackMedia && (
        <PlaybackModal 
          media={playbackMedia} 
          onClose={() => setPlaybackMedia(null)} 
        />
      )}
    </div>
  );
}
