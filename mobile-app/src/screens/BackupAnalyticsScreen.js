import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { backupService } from '../services/api';

const { width } = Dimensions.get('window');

function ProgressBar({ percentage, color = '#0ea5e9', height = 8 }) {
  return (
    <View style={[styles.progressBarBg, { height }]}>
      <View
        style={[
          styles.progressBarFill,
          { width: `${Math.min(percentage, 100)}%`, backgroundColor: color, height },
        ]}
      />
    </View>
  );
}

function StatCard({ title, value, subtitle, icon, color, percentage }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      {percentage !== undefined && (
        <View style={styles.progressContainer}>
          <ProgressBar percentage={percentage} color={color} />
          <Text style={[styles.percentageText, { color }]}>{percentage}%</Text>
        </View>
      )}
    </View>
  );
}

function GroupRow({ group }) {
  const getProgressColor = (pct) => {
    if (pct >= 90) return '#10b981';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={styles.groupRow}>
      <View style={styles.groupInfo}>
        <Text style={styles.groupCode}>{group.group_code}</Text>
        <Text style={styles.groupName}>{group.name}</Text>
      </View>
      <View style={styles.groupStats}>
        <Text style={styles.groupClips}>{group.total_clips} clips</Text>
        <Text style={styles.groupSize}>{group.total_size_formatted}</Text>
      </View>
      <View style={styles.groupProgress}>
        <View style={styles.progressBarSmall}>
          <ProgressBar percentage={group.backup_percentage} color={getProgressColor(group.backup_percentage)} height={6} />
        </View>
        <Text style={[styles.groupPercentage, { color: getProgressColor(group.backup_percentage) }]}>
          {group.backup_percentage}%
        </Text>
      </View>
    </View>
  );
}

