import React, { useEffect, useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { getSocket } from '../socket/socket';

import HomeScreen from '../screens/HomeScreen';
import SubjectsScreen from '../screens/SubjectsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function Badge({ count, color }) {
  if (!count) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -10,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export default function MainTabs() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!user?.name) return;
    try {
      const res = await api.chatUnread(user.name);
      setUnread(res.total || 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 15000);
    const socket = getSocket();
    const onNew = () => loadUnread();
    if (socket) socket.on('new_message', onNew);
    return () => {
      clearInterval(t);
      if (socket) socket.off('new_message', onNew);
    };
  }, [loadUnread]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Tests: focused ? 'school' : 'school-outline',
            Leaderboard: focused ? 'trophy' : 'trophy-outline',
            Chat: focused ? 'chatbubbles' : 'chatbubbles-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return (
            <View>
              <Ionicons name={icons[route.name]} size={size} color={color} />
              {route.name === 'Chat' ? <Badge count={unread} color={colors.danger} /> : null}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Asosiy', headerShown: false }} />
      <Tab.Screen name="Tests" component={SubjectsScreen} options={{ title: 'Testlar' }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Reyting' }} />
      <Tab.Screen name="Chat" component={ChatListScreen} options={{ title: 'Suhbatlar' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil', headerShown: false }} />
    </Tab.Navigator>
  );
}
