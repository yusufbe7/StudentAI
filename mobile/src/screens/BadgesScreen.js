import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Loader, Card } from '../components/UI';

export default function BadgesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [earned, setEarned] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.name) return;
    try {
      // Avtomatik tekshirish (yangi badge berish)
      await api.checkBadges(user.name).catch(() => {});
      const res = await api.badges(user.name);
      setEarned(res.badges || []);
      setAll(res.all || []);
    } catch {
      setEarned([]);
      setAll([]);
    } finally {
      setLoading(false);
    }
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

  if (loading) return <Loader text="Yutuqlar yuklanmoqda..." />;

  const earnedIds = new Set(earned.map((b) => b.id || b.title || b.name));
  const list = all.length ? all : earned;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={[styles.summary, { backgroundColor: colors.primary }]}>
        <Text style={{ fontSize: 40 }}>🏅</Text>
        <Text style={styles.summaryNum}>
          {earned.length} / {list.length || earned.length}
        </Text>
        <Text style={styles.summaryLabel}>yutuq qo'lga kiritildi</Text>
      </View>

      <View style={styles.grid}>
        {list.map((b, i) => {
          const got = earnedIds.has(b.id || b.title || b.name);
          return (
            <Card key={i} style={[styles.badge, { opacity: got ? 1 : 0.45, borderColor: got ? colors.gold : colors.border }]}>
              <Text style={{ fontSize: 40, textAlign: 'center' }}>{got ? b.icon || '🏅' : '🔒'}</Text>
              <Text style={[styles.badgeTitle, { color: colors.text }]} numberOfLines={2}>
                {b.title || b.name}
              </Text>
              {b.description ? (
                <Text style={[styles.badgeDesc, { color: colors.textDim }]} numberOfLines={2}>
                  {b.description}
                </Text>
              ) : null}
            </Card>
          );
        })}
      </View>

      {list.length === 0 ? (
        <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 20 }}>
          Hozircha yutuqlar yo'q. Test ishlab, streak yig'ib yutuqlarni oching!
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 18 },
  summaryNum: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 6 },
  summaryLabel: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badge: { width: '48%', alignItems: 'center', paddingVertical: 18 },
  badgeTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  badgeDesc: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});
