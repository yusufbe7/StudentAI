import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Card } from '../components/UI';
import { notifyLocal } from '../utils/notifications';

export default function TestResultScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const { subjectKey, title, mode, total, correct, wrong, score, durationMin, results } = route.params;
  const [newBadges, setNewBadges] = useState([]);
  const submitted = useRef(false);

  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const isTurbo = mode === 'turbo';

  useEffect(() => {
    if (submitted.current || isTurbo || !user) return;
    submitted.current = true;
    (async () => {
      try {
        await api.submitScore({
          name: user.name,
          username: user.username,
          score,
          totalQ: total,
          wrongCount: wrong,
          subjectKey,
        });
        await api.testSession({
          name: user.name,
          tgUsername: user.username,
          subjectKey,
          subjectName: title,
          score,
          totalQ: total,
          wrongCount: wrong,
          durationMin,
        });
        const st = await api.updateStreak(user.name).catch(() => ({}));
        if (st?.newBadges?.length) setNewBadges(st.newBadges);
        refreshUser().catch(() => {});
        notifyLocal('Test yakunlandi! 🎉', `${title}: ${correct}/${total} to'g'ri (+${score} ball)`);
      } catch (e) {
        // jim ravishda — natija baribir ko'rsatiladi
      }
    })();
  }, []);

  const grade =
    percent >= 90 ? { emoji: '🏆', text: 'Ajoyib!', color: colors.gold }
    : percent >= 70 ? { emoji: '🎉', text: 'Yaxshi!', color: colors.accent }
    : percent >= 50 ? { emoji: '👍', text: 'Yomon emas', color: colors.primary }
    : { emoji: '📚', text: 'Mashq qiling', color: colors.danger };

  const wrongList = (results || []).filter((r) => !r.isCorrect);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 50 }}>
        <View style={styles.hero}>
          <Text style={{ fontSize: 64 }}>{grade.emoji}</Text>
          <Text style={[styles.heroText, { color: grade.color }]}>{grade.text}</Text>
          <Text style={[styles.subjectName, { color: colors.textDim }]}>{title}</Text>
        </View>

        {/* Circle score */}
        <View style={styles.scoreWrap}>
          <View style={[styles.scoreCircle, { borderColor: grade.color }]}>
            <Text style={[styles.scorePercent, { color: colors.text }]}>{percent}%</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>natija</Text>
          </View>
        </View>

        <Card>
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: colors.accent }]}>{correct}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>To'g'ri</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: colors.danger }]}>{wrong}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>Xato</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: colors.gold }]}>{isTurbo ? '—' : `+${score}`}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>Ball</Text>
            </View>
          </View>
          {isTurbo ? (
            <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 12, fontSize: 12 }}>
              Turbo rejimda ball hisoblanmaydi (yodlash rejimi)
            </Text>
          ) : null}
        </Card>

        {/* New badges */}
        {newBadges.length > 0 ? (
          <Card style={{ borderColor: colors.gold }}>
            <Text style={[styles.cardTitle, { color: colors.gold }]}>🏅 Yangi yutuq!</Text>
            {newBadges.map((b, i) => (
              <Text key={i} style={{ color: colors.text, marginTop: 4 }}>
                {b.icon || '🏅'} {b.title || b.name || b}
              </Text>
            ))}
          </Card>
        ) : null}

        {/* Wrong answers review */}
        {wrongList.length > 0 ? (
          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Xatolar tahlili</Text>
            {wrongList.map((r, i) => (
              <View key={i} style={[styles.wrongItem, { borderBottomColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 4 }}>{r.q}</Text>
                {r.selected ? (
                  <Text style={{ color: colors.danger, fontSize: 13 }}>✗ Siz: {r.selected}</Text>
                ) : (
                  <Text style={{ color: colors.danger, fontSize: 13 }}>✗ Javob berilmadi</Text>
                )}
                <Text style={{ color: colors.accent, fontSize: 13 }}>✓ To'g'ri: {r.correct}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Main', { screen: 'Tests' })}
        >
          <Ionicons name="repeat" size={20} color="#fff" />
          <Text style={styles.btnText}>Yana test ishlash</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.card2 }]}
          onPress={() => navigation.navigate('Main', { screen: 'Leaderboard' })}
        >
          <Ionicons name="trophy" size={20} color={colors.gold} />
          <Text style={[styles.btnText, { color: colors.text }]}>Reytingni ko'rish</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 10 },
  heroText: { fontSize: 26, fontWeight: '800', marginTop: 6 },
  subjectName: { fontSize: 14, marginTop: 4 },
  scoreWrap: { alignItems: 'center', marginVertical: 16 },
  scoreCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
  scorePercent: { fontSize: 38, fontWeight: '800' },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statCell: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 26, fontWeight: '800' },
  divider: { width: 1, height: 40 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  wrongItem: { paddingVertical: 10, borderBottomWidth: 1 },
  btn: { flexDirection: 'row', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
