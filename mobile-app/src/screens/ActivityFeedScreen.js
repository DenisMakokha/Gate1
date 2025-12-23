import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { activityFeedService } from '../services/api';

const iconMap = {
  copy: 'copy-outline',
  'checkmark-circle': 'checkmark-circle',
  warning: 'warning',
  'cloud-upload': 'cloud-upload',
  'shield-checkmark': 'shield-checkmark',
  'alert-circle': 'alert-circle',
  'checkmark-done': 'checkmark-done',
  'radio-button-on': 'radio-button-on',
  'radio-button-off': 'radio-button-off',
  'hardware-chip': 'hardware-chip',
};

const colorMap = {
  blue: '#3b82f6',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  gray: '#6b7280',
};

function ActivityItem({ activity }) {
  const iconName = iconMap[activity.icon] || 'ellipse';
  const color = colorMap[activity.color] || colorMap.gray;

  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={iconName} size={18} color={color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{activity.title}</Text>
        {activity.description && (
          <Text style={styles.activityDesc}>{activity.description}</Text>
        )}
        <View style={styles.activityMeta}>
          {activity.group && (
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>{activity.group.code}</Text>
            </View>
          )}
          <Text style={styles.activityTime}>{activity.time_ago}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ActivityFeedScreen({ navigation }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const response = await activityFeedService.getAll({ limit: 50 });
      setActivities(response.activities || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadActivities();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Activity Feed</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >
        {activities.length > 0 ? (
          <View style={styles.activityList}>
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No activity recorded yet</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  content: {
    flex: 1,
  },
  activityList: {
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  activityDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  groupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  },
  groupBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  activityTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
});
