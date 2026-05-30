import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Card, Button, Loader, Pill } from '../components/UI';
import Avatar from '../components/Avatar';

export default function UserProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { name, nickname } = route.params;
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [follow, setFollow] = useState({ followers: 0, following: 0, isFollowing: false });
  const [loading, setLoading] = useState(true);
  const isMe = (name || '').toLowerCase() === (user?.name || '').toLowerCase();

  useLayoutEffect(() => {
    navigation.setOptions({ title: nickname || name });
  }, [navigation, name, nickname]);

  const load = useCallback(async () => {
    await Promise.all([
      api.userStats({ name }).then(setStats).catch(() => setStats(null)),
      api.badges(name).then((r) => setBadges(r.badges || [])).catch(() => {}),
      api
        .followInfo(name)
        .then((r) =>
          setFollow({
            followers: r.followers ?? r.followersCount ?? 0,
            following: r.following ?? r.followingCount ?? 0,
            isFollowing: (r.followersList || r.followers_list || []).some?.(
              (n) => (n || '').toLowerCase() === (user?.name || '').toLowerCase()
            ) || false,
          })
        )
        .catch(() => {}),
    ]);
    setLoading(false);
  }, [name, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    setFollow((f) => ({ ...f, isFollowing: !f.isFollowing, followers: f.followers + (f.isFollowing ? -1 : 1) }));
    try {
      await api.follow(user.name, name);
    } catch {
      load();
    }
  };

  if (loading) return <Loader />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <Avatar name={name} size={90} />
        <Text style={[styles.name, { color: colors.text }]}>{nickname || name}</Text>
        {nickname ? <Text style={{ color: colors.textDim }}>{name}</Text> : null}
        <View style={styles.followRow}>
          <View style={styles.followCell}>
            <Text style={[styles.followNum, { color: colors.text }]}>{follow.followers}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>Obunachilar</Text>
          </View>
          <View style={styles.followCell}>
            <Text style={[styles.followNum, { color: colors.text }]}>{follow.following}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>Obunalar</Text>
          </View>
        </View>
      </View>

      {!isMe ? (
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <Button
            title={follow.isFollowing ? 'Obunani bekor qilish' : 'Obuna bo\'lish'}
            variant={follow.isFollowing ? 'outline' : 'primary'}
            style={{ flex: 1 }}
            onPress={toggleFollow}
          />
          <Button
            title="Xabar yozish"
            variant="accent"
            style={{ flex: 1 }}
            onPress={() => navigation.navigate('ChatRoom', { otherName: name })}
          />
        </View>
      ) : null}

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Statistika</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: colors.gold }]}>{Math.round(stats?.score || 0)}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>Ball</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{stats?.totalTests || 0}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>Testlar</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: colors.accent }]}>{stats?.totalCorrect || 0}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>To'g'ri</Text>
          </View>
        </View>
        {stats?.univ && stats.univ !== '—' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <Pill text={stats.univ} />
            {stats.kurs && stats.kurs !== '—' ? <Pill text={stats.kurs} /> : null}
            {stats.yonalish && stats.yonalish !== '—' ? <Pill text={stats.yonalish} /> : null}
          </View>
        ) : null}
      </Card>

      {badges.length > 0 ? (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Yutuqlar ({badges.length})</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {badges.map((b, i) => (
              <View key={i} style={{ alignItems: 'center', width: 64 }}>
                <Text style={{ fontSize: 32 }}>{b.icon || '🏅'}</Text>
                <Text style={{ color: colors.textDim, fontSize: 10, textAlign: 'center' }} numberOfLines={2}>
                  {b.title || b.name}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 22, fontWeight: '800', marginTop: 10 },
  followRow: { flexDirection: 'row', gap: 36, marginTop: 14 },
  followCell: { alignItems: 'center' },
  followNum: { fontSize: 18, fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  statsRow: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
});
