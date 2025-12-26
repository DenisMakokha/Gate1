import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const getRoleDisplay = (role) => {
    const roleMap = {
      'admin': 'Administrator',
      'team-lead': 'Team Lead',
      'group-leader': 'Group Leader',
      'qa-lead': 'QA Lead',
      'qa': 'QA Team',
      'backup-lead': 'Backup Lead',
      'backup': 'Backup Team',
      'editor': 'Editor',
    };
    return roleMap[role] || role;
  };

  const getRoleIcon = (role) => {
    const iconMap = {
      'admin': 'shield-checkmark',
      'team-lead': 'people-circle',
      'group-leader': 'people',
      'qa-lead': 'eye',
      'qa': 'checkmark-circle',
      'backup-lead': 'cloud',
      'backup': 'cloud-upload',
      'editor': 'create',
    };
    return iconMap[role] || 'person';
  };

  const getRoleColor = (role) => {
    const colorMap = {
      'admin': '#ef4444',
      'team-lead': '#f59e0b',
      'group-leader': '#10b981',
      'qa-lead': '#8b5cf6',
      'qa': '#7c3aed',
      'backup-lead': '#0ea5e9',
      'backup': '#06b6d4',
      'editor': '#6366f1',
    };
    return colorMap[role] || '#6b7280';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Modern Gradient Header */}
        <LinearGradient
          colors={['#0ea5e9', '#0284c7', '#0369a1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </Text>
            </LinearGradient>
            <View style={styles.onlineIndicator} />
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          
          {/* Role Badges with Icons */}
          <View style={styles.rolesContainer}>
            {user?.roles?.map((role, index) => (
              <View key={index} style={[styles.roleBadge, { backgroundColor: getRoleColor(role) + '30' }]}>
                <Ionicons name={getRoleIcon(role)} size={14} color="#fff" />
                <Text style={styles.roleText}>{getRoleDisplay(role)}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

      <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="briefcase" size={20} color="#0ea5e9" />
            <Text style={styles.sectionTitle}>Responsibilities</Text>
          </View>
          <View style={styles.responsibilityList}>
            {(user?.roles?.includes('admin') || user?.roles?.includes('team-lead')) && (
              <>
                <ResponsibilityItem icon="shield-checkmark" text="Full system oversight" />
                <ResponsibilityItem icon="stats-chart" text="Live operations monitoring" />
                <ResponsibilityItem icon="search" text="Global search & playback" />
                <ResponsibilityItem icon="download" text="Download capability" />
              </>
            )}
            {user?.roles?.includes('group-leader') && (
              <>
                <ResponsibilityItem icon="checkmark-done" text="Quality control" />
                <ResponsibilityItem icon="people" text="Team support" />
                <ResponsibilityItem icon="arrow-up-circle" text="Issue escalation" />
                <ResponsibilityItem icon="chatbubbles" text="Communication bridge" />
              </>
            )}
            {(user?.roles?.includes('qa') || user?.roles?.includes('qa-lead')) && (
              <>
                <ResponsibilityItem icon="videocam" text="Review issue-only videos" />
                <ResponsibilityItem icon="checkmark-circle" text="Confirm fixes" />
                <ResponsibilityItem icon="cloud-offline" text="Offline QA review" />
              </>
            )}
            {(user?.roles?.includes('backup') || user?.roles?.includes('backup-lead')) && (
              <>
                <ResponsibilityItem icon="cloud-done" text="Verify backups" />
                <ResponsibilityItem icon="hardware-chip" text="Disk rotation" />
                <ResponsibilityItem icon="pie-chart" text="Monitor coverage" />
              </>
            )}
            {user?.roles?.includes('editor') && (
              <>
                <ResponsibilityItem icon="create" text="Video editing" />
                <ResponsibilityItem icon="folder" text="File renaming" />
                <ResponsibilityItem icon="sync" text="Sync with system" />
              </>
            )}
          </View>
        </View>

      <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color="#0ea5e9" />
            <Text style={styles.sectionTitle}>Groups</Text>
          </View>
          {user?.groups?.length > 0 ? (
            user.groups.map((group, index) => (
              <View key={index} style={styles.groupItem}>
                <View style={styles.groupIcon}>
                  <Ionicons name="layers" size={18} color="#0ea5e9" />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupCode}>{group.code}</Text>
                  <Text style={styles.groupName}>{group.name}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="layers-outline" size={32} color="#d1d5db" />
              <Text style={styles.emptyText}>No groups assigned</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color="#0ea5e9" />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="notifications" size={22} color="#0ea5e9" />
              </View>
              <Text style={styles.actionText}>Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="settings" size={22} color="#10b981" />
              </View>
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="help-circle" size={22} color="#f59e0b" />
              </View>
              <Text style={styles.actionText}>Help</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="document-text" size={22} color="#8b5cf6" />
              </View>
              <Text style={styles.actionText}>Docs</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color="#0ea5e9" />
            <Text style={styles.sectionTitle}>App Info</Text>
          </View>
          <View style={styles.infoCard}>
            <InfoRow icon="phone-portrait" label="Version" value="1.0.0" />
            <InfoRow icon="server" label="System" value="Gate 1 System" />
            <InfoRow icon="wifi" label="Status" value="Connected" valueColor="#10b981" />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#dc2626" />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Gate 1 System - Leadership Console</Text>
          <Text style={styles.footerText}>Powered by Nelium Systems</Text>
          <Text style={styles.footerText}>© 2025 All Rights Reserved</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Responsibility Item Component
function ResponsibilityItem({ icon, text }) {
  return (
    <View style={styles.responsibilityItem}>
      <View style={styles.responsibilityIcon}>
        <Ionicons name={icon} size={16} color="#10b981" />
      </View>
      <Text style={styles.responsibilityText}>{text}</Text>
    </View>
  );
}

// Info Row Component
function InfoRow({ icon, label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={18} color="#6b7280" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 28,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    borderWidth: 3,
    borderColor: '#0284c7',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  roleText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  responsibilityList: {
    gap: 10,
  },
  responsibilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  responsibilityIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  responsibilityText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  groupName: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 8,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (width - 64 - 12) / 2,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  infoCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});
