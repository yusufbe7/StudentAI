import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Loader } from '../components/UI';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import MainTabs from './MainTabs';

import TestScreen from '../screens/TestScreen';
import TestResultScreen from '../screens/TestResultScreen';
import SubjectListScreen from '../screens/SubjectListScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import VipScreen from '../screens/VipScreen';
import BadgesScreen from '../screens/BadgesScreen';
import CalendarScreen from '../screens/CalendarScreen';
import VideoLessonsScreen from '../screens/VideoLessonsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  if (loading) return <Loader text="Yuklanmoqda..." />;

  const screenOptions = {
    headerStyle: { backgroundColor: colors.card },
    headerTitleStyle: { color: colors.text },
    headerTintColor: colors.primary,
    contentStyle: { backgroundColor: colors.bg },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Ro'yxatdan o'tish" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="SubjectList" component={SubjectListScreen} options={{ title: 'Fanlar' }} />
            <Stack.Screen name="Test" component={TestScreen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="TestResult" component={TestResultScreen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: 'Chat' }} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profil' }} />
            <Stack.Screen name="Vip" component={VipScreen} options={{ title: 'VIP a\'zolik' }} />
            <Stack.Screen name="Badges" component={BadgesScreen} options={{ title: 'Yutuqlar' }} />
            <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Imtihon kalendari' }} />
            <Stack.Screen name="VideoLessons" component={VideoLessonsScreen} options={{ title: 'Video darslar' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Profilni tahrirlash' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
