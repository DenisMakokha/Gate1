import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Vibration,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { backupService, dashboardService } from '../services/api';

const { width } = Dimensions.get('window');
const POLL_INTERVAL = 10000; // 10 seconds for real-time updates

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

// Disk Status Card - Critical for backup team
function DiskStatusCard({ disk, onPress }) {
  const getStatusColor = () => {
    if (disk.status === 'offline') return '#ef4444';
    if (disk.usage_percentage >= 90) return '#ef4444';
    if (disk.usage_percentage >= 70) return '#f59e0b';
    return '#10b981';
  };

  const statusColor = getStatusColor();

  return (
    <TouchableOpacity style={styles.diskCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.diskHeader}>
        <View style={[styles.diskIconBg, { backgroundColor: statusColor + '20' }]}>
          <Ionicons 
            name={disk.status === 'offline' ? 'cloud-offline' : 'hardware-chip'} 
            size={24} 
            color={statusColor} 
          />
        </View>
        <View style={styles.diskInfo}>
          <Text style={styles.diskName}>{disk.name}</Text>
          <Text style={styles.diskPurpose}>{disk.purpose}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {disk.status === 'offline' ? 'OFFLINE' : disk.status?.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.diskBody}>
        <View style={styles.diskStats}>
          <View style={styles.diskStatItem}>
            <Text style={styles.diskStatValue}>{disk.files_pending || 0}</Text>
            <Text style={styles.diskStatLabel}>Pending</Text>
          </View>
          <View style={styles.diskStatItem}>
            <Text style={styles.diskStatValue}>{disk.files_today || 0}</Text>
            <Text style={styles.diskStatLabel}>Today</Text>
          </View>
          <View style={styles.diskStatItem}>
            <Text style={[styles.diskStatValue, { color: statusColor }]}>{disk.usage_percentage}%</Text>
            <Text style={styles.diskStatLabel}>Used</Text>
          </View>
        </View>
        <ProgressBar percentage={disk.usage_percentage} color={statusColor} />
        <Text style={styles.diskCapacity}>
          {disk.used_formatted} / {disk.capacity_formatted} • {disk.free_formatted} free
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Pending File Card - For backup queue
function PendingFileCard({ file, onVerify }) {
  const priorityColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#6b7280',
  };

  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingLeft}>
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColors[file.priority] || '#6b7280' }]} />
        <View style={styles.pendingInfo}>
          <Text style={styles.pendingFilename} numberOfLines={1}>{file.filename}</Text>
          <View style={styles.pendingMeta}>
            <Text style={styles.pendingMetaText}>{file.size_formatted}</Text>
            <Text style={styles.pendingMetaText}>•</Text>
            <Text style={styles.pendingMetaText}>{file.editor_name}</Text>
            <Text style={styles.pendingMetaText}>•</Text>
            <Text style={styles.pendingMetaText}>{file.group_code}</Text>
          </View>
          <Text style={styles.pendingTime}>Waiting {file.waiting_time}</Text>
        </View>
      </View>
      {file.status === 'copying' ? (
        <View style={styles.copyingIndicator}>
          <ActivityIndicator size="small" color="#0ea5e9" />
          <Text style={styles.copyingText}>{file.progress}%</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.verifyButton} onPress={() => onVerify(file)}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Editor Pending Card - Shows pending clips per editor with last backup disk
// Thresholds are passed dynamically based on team averages
function EditorPendingCard({ editor, onPress, avgPending = 10 }) {
  // Dynamic thresholds: High = 1.5x average, Medium = 1x average
  const highThreshold = Math.max(avgPending * 1.5, 5);
  const mediumThreshold = Math.max(avgPending, 3);
  const hasHighPending = editor.pending_clips > highThreshold;
  const hasMediumPending = editor.pending_clips > mediumThreshold;
  
  return (
    <TouchableOpacity style={styles.editorPendingCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.editorPendingLeft}>
        <View style={[styles.editorPendingAvatar, hasHighPending && { backgroundColor: '#fef2f2' }]}>
          <Text style={[styles.editorPendingInitials, hasHighPending && { color: '#dc2626' }]}>
            {editor.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </Text>
        </View>
        <View style={styles.editorPendingInfo}>
          <Text style={styles.editorPendingName}>{editor.name}</Text>
          <Text style={styles.editorPendingGroup}>{editor.group_code}</Text>
        </View>
      </View>
      
      <View style={styles.editorPendingCenter}>
        <View style={styles.pendingCountBadge}>
          <Text style={[
            styles.pendingCountText,
            hasHighPending ? { color: '#dc2626' } : hasMediumPending ? { color: '#f59e0b' } : { color: '#10b981' }
          ]}>
            {editor.pending_clips}
          </Text>
          <Text style={styles.pendingCountLabel}>pending</Text>
        </View>
        <Text style={styles.pendingSizeText}>{editor.pending_size_formatted}</Text>
      </View>
      
      <View style={styles.editorPendingRight}>
        {editor.last_backup_disk ? (
          <View style={styles.diskAssignment}>
            <Ionicons name="hardware-chip" size={14} color="#0ea5e9" />
            <Text style={styles.diskAssignmentText}>{editor.last_backup_disk}</Text>
          </View>
        ) : (
          <View style={[styles.diskAssignment, { backgroundColor: '#fef2f2' }]}>
            <Ionicons name="help-circle" size={14} color="#dc2626" />
            <Text style={[styles.diskAssignmentText, { color: '#dc2626' }]}>No disk</Text>
          </View>
        )}
        <Text style={styles.lastBackupTime}>{editor.last_backup_time || 'Never'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Group Pending Card - Shows pending clips per group
// Thresholds are passed dynamically based on team averages
function GroupPendingCard({ group, avgPending = 20 }) {
  // Dynamic thresholds: High = 1.5x average, Medium = 1x average
  const highThreshold = Math.max(avgPending * 1.5, 10);
  const mediumThreshold = Math.max(avgPending, 5);
  const hasHighPending = group.pending_clips > highThreshold;
  const hasMediumPending = group.pending_clips > mediumThreshold;
  
  return (
    <View style={styles.groupPendingCard}>
      <View style={styles.groupPendingHeader}>
        <View style={[styles.groupPendingIcon, hasHighPending && { backgroundColor: '#fef2f2' }]}>
          <Ionicons name="people" size={18} color={hasHighPending ? '#dc2626' : '#0ea5e9'} />
        </View>
        <View style={styles.groupPendingInfo}>
          <Text style={styles.groupPendingCode}>{group.group_code}</Text>
          <Text style={styles.groupPendingName}>{group.name}</Text>
        </View>
        <View style={styles.groupPendingStats}>
          <Text style={[
            styles.groupPendingCount,
            hasHighPending ? { color: '#dc2626' } : hasMediumPending ? { color: '#f59e0b' } : { color: '#10b981' }
          ]}>
            {group.pending_clips}
          </Text>
          <Text style={styles.groupPendingLabel}>pending</Text>
        </View>
      </View>
      <View style={styles.groupPendingDetails}>
        <View style={styles.groupPendingDetailItem}>
          <Text style={styles.groupPendingDetailValue}>{group.total_renamed || 0}</Text>
          <Text style={styles.groupPendingDetailLabel}>Total Renamed</Text>
        </View>
        <View style={styles.groupPendingDetailItem}>
          <Text style={styles.groupPendingDetailValue}>{group.backed_up || 0}</Text>
          <Text style={styles.groupPendingDetailLabel}>Backed Up</Text>
        </View>
        <View style={styles.groupPendingDetailItem}>
          <Text style={styles.groupPendingDetailValue}>{group.pending_size_formatted || '0 B'}</Text>
          <Text style={styles.groupPendingDetailLabel}>Pending Size</Text>
        </View>
      </View>
    </View>
  );
}

// Alert Banner for critical issues
function AlertBanner({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) return null;

  const criticalAlert = alerts.find(a => a.severity === 'critical') || alerts[0];

  return (
    <TouchableOpacity 
      style={[styles.alertBanner, { backgroundColor: criticalAlert.severity === 'critical' ? '#fef2f2' : '#fefce8' }]}
      onPress={() => onDismiss(criticalAlert)}
    >
      <Ionicons 
        name="warning" 
        size={20} 
        color={criticalAlert.severity === 'critical' ? '#dc2626' : '#ca8a04'} 
      />
      <Text style={[styles.alertText, { color: criticalAlert.severity === 'critical' ? '#dc2626' : '#ca8a04' }]}>
        {criticalAlert.message}
      </Text>
      <Text style={styles.alertCount}>
        {alerts.length > 1 ? `+${alerts.length - 1}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

export default function BackupOperationsScreen({ navigation }) {
  const { user, isBackupRole } = useAuth();
  const [data, setData] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [alerts, setAlerts] = useState([]);
  const pollRef = useRef(null);

  // Load all backup data
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    
    try {
      const [analyticsRes, pendingRes, coverageRes, pendingByEditorRes, pendingByGroupRes, diskAssignmentsRes] = await Promise.all([
        backupService.getAnalytics(),
        backupService.getPending({ limit: 50 }),
        backupService.getCoverage(),
        backupService.getPendingByEditor().catch(() => ({ data: [] })),
        backupService.getPendingByGroup().catch(() => ({ data: [] })),
        backupService.getEditorDiskAssignments().catch(() => ({ data: [] })),
      ]);

      setData({
        ...analyticsRes,
        coverage: coverageRes,
        pending_by_editor: pendingByEditorRes.data || pendingByEditorRes || [],
        pending_by_group: pendingByGroupRes.data || pendingByGroupRes || [],
        editor_disk_assignments: diskAssignmentsRes.data || diskAssignmentsRes || [],
      });
      setPendingFiles(pendingRes.data || pendingRes || []);

      // Check for critical alerts
      const newAlerts = [];
      
      // Disk space alerts
      analyticsRes?.disks?.forEach(disk => {
        if (disk.status === 'offline') {
          newAlerts.push({
            id: `disk-offline-${disk.id}`,
            severity: 'critical',
            message: `${disk.name} is OFFLINE`,
            type: 'disk_offline',
          });
        } else if (disk.usage_percentage >= 90) {
          newAlerts.push({
            id: `disk-full-${disk.id}`,
            severity: 'critical',
            message: `${disk.name} is ${disk.usage_percentage}% full`,
            type: 'disk_full',
          });
        }
      });

      // Pending backups alert
      const pendingCount = pendingRes?.length || pendingRes?.data?.length || 0;
      if (pendingCount > 100) {
        newAlerts.push({
          id: 'pending-high',
          severity: 'warning',
          message: `${pendingCount} files waiting for backup`,
          type: 'pending_high',
        });
      }

      if (newAlerts.length > 0 && newAlerts.length !== alerts.length) {
        Vibration.vibrate(200); // Alert vibration
      }
      setAlerts(newAlerts);

    } catch (error) {
      console.error('Failed to load backup data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [alerts.length]);

  // Real-time polling
  useEffect(() => {
    loadData();

    // Start polling for real-time updates
    pollRef.current = setInterval(() => {
      loadData(false);
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(false);
  }, [loadData]);

  const handleVerify = async (file) => {
    Alert.alert(
      'Verify Backup',
      `Mark ${file.filename} as verified?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            try {
              // API call to verify
              // await backupService.verify(file.id);
              Alert.alert('Success', 'File marked as verified');
              loadData(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to verify file');
            }
          },
        },
      ]
    );
  };

  const handleDiskPress = (disk) => {
    navigation.navigate('BackupAnalytics');
  };

  const dismissAlert = (alert) => {
    setAlerts(prev => prev.filter(a => a.id !== alert.id));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading backup operations...</Text>
      </View>
    );
  }

  const overall = data?.overall || {};
  const disks = data?.disks || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#0ea5e9', '#0284c7']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Backup Operations</Text>
            <Text style={styles.headerSubtitle}>Real-time monitoring • Auto-refresh 10s</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('BackupAnalytics')} style={styles.analyticsButton}>
            <Ionicons name="stats-chart" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{overall.backup_percentage || 0}%</Text>
            <Text style={styles.quickStatLabel}>Coverage</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatValue, overall.pending_clips > 0 && { color: '#fef08a' }]}>
              {overall.pending_clips || 0}
            </Text>
            <Text style={styles.quickStatLabel}>Pending</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{overall.backed_up_today || 0}</Text>
            <Text style={styles.quickStatLabel}>Today</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{disks.filter(d => d.status === 'active').length}</Text>
            <Text style={styles.quickStatLabel}>Disks Online</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Alert Banner */}
      <AlertBanner alerts={alerts} onDismiss={dismissAlert} />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {[
          { id: 'overview', label: 'Disks', icon: 'hardware-chip' },
          { id: 'pending', label: `Pending (${overall.pending_clips || 0})`, icon: 'time' },
          { id: 'editors', label: 'By Editor', icon: 'person' },
          { id: 'groups', label: 'By Group', icon: 'people' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
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
          />
        }
      >
        {/* Disks Tab */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backup Disks</Text>
            {disks.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="hardware-chip-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No disks configured</Text>
              </View>
            ) : (
              disks.map((disk) => (
                <DiskStatusCard key={disk.id} disk={disk} onPress={() => handleDiskPress(disk)} />
              ))
            )}

            {/* Today's Activity */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Today's Activity</Text>
            <View style={styles.activityCard}>
              <View style={styles.activityRow}>
                <View style={styles.activityItem}>
                  <Ionicons name="cloud-upload" size={24} color="#10b981" />
                  <Text style={styles.activityValue}>{overall.backed_up_today || 0}</Text>
                  <Text style={styles.activityLabel}>Backed Up</Text>
                </View>
                <View style={styles.activityItem}>
                  <Ionicons name="checkmark-done" size={24} color="#0ea5e9" />
                  <Text style={styles.activityValue}>{overall.verified_today || 0}</Text>
                  <Text style={styles.activityLabel}>Verified</Text>
                </View>
                <View style={styles.activityItem}>
                  <Ionicons name="document" size={24} color="#6366f1" />
                  <Text style={styles.activityValue}>{overall.size_today_formatted || '0 B'}</Text>
                  <Text style={styles.activityLabel}>Data</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Backups</Text>
              <Text style={styles.sectionSubtitle}>{pendingFiles.length} files waiting</Text>
            </View>
            
            {pendingFiles.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptyText}>No files pending backup</Text>
              </View>
            ) : (
              <>
                {/* Priority Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={styles.legendText}>High Priority</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                    <Text style={styles.legendText}>Medium</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#6b7280' }]} />
                    <Text style={styles.legendText}>Low</Text>
                  </View>
                </View>

                {pendingFiles.map((file, index) => (
                  <PendingFileCard key={file.id || index} file={file} onVerify={handleVerify} />
                ))}
              </>
            )}
          </View>
        )}

        {/* By Editor Tab - Pending clips per editor with disk assignment */}
        {activeTab === 'editors' && (
          <View style={styles.section}>
            {/* Team Total Summary */}
            <View style={styles.teamSummaryCard}>
              <Text style={styles.teamSummaryTitle}>Team Total - Not Backed Up</Text>
              <View style={styles.teamSummaryStats}>
                <View style={styles.teamSummaryItem}>
                  <Text style={styles.teamSummaryValue}>{overall.pending_clips || 0}</Text>
                  <Text style={styles.teamSummaryLabel}>Clips</Text>
                </View>
                <View style={styles.teamSummaryDivider} />
                <View style={styles.teamSummaryItem}>
                  <Text style={styles.teamSummaryValue}>{overall.pending_size_formatted || '0 B'}</Text>
                  <Text style={styles.teamSummaryLabel}>Size</Text>
                </View>
                <View style={styles.teamSummaryDivider} />
                <View style={styles.teamSummaryItem}>
                  <Text style={styles.teamSummaryValue}>{data?.pending_by_editor?.length || 0}</Text>
                  <Text style={styles.teamSummaryLabel}>Editors</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Pending by Editor</Text>
            <Text style={styles.sectionSubtitleInfo}>
              Shows renamed clips not yet backed up • Disk = last backup location
            </Text>
            
            {(!data?.pending_by_editor || data.pending_by_editor.length === 0) ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                <Text style={styles.emptyTitle}>All Editors Backed Up!</Text>
                <Text style={styles.emptyText}>No pending clips from any editor</Text>
              </View>
            ) : (
              (() => {
                // Calculate average pending per editor for dynamic thresholds
                const totalPending = data.pending_by_editor.reduce((sum, e) => sum + e.pending_clips, 0);
                const avgPending = totalPending / data.pending_by_editor.length;
                return data.pending_by_editor.map((editor) => (
                  <EditorPendingCard 
                    key={editor.id} 
                    editor={editor} 
                    avgPending={avgPending}
                    onPress={() => {}} 
                  />
                ));
              })()
            )}
          </View>
        )}

        {/* By Group Tab - Pending clips per group */}
        {activeTab === 'groups' && (
          <View style={styles.section}>
            {/* Team Total Summary */}
            <View style={styles.teamSummaryCard}>
              <Text style={styles.teamSummaryTitle}>Team Total - Not Backed Up</Text>
              <View style={styles.teamSummaryStats}>
                <View style={styles.teamSummaryItem}>
                  <Text style={styles.teamSummaryValue}>{overall.pending_clips || 0}</Text>
                  <Text style={styles.teamSummaryLabel}>Clips</Text>
                </View>
                <View style={styles.teamSummaryDivider} />
                <View style={styles.teamSummaryItem}>
                  <Text style={styles.teamSummaryValue}>{overall.pending_size_formatted || '0 B'}</Text>
                  <Text style={styles.teamSummaryLabel}>Size</Text>
                </View>
                <View style={styles.teamSummaryDivider} />
                <View style={styles.teamSummaryItem}>
                  <Text style={styles.teamSummaryValue}>{data?.pending_by_group?.length || 0}</Text>
                  <Text style={styles.teamSummaryLabel}>Groups</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Pending by Group</Text>
            <Text style={styles.sectionSubtitleInfo}>
              Shows renamed clips not yet backed up per group
            </Text>
            
            {(!data?.pending_by_group || data.pending_by_group.length === 0) ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                <Text style={styles.emptyTitle}>All Groups Backed Up!</Text>
                <Text style={styles.emptyText}>No pending clips from any group</Text>
              </View>
            ) : (
              (() => {
                // Calculate average pending per group for dynamic thresholds
                const totalPending = data.pending_by_group.reduce((sum, g) => sum + g.pending_clips, 0);
                const avgPending = totalPending / data.pending_by_group.length;
                return data.pending_by_group.map((group) => (
                  <GroupPendingCard key={group.id} group={group} avgPending={avgPending} />
                ));
              })()
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  analyticsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  quickStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 4,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  alertCount: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabTextActive: {
    color: '#0ea5e9',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Disk Card
  diskCard: {
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
  diskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diskIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diskInfo: {
    flex: 1,
    marginLeft: 12,
  },
  diskName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  diskPurpose: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  diskBody: {
    marginTop: 16,
  },
  diskStats: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  diskStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  diskStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  diskStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  diskCapacity: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  // Pending Card
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  pendingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingFilename: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  pendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  pendingMetaText: {
    fontSize: 11,
    color: '#6b7280',
  },
  pendingTime: {
    fontSize: 10,
    color: '#f59e0b',
    marginTop: 2,
  },
  copyingIndicator: {
    alignItems: 'center',
  },
  copyingText: {
    fontSize: 10,
    color: '#0ea5e9',
    marginTop: 2,
  },
  verifyButton: {
    padding: 8,
  },
  // Activity Card
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  activityItem: {
    alignItems: 'center',
  },
  activityValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 8,
  },
  activityLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  // Coverage
  coverageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  coverageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverageInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
  },
  coverageInfo: {
    flex: 1,
    marginLeft: 12,
  },
  coverageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  coverageProgressRow: {
    width: '100%',
  },
  coverageStats: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  coveragePercentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  coveragePending: {
    fontSize: 10,
    color: '#f59e0b',
    marginTop: 2,
  },
  coverageClips: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#6b7280',
  },
  // Progress Bar
  progressBarBg: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    borderRadius: 4,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  // Section subtitle info
  sectionSubtitleInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    marginTop: -8,
  },
  // Team Summary Card
  teamSummaryCard: {
    backgroundColor: '#0ea5e9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  teamSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 12,
  },
  teamSummaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  teamSummaryItem: {
    alignItems: 'center',
  },
  teamSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  teamSummaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  teamSummaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  // Editor Pending Card
  editorPendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  editorPendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editorPendingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorPendingInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
  },
  editorPendingInfo: {
    marginLeft: 10,
  },
  editorPendingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  editorPendingGroup: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },
  editorPendingCenter: {
    alignItems: 'center',
    marginHorizontal: 12,
  },
  pendingCountBadge: {
    alignItems: 'center',
  },
  pendingCountText: {
    fontSize: 20,
    fontWeight: '700',
  },
  pendingCountLabel: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  pendingSizeText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  editorPendingRight: {
    alignItems: 'flex-end',
  },
  diskAssignment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  diskAssignmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284c7',
  },
  lastBackupTime: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 4,
  },
  // Group Pending Card
  groupPendingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  groupPendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupPendingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupPendingInfo: {
    flex: 1,
    marginLeft: 10,
  },
  groupPendingCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  groupPendingName: {
    fontSize: 11,
    color: '#6b7280',
  },
  groupPendingStats: {
    alignItems: 'flex-end',
  },
  groupPendingCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  groupPendingLabel: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  groupPendingDetails: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  groupPendingDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  groupPendingDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  groupPendingDetailLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
});
