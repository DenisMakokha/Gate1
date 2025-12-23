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
import { reportService } from '../services/api';

function StatCard({ title, value, subtitle, icon, color }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function EditorRow({ editor }) {
  return (
    <View style={styles.editorRow}>
      <View style={styles.editorInfo}>
        <Text style={styles.editorName}>{editor.name}</Text>
        <Text style={styles.editorMeta}>
          {editor.sessions_completed} sessions • {editor.files_copied} files
        </Text>
      </View>
      {editor.errors > 0 && (
        <View style={styles.errorBadge}>
          <Text style={styles.errorBadgeText}>{editor.errors} errors</Text>
        </View>
      )}
    </View>
  );
}

export default function DailySummaryScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadSummary();
  }, [selectedDate]);

  const loadSummary = async () => {
    try {
      const response = await reportService.getDailySummary(selectedDate);
      setData(response);
    } catch (error) {
      console.error('Failed to load daily summary:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSummary();
  }, [selectedDate]);

  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  const copyStats = data?.copy_stats || {};
  const mediaStats = data?.media_stats || {};
  const backupStats = data?.backup_stats || {};
  const issueStats = data?.issue_stats || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Summary</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Date Selector */}
        <View style={styles.dateSelector}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {new Date(selectedDate).toLocaleDateString('en', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </Text>
          <TouchableOpacity 
            onPress={() => changeDate(1)} 
            style={styles.dateArrow}
            disabled={selectedDate >= new Date().toISOString().split('T')[0]}
          >
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={selectedDate >= new Date().toISOString().split('T')[0] ? 'rgba(255,255,255,0.3)' : '#fff'} 
            />
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
        {/* Copy Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Copy Progress</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Sessions"
              value={copyStats.sessions || 0}
              subtitle={`${copyStats.completed_sessions || 0} completed`}
              icon="layers"
              color="#3b82f6"
            />
            <StatCard
              title="Files Copied"
              value={copyStats.files_copied?.toLocaleString() || 0}
              subtitle={`of ${copyStats.files_detected?.toLocaleString() || 0}`}
              icon="copy"
              color="#10b981"
            />
          </View>
        </View>

        {/* Media Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Media Quality</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Media"
              value={mediaStats.total?.toLocaleString() || 0}
              subtitle={mediaStats.total_size}
              icon="images"
              color="#8b5cf6"
            />
            <StatCard
              title="Error Rate"
              value={`${mediaStats.error_rate || 0}%`}
              subtitle={`${mediaStats.errors || 0} errors`}
              icon="warning"
              color={mediaStats.error_rate > 5 ? '#ef4444' : '#f59e0b'}
            />
          </View>
        </View>

        {/* Backup Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup Progress</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Backups"
              value={backupStats.total || 0}
              subtitle={backupStats.total_size}
              icon="cloud-upload"
              color="#0ea5e9"
            />
            <StatCard
              title="Verified"
              value={backupStats.verified || 0}
              icon="shield-checkmark"
              color="#10b981"
            />
          </View>
        </View>

        {/* Issue Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Issues</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Reported"
              value={issueStats.reported || 0}
              subtitle={`${issueStats.critical || 0} critical`}
              icon="alert-circle"
              color="#ef4444"
            />
            <StatCard
              title="Resolved"
              value={issueStats.resolved || 0}
              icon="checkmark-circle"
              color="#10b981"
            />
          </View>
        </View>

        {/* Editor Performance */}
        {data?.editor_performance?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Editor Performance</Text>
            <View style={styles.editorList}>
              {data.editor_performance.map((editor, idx) => (
                <EditorRow key={idx} editor={editor} />
              ))}
            </View>
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
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  dateArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
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
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  statTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  editorList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  editorInfo: {
    flex: 1,
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
  errorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
  },
  errorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
});
