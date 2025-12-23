import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  async initialize() {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }

      // Get push token
      if (Device.isDevice) {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: 'your-project-id', // Replace with your Expo project ID
        });
        this.expoPushToken = token.data;
        
        // Store token locally
        await AsyncStorage.setItem('pushToken', this.expoPushToken);
        
        // Send token to backend
        await this.registerToken(this.expoPushToken);
        
        console.log('Push token:', this.expoPushToken);
      } else {
        console.log('Must use physical device for push notifications');
      }

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366f1',
        });

        await Notifications.setNotificationChannelAsync('issues', {
          name: 'Issues',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#ef4444',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return null;
    }
  }

  async registerToken(token) {
    try {
      await api.post('/auth/fcm-token', {
        fcm_token: token,
        device_type: Platform.OS,
      });
      console.log('FCM token registered with backend');
    } catch (error) {
      console.error('Error registering FCM token:', error);
    }
  }

  setupListeners(onNotification, onNotificationResponse) {
    // Listen for incoming notifications while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        if (onNotification) {
          onNotification(notification);
        }
      }
    );

    // Listen for user interaction with notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        if (onNotificationResponse) {
          onNotificationResponse(response);
        }
      }
    );
  }

  removeListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  async scheduleLocalNotification(title, body, data = {}, seconds = 1) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds },
    });
  }

  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }

  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  // Handle notification navigation
  handleNotificationNavigation(notification, navigation) {
    const data = notification?.request?.content?.data || {};
    
    switch (data.type) {
      case 'new_issue':
      case 'critical_issue':
        navigation.navigate('IssueDetail', { issueId: data.issue_id });
        break;
      case 'issue_resolved':
        navigation.navigate('Issues');
        break;
      case 'registration_approved':
        navigation.navigate('Dashboard');
        break;
      case 'new_registration':
        navigation.navigate('Team');
        break;
      default:
        navigation.navigate('Dashboard');
    }
  }
}

export default new NotificationService();
