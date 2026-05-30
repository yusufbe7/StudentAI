import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Video darslar ro'yxati (YouTube). Adminlar bu ro'yxatni kengaytirishi mumkin.
const LESSONS = [
  { id: '1', subject: 'Dasturlash', title: 'JavaScript asoslari', author: 'Yusufbe Dev', yt: 'W6NZfCO5SIk', duration: '48 daq' },
  { id: '2', subject: 'Dasturlash', title: "Ma'lumotlar tuzilmasi", author: 'freeCodeCamp', yt: '8hly31xKli0', duration: '1s 20daq' },
  { id: '3', subject: 'Fizika', title: 'Mexanika asoslari', author: 'Khan Academy', yt: 'ZM8ECpBuQYE', duration: '35 daq' },
  { id: '4', subject: 'Matematika', title: 'Hisob (Calculus)', author: '3Blue1Brown', yt: 'WUvTyaaNkzM', duration: '17 daq' },
  { id: '5', subject: 'English', title: 'Grammar asoslari', author: 'BBC Learning', yt: 'juKd26qkNAw', duration: '25 daq' },
  { id: '6', subject: 'Falsafa', title: 'Falsafaga kirish', author: 'CrashCourse', yt: '1A_CAkYt3GY', duration: '10 daq' },
];

const SUBJECTS = ['Barchasi', ...Array.from(new Set(LESSONS.map((l) => l.subject)))];

export default function VideoLessonsScreen() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState('Barchasi');
  const [playing, setPlaying] = useState(null);

  const data = filter === 'Barchasi' ? LESSONS : LESSONS.filter((l) => l.subject === filter);

  const openVideo = (lesson) => setPlaying(lesson);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Filter chips */}
      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SUBJECTS}
          keyExtractor={(s) => s}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => {
            const active = filter === item;
            return (
              <TouchableOpacity
                onPress={() => setFilter(item)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                ]}
              >
                <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openVideo(item)}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.thumb}>
              <Ionicons name="play-circle" size={44} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{item.subject}</Text>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 }} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4 }}>
                {item.author} • {item.duration}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Video player modal */}
      <Modal visible={!!playing} animationType="slide" onRequestClose={() => setPlaying(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={[styles.playerBar, { backgroundColor: colors.card }]}>
            <TouchableOpacity onPress={() => setPlaying(null)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontWeight: '700', flex: 1, marginLeft: 12 }} numberOfLines={1}>
              {playing?.title}
            </Text>
            <TouchableOpacity onPress={() => playing && Linking.openURL(`https://youtu.be/${playing.yt}`)}>
              <Ionicons name="open-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {playing ? (
            <WebView
              style={{ flex: 1, backgroundColor: '#000' }}
              allowsFullscreenVideo
              javaScriptEnabled
              source={{ uri: `https://www.youtube.com/embed/${playing.yt}?rel=0&autoplay=1` }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1 },
  thumb: { width: 80, height: 60, borderRadius: 12, backgroundColor: '#6c5ce7', alignItems: 'center', justifyContent: 'center' },
  playerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14 },
});
