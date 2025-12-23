import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
} from 'react-native';
import { groupService } from '../services/api';
import { useAuth } from '../context/AuthContext';

function MemberCard({ member, onCall, onWhatsApp }) {
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {member.name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.memberDetails}>
          <View style={styles.memberHeader}>
            <Text style={styles.memberName}>{member.name}</Text>
            <View style={[
              styles.statusDot,
              { backgroundColor: member.is_online ? '#22c55e' : '#d1d5db' }
            ]} />
          </View>
          <Text style={styles.memberEmail}>{member.email}</Text>
          <View style={styles.memberStats}>
            <Text style={styles.statText}>{member.media_today || 0} files today</Text>
            {member.open_issues > 0 && (
              <Text style={[styles.statText, { color: '#dc2626' }]}>
                {member.open_issues} issues
              </Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.memberActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onCall(member)}>
          <Text style={styles.actionButtonText}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => onWhatsApp(member)}>
          <Text style={styles.actionButtonText}>💬</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TeamScreen() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const response = await groupService.getAll();
      setGroups(response.data || []);
      if (response.data?.length > 0 && !selectedGroup) {
        setSelectedGroup(response.data[0]);
        loadMembers(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedGroup]);

  const loadMembers = async (groupId) => {
    try {
      const response = await groupService.getMembers(groupId);
      setMembers(response.members || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroups();
  }, [loadGroups]);

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    loadMembers(group.id);
  };

  const handleCall = (member) => {
    if (member.phone) {
      Linking.openURL(`tel:${member.phone}`);
    }
  };

  const handleWhatsApp = (member) => {
    if (member.phone) {
      const phone = member.phone.replace(/[^0-9]/g, '');
      Linking.openURL(`whatsapp://send?phone=${phone}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Team</Text>
      </View>

      {/* Group Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={groups}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tab,
                selectedGroup?.id === item.id && styles.tabActive,
              ]}
              onPress={() => handleSelectGroup(item)}
            >
              <Text style={[
                styles.tabText,
                selectedGroup?.id === item.id && styles.tabTextActive,
              ]}>
                {item.group_code}
              </Text>
              {item.open_issues > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{item.open_issues}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.tabsList}
        />
      </View>

      {/* Group Info */}
      {selectedGroup && (
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{selectedGroup.name}</Text>
          <Text style={styles.groupStats}>
            {members.length} members • {selectedGroup.open_issues || 0} open issues
          </Text>
        </View>
      )}

      {/* Members List */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            onCall={handleCall}
            onWhatsApp={handleWhatsApp}
          />
        )}
        contentContainerStyle={styles.membersList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No members in this group</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  tabsContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabsList: {
    padding: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: 'white',
  },
  tabBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  groupInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  groupStats: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  membersList: {
    padding: 16,
  },
  memberCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  memberDetails: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  memberStats: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 12,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
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
