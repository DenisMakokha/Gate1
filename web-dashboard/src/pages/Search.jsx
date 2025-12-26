import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { mediaService, issueService } from '../services/api';
import { 
  Search as SearchIcon, 
  Video, 
  Play, 
  Download, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  HardDrive,
  Wifi,
  WifiOff,
  Lock,
  Eye,
  Calendar,
  User,
  Camera,
  Tag,
  MapPin,
  Clock,
  Shield,
  FileVideo,
  Copy
} from 'lucide-react';

// Playback Source Types
const PLAYBACK_SOURCES = {
  VERIFIED_BACKUP: 'verified_backup',
  EDITOR_STREAM: 'editor_stream',
  QA_CACHE: 'qa_cache',
  OFFLINE: 'offline'
};

// Playback Modal Component - Full specification compliance
function PlaybackModal({ media, onClose, canDownload, onDownload, user }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackLogged, setPlaybackLogged] = useState(false);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);

  // Determine playback source priority
  useEffect(() => {
    const determineSource = () => {
      // Priority 1: Verified Backup
      if (media.backup_verified && media.backup_available) {
        setSource({
          type: PLAYBACK_SOURCES.VERIFIED_BACKUP,
          label: 'Verified Backup',
          icon: HardDrive,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          url: media.backup_stream_url || media.preview_url
        });
      }
      // Priority 2: Editor Stream (if editor online)
      else if (media.editor_online && media.local_available) {
        setSource({
          type: PLAYBACK_SOURCES.EDITOR_STREAM,
          label: 'Editor Stream (Live)',
          icon: Wifi,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          url: media.editor_stream_url || media.preview_url
        });
      }
      // Priority 3: QA Cache
      else if (media.qa_cache_available) {
        setSource({
          type: PLAYBACK_SOURCES.QA_CACHE,
          label: 'QA Review Cache',
          icon: Shield,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          url: media.qa_cache_url
        });
      }
      // No source available
      else {
        setSource({
          type: PLAYBACK_SOURCES.OFFLINE,
          label: 'Source Offline',
          icon: WifiOff,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          url: null
        });
      }
      setLoading(false);
    };

    determineSource();
  }, [media]);

  // Log playback intent before starting
  const handlePlay = async () => {
    if (!playbackLogged) {
      try {
        // Log playback intent via API
        await mediaService.logPlayback?.(media.media_id, {
          source: source?.type,
          reason: media.issues?.length > 0 ? 'issue_review' : 'admin_oversight'
        });
        setPlaybackLogged(true);
      } catch (error) {
        console.error('Failed to log playback:', error);
      }
    }
    setIsPlaying(true);
  };

  const handleDownload = async () => {
    if (onDownload) {
      // Log download intent
      try {
        await mediaService.logDownload?.(media.media_id, {
          source: source?.type
        });
      } catch (error) {
        console.error('Failed to log download:', error);
      }
      onDownload(media);
    }
  };

  if (!media) return null;

  const SourceIcon = source?.icon || HardDrive;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">{media.filename}</h3>
              <p className="text-sm text-gray-500">{media.media_id}</p>
            </div>
            {/* Source Label */}
            {source && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${source.bgColor}`}>
                <SourceIcon className={`w-4 h-4 ${source.color}`} />
                <span className={`text-sm font-medium ${source.color}`}>
                  Source: {source.label}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Download button - Admin/Team Lead only */}
            {canDownload && source?.type !== PLAYBACK_SOURCES.OFFLINE && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
            {canDownload && source?.type !== PLAYBACK_SOURCES.OFFLINE && (
              <button
                onClick={() => navigator.clipboard.writeText(source?.url || '')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Copy stream URL"
              >
                <Copy className="w-4 h-4" />
                Copy URL
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="flex-1 bg-black relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          ) : source?.type === PLAYBACK_SOURCES.OFFLINE ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <WifiOff className="w-20 h-20 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">Source Offline</p>
                <p className="text-sm mt-2">Video is not currently available for playback</p>
                <p className="text-xs mt-4 text-gray-500">
                  Backup disk may be disconnected or editor is offline
                </p>
              </div>
            </div>
          ) : !isPlaying ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={handlePlay}
                className="flex items-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
              >
                <Play className="w-8 h-8" />
                <span className="text-lg font-medium">Play Video</span>
              </button>
              <p className="absolute bottom-8 text-white/60 text-sm">
                Playback will be logged for audit purposes
              </p>
            </div>
          ) : (
            <video
              controls
              autoPlay
              className="w-full h-full"
              src={source?.url || media.preview_url}
              onEnded={() => setIsPlaying(false)}
            >
              Your browser does not support video playback.
            </video>
          )}
        </div>

        {/* Metadata Panel */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-500 block text-xs">Person</span>
                <span className="font-medium">{media.full_name || 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-500 block text-xs">Condition</span>
                <span className="font-medium">{media.condition || 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-500 block text-xs">Region</span>
                <span className="font-medium">{media.region || 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-500 block text-xs">Camera / SD</span>
                <span className="font-medium">{media.camera_number || '?'} / {media.sd_label || '?'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-500 block text-xs">Indexed</span>
                <span className="font-medium">{media.created_at ? new Date(media.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-500 block text-xs">Editor</span>
                <span className="font-medium">{media.editor?.name || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-3 mt-4">
            {/* Issue Badge */}
            {media.issues?.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700">
                  {media.issues.length} Issue{media.issues.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
            {/* Backup Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              media.backup_verified 
                ? 'bg-green-50 border border-green-200' 
                : media.backup_pending
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <HardDrive className={`w-4 h-4 ${
                media.backup_verified ? 'text-green-600' : 
                media.backup_pending ? 'text-yellow-600' : 'text-gray-600'
              }`} />
              <span className={`text-sm ${
                media.backup_verified ? 'text-green-700' : 
                media.backup_pending ? 'text-yellow-700' : 'text-gray-700'
              }`}>
                {media.backup_verified ? 'Backup Verified' : 
                 media.backup_pending ? 'Backup Pending' : 'No Backup'}
              </span>
            </div>
          </div>

          {/* Issue Notes */}
          {media.issues?.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">Issue Notes</h4>
              {media.issues.map((issue, idx) => (
                <div key={idx} className="text-sm text-red-700">
                  <span className="font-medium">{issue.type?.replace('_', ' ')}:</span> {issue.description || 'No description'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Notice */}
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            <Shield className="w-3 h-3 inline mr-1" />
            All playback actions are logged for audit. User: {user?.name} ({user?.role})
          </p>
        </div>
      </div>
    </div>
  );
}

// Main Search Component
export default function Search() {
  const { user, isAdmin, isTeamLead, isGroupLeader, isQA, isQALead } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playbackMedia, setPlaybackMedia] = useState(null);
  const [searched, setSearched] = useState(false);

  // Role-based permissions
  const isAdminOrTeamLead = isAdmin() || isTeamLead();
  const isQARole = isQA() || isQALead();
  const isGroupLeaderRole = isGroupLeader();
  const canDownload = isAdminOrTeamLead; // Only Admin/Team Lead can download

  // Role-based filter visibility
  const canSearchByName = isAdminOrTeamLead;
  const canSearchByRegion = isAdminOrTeamLead;
  const canSearchByCondition = isAdminOrTeamLead || isGroupLeaderRole;
  const canSearchByEditor = isAdminOrTeamLead;
  const canSearchByGroup = isAdminOrTeamLead;

  // Filters state - Admin has all, QA has limited
  const [filters, setFilters] = useState({
    full_name: '',
    age: '',
    condition: '',
    region: '',
    camera_number: '',
    sd_label: '',
    event_id: '',
    editor_id: '',
    group_id: '',
    issue_type: '',
    issue_status: '',
    backup_status: '',
    date_from: '',
    date_to: '',
    page: 1
  });

  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  // Search handler
  const handleSearch = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);

    try {
      // Build params based on role
      const params = {};
      
      // Admin/Team Lead: Full access
      if (isAdminOrTeamLead) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params[key] = value;
        });
      }
      // QA: Issue-only search
      else if (isQARole) {
        if (filters.issue_type) params.issue_type = filters.issue_type;
        if (filters.issue_status) params.issue_status = filters.issue_status;
        if (filters.camera_number) params.camera_number = filters.camera_number;
        if (filters.sd_label) params.sd_label = filters.sd_label;
        if (filters.event_id) params.event_id = filters.event_id;
        params.has_issues = true; // Force issue-only results
      }
      // Group Leader: Group + issue scoped
      else if (isGroupLeaderRole) {
        if (filters.issue_type) params.issue_type = filters.issue_type;
        if (filters.issue_status) params.issue_status = filters.issue_status;
        if (filters.camera_number) params.camera_number = filters.camera_number;
        params.my_groups = true; // API will scope to leader's groups
      }

      const response = await mediaService.search(params);
      setResults(response.data || []);
      setPagination({
        current_page: response.current_page || 1,
        last_page: response.last_page || 1,
        total: response.total || 0
      });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Download handler
  const handleDownload = async (media) => {
    if (!canDownload) return;
    
    try {
      // Request download URL from API
      const response = await mediaService.getDownloadUrl?.(media.media_id);
      if (response?.url) {
        window.open(response.url, '_blank');
      } else {
        // Fallback to preview URL
        window.open(media.preview_url || media.backup_stream_url, '_blank');
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const issueTypes = [
    { value: 'no_audio', label: 'No Audio' },
    { value: 'low_audio', label: 'Low Audio' },
    { value: 'blurry', label: 'Blurry Video' },
    { value: 'shaky', label: 'Shaky Video' },
    { value: 'cut_interview', label: 'Cut Interview' },
    { value: 'filename_error', label: 'Filename Error' },
    { value: 'duplicate', label: 'Duplicate' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search & Playback</h1>
        <p className="text-gray-500">
          {isAdminOrTeamLead 
            ? 'Global search across all indexed media — find any video ever indexed'
            : isQARole
            ? 'Search videos with reported issues only'
            : isGroupLeaderRole
            ? 'Search issues within your groups'
            : 'Search indexed media'
          }
        </p>
      </div>

      {/* Role Notice */}
      {isQARole && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-purple-600 mt-0.5" />
          <div>
            <p className="font-medium text-purple-800">QA Search Restrictions</p>
            <p className="text-sm text-purple-700 mt-1">
              You can only search videos with reported issues. Search by name, condition, region, editor, or group is not available.
              This is enforced at API level.
            </p>
          </div>
        </div>
      )}

      {/* Search Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Name - Admin/Team Lead only */}
            {canSearchByName && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={filters.full_name}
                  onChange={(e) => setFilters({ ...filters, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Search by name..."
                />
              </div>
            )}

            {/* Age - Admin/Team Lead only */}
            {canSearchByName && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Age</label>
                <input
                  type="number"
                  value={filters.age}
                  onChange={(e) => setFilters({ ...filters, age: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Age"
                />
              </div>
            )}

            {/* Condition - Admin/Team Lead/Group Leader */}
            {canSearchByCondition && (
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

            {/* Region - Admin/Team Lead only */}
            {canSearchByRegion && (
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

            {/* Camera Number - All roles */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Camera Number</label>
              <input
                type="text"
                value={filters.camera_number}
                onChange={(e) => setFilters({ ...filters, camera_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 10"
              />
            </div>

            {/* SD Card - All roles */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SD Card Label</label>
              <input
                type="text"
                value={filters.sd_label}
                onChange={(e) => setFilters({ ...filters, sd_label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 10B"
              />
            </div>

            {/* Issue Type - All roles */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Issue Type</label>
              <select
                value={filters.issue_type}
                onChange={(e) => setFilters({ ...filters, issue_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {issueTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Issue Status */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Issue Status</label>
              <select
                value={filters.issue_status}
                onChange={(e) => setFilters({ ...filters, issue_status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Status</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Backup Status - Admin/Team Lead only */}
            {isAdminOrTeamLead && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Backup Status</label>
                <select
                  value={filters.backup_status}
                  onChange={(e) => setFilters({ ...filters, backup_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any Status</option>
                  <option value="pending">Pending</option>
                  <option value="backed_up">Backed Up</option>
                  <option value="verified">Verified</option>
                </select>
              </div>
            )}

            {/* Date Range - Admin/Team Lead */}
            {isAdminOrTeamLead && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setFilters({
                full_name: '', age: '', condition: '', region: '',
                camera_number: '', sd_label: '', event_id: '', editor_id: '',
                group_id: '', issue_type: '', issue_status: '', backup_status: '',
                date_from: '', date_to: '', page: 1
              })}
              className="text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <SearchIcon className="w-4 h-4" />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {searched && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {pagination.total} Result{pagination.total !== 1 ? 's' : ''} Found
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No videos found matching your search criteria</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map((item) => (
                <div key={item.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileVideo className="w-8 h-8 text-gray-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{item.filename}</p>
                      {/* Issue Badge */}
                      {item.issues?.length > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                          Issue
                        </span>
                      )}
                      {/* Backup Badge */}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.backup_verified 
                          ? 'bg-green-100 text-green-700' 
                          : item.backup_pending
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {item.backup_verified ? 'Verified' : item.backup_pending ? 'Pending' : 'No Backup'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      {isAdminOrTeamLead && item.full_name && (
                        <span>{item.full_name}</span>
                      )}
                      <span>Camera {item.camera_number || '?'}</span>
                      <span>SD {item.sd_label || '?'}</span>
                      {item.editor?.name && <span>Editor: {item.editor.name}</span>}
                    </div>
                  </div>

                  {/* Source Availability */}
                  <div className="flex items-center gap-2 text-sm">
                    {item.backup_available && (
                      <span className="flex items-center gap-1 text-green-600">
                        <HardDrive className="w-4 h-4" />
                      </span>
                    )}
                    {item.editor_online && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <Wifi className="w-4 h-4" />
                      </span>
                    )}
                    {!item.backup_available && !item.editor_online && (
                      <span className="flex items-center gap-1 text-red-600">
                        <WifiOff className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPlaybackMedia(item)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Play className="w-4 h-4" />
                      Play
                    </button>
                    {canDownload && (
                      <button
                        onClick={() => handleDownload(item)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.last_page > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {pagination.current_page} of {pagination.last_page}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFilters({ ...filters, page: pagination.current_page - 1 });
                    handleSearch();
                  }}
                  disabled={pagination.current_page === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    setFilters({ ...filters, page: pagination.current_page + 1 });
                    handleSearch();
                  }}
                  disabled={pagination.current_page === pagination.last_page}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Playback Modal */}
      {playbackMedia && (
        <PlaybackModal
          media={playbackMedia}
          onClose={() => setPlaybackMedia(null)}
          canDownload={canDownload}
          onDownload={handleDownload}
          user={user}
        />
      )}
    </div>
  );
}
