import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../hooks/useOffline';

export default function OfflineIndicator({ showPending = true }) {
  const { isOnline, pendingCount, syncNow } = useOffline();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <View style={[styles.container, !isOnline && styles.offline]}>
      <View style={styles.content}>
        <Ionicons
          name={isOnline ? 'cloud-upload-outline' : 'cloud-offline-outline'}
          size={16}
          color={isOnline ? '#f59e0b' : '#ef4444'}
        />
        <Text style={[styles.text, !isOnline && styles.offlineText]}>
          {!isOnline
            ? 'You are offline'
            : `${pendingCount} pending ${pendingCount === 1 ? 'action' : 'actions'}`}
        </Text>
      </View>
      {isOnline && pendingCount > 0 && (
        <TouchableOpacity onPress={syncNow} style={styles.syncButton}>
          <Text style={styles.syncText}>Sync Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function OfflineBadge() {
  const { isOnline, isFromCache } = useOffline();

  if (isOnline && !isFromCache) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Ionicons
        name={isOnline ? 'time-outline' : 'cloud-offline-outline'}
        size={12}
        color="#6b7280"
      />
      <Text style={styles.badgeText}>
        {isOnline ? 'Cached' : 'Offline'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  offline: {
    backgroundColor: '#fef2f2',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: '#92400e',
  },
  offlineText: {
    color: '#991b1b',
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f59e0b',
    borderRadius: 6,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
});
