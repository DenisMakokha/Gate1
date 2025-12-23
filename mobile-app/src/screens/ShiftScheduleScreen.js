import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { shiftService } from '../services/api';

function ShiftCard({ shift, onCheckIn, onCheckOut }) {
  const getStatusColor = () => {
    switch (shift.status) {
      case 'active': return '#10b981';
      case 'completed': return '#6b7280';
      case 'missed': return '#ef4444';
      case 'cancelled': return '#9ca3af';
      default: return '#3b82f6';
    }
  };

  const getStatusLabel = () => {
    switch (shift.status) {
      case 'active': return 'In Progress';
      case 'completed': return 'Completed';
      case 'missed': return 'Missed';
      case 'cancelled': return 'Cancelled';
      default: return 'Scheduled';
    }
  };

  return (
    <View style={styles.shiftCard}>
      <View style={styles.shiftHeader}>
        <View style={styles.shiftTime}>
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text style={styles.shiftTimeText}>
            {shift.start_time} - {shift.end_time}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusLabel()}
          </Text>
        </View>
      </View>

      <View style={styles.shiftInfo}>
        <Text style={styles.shiftDate}>{shift.shift_date}</Text>
        {shift.event_name && (
          <Text style={styles.shiftEvent}>{shift.event_name}</Text>
        )}
        {shift.group_code && (
          <View style={styles.groupTag}>
            <Text style={styles.groupTagText}>{shift.group_code}</Text>
          </View>
        )}
      </View>

      {shift.notes && (
        <Text style={styles.shiftNotes}>{shift.notes}</Text>
      )}

      {/* Action Buttons */}
      {shift.status === 'scheduled' && shift.is_starting_soon && (
        <TouchableOpacity
          style={styles.checkInButton}
          onPress={() => onCheckIn(shift.id)}
        >
          <Ionicons name="log-in-outline" size={18} color="#fff" />
          <Text style={styles.checkInText}>Check In</Text>
        </TouchableOpacity>
      )}

      {shift.status === 'active' && (
        <TouchableOpacity
          style={[styles.checkInButton, { backgroundColor: '#ef4444' }]}
          onPress={() => onCheckOut(shift.id)}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.checkInText}>Check Out</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ShiftScheduleScreen({ navigation }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    try {
      const response = await shiftService.getMyShifts();
      setShifts(response.shifts || []);
    } catch (error) {
      console.error('Failed to load shifts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadShifts();
  }, []);

  const handleCheckIn = async (shiftId) => {
    try {
      await shiftService.checkIn(shiftId);
      Alert.alert('Success', 'Checked in successfully!');
      loadShifts();
    } catch (error) {
      Alert.alert('Error', 'Failed to check in');
    }
  };

  const handleCheckOut = async (shiftId) => {
    Alert.alert(
      'Check Out',
      'Are you sure you want to check out from this shift?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await shiftService.checkOut(shiftId);
              Alert.alert('Success', 'Checked out successfully!');
              loadShifts();
            } catch (error) {
              Alert.alert('Error', 'Failed to check out');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading shifts...</Text>
      </View>
    );
  }

  const activeShift = shifts.find(s => s.status === 'active');
  const upcomingShifts = shifts.filter(s => s.status === 'scheduled');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Shifts</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {activeShift && (
          <View style={styles.activeShiftBanner}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>
              Active shift: {activeShift.start_time} - {activeShift.end_time}
            </Text>
          </View>
        )}
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
        {activeShift && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Shift</Text>
            <ShiftCard
              shift={activeShift}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
            />
          </View>
        )}

        {upcomingShifts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Shifts</Text>
            {upcomingShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
              />
            ))}
          </View>
        )}

        {shifts.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No shifts scheduled</Text>
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
  activeShiftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  activeText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
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
  shiftCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shiftTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shiftTimeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  shiftInfo: {
    gap: 4,
  },
  shiftDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  shiftEvent: {
    fontSize: 13,
    color: '#6b7280',
  },
  groupTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    marginTop: 4,
  },
  groupTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  shiftNotes: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
    gap: 6,
  },
  checkInText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
