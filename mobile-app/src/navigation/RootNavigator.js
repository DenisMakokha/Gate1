import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import NotificationService from '../services/NotificationService';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import IssuesScreen from '../screens/IssuesScreen';
import IssueDetailScreen from '../screens/IssueDetailScreen';
import CreateIssueScreen from '../screens/CreateIssueScreen';
import TeamScreen from '../screens/TeamScreen';
import TeamStatusScreen from '../screens/TeamStatusScreen';
import BackupAnalyticsScreen from '../screens/BackupAnalyticsScreen';
import WorkflowProgressScreen from '../screens/WorkflowProgressScreen';
import ActivityFeedScreen from '../screens/ActivityFeedScreen';
import ShiftScheduleScreen from '../screens/ShiftScheduleScreen';
import DailySummaryScreen from '../screens/DailySummaryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EventsScreen from '../screens/EventsScreen';
import MediaBrowserScreen from '../screens/MediaBrowserScreen';
import SearchPlaybackScreen from '../screens/SearchPlaybackScreen';
import QAOfflineReviewScreen from '../screens/QAOfflineReviewScreen';
import BackupOperationsScreen from '../screens/BackupOperationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { isAdmin, isTeamLead, isGroupLeader, isQA, isQARole, isBackup, isBackupRole, hasOperationalAccess } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{
          tabBarLabel: 'Events',
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Issues"
        component={IssuesScreen}
        options={{
          tabBarLabel: 'Issues',
          tabBarIcon: ({ color }) => (
            <Ionicons name="alert-circle" size={22} color={color} />
          ),
        }}
      />
      {/* Search tab - role-restricted per blueprint */}
      {(hasOperationalAccess() || isGroupLeader() || isQARole()) && (
        <Tab.Screen
          name="Search"
          component={SearchPlaybackScreen}
          options={{
            tabBarLabel: 'Search',
            tabBarIcon: ({ color }) => (
              <Ionicons name="search" size={22} color={color} />
            ),
          }}
        />
      )}
      {/* Backup Operations tab - critical for Backup team */}
      {isBackupRole() && (
        <Tab.Screen
          name="Backups"
          component={BackupOperationsScreen}
          options={{
            tabBarLabel: 'Backups',
            tabBarIcon: ({ color }) => (
              <Ionicons name="cloud-upload" size={22} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const navigationRef = useRef(null);

  useEffect(() => {
    if (user) {
      // Initialize push notifications when user is logged in
      NotificationService.initialize();
      
      // Setup notification listeners
      NotificationService.setupListeners(
        (notification) => {
          // Handle foreground notification
          console.log('Foreground notification:', notification);
        },
        (response) => {
          // Handle notification tap
          if (navigationRef.current) {
            NotificationService.handleNotificationNavigation(
              response.notification,
              navigationRef.current
            );
          }
        }
      );

      return () => {
        NotificationService.removeListeners();
      };
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen
            name="IssueDetail"
            component={IssueDetailScreen}
            options={{ headerShown: true, title: 'Issue Details' }}
          />
          <Stack.Screen
            name="CreateIssue"
            component={CreateIssueScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Team"
            component={TeamScreen}
            options={{ headerShown: true, title: 'Team' }}
          />
          <Stack.Screen
            name="TeamStatus"
            component={TeamStatusScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BackupAnalytics"
            component={BackupAnalyticsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="WorkflowProgress"
            component={WorkflowProgressScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ActivityFeed"
            component={ActivityFeedScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ShiftSchedule"
            component={ShiftScheduleScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="DailySummary"
            component={DailySummaryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="QAOfflineReview"
            component={QAOfflineReviewScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BackupOperations"
            component={BackupOperationsScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
