import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Card, Button, Input, EmptyState } from '../components/UI';
import { notifyLocal } from '../utils/notifications';

const KEY = '@studentai/exam_events';

function parseDate(str) {
  // DD.MM.YYYY
  const m = (str || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], 9, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function daysLeft(ts) {
  const diff = Math.ceil((ts - Date.now()) / 86400000);
  return diff;
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const [events, setEvents] = useState([]);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.sort((a, b) => a.ts - b.ts);
      setEvents(arr);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (arr) => {
    arr.sort((a, b) => a.ts - b.ts);
    setEvents(arr);
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  };

  const add = async () => {
    if (title.trim().length < 2) {
      Alert.alert('Xatolik', 'Imtihon nomini kiriting');
      return;
    }
    const d = parseDate(date);
    if (!d) {
      Alert.alert('Sana xato', 'Sanani DD.MM.YYYY ko\'rinishida kiriting (masalan: 15.06.2026)');
      return;
    }
    const ev = { id: Date.now().toString(), title: title.trim(), ts: d.getTime() };
    await save([...events, ev]);

    // Imtihondan 1 kun oldin eslatma
    const remindAt = Math.floor((d.getTime() - 86400000 - Date.now()) / 1000);
    if (remindAt > 0) {
      notifyLocal('📅 Imtihon eslatmasi', `Ertaga: ${ev.title}`, remindAt);
    }
    setTitle('');
    setDate('');
    setModal(false);
  };

  const remove = (id) => {
    Alert.alert('O\'chirish', 'Bu imtihon eslatmasini o\'chirasizmi?', [
      { text: 'Yo\'q', style: 'cancel' },
      { text: 'O\'chirish', style: 'destructive', onPress: () => save(events.filter((e) => e.id !== id)) },
    ]);
  };

  const renderItem = ({ item }) => {
    const dl = daysLeft(item.ts);
    const past = dl < 0;
    const soon = dl >= 0 && dl <= 3;
    const color = past ? colors.textDim : soon ? colors.danger : colors.primary;
    return (
      <Card style={styles.eventCard}>
        <View style={[styles.dateBox, { backgroundColor: color + '22' }]}>
          <Text style={[styles.dateDay, { color }]}>{new Date(item.ts).getDate()}</Text>
          <Text style={[styles.dateMonth, { color }]}>
            {new Date(item.ts).toLocaleString('uz-UZ', { month: 'short' })}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={{ color, fontSize: 13, marginTop: 4 }}>
            {past ? 'O\'tib ketgan' : dl === 0 ? 'Bugun!' : `${dl} kun qoldi`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => remove(item.id)} style={{ padding: 6 }}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={events}
        keyExtractor={(it) => it.id}
        contentContainerStyle={events.length === 0 ? { flex: 1 } : { padding: 16, paddingBottom: 90 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            icon="📅"
            title="Imtihon sanalari yo'q"
            subtitle="Imtihon sanalarini qo'shing — bir kun oldin eslatma keladi"
          />
        }
      />
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setModal(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Yangi imtihon</Text>
            <Input label="Imtihon nomi" placeholder="Masalan: Fizika 2 yakuniy" value={title} onChangeText={setTitle} />
            <Input
              label="Sana (DD.MM.YYYY)"
              placeholder="15.06.2026"
              value={date}
              onChangeText={setDate}
              keyboardType="numbers-and-punctuation"
            />
            <Button title="Qo'shish" onPress={add} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  eventCard: { flexDirection: 'row', alignItems: 'center' },
  dateBox: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 22, fontWeight: '800' },
  dateMonth: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
});
