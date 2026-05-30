import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Bildirishnomalar ko'rinishini sozlash
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Ruxsat so'rash va Android kanalini sozlash
export async function registerForNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'StudentAI',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#6c5ce7',
      });
    }
    if (!Device.isDevice) return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const res = await Notifications.requestPermissionsAsync();
      status = res.status;
    }
    return status === 'granted';
  } catch {
    return false;
  }
}

// Lokal bildirishnoma chiqarish
export async function notifyLocal(title, body, seconds = 1) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: seconds > 0 ? { seconds } : null,
    });
  } catch {}
}

export default { registerForNotifications, notifyLocal };
