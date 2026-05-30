import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Loader, EmptyState } from '../components/UI';
import Avatar from '../components/Avatar';

function Podium({ data, colors, onPress }) {
  const order = [data[1], data[0], data[2]]; // 2-1-3
  const heights = [90, 120, 70];
  const medals = ['🥈', '🥇', '🥉'];
  const medalColors = [colors.silver, colors.gold, colors.bronze];
  return (
    <View style={styles.podium}>
      {order.map((u, i) =>
        u ? (
          <TouchableOpacity key={i} style={styles.podiumCol} onPress={() => onPress(u)} activeOpacity={0.8}>
            <Text style={{ fontSize: 26 }}>{medals[i]}</Text>
            <Avatar name={u.name} size={56} />
            <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
              {u.nickname || u.name}
            </Text>
            <Text style={[styles.podiumScore, { color: medalColors[i] }]}>{Math.round(u.score)}</Text>
            <View style={[styles.podiumBar, { height: heights[i], backgroundColor: medalColors[i] + '33', borderColor: medalColors[i] }]} />
          </TouchableOpacity>
        ) : (
          <View key={i} style={styles.podiumCol} />
        )
      )}
    </View>
  );
}

export default function LeaderboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.leaderboard();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const openUser = (u) => {
    if (!u) return;
    navigation.navigate('UserProfile', { name: u.name, nickname: u.nickname });
  };

  const myRank = list.findIndex((u) => (u.name || '').toLowerCase() === (user?.name || '').toLowerCase());

  if (loading) return <Loader text="Reyting yuklanmoqda..." />;

  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rest}
        keyExtractor={(it, i) => (it.name || '') + i}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          list.length === 0 ? null : (
            <>
              <Podium data={top3} colors={colors} onPress={openUser} />
              {rest.length > 0 ? (
                <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Boshqa ishtirokchilar</Text>
              ) : null}
            </>
          )
        }
        ListEmptyComponent={<EmptyState icon="🏆" title="Reyting bo'sh" subtitle="Birinchi bo'lib test ishlang!" />}
        renderItem={({ item, index }) => {
          const rank = index + 4;
          const isMe = (item.name || '').toLowerCase() === (user?.name || '').toLowerCase();
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openUser(item)}
              style={[
                styles.row,
                {
                  backgroundColor: isMe ? colors.primary + '22' : colors.card,
                  borderColor: isMe ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.rank, { color: colors.textDim }]}>{rank}</Text>
              <Avatar name={item.name} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                  {item.nickname || item.name} {isMe ? '(siz)' : ''}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 12 }} numberOfLines={1}>
                  {item.totalTests || 0} test • {item.univ || 'Universitet kiritilmagan'}
                </Text>
              </View>
              <Text style={[styles.rowScore, { color: colors.gold }]}>{Math.round(item.score)}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* My rank sticky footer */}
      {myRank >= 0 ? (
        <View style={[styles.myRankBar, { backgroundColor: colors.primary }]}>
          <Text style={styles.myRankText}>Sizning o'rningiz: #{myRank + 1}</Text>
          <Text style={styles.myRankScore}>{Math.round(list[myRank]?.score || 0)} ball</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginBottom: 20, marginTop: 8 },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumName: { fontSize: 13, fontWeight: '700', marginTop: 6, maxWidth: 90 },
  podiumScore: { fontSize: 16, fontWeight: '800', marginVertical: 4 },
  podiumBar: { width: '70%', borderRadius: 8, borderWidth: 1, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1 },
  rank: { width: 28, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  rowName: { fontSize: 15, fontWeight: '700' },
  rowScore: { fontSize: 18, fontWeight: '800' },
  myRankBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  myRankText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  myRankScore: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