function EditorRow({ editor }) {
  const getProgressColor = (pct) => {
    if (pct >= 90) return '#10b981';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={styles.editorRow}>
      <View style={styles.editorAvatar}>
        <Text style={styles.editorInitials}>
          {editor.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </Text>
      </View>
      <View style={styles.editorInfo}>
        <Text style={styles.editorName}>{editor.name}</Text>
        <Text style={styles.editorClips}>{editor.total_clips} clips • {editor.total_size_formatted}</Text>
      </View>
      <View style={styles.editorProgress}>
        <Text style={[styles.editorPercentage, { color: getProgressColor(editor.backup_percentage) }]}>
          {editor.backup_percentage}%
        </Text>
        {editor.pending_clips > 0 && (
          <Text style={styles.editorPending}>{editor.pending_clips} pending</Text>
        )}
      </View>
    </View>
  );
}

export default function BackupAnalyticsScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await backupService.getAnalytics();
      setData(response);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading backup analytics...</Text>
      </View>
    );
  }

  const overall = data?.overall || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#0ea5e9', '#0284c7']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Backup Analytics</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Overall Progress */}
        <View style={styles.overallProgress}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressValue}>{overall.backup_percentage || 0}%</Text>
            <Text style={styles.progressLabel}>Backed Up</Text>
          </View>
          <View style={styles.overallStats}>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatValue}>{overall.total_clips?.toLocaleString() || 0}</Text>
              <Text style={styles.overallStatLabel}>Total Clips</Text>
            </View>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatValue}>{overall.total_size_formatted || '0 B'}</Text>
              <Text style={styles.overallStatLabel}>Total Size</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {[
          { id: 'overview', label: 'Overview', icon: 'stats-chart' },
          { id: 'groups', label: 'Groups', icon: 'layers' },
          { id: 'editors', label: 'Editors', icon: 'people' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? '#0ea5e9' : '#9ca3af'}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0ea5e9']}
            tintColor="#0ea5e9"
          />
        }
      >
        {activeTab === 'overview' && (
          <>
            {/* Stat Cards */}
            <View style={styles.statsGrid}>
              <StatCard
                title="Backed Up"
                value={overall.backed_up_clips?.toLocaleString() || 0}
                subtitle={overall.backed_up_size_formatted}
                icon="cloud-done"
                color="#10b981"
                percentage={overall.backup_percentage}
              />
              <StatCard
                title="Verified"
                value={overall.verified_clips?.toLocaleString() || 0}
                subtitle={overall.verified_size_formatted}
                icon="checkmark-circle"
                color="#10b981"
                percentage={overall.verification_percentage}
              />
              <StatCard
                title="Pending"
                value={overall.pending_clips?.toLocaleString() || 0}
                subtitle={overall.pending_size_formatted}
                icon="time"
                color={overall.pending_clips > 0 ? '#f59e0b' : '#10b981'}
              />
              <StatCard
                title="Disks"
                value={data?.disks?.length || 0}
                subtitle="Active"
                icon="hardware-chip"
                color="#0ea5e9"
              />
            </View>

            {/* Daily Trend */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>7-Day Trend</Text>
              <View style={styles.trendCard}>
                {data?.daily_trend?.map((day, index) => (
                  <View key={day.date} style={styles.trendDay}>
                    <View style={styles.trendBarContainer}>
                      <View
                        style={[
                          styles.trendBar,
                          {
                            height: `${day.clips_created > 0 ? (day.clips_backed_up / day.clips_created) * 100 : 0}%`,
                            backgroundColor: '#0ea5e9',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.trendLabel}>{day.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Disk Usage */}
            {data?.disks?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Disk Usage</Text>
                {data.disks.map((disk) => (
                  <View key={disk.id} style={styles.diskCard}>
                    <View style={styles.diskHeader}>
                      <View style={styles.diskIconBg}>
                        <Ionicons name="hardware-chip" size={20} color="#0ea5e9" />
                      </View>
                      <View style={styles.diskInfo}>
                        <Text style={styles.diskName}>{disk.name}</Text>
                        <Text style={styles.diskPurpose}>{disk.purpose}</Text>
                      </View>
                      <Text style={[
                        styles.diskStatus,
                        { color: disk.status === 'active' ? '#10b981' : '#9ca3af' }
                      ]}>
                        {disk.status}
                      </Text>
                    </View>
                    <View style={styles.diskProgress}>
                      <ProgressBar
                        percentage={disk.usage_percentage}
                        color={disk.usage_percentage >= 90 ? '#ef4444' : disk.usage_percentage >= 70 ? '#f59e0b' : '#0ea5e9'}
                      />
                      <View style={styles.diskUsage}>
                        <Text style={styles.diskUsageText}>{disk.used_formatted} / {disk.capacity_formatted}</Text>
                        <Text style={styles.diskUsagePercent}>{disk.usage_percentage}%</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'groups' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backup by Group</Text>
            {data?.by_group?.map((group) => (
              <GroupRow key={group.id} group={group} />
            ))}
            {(!data?.by_group || data.by_group.length === 0) && (
              <View style={styles.emptyState}>
                <Ionicons name="layers-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No group data available</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'editors' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backup by Editor</Text>
            {data?.by_editor?.map((editor) => (
              <EditorRow key={editor.id} editor={editor} />
            ))}
            {(!data?.by_editor || data.by_editor.length === 0) && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No editor data available</Text>
              </View>
            )}
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
    paddingBottom: 24,
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
  overallProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  progressLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  overallStats: {
    flex: 1,
    marginLeft: 20,
  },
  overallStatItem: {
    marginBottom: 8,
  },
  overallStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  overallStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#e0f2fe',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabTextActive: {
    color: '#0ea5e9',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: (width - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  statSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBarBg: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  trendCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 140,
  },
  trendDay: {
    alignItems: 'center',
    flex: 1,
  },
  trendBarContainer: {
    flex: 1,
    width: 24,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBar: {
    width: '100%',
    borderRadius: 4,
  },
  trendLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
  },
  diskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  diskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  diskIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diskInfo: {
    flex: 1,
    marginLeft: 12,
  },
  diskName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  diskPurpose: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  diskStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  diskProgress: {
    marginTop: 8,
  },
  diskUsage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  diskUsageText: {
    fontSize: 12,
    color: '#6b7280',
  },
  diskUsagePercent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  groupRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
  },
  groupCode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  groupName: {
    fontSize: 12,
    color: '#6b7280',
  },
  groupStats: {
    alignItems: 'flex-end',
    marginRight: 16,
  },
  groupClips: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  groupSize: {
    fontSize: 11,
    color: '#9ca3af',
  },
  groupProgress: {
    width: 70,
    alignItems: 'flex-end',
  },
  progressBarSmall: {
    width: '100%',
  },
  groupPercentage: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  editorRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  editorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  editorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  editorClips: {
    fontSize: 12,
    color: '#6b7280',
  },
  editorProgress: {
    alignItems: 'flex-end',
  },
  editorPercentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  editorPending: {
    fontSize: 11,
    color: '#f59e0b',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
});
