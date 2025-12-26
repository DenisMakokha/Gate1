import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { mediaService, issueService } from '../services/api';

const { width, height } = Dimensions.get('window');

// Playback Source Types
const PLAYBACK_SOURCES = {
  VERIFIED_BACKUP: 'verified_backup',
  EDITOR_STREAM: 'editor_stream',
  QA_CACHE: 'qa_cache',
  OFFLINE: 'offline'
};

// Playback Modal Component - Full specification compliance
function PlaybackModal({ media, visible, onClose, canDownload, user }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackLogged, setPlaybackLogged] = useState(false);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const videoRef = React.useRef(null);

  useEffect(() => {
    if (media && visible) {
      determineSource();
    }
  }, [media, visible]);

  const determineSource = () => {
    setLoading(true);
    // Priority 1: Verified Backup
    if (media.backup_verified && media.backup_available) {
      setSource({
        type: PLAYBACK_SOURCES.VERIFIED_BACKUP,
        label: 'Verified Backup',
        color: '#22c55e',
        url: media.backup_stream_url || media.preview_url
      });
    }
    // Priority 2: Editor Stream (if editor online)
    else if (media.editor_online && media.local_available) {
      setSource({
        type: PLAYBACK_SOURCES.EDITOR_STREAM,
        label: 'Editor Stream (Live)',
        color: '#3b82f6',
        url: media.editor_stream_url || media.preview_url
      });
    }
    // Priority 3: QA Cache
    else if (media.qa_cache_available) {
      setSource({
        type: PLAYBACK_SOURCES.QA_CACHE,
        label: 'QA Review Cache',
        color: '#f59e0b',
        url: media.qa_cache_url
      });
    }
    // No source available
    else {
      setSource({
        type: PLAYBACK_SOURCES.OFFLINE,
        label: 'Source Offline',
        color: '#ef4444',
        url: null
      });
    }
    setLoading(false);
  };

  // Log playback intent before starting
  const handlePlay = async () => {
    if (!playbackLogged) {
      try {
        await mediaService.logPlayback(media.media_id, {
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
    if (!canDownload) {
      Alert.alert('Not Permitted', 'Download is only available for Admin and Team Lead roles.');
      return;
    }

    try {
      // Log download intent
      await mediaService.logDownload(media.media_id, { source: source?.type });
      
      // Get download URL
      const response = await mediaService.getDownloadUrl(media.media_id);
      if (response?.url) {
        Linking.openURL(response.url);
      } else {
        Alert.alert('Download Unavailable', 'No download source currently available.');
      }
    } catch (error) {
      Alert.alert('Download Failed', 'Could not initiate download.');
    }
  };

  if (!media) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.playbackModal}>
          {/* Header */}
          <View style={styles.playbackHeader}>
            <View style={styles.playbackHeaderLeft}>
              <Text style={styles.playbackTitle} numberOfLines={1}>{media.filename}</Text>
              <Text style={styles.playbackSubtitle}>{media.media_id}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Source Label */}
          {source && (
            <View style={[styles.sourceLabel, { backgroundColor: source.color + '20' }]}>
              <Ionicons 
                name={source.type === PLAYBACK_SOURCES.OFFLINE ? 'cloud-offline' : 'server'} 
                size={16} 
                color={source.color} 
              />
              <Text style={[styles.sourceLabelText, { color: source.color }]}>
                Source: {source.label}
              </Text>
            </View>
          )}

          {/* Video Player */}
          <View style={styles.videoContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#0ea5e9" />
            ) : source?.type === PLAYBACK_SOURCES.OFFLINE ? (
              <View style={styles.offlineContainer}>
                <Ionicons name="cloud-offline" size={64} color="#9ca3af" />
                <Text style={styles.offlineTitle}>Source Offline</Text>
                <Text style={styles.offlineText}>Video is not currently available</Text>
              </View>
            ) : !isPlaying ? (
              <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
                <View style={styles.playButtonInner}>
                  <Ionicons name="play" size={40} color="#fff" />
                </View>
                <Text style={styles.playButtonText}>Tap to Play</Text>
                <Text style={styles.auditNotice}>Playback will be logged for audit</Text>
              </TouchableOpacity>
            ) : (
              <Video
                ref={videoRef}
                source={{ uri: source?.url || media.preview_url }}
                style={styles.video}
                useNativeControls
                resizeMode="contain"
                shouldPlay
                onPlaybackStatusUpdate={(status) => {
                  if (status.didJustFinish) {
                    setIsPlaying(false);
                  }
                }}
              />
            )}
          </View>

          {/* Metadata Panel */}
          <View style={styles.metadataPanel}>
            <View style={styles.metadataRow}>
              <View style={styles.metadataItem}>
                <Ionicons name="person" size={14} color="#9ca3af" />
                <Text style={styles.metadataLabel}>Person</Text>
                <Text style={styles.metadataValue}>{media.full_name || 'N/A'}</Text>
              </View>
              <View style={styles.metadataItem}>
                <Ionicons name="camera" size={14} color="#9ca3af" />
                <Text style={styles.metadataLabel}>Camera</Text>
                <Text style={styles.metadataValue}>{media.camera_number || '?'}</Text>
              </View>
            </View>
            <View style={styles.metadataRow}>
              <View style={styles.metadataItem}>
                <Ionicons name="location" size={14} color="#9ca3af" />
                <Text style={styles.metadataLabel}>Region</Text>
                <Text style={styles.metadataValue}>{media.region || 'N/A'}</Text>
              </View>
              <View style={styles.metadataItem}>
                <Ionicons name="disc" size={14} color="#9ca3af" />
                <Text style={styles.metadataLabel}>SD Card</Text>
                <Text style={styles.metadataValue}>{media.sd_label || '?'}</Text>
              </View>
            </View>
          </View>

          {/* Issue Badge */}
          {media.issues?.length > 0 && (
            <View style={styles.issueBanner}>
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.issueBannerText}>
                {media.issues.length} Issue{media.issues.length > 1 ? 's' : ''} Reported
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.playbackActions}>
            {canDownload && source?.type !== PLAYBACK_SOURCES.OFFLINE && (
              <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.downloadButtonText}>Download</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Audit Footer */}
          <View style={styles.auditFooter}>
            <Ionicons name="shield-checkmark" size={12} color="#9ca3af" />
            <Text style={styles.auditFooterText}>
              All actions logged • {user?.name} ({user?.roles?.[0]})
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SearchPlaybackScreen({ navigation }) {
  const { user, isAdmin, isTeamLead, isGroupLeader, isQARole, isBackupRole, hasOperationalAccess } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showPlayback, setShowPlayback] = useState(false);

  // Role-based permissions
  const isAdminOrTeamLead = hasOperationalAccess();
  const isQA = isQARole();
  const isGL = isGroupLeader();
  const canDownload = isAdminOrTeamLead;

  // Role-based filter visibility
  const canSearchByName = isAdminOrTeamLead;
  const canSearchByRegion = isAdminOrTeamLead;

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    issue_type: '',
    camera_number: '',
  });

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);

    try {
      const params = {};

      // Admin/Team Lead: Full access
      if (isAdminOrTeamLead) {
        if (filters.search) params.search = filters.search;
        if (filters.issue_type) params.issue_type = filters.issue_type;
        if (filters.camera_number) params.camera_number = filters.camera_number;
      }
      // QA: Issue-only search
      else if (isQA) {
        if (filters.issue_type) params.issue_type = filters.issue_type;
        if (filters.camera_number) params.camera_number = filters.camera_number;
        params.has_issues = true; // Force issue-only results
      }
      // Group Leader: Group + issue scoped
      else if (isGL) {
        if (filters.issue_type) params.issue_type = filters.issue_type;
        if (filters.camera_number) params.camera_number = filters.camera_number;
        params.my_groups = true;
      }

      const response = await mediaService.search(params);
      setResults(response.data || []);
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Search Failed', 'Could not complete search.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    handleSearch();
  }, [filters]);

  const openPlayback = (media) => {
    // QA can only play media with issues
    if (isQA && (!media.issues || media.issues.length === 0)) {
      Alert.alert(
        'Access Restricted',
        'QA can only play media with reported issues.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedMedia(media);
    setShowPlayback(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'synced': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  const renderMediaItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mediaCard}
      onPress={() => openPlayback(item)}
      activeOpacity={0.7}
    >
      <View style={styles.mediaThumbnail}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="videocam" size={28} color="#9ca3af" />
          </View>
        )}
        {/* Issue Badge */}
        {item.issues?.length > 0 && (
          <View style={styles.issueBadge}>
            <Ionicons name="alert-circle" size={10} color="#fff" />
          </View>
        )}
        {/* Source Indicator */}
        <View style={styles.sourceIndicator}>
          {item.backup_available ? (
            <Ionicons name="server" size={12} color="#22c55e" />
          ) : item.editor_online ? (
            <Ionicons name="wifi" size={12} color="#3b82f6" />
          ) : (
            <Ionicons name="cloud-offline" size={12} color="#ef4444" />
          )}
        </View>
      </View>

      <View style={styles.mediaInfo}>
        <Text style={styles.mediaFilename} numberOfLines={1}>{item.filename}</Text>
        <View style={styles.mediaMetaRow}>
          <Text style={styles.mediaMeta}>Cam {item.camera_number || '?'}</Text>
          <Text style={styles.mediaMeta}>•</Text>
          <Text style={styles.mediaMeta}>SD {item.sd_label || '?'}</Text>
        </View>
        {/* Show name only for Admin/Team Lead */}
        {isAdminOrTeamLead && item.full_name && (
          <Text style={styles.mediaName} numberOfLines={1}>{item.full_name}</Text>
        )}
      </View>

      <Ionicons name="play-circle" size={24} color="#0ea5e9" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#0ea5e9', '#0284c7']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Search & Playback</Text>
        <Text style={styles.headerSubtitle}>
          {isAdminOrTeamLead ? 'Global search across all indexed media' :
           isQA ? 'Search videos with reported issues only' :
           isGL ? 'Search issues within your groups' : 'Search indexed media'}
        </Text>
      </LinearGradient>

      {/* Role Notice for QA */}
      {isQA && (
        <View style={styles.roleNotice}>
          <Ionicons name="lock-closed" size={16} color="#7c3aed" />
          <Text style={styles.roleNoticeText}>
            QA: Issue-only search. Name/region filters not available.
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        {/* Name search - Admin/Team Lead only */}
        {canSearchByName && (
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={18} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, filename..."
              placeholderTextColor="#9ca3af"
              value={filters.search}
              onChangeText={(text) => setFilters({ ...filters, search: text })}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
        )}

        {/* Camera filter - all roles */}
        <View style={styles.filterRow}>
          <View style={styles.filterInputSmall}>
            <Ionicons name="camera" size={16} color="#9ca3af" />
            <TextInput
              style={styles.filterInput}
              placeholder="Camera #"
              placeholderTextColor="#9ca3af"
              value={filters.camera_number}
              onChangeText={(text) => setFilters({ ...filters, camera_number: text })}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-off" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptyText}>Try different search criteria</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} />
          }
          ListEmptyComponent={
            !searched && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={64} color="#d1d5db" />
                <Text style={styles.emptyTitle}>Search Media</Text>
                <Text style={styles.emptyText}>
                  {isQA ? 'Search for media with issues to review' : 'Enter search criteria above'}
                </Text>
              </View>
            )
          }
        />
      )}

      {/* Playback Modal */}
      <PlaybackModal
        media={selectedMedia}
        visible={showPlayback}
        onClose={() => {
          setShowPlayback(false);
          setSelectedMedia(null);
        }}
        canDownload={canDownload}
        user={user}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  roleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  roleNoticeText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '500',
  },
  searchContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterInputSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  filterInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  mediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mediaThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    marginRight: 12,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaInfo: {
    flex: 1,
  },
  mediaFilename: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  mediaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  mediaMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  mediaName: {
    fontSize: 12,
    color: '#0ea5e9',
    marginTop: 2,
  },
  // Playback Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  playbackModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
  },
  playbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  playbackHeaderLeft: {
    flex: 1,
    marginRight: 16,
  },
  playbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  playbackSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sourceLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  videoContainer: {
    height: 220,
    backgroundColor: '#000',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  offlineContainer: {
    alignItems: 'center',
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  offlineText: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  playButton: {
    alignItems: 'center',
  },
  playButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  auditNotice: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  metadataPanel: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metadataItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  metadataValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1f2937',
  },
  issueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  issueBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#dc2626',
  },
  playbackActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  downloadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  auditFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 6,
  },
  auditFooterText: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
