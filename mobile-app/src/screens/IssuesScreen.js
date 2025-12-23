import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { issueService } from '../services/api';

const severityColors = {
  critical: { bg: '#fef2f2', text: '#dc2626' },
  high: { bg: '#fff7ed', text: '#ea580c' },
  medium: { bg: '#fefce8', text: '#ca8a04' },
  low: { bg: '#f3f4f6', text: '#6b7280' },
};

const statusColors = {
  open: { bg: '#fef2f2', text: '#dc2626' },
  acknowledged: { bg: '#fefce8', text: '#ca8a04' },
  in_progress: { bg: '#eff6ff', text: '#2563eb' },
  escalated: { bg: '#faf5ff', text: '#9333ea' },
  resolved: { bg: '#f0fdf4', text: '#16a34a' },
};

const typeLabels = {
  no_audio: 'No Audio',
  low_audio: 'Low Audio',
  blurry: 'Blurry Video',
  shaky: 'Shaky Video',
  cut_interview: 'Cut Interview',
  filename_error: 'Filename Error',
  duplicate: 'Duplicate',
  other: 'Other',
};

function IssueCard({ issue, onPress }) {
  const severity = severityColors[issue.severity] || severityColors.medium;
  const status = statusColors[issue.status] || statusColors.open;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.issueId}>{issue.issue_id}</Text>
        <View style={[styles.badge, { backgroundColor: severity.bg }]}>
          <Text style={[styles.badgeText, { color: severity.text }]}>
            {issue.severity}
          </Text>
        </View>
      </View>

      <Text style={styles.issueType}>
        {typeLabels[issue.type] || issue.type}
      </Text>

      <Text style={styles.filename} numberOfLines={1}>
        {issue.media?.filename || 'Unknown file'}
      </Text>

      <View style={styles.cardFooter}>
        <Text style={styles.reporter}>
          {issue.reporter?.name || 'Unknown'} • {issue.group?.group_code}
        </Text>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.text }]}>
            {issue.status.replace('_', ' ')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function IssuesScreen({ navigation }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('open');

  const loadIssues = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await issueService.getAll(params);
      setIssues(response.data || []);
    } catch (error) {
      console.error('Failed to load issues:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadIssues();
  }, [loadIssues]);

  const filters = ['all', 'open', 'acknowledged', 'escalated', 'resolved'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Issues</Text>
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                filter === item && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item && styles.filterTextActive,
                ]}
              >
                {item.charAt(0).toUpperCase() + item.slice(1).replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      <FlatList
        data={issues}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            onPress={() => navigation.navigate('IssueDetail', { issueId: item.issue_id })}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No issues found'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterList: {
    padding: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTextActive: {
    color: 'white',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueId: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  issueType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  filename: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  reporter: {
    fontSize: 13,
    color: '#6b7280',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
