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
import { dashboardService } from '../services/api';

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

function StatCard({ title, value, subtitle, icon, color, copyPct, renamePct }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      {copyPct !== undefined && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Copied</Text>
            <Text style={[styles.progressPct, { color }]}>{copyPct}%</Text>
          </View>
          <ProgressBar percentage={copyPct} color={color} height={6} />
          {renamePct !== undefined && (
            <>
              <View style={[styles.progressRow, { marginTop: 8 }]}>
                <Text style={styles.progressLabel}>Renamed</Text>
                <Text style={[styles.progressPct, { color: '#10b981' }]}>{renamePct}%</Text>
              </View>
              <ProgressBar percentage={renamePct} color="#10b981" height={6} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

function GroupRow({ group }) {
  const getColor = (pct) => {
    if (pct >= 90) return '#10b981';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={styles.groupRow}>
      <View style={styles.groupInfo}>
        <Text style={styles.groupCode}>{group.group_code}</Text>
        <Text style={styles.groupMeta}>{group.member_count} members • {group.total_size_formatted}</Text>
      </View>
      <View style={styles.groupStats}>
        <View style={styles.groupStatRow}>
          <Text style={styles.groupStatLabel}>Copied</Text>
          <View style={styles.groupProgressWrap}>
            <View style={styles.miniProgress}>
              <ProgressBar percentage={group.copy_percentage} color={getColor(group.copy_percentage)} height={4} />
            </View>
            <Text style={[styles.groupStatValue, { color: getColor(group.copy_percentage) }]}>
              {group.copy_percentage}%
            </Text>
          </View>
        </View>
        <View style={styles.groupStatRow}>
          <Text style={styles.groupStatLabel}>Renamed</Text>
          <View style={styles.groupProgressWrap}>
            <View style={styles.miniProgress}>
              <ProgressBar percentage={group.rename_percentage} color={getColor(group.rename_percentage)} height={4} />
            </View>
            <Text style={[styles.groupStatValue, { color: getColor(group.rename_percentage) }]}>
              {group.rename_percentage}%
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function EditorRow({ editor }) {
  const getColor = (pct) => {
    if (pct >= 90) return '#10b981';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={styles.editorRow}>
      <View style={styles.editorLeft}>
        <View style={styles.editorAvatar}>
          <Text style={styles.editorInitials}>
            {editor.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </Text>
        </View>
        <View style={styles.editorInfo}>
          <View style={styles.editorNameRow}>
            <View style={[styles.onlineDot, { backgroundColor: editor.is_online ? '#10b981' : '#d1d5db' }]} />
            <Text style={styles.editorName}>{editor.name}</Text>
          </View>
          <Text style={styles.editorMeta}>{editor.files_copied}/{editor.files_detected} files • {editor.total_size_formatted}</Text>
        </View>
      </View>
      <View style={styles.editorRight}>
        <Text style={[styles.editorPct, { color: getColor(editor.copy_percentage) }]}>
          {editor.copy_percentage}%
        </Text>
        <Text style={styles.editorPctLabel}>copied</Text>
      </View>
    </View>
  );
}

function SessionRow({ session }) {
  return (
    <View style={styles.sessionRow}>
      <View style={styles.sessionHeader}>
        <View style={styles.sessionLive}>
          <View style={styles.liveDot} />
          <Text style={styles.sessionEditor}>{session.editor}</Text>
        </View>
        <Text style={styles.sessionTime}>
          {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <View style={styles.sessionMeta}>
        <Text style={styles.sessionDetail}>Camera {session.camera_number}</Text>
        {session.sd_label && <Text style={styles.sessionDetail}> • {session.sd_label}</Text>}
      </View>
      <View style={styles.sessionProgress}>
        <ProgressBar percentage={session.copy_progress} color="#0ea5e9" height={6} />
        <View style={styles.sessionProgressText}>
          <Text style={styles.sessionFiles}>{session.files_copied} / {session.files_detected}</Text>
          <Text style={styles.sessionPct}>{session.copy_progress}%</Text>
        </View>
      </View>
    </View>
  );
}

export default function WorkflowProgressScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('groups');

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const response = await dashboardService.getWorkflowProgress();
      setData(response);
    } catch (error) {
      console.error('Failed to load workflow progress:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProgress();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading workflow progress...</Text>
      </View>
    );
  }

  const overall = data?.overall || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Workflow Progress</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Overall Progress */}
        <View style={styles.overallCard}>
          <View style={styles.overallRow}>
            <View style={styles.overallItem}>
              <Text style={styles.overallValue}>{overall.copy_percentage || 0}%</Text>
              <Text style={styles.overallLabel}>Copied</Text>
            </View>
            <View style={styles.overallDivider} />
            <View style={styles.overallItem}>
              <Text style={styles.overallValue}>{overall.rename_percentage || 0}%</Text>
              <Text style={styles.overallLabel}>Renamed</Text>
            </View>
            <View style={styles.overallDivider} />
            <View style={styles.overallItem}>
              <Text style={styles.overallValue}>{overall.active_sessions || 0}</Text>
              <Text style={styles.overallLabel}>Active</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {[
          { id: 'groups', label: 'Groups', icon: 'layers' },
          { id: 'editors', label: 'Editors', icon: 'people' },
          { id: 'sessions', label: 'Sessions', icon: 'pulse' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? '#6366f1' : '#9ca3af'}
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
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >
        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statMini}>
            <Text style={styles.statMiniValue}>{overall.files_detected?.toLocaleString() || 0}</Text>
            <Text style={styles.statMiniLabel}>Detected</Text>
          </View>
          <View style={styles.statMini}>
            <Text style={[styles.statMiniValue, { color: '#10b981' }]}>{overall.files_copied?.toLocaleString() || 0}</Text>
            <Text style={styles.statMiniLabel}>Copied</Text>
          </View>
          <View style={styles.statMini}>
            <Text style={[styles.statMiniValue, { color: '#f59e0b' }]}>{overall.files_pending?.toLocaleString() || 0}</Text>
            <Text style={styles.statMiniLabel}>Pending</Text>
          </View>
          <View style={styles.statMini}>
            <Text style={styles.statMiniValue}>{overall.total_size_formatted || '0 B'}</Text>
            <Text style={styles.statMiniLabel}>Size</Text>
          </View>
        </View>

        {activeTab === 'groups' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Progress by Group</Text>
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
            <Text style={styles.sectionTitle}>Progress by Editor</Text>
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

        {activeTab === 'sessions' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Copy Sessions</Text>
            {data?.active_sessions?.length > 0 ? (
              data.active_sessions.map((session) => (
                <SessionRow key={session.session_id} session={session} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="pulse-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No active sessions</Text>
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
  overallCard: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overallItem: {
    flex: 1,
    alignItems: 'center',
  },
  overallValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  overallLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  overallDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    backgroundColor: '#eef2ff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabTextActive: {
    color: '#6366f1',
  },
  content: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
  },
  statMini: {
    flex: 1,
    alignItems: 'center',
  },
  statMiniValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  statMiniLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
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
  groupRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  groupInfo: {
    marginBottom: 10,
  },
  groupCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  groupMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  groupStats: {
    gap: 8,
  },
  groupStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    width: 60,
  },
  groupProgressWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniProgress: {
    flex: 1,
  },
  groupStatValue: {
    fontSize: 13,
    fontWeight: '700',
    width: 45,
    textAlign: 'right',
  },
  editorRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
  },
  editorInfo: {
    marginLeft: 12,
    flex: 1,
  },
  editorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  editorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  editorMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  editorRight: {
    alignItems: 'flex-end',
  },
  editorPct: {
    fontSize: 18,
    fontWeight: '700',
  },
  editorPctLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  sessionRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  sessionEditor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  sessionTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  sessionMeta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  sessionDetail: {
    fontSize: 12,
    color: '#6b7280',
  },
  sessionProgress: {
    marginTop: 10,
  },
  sessionProgressText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sessionFiles: {
    fontSize: 12,
    color: '#6b7280',
  },
  sessionPct: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0ea5e9',
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
  progressBarBg: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    borderRadius: 4,
  },
  statCard: {
    width: (width - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  statSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  progressSection: {
    marginTop: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  progressPct: {
    fontSize: 11,
    fontWeight: '600',
  },
});
