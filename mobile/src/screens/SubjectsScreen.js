import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';
import { Loader, EmptyState, Pill } from '../components/UI';
import { cacheSet, cacheGet, subjectIcon } from '../utils/storage';

const MODES = [
  { key: 'blitz', label: 'Blitz test', sub: '25 ta tasodifiy savol', icon: 'flash', count: 25 },
  { key: 'full', label: "To'liq test", sub: 'Barcha savollar', icon: 'list', count: null },
  { key: 'turbo', label: 'Turbo yodlash', sub: 'Javoblar ko\'rsatiladi', icon: 'rocket', count: null },
];

export default function SubjectsScreen({ navigation }) {
  const { colors } = useTheme();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [picked, setPicked] = useState(null); // {key,title,questions}

  const toArray = (obj) =>
    Object.entries(obj || {})
      .map(([key, val]) => ({ key, title: val.title || key, questions: val.questions || [] }))
      .filter((s) => s.questions.length > 0)
      .sort((a, b) => a.title.localeCompare(b.title));

  const load = useCallback(async () => {
    try {
      const data = await api.subjects();
      const arr = toArray(data);
      setSubjects(arr);
      setOffline(false);
      await cacheSet('subjects', data);
    } catch (e) {
      // Offline: keshdan o'qish
      const cached = await cacheGet('subjects');
      if (cached) {
        setSubjects(toArray(cached));
        setOffline(true);
      }
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

  const startMode = (mode) => {
    if (!picked) return;
    setPicked(null);
    navigation.navigate('Test', {
      subjectKey: picked.key,
      title: picked.title,
      questions: picked.questions,
      mode: mode.key,
      limit: mode.count,
    });
  };

  if (loading) return <Loader text="Fanlar yuklanmoqda..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {offline ? (
        <View style={[styles.offlineBar, { backgroundColor: colors.warning }]}>
          <Ionicons name="cloud-offline" size={16} color="#000" />
          <Text style={styles.offlineText}>Offline rejim — keshlangan savollar</Text>
        </View>
      ) : null}

      <FlatList
        data={subjects}
        keyExtractor={(it) => it.key}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState icon="📭" title="Fanlar topilmadi" subtitle="Internet aloqasini tekshiring va yangilang" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPicked(item)}
            style={[styles.subjectCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.subjIcon, { backgroundColor: colors.card2 }]}>
              <Text style={{ fontSize: 26 }}>{subjectIcon(item.key, item.title)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subjTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <Pill text={`${item.questions.length} ta savol`} color={colors.primary} bg={colors.primary + '22'} />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
          </TouchableOpacity>
        )}
      />

      {/* Mode picker */}
      <Modal visible={!!picked} transparent animationType="slide" onRequestClose={() => setPicked(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPicked(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
              {picked?.title}
            </Text>
            <Text style={{ color: colors.textDim, marginBottom: 16 }}>Test rejimini tanlang</Text>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeRow, { backgroundColor: colors.card2 }]}
                onPress={() => startMode(m)}
                activeOpacity={0.8}
              >
                <View style={[styles.modeIcon, { backgroundColor: colors.primary + '22' }]}>
                  <Ionicons name={m.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{m.label}</Text>
                  <Text style={{ color: colors.textDim, fontSize: 12 }}>{m.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  offlineBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 6 },
  offlineText: { color: '#000', fontWeight: '600', fontSize: 12 },
  subjectCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1 },
  subjIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  subjTitle: { fontSize: 16, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  modeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 12 },
  modeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
});
