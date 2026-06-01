import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { getSocket } from '../socket/socket';
import { Loader, EmptyState } from '../components/UI';
import Avatar from '../components/Avatar';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'hozir';
  if (s < 3600) return Math.floor(s / 60) + ' daq';
  if (s < 86400) return Math.floor(s / 3600) + ' soat';
  return Math.floor(s / 86400) + ' kun';
}

export default function ChatListScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.name) return;
    try {
      const data = await api.chatList(user.name);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = () => load();
    socket.on('new_message', onNew);
    socket.on('message_sent', onNew);
    return () => {
      socket.off('new_message', onNew);
      socket.off('message_sent', onNew);
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <Loader text="Suhbatlar yuklanmoqda..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={list}
        keyExtractor={(it) => it.cid}
        contentContainerStyle={list.length === 0 ? { flex: 1 } : { padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="💬"
            title="Suhbatlar yo'q"
            subtitle="Reytingdagi foydalanuvchi profiliga kirib, yozishni boshlang"
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ChatRoom', { otherName: item.otherName })}
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <Avatar name={item.otherName} size={52} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.otherName}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>{timeAgo(item.lastTs)}</Text>
              </View>
              <View style={styles.rowTop}>
                <Text style={{ color: colors.textDim, flex: 1 }} numberOfLines={1}>
                  {item.lastFrom?.toLowerCase() === user?.name?.toLowerCase() ? 'Siz: ' : ''}
                  {item.lastMsg}
                </Text>
                {item.unread > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.badgeText}>{item.unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  name: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
