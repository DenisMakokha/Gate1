import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { issueService, mediaService } from '../services/api';
import offlineStorage from '../services/offlineStorage';

const { width, height } = Dimensions.get('window');

/**
 * QA Offline Review Screen
 * 
 * Per Blueprint Specification:
 * - Shows ONLY assigned issue clips
 * - NO search box
 * - NO browsing
 * - Watermarked playback
 * - Auto-expires after sync
 * - Read-only
 */

// Playback Modal for QA Issue Review (Offline-capable)
function QAPlaybackModal({ issue, visible, onClose, user }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackLogged, setPlaybackLogged] = useState(false);
  const videoRef = React.useRef(null);

  const media = issue?.media;

  const handlePlay = async () => {
    if (!playbackLogged) {
      try {
        // Log playback intent (will queue if offline)
        await mediaService.logPlayback(media?.media_id, {
          source: 'qa_cache',
          reason: 'issue_review'
        });
        setPlaybackLogged(true);
      } catch (error) {
        // Queue for later if offline
        console.log('Playback log queued for sync');
      }
    }
    setIsPlaying(true);
  };

  if (!issue || !media) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.playbackModal}>
          {/* Header */}
          <View style={styles.playbackHeader}>
            <View style={styles.playbackHeaderLeft}>
              <Text style={styles.playbackTitle}>Review Issue</Text>
              <Text style={styles.playbackSubtitle}>{issue.issue_id}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* QA Cache Notice */}
          <View style={styles.qaNotice}>
            <Ionicons name="shield-checkmark" size={16} color="#f59e0b" />
            <Text style={styles.qaNoticeText}>
              QA Review Cache • Watermarked • Read-only
            </Text>
          </View>

          {/* Video Player */}
          <View style={styles.videoContainer}>
            {!isPlaying ? (
              <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
                <View style={styles.playButtonInner}>
                  <Ionicons name="play" size={40} color="#fff" />
                </View>
                <Text style={styles.playButtonText}>Play for Review</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.videoWrapper}>
                <Video
                  ref={videoRef}
                  source={{ uri: media.qa_cache_url || media.preview_url }}
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
                {/* Watermark Overlay */}
                <View style={styles.watermark}>
                  <Text style={styles.watermarkText}>QA REVIEW ONLY</Text>
                  <Text style={styles.watermarkUser}>{user?.name}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Issue Details */}
          <View style={styles.issueDetails}>
            <View style={styles.issueRow}>
              <Text style={styles.issueLabel}>Type</Text>
              <Text style={styles.issueValue}>
                {issue.type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
            </View>
            <View style={styles.issueRow}>
              <Text style={styles.issueLabel}>Severity</Text>
              <View style={[
                styles.severityBadge,
                { backgroundColor: issue.severity === 'critical' ? '#fef2f2' : '#fefce8' }
              ]}>
                <Text style={[
                  styles.severityText,
                  { color: issue.severity === 'critical' ? '#dc2626' : '#ca8a04' }
                ]}>
                  {issue.severity}
                </Text>
              </View>
            </View>
            <View style={styles.issueRow}>
              <Text style={styles.issueLabel}>File</Text>
              <Text style={styles.issueValue} numberOfLines={1}>{media.filename}</Text>
            </View>
            <View style={styles.issueRow}>
              <Text style={styles.issueLabel}>Camera</Text>
              <Text style={styles.issueValue}>{media.camera_number || '?'}</Text>
            </View>
            {issue.description && (
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionLabel}>Description</Text>
                <Text style={styles.descriptionText}>{issue.description}</Text>
              </View>
            )}
          </View>

          {/* Read-only Notice */}
          <View style={styles.readOnlyNotice}>
            <Ionicons name="lock-closed" size={14} color="#9ca3af" />
            <Text style={styles.readOnlyText}>
              View only • No download • Auto-expires after sync
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function QAOfflineReviewScreen({ navigation }) {
  const { user, isQARole } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showPlayback, setShowPlayback] = useState(false);

  // Load assigned issues only (no browsing)
  const loadAssignedIssues = useCallback(async () => {
    try {
      // First try to get from offline cache
      const cachedIssues = await offlineStorage.getItem('qa_assigned_issues');
      if (cachedIssues) {
        setIssues(cachedIssues);
      }

      // Then fetch fresh data
      const response = await issueService.getAll({
        status: 'open,acknowledged,in_progress',
        assigned_to_qa: true, // Only issues assigned for QA review
        with_media: true,
      });
      
      const freshIssues = response.data || [];
      setIssues(freshIssues);
      
      // Cache for offline use
      await offlineStorage.setItem('qa_assigned_issues', freshIssues);
    } catch (error) {
      console.error('Failed to load issues:', error);
      // Use cached data if fetch fails
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAssignedIssues();
  }, [loadAssignedIssues]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAssignedIssues();
  }, [loadAssignedIssues]);

  const openReview = (issue) => {
    setSelectedIssue(issue);
    setShowPlayback(true);
  };

  const severityColors = {
    critical: { bg: '#fef2f2', text: '#dc2626' },
    high: { bg: '#fff7ed', text: '#ea580c' },
    medium: { bg: '#fefce8', text: '#ca8a04' },
    low: { bg: '#f3f4f6', text: '#6b7280' },
  };

  const renderIssueCard = ({ item }) => {
    const severity = severityColors[item.severity] || severityColors.medium;
    
    return (
      <TouchableOpacity
        style={styles.issueCard}
        onPress={() => openReview(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View style={styles.thumbnailContainer}>
            {item.media?.thumbnail_url ? (
              <Image source={{ uri: item.media.thumbnail_url }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="videocam" size={24} color="#9ca3af" />
              </View>
            )}
            <View style={[styles.severityDot, { backgroundColor: severity.text }]} />
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.issueType}>
            {item.type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Text>
          <Text style={styles.issueFile} numberOfLines={1}>
            {item.media?.filename || 'Unknown file'}
          </Text>
          <View style={styles.cardMeta}>
            <View style={[styles.severityBadgeSmall, { backgroundColor: severity.bg }]}>
              <Text style={[styles.severityTextSmall, { color: severity.text }]}>
                {item.severity}
              </Text>
            </View>
            <Text style={styles.cardMetaText}>Cam {item.media?.camera_number || '?'}</Text>
          </View>
        </View>
        
        <View style={styles.cardAction}>
          <Ionicons name="play-circle" size={32} color="#0ea5e9" />
        </View>
      </TouchableOpacity>
    );
  };

  // Restrict to QA roles only
  if (!isQARole()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.restrictedContainer}>
          <Ionicons name="lock-closed" size={64} color="#9ca3af" />
          <Text style={styles.restrictedTitle}>Access Restricted</Text>
          <Text style={styles.restrictedText}>
            This screen is only available for QA roles.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7c3aed', '#6d28d9']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>QA Issue Review</Text>
        <Text style={styles.headerSubtitle}>
          Assigned clips for review • No browsing
        </Text>
      </LinearGradient>

      {/* No Search Notice - Per Blueprint */}
      <View style={styles.noSearchNotice}>
        <Ionicons name="information-circle" size={18} color="#7c3aed" />
        <Text style={styles.noSearchText}>
          Only assigned issue clips are shown. No search or browsing available.
        </Text>
      </View>

      {/* Issues List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading assigned issues...</Text>
        </View>
      ) : issues.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          <Text style={styles.emptyTitle}>All Clear!</Text>
          <Text style={styles.emptyText}>
            No issues currently assigned for review.
          </Text>
        </View>
      ) : (
        <FlatList
          data={issues}
          renderItem={renderIssueCard}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={['#7c3aed']} 
            />
          }
        />
      )}

      {/* Playback Modal */}
      <QAPlaybackModal
        issue={selectedIssue}
        visible={showPlayback}
        onClose={() => {
          setShowPlayback(false);
          setSelectedIssue(null);
        }}
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
  noSearchNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  noSearchText: {
    flex: 1,
    fontSize: 13,
    color: '#7c3aed',
    fontWeight: '500',
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
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  restrictedText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  issueCard: {
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
  cardLeft: {
    marginRight: 12,
  },
  thumbnailContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardContent: {
    flex: 1,
  },
  issueType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  issueFile: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  severityBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  severityTextSmall: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardMetaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  cardAction: {
    paddingLeft: 12,
  },
  // Modal Styles
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
  },
  playbackTitle: {
    fontSize: 18,
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
  qaNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fefce8',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  qaNoticeText: {
    fontSize: 12,
    color: '#ca8a04',
    fontWeight: '500',
  },
  videoContainer: {
    height: 200,
    backgroundColor: '#000',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  watermark: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  watermarkText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1,
  },
  watermarkUser: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  issueDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  issueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  issueLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  issueValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1f2937',
    maxWidth: '60%',
    textAlign: 'right',
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  descriptionBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  descriptionLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 13,
    color: '#1f2937',
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 6,
  },
  readOnlyText: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
