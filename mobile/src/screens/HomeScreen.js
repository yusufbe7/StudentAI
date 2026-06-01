import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Card } from '../components/UI';
import Avatar from '../components/Avatar';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Tunajiz xayrli';
  if (h < 12) return 'Xayrli tong';
  if (h < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}

function StatBox({ icon, value, label, color }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: colors.card2 }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textDim }]}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={styles.qa} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.qaIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.qaLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState({ current: 0, max: 0 });
  const [online, setOnline] = useState(0);
  const [feed, setFeed] = useState([]);

  const load = useCallback(async () => {
    if (!user) return;
    const tasks = [
      api.userStats({ name: user.name, username: user.username }).then(setStats).catch(() => {}),
      api.streak(user.name).then(setStreak).catch(() => {}),
      api.onlineCount().then((r) => setOnline(r.count || 0)).catch(() => {}),
      api.activityFeed(12).then((r) => setFeed(Array.isArray(r) ? r : [])).catch(() => {}),
    ];
    await Promise.all(tasks);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const score = stats?.score ?? 0;
  const tests = stats?.totalTests ?? 0;
  const correct = stats?.totalCorrect ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greet, { color: colors.textDim }]}>{greeting()},</Text>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {user?.name} 👋
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Avatar name={user?.name} photo={user?.photo} size={48} />
          </TouchableOpacity>
        </View>

        {/* Streak + Online banner */}
        <View style={styles.row}>
          <View style={[styles.banner, { backgroundColor: colors.primary }]}>
            <Text style={styles.bannerEmoji}>🔥</Text>
            <Text style={styles.bannerValue}>{streak.current || 0} kun</Text>
            <Text style={styles.bannerLabel}>Streak (max {streak.max || 0})</Text>
          </View>
          <View style={[styles.banner, { backgroundColor: colors.accent }]}>
            <Text style={styles.bannerEmoji}>🟢</Text>
            <Text style={styles.bannerValue}>{online}</Text>
            <Text style={styles.bannerLabel}>Online</Text>
          </View>
        </View>

        {/* Stats */}
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Statistikangiz</Text>
          <View style={styles.statsRow}>
            <StatBox icon="star" value={Math.round(score)} label="Ball" color={colors.gold} />
            <StatBox icon="document-text" value={tests} label="Testlar" color={colors.primary} />
            <StatBox icon="checkmark-circle" value={correct || 0} label="To'g'ri" color={colors.accent} />
          </View>
        </Card>

        {/* Quick actions */}
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Tezkor amallar</Text>
          <View style={styles.qaRow}>
            <QuickAction icon="school" label="Test" color={colors.primary} onPress={() => navigation.navigate('Tests')} />
            <QuickAction icon="trophy" label="Reyting" color={colors.gold} onPress={() => navigation.navigate('Leaderboard')} />
            <QuickAction icon="ribbon" label="Yutuqlar" color={colors.accent} onPress={() => navigation.navigate('Badges')} />
            <QuickAction icon="calendar" label="Kalendar" color={colors.danger} onPress={() => navigation.navigate('Calendar')} />
          </View>
          <View style={[styles.qaRow, { marginTop: 14 }]}>
            <QuickAction icon="videocam" label="Darslar" color="#0984e3" onPress={() => navigation.navigate('VideoLessons')} />
            <QuickAction icon="diamond" label="VIP" color="#e84393" onPress={() => navigation.navigate('Vip')} />
            <QuickAction icon="chatbubbles" label="Chat" color="#00cec9" onPress={() => navigation.navigate('Chat')} />
            <QuickAction icon="person" label="Profil" color={colors.textDim} onPress={() => navigation.navigate('Profile')} />
          </View>
        </Card>

        {/* Activity feed */}
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>So'nggi faollik</Text>
          {feed.length === 0 ? (
            <Text style={{ color: colors.textDim, paddingVertical: 12 }}>Hozircha faollik yo'q</Text>
          ) : (
            feed.map((f) => (
              <View key={f.id} style={[styles.feedItem, { borderBottomColor: colors.border }]}>
                <Avatar name={f.name} size={36} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={{ color: colors.textDim, fontSize: 12 }} numberOfLines={1}>
                    {f.subjectName} • {f.correctCount}/{f.totalQ} to'g'ri
                  </Text>
                </View>
                <Text style={{ color: colors.gold, fontWeight: '700' }}>+{Math.round(f.score)}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  greet: { fontSize: 14 },
  name: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  banner: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  bannerEmoji: { fontSize: 24 },
  bannerValue: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  bannerLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  statLabel: { fontSize: 12, marginTop: 2 },
  qaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  qa: { alignItems: 'center', width: '23%' },
  qaIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  feedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
});
