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
import api from '../services/api';

export default function EventsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const loadEvents = async () => {
    try {
      const endpoint = filter === 'active' ? '/events/active' : '/events';
      const response = await api.get(endpoint);
      setEvents(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [filter]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#22c55e';
      case 'completed':
        return '#6b7280';
      case 'planning':
        return '#f59e0b';
      default:
        return '#9ca3af';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderEvent = ({ item }) => (
    <TouchableOpacity style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventIcon}>
          <Ionicons name="calendar" size={24} color="#6366f1" />
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventCode}>{item.event_code}</Text>
          <Text style={styles.eventName}>{item.name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.eventDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#9ca3af" />
          <Text style={styles.detailText}>{item.location || 'No location'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#9ca3af" />
          <Text style={styles.detailText}>
            {formatDate(item.start_date)} - {formatDate(item.end_date)}
          </Text>
        </View>
      </View>

      {item.stats && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.stats.groups || 0}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.stats.media || 0}</Text>
            <Text style={styles.statLabel}>Media</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.stats.issues || 0}</Text>
            <Text style={styles.statLabel}>Issues</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptyText}>
        {filter === 'active' ? 'No active events at the moment' : 'No events have been created yet'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All Events
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
      </View>

      {/* Events List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterTabActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  eventCard: {
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
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
    marginLeft: 12,
  },
  eventCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0ea5e9',
    textTransform: 'uppercase',
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  eventDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
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
});
