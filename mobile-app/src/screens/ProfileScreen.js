import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

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
      'editor': 'Editor',
      'group-leader': 'Group Leader',
      'qa': 'QA Team',
      'backup': 'Backup Team',
    };
    return roleMap[role] || role;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.rolesContainer}>
          {user?.roles?.map((role, index) => (
            <View key={index} style={styles.roleBadge}>
              <Text style={styles.roleText}>{getRoleDisplay(role)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Responsibilities</Text>
        <View style={styles.responsibilityList}>
          {user?.roles?.includes('group-leader') && (
            <>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Quality control</Text>
              </View>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Team support</Text>
              </View>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Issue escalation</Text>
              </View>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Communication bridge</Text>
              </View>
            </>
          )}
          {user?.roles?.includes('qa') && (
            <>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Review issue-only videos</Text>
              </View>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Confirm fixes</Text>
              </View>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Offline QA review</Text>
              </View>
            </>
          )}
          {user?.roles?.includes('backup') && (
            <>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Verify backups</Text>
              </View>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Disk rotation</Text>
              </View>
              <View style={styles.responsibilityItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.responsibilityText}>Monitor coverage</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Groups</Text>
        {user?.groups?.length > 0 ? (
          user.groups.map((group, index) => (
            <View key={index} style={styles.groupItem}>
              <Text style={styles.groupCode}>{group.code}</Text>
              <Text style={styles.groupName}>{group.name}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No groups assigned</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>System</Text>
          <Text style={styles.infoValue}>Gate 1 System</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Gate 1 System - Leadership Console</Text>
        <Text style={styles.footerText}>© 2024 All Rights Reserved</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  responsibilityList: {
    gap: 12,
  },
  responsibilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 16,
    color: '#16a34a',
    marginRight: 12,
  },
  responsibilityText: {
    fontSize: 14,
    color: '#374151',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  groupCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginRight: 12,
  },
  groupName: {
    fontSize: 14,
    color: '#374151',
  },
  emptyText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  logoutButton: {
    margin: 20,
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});
