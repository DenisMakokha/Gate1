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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function MediaBrowserScreen({ navigation }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async (searchQuery = '') => {
    try {
      const response = await api.get('/media/search', {
        params: { search: searchQuery, per_page: 50 },
      });
      setMedia(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMedia(search);
  }, [search]);

  const handleSearch = () => {
    setLoading(true);
    loadMedia(search);
  };

  const getMediaIcon = (type) => {
    switch (type) {
      case 'video':
        return 'videocam';
      case 'audio':
        return 'musical-notes';
      case 'image':
        return 'image';
      default:
        return 'document';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'synced':
        return '#22c55e';
      case 'pending':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMediaItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mediaCard}
      onPress={() => {
        setSelectedMedia(item);
        setShowDetail(true);
      }}
    >
      <View style={styles.mediaThumbnail}>
        {item.thumbnail_path ? (
          <Image source={{ uri: item.thumbnail_path }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name={getMediaIcon(item.media_type)} size={32} color="#9ca3af" />
          </View>
        )}
        {item.media_type === 'video' && item.duration_seconds && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration_seconds)}</Text>
          </View>
        )}
      </View>

      <View style={styles.mediaInfo}>
        <Text style={styles.mediaFilename} numberOfLines={1}>
          {item.original_filename}
        </Text>
        <View style={styles.mediaMetaRow}>
          <View style={styles.mediaType}>
            <Ionicons name={getMediaIcon(item.media_type)} size={14} color="#6b7280" />
            <Text style={styles.mediaTypeText}>{item.media_type}</Text>
          </View>
          <Text style={styles.mediaSize}>{formatFileSize(item.file_size)}</Text>
        </View>
        <View style={styles.mediaFooter}>
          <Text style={styles.mediaGroup}>{item.group?.group_code || '-'}</Text>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="film-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No Media Found</Text>
      <Text style={styles.emptyText}>
        {search ? 'Try a different search term' : 'No media files have been synced yet'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Media Browser</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by filename, media ID..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); loadMedia(''); }}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Media Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={media}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Media Details</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedMedia && (
              <View style={styles.modalBody}>
                <View style={styles.detailThumbnail}>
                  {selectedMedia.thumbnail_path ? (
                    <Image
                      source={{ uri: selectedMedia.thumbnail_path }}
                      style={styles.detailImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.detailPlaceholder}>
                      <Ionicons
                        name={getMediaIcon(selectedMedia.media_type)}
                        size={64}
                        color="#9ca3af"
                      />
                    </View>
                  )}
                </View>

                <View style={styles.detailInfo}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Filename</Text>
                    <Text style={styles.detailValue}>{selectedMedia.original_filename}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Media ID</Text>
                    <Text style={styles.detailValue}>{selectedMedia.media_id}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>{selectedMedia.media_type}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Size</Text>
                    <Text style={styles.detailValue}>{formatFileSize(selectedMedia.file_size)}</Text>
                  </View>
                  {selectedMedia.duration_seconds && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Duration</Text>
                      <Text style={styles.detailValue}>
                        {formatDuration(selectedMedia.duration_seconds)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Group</Text>
                    <Text style={styles.detailValue}>
                      {selectedMedia.group?.group_code || '-'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Editor</Text>
                    <Text style={styles.detailValue}>
                      {selectedMedia.editor?.name || '-'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(selectedMedia.status) + '20' },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: getStatusColor(selectedMedia.status) }]}
                      >
                        {selectedMedia.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    padding: 12,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  mediaCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mediaThumbnail: {
    height: 100,
    backgroundColor: '#f3f4f6',
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
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  mediaInfo: {
    padding: 10,
  },
  mediaFilename: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  mediaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mediaType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaTypeText: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  mediaSize: {
    fontSize: 11,
    color: '#9ca3af',
  },
  mediaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaGroup: {
    fontSize: 11,
    color: '#0ea5e9',
    fontWeight: '500',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalBody: {
    padding: 20,
  },
  detailThumbnail: {
    height: 180,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailInfo: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    maxWidth: '60%',
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});
