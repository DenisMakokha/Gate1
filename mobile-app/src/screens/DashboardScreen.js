import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/api';

const { width } = Dimensions.get('window');

function StatCard({ title, value, subtitle, icon, color, gradient }) {
  const colors = {
    blue: { bg: '#e0f2fe', text: '#0284c7', icon: 'people' },
    red: { bg: '#fef2f2', text: '#dc2626', icon: 'alert-circle' },
    green: { bg: '#dcfce7', text: '#16a34a', icon: 'checkmark-circle' },
    yellow: { bg: '#fefce8', text: '#ca8a04', icon: 'time' },
    teal: { bg: '#ccfbf1', text: '#0d9488', icon: 'film' },
  };

  const colorStyle = colors[color] || colors.blue;

  if (gradient) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statCardGradient}
      >
        <View style={styles.statIconContainer}>
          <Ionicons name={icon || colorStyle.icon} size={24} color="#fff" />
        </View>
        <Text style={styles.statValueWhite}>{value}</Text>
        <Text style={styles.statTitleWhite}>{title}</Text>
        {subtitle && <Text style={styles.statSubtitleWhite}>{subtitle}</Text>}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.statCard, { backgroundColor: colorStyle.bg }]}>
      <View style={[styles.statIconSmall, { backgroundColor: colorStyle.text + '20' }]}>
        <Ionicons name={icon || colorStyle.icon} size={18} color={colorStyle.text} />
      </View>
      <Text style={[styles.statValue, { color: colorStyle.text }]}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function GroupCard({ group, onPress }) {
  return (
    <TouchableOpacity style={styles.groupCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.groupHeader}>
        <View style={styles.groupIconContainer}>
          <Ionicons name="people" size={20} color="#0ea5e9" />
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupCode}>{group.code || group.group_code}</Text>
          <Text style={styles.groupName}>{group.name}</Text>
        </View>
        {group.open_issues > 0 && (
          <View style={styles.issueBadge}>
            <Ionicons name="alert-circle" size={12} color="#dc2626" />
            <Text style={styles.issueBadgeText}>{group.open_issues}</Text>
          </View>
        )}
      </View>
      <View style={styles.groupStatsRow}>
        <View style={styles.groupStatItem}>
          <Ionicons name="person" size={14} color="#9ca3af" />
          <Text style={styles.groupStatText}>{group.member_count || 0} members</Text>
        </View>
        <View style={styles.groupStatItem}>
          <Ionicons name="checkmark-done" size={14} color="#16a34a" />
          <Text style={[styles.groupStatText, { color: '#16a34a' }]}>
            {group.resolved_today || 0} resolved
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user, isAdmin, isTeamLead, isGroupLeader, isQA, isQARole, isBackup, isBackupRole, hasOperationalAccess } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      let response;
      // Admin/Team Lead get admin dashboard
      if (hasOperationalAccess()) {
        response = await dashboardService.getAdmin();
      } else if (isGroupLeader()) {
        response = await dashboardService.getGroupLeader();
      } else if (isQARole()) {
        response = await dashboardService.getQA();
      } else if (isBackupRole()) {
        response = await dashboardService.getBackup();
      } else {
        response = await dashboardService.getGroupLeader();
      }
      setData(response);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasOperationalAccess, isGroupLeader, isQARole, isBackupRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingSpinner}>
          <Ionicons name="sync" size={32} color="#0ea5e9" />
        </View>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0ea5e9" />
      <ScrollView
        style={styles.scrollView}
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
        {/* Premium Header */}
        <LinearGradient
          colors={['#0ea5e9', '#0284c7', '#0369a1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{user?.name?.split(' ')[0]} 👋</Text>
            </View>
            <TouchableOpacity style={styles.notificationBtn}>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.roleText}>
              {user?.roles?.[0]?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </View>
        </LinearGradient>

      {/* Admin/Team Lead Quick Actions */}
      {hasOperationalAccess() && (
        <>
          <TouchableOpacity 
            style={styles.teamStatusCard}
            onPress={() => navigation.navigate('TeamStatus')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.teamStatusGradient}
            >
              <View style={styles.teamStatusLeft}>
                <View style={[styles.teamStatusIconBg, { backgroundColor: '#fff' }]}>
                  <Ionicons name="pulse" size={24} color="#ef4444" />
                </View>
                <View>
                  <Text style={styles.teamStatusTitle}>Live Operations</Text>
                  <Text style={styles.teamStatusSubtitle}>
                    {data?.active_sessions || 0} active sessions • {data?.camera_health?.unhealthy || 0} cameras need attention
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.teamStatusCard}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#0ea5e9', '#0284c7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.teamStatusGradient}
            >
              <View style={styles.teamStatusLeft}>
                <View style={[styles.teamStatusIconBg, { backgroundColor: '#fff' }]}>
                  <Ionicons name="search" size={24} color="#0ea5e9" />
                </View>
                <View>
                  <Text style={styles.teamStatusTitle}>Search & Playback</Text>
                  <Text style={styles.teamStatusSubtitle}>
                    Global search across all indexed media
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* Team Status Quick Action - Only for Group Leaders */}
      {isGroupLeader() && !hasOperationalAccess() && (
        <TouchableOpacity 
          style={styles.teamStatusCard}
          onPress={() => navigation.navigate('TeamStatus')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#10b981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.teamStatusGradient}
          >
            <View style={styles.teamStatusLeft}>
              <View style={styles.teamStatusIconBg}>
                <Ionicons name="people" size={24} color="#10b981" />
              </View>
              <View>
                <Text style={styles.teamStatusTitle}>Team Status</Text>
                <Text style={styles.teamStatusSubtitle}>
                  {data?.team_stats?.online_members || 0} online • {(data?.team_stats?.total_members || 0) - (data?.team_stats?.online_members || 0)} offline
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Workflow Progress Quick Action - For Group Leaders */}
      {isGroupLeader() && (
        <TouchableOpacity 
          style={styles.teamStatusCard}
          onPress={() => navigation.navigate('WorkflowProgress')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#6366f1', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.teamStatusGradient}
          >
            <View style={styles.teamStatusLeft}>
              <View style={[styles.teamStatusIconBg, { backgroundColor: '#fff' }]}>
                <Ionicons name="copy" size={24} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.teamStatusTitle}>Workflow Progress</Text>
                <Text style={styles.teamStatusSubtitle}>
                  Copy & rename tracking
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Backup Operations Quick Actions - Critical for Backup Team */}
      {isBackupRole() && (
        <>
          <TouchableOpacity 
            style={styles.teamStatusCard}
            onPress={() => navigation.navigate('Backups')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10b981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.teamStatusGradient}
            >
              <View style={styles.teamStatusLeft}>
                <View style={[styles.teamStatusIconBg, { backgroundColor: '#fff' }]}>
                  <Ionicons name="cloud-upload" size={24} color="#10b981" />
                </View>
                <View>
                  <Text style={styles.teamStatusTitle}>Backup Operations</Text>
                  <Text style={styles.teamStatusSubtitle}>
                    {data?.pending_backups || 0} pending • Real-time monitoring
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.teamStatusCard}
            onPress={() => navigation.navigate('BackupAnalytics')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#0ea5e9', '#0284c7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.teamStatusGradient}
            >
              <View style={styles.teamStatusLeft}>
                <View style={[styles.teamStatusIconBg, { backgroundColor: '#fff' }]}>
                  <Ionicons name="stats-chart" size={24} color="#0ea5e9" />
                </View>
                <View>
                  <Text style={styles.teamStatusTitle}>Coverage Analytics</Text>
                  <Text style={styles.teamStatusSubtitle}>
                    {data?.backup_percentage || 0}% coverage • By editor & group
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.teamStatusCard}
            onPress={() => navigation.navigate('BackupOperations')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.teamStatusGradient}
            >
              <View style={styles.teamStatusLeft}>
                <View style={[styles.teamStatusIconBg, { backgroundColor: '#fff' }]}>
                  <Ionicons name="hardware-chip" size={24} color="#6366f1" />
                </View>
                <View>
                  <Text style={styles.teamStatusTitle}>Disk Status</Text>
                  <Text style={styles.teamStatusSubtitle}>
                    Monitor disk health & capacity
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Team Members"
          value={data?.team_stats?.total_members || 0}
          subtitle={`${data?.team_stats?.online_members || 0} online`}
          color="blue"
        />
        <StatCard
          title="Media Today"
          value={data?.team_stats?.media_today || 0}
          color="green"
        />
        <StatCard
          title="Open Issues"
          value={data?.groups?.reduce((sum, g) => sum + (g.open_issues || 0), 0) || 0}
          color="red"
        />
        <StatCard
          title="Resolved Today"
          value={data?.groups?.reduce((sum, g) => sum + (g.resolved_today || 0), 0) || 0}
          color="green"
        />
      </View>

      {/* Groups */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Groups</Text>
        {data?.groups?.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
        {(!data?.groups || data.groups.length === 0) && (
          <Text style={styles.emptyText}>No groups assigned</Text>
        )}
      </View>

      {/* Recent Issues */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Issues</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Issues')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        {data?.recent_issues?.slice(0, 5).map((issue) => (
          <TouchableOpacity
            key={issue.id}
            style={styles.issueItem}
            onPress={() => navigation.navigate('IssueDetail', { issueId: issue.issue_id })}
          >
            <View style={styles.issueInfo}>
              <Text style={styles.issueType}>
                {issue.type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
              <Text style={styles.issueReporter}>
                {issue.reporter?.name || 'Unknown'}
              </Text>
            </View>
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
          </TouchableOpacity>
        ))}
        {(!data?.recent_issues || data.recent_issues.length === 0) && (
          <Text style={styles.emptyText}>No open issues</Text>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0ea5e9',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 16,
    gap: 6,
  },
  roleText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginTop: -24,
  },
  statCard: {
    width: '46%',
    margin: '2%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardGradient: {
    width: '46%',
    margin: '2%',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statValueWhite: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  statTitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '500',
  },
  statTitleWhite: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  statSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  statSubtitleWhite: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  teamStatusCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  teamStatusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  teamStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  teamStatusIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamStatusTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  teamStatusSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#0ea5e9',
    fontWeight: '600',
  },
  groupCard: {
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
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  groupName: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  groupStatsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 16,
  },
  groupStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupStatText: {
    fontSize: 13,
    color: '#6b7280',
  },
  issueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  issueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  issueItem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  issueInfo: {
    flex: 1,
  },
  issueType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  issueReporter: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: 24,
    fontSize: 15,
  },
});
