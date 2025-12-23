import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { userService } from '../services/api';

export default function TeamStatusScreen({ navigation }) {
  const [editors, setEditors] = useState([]);
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'online', 'offline'

  useEffect(() => {
    loadEditors();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadEditors, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadEditors = async () => {
    try {
      const params = {};
      if (filter === 'online') params.online = 'true';
      if (filter === 'offline') params.online = 'false';
      
      const response = await userService.getEditorsStatus(params);
      setEditors(response.editors || []);
      setSummary(response.summary || { total: 0, online: 0, offline: 0 });
    } catch (error) {
      console.error('Failed to load editors:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEditors();
  }, [filter]);

  useEffect(() => {
    loadEditors();
  }, [filter]);

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  };

  const renderEditor = ({ item }) => (
    <View style={styles.editorCard}>
      <View style={styles.editorRow}>
        {/* Avatar with status */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
          <View style={[
            styles.statusDot,
            item.is_online ? styles.statusOnline : styles.statusOffline
          ]} />
        </View>

        {/* Editor info */}
        <View style={styles.editorInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.editorName}>{item.name}</Text>
            {item.is_online && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            )}
          </View>
          <Text style={styles.editorEmail}>{item.email}</Text>
          
          {/* Groups */}
          {item.groups?.length > 0 && (
            <View style={styles.groupsRow}>
              {item.groups.slice(0, 2).map((group) => (
                <View key={group.id} style={styles.groupBadge}>
                  <Text style={styles.groupText}>{group.group_code}</Text>
                </View>
              ))}
              {item.groups.length > 2 && (
                <View style={styles.groupBadge}>
                  <Text style={styles.groupText}>+{item.groups.length - 2}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Activity / Last seen */}
        <View style={styles.activityContainer}>
          {item.is_online ? (
            <View style={styles.activityRow}>
              <Ionicons name="desktop-outline" size={14} color="#10b981" />
              <Text style={styles.activityText} numberOfLines={1}>
                {item.current_activity || 'Active'}
              </Text>
            </View>
          ) : (
            <View style={styles.activityRow}>
              <Ionicons name="time-outline" size={14} color="#9ca3af" />
              <Text style={styles.lastSeenText}>{formatLastSeen(item.last_seen_at)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading team status...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#0ea5e9', '#0284c7']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Status</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#86efac' }]}>{summary.online}</Text>
            <Text style={styles.summaryLabel}>Online</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.offline}</Text>
            <Text style={styles.summaryLabel}>Offline</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        {['all', 'online', 'offline'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Editor list */}
      <FlatList
        data={editors}
        renderItem={renderEditor}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0ea5e9']}
            tintColor="#0ea5e9"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No editors found</Text>
            <Text style={styles.emptyText}>
              {filter !== 'all' ? `No ${filter} editors` : 'No editors in your groups'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterTabActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  editorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0284c7',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusOnline: {
    backgroundColor: '#10b981',
  },
  statusOffline: {
    backgroundColor: '#9ca3af',
  },
  editorInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16a34a',
  },
  editorEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  groupsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  groupBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  groupText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  activityContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
    maxWidth: 70,
  },
  lastSeenText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyContainer: {
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
});
