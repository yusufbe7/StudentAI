import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  BackHandler,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../config';
import { shuffle } from '../utils/storage';

const TIME_PER_Q = 30; // sekund
const { width } = Dimensions.get('window');

function resolveImage(image) {
  if (!image) return null;
  if (typeof image !== 'string') return null;
  if (image.startsWith('http')) return image;
  if (image.startsWith('data:')) return image;
  // uzun base64 (fayl emas)
  if (image.length > 200 && !image.includes('.')) return 'data:image/png;base64,' + image;
  return `${BASE_URL.replace(/\/$/, '')}/images/${image}`;
}

export default function TestScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { subjectKey, title, questions, mode, limit } = route.params;
  const isTurbo = mode === 'turbo';

  // Savollarni tayyorlash (aralashtirish + variant aralashtirish)
  const prepared = useMemo(() => {
    let list = shuffle(questions);
    if (limit && list.length > limit) list = list.slice(0, limit);
    return list.map((q) => {
      const opts = Array.isArray(q.options) && q.options.length ? q.options : [q.a];
      return { ...q, _options: shuffle(opts) };
    });
  }, [questions, limit]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const startTime = useRef(Date.now());
  const timerRef = useRef(null);

  const total = prepared.length;
  const q = prepared[index];

  const finish = useCallback(
    (finalResults) => {
      clearInterval(timerRef.current);
      const correct = finalResults.filter((r) => r.isCorrect).length;
      const wrong = finalResults.length - correct;
      const durationMin = Math.max(1, Math.round((Date.now() - startTime.current) / 60000));
      navigation.replace('TestResult', {
        subjectKey,
        title,
        mode,
        total: finalResults.length,
        correct,
        wrong,
        score: correct, // 1 ball/to'g'ri javob
        durationMin,
        results: finalResults,
      });
    },
    [navigation, subjectKey, title, mode]
  );

  const goNext = useCallback(
    (resultsSoFar) => {
      if (index + 1 >= total) {
        finish(resultsSoFar);
      } else {
        setIndex((i) => i + 1);
        setSelected(null);
        setAnswered(false);
        setTimeLeft(TIME_PER_Q);
      }
    },
    [index, total, finish]
  );

  const handleAnswer = useCallback(
    (option) => {
      if (answered) return;
      clearInterval(timerRef.current);
      const isCorrect = option === q.a;
      setSelected(option);
      setAnswered(true);
      const newResults = [...results, { q: q.q, selected: option, correct: q.a, isCorrect }];
      setResults(newResults);
      setTimeout(() => goNext(newResults), 850);
    },
    [answered, q, results, goNext]
  );

  // Timer (turbo'da yo'q)
  useEffect(() => {
    if (isTurbo || answered) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Vaqt tugadi → noto'g'ri
          const newResults = [...results, { q: q.q, selected: null, correct: q.a, isCorrect: false }];
          setResults(newResults);
          setAnswered(true);
          setTimeout(() => goNext(newResults), 700);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, answered, isTurbo]);

  // Orqaga tugmasi: tasdiqlash
  useEffect(() => {
    const confirmExit = () => {
      Alert.alert('Testdan chiqish', "Test yakunlanmagan. Rostan chiqasizmi?", [
        { text: 'Yo\'q', style: 'cancel' },
        { text: 'Ha, chiqaman', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', confirmExit);
    return () => sub.remove();
  }, [navigation]);

  if (!q) return null;

  const imgUri = resolveImage(q.image);
  const progress = ((index + (answered ? 1 : 0)) / total) * 100;

  const optionStyle = (opt) => {
    // Turbo: to'g'ri javob doim yashil
    if (isTurbo) {
      if (opt === q.a) return { bg: colors.accent + '22', border: colors.accent, label: colors.accent };
      return { bg: colors.card, border: colors.border, label: colors.text };
    }
    if (!answered) return { bg: colors.card, border: colors.border, label: colors.text };
    if (opt === q.a) return { bg: colors.accent + '22', border: colors.accent, label: colors.accent };
    if (opt === selected) return { bg: colors.danger + '22', border: colors.danger, label: colors.danger };
    return { bg: colors.card, border: colors.border, label: colors.textDim };
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top bar */}
      <View style={[styles.topbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Chiqish', 'Testni tark etasizmi?', [
              { text: 'Yo\'q', style: 'cancel' },
              { text: 'Ha', style: 'destructive', onPress: () => navigation.goBack() },
            ])
          }
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {isTurbo ? (
          <View style={[styles.turboTag, { backgroundColor: colors.primary }]}>
            <Text style={styles.turboTagText}>🚀 TURBO</Text>
          </View>
        ) : (
          <View style={[styles.timer, { backgroundColor: timeLeft <= 5 ? colors.danger : colors.card2 }]}>
            <Text style={{ color: timeLeft <= 5 ? '#fff' : colors.text, fontWeight: '800' }}>{timeLeft}s</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.card2 }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={[styles.counter, { color: colors.textDim }]}>
          Savol {index + 1} / {total}
        </Text>

        {imgUri ? (
          <Image source={{ uri: imgUri }} style={styles.qImage} resizeMode="contain" />
        ) : null}

        <Text style={[styles.question, { color: colors.text }]}>{q.q}</Text>

        {q.hint && isTurbo ? (
          <Text style={[styles.hint, { color: colors.textDim }]}>💡 {q.hint}</Text>
        ) : null}

        <View style={{ marginTop: 18 }}>
          {q._options.map((opt, i) => {
            const s = optionStyle(opt);
            const showCheck = (answered || isTurbo) && opt === q.a;
            const showCross = answered && !isTurbo && opt === selected && opt !== q.a;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.85}
                disabled={answered || isTurbo}
                onPress={() => handleAnswer(opt)}
                style={[styles.option, { backgroundColor: s.bg, borderColor: s.border }]}
              >
                <Text style={[styles.optionText, { color: s.label }]}>{opt}</Text>
                {showCheck ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
                {showCross ? <Ionicons name="close-circle" size={22} color={colors.danger} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {isTurbo ? (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              const newResults = [...results, { q: q.q, selected: q.a, correct: q.a, isCorrect: true }];
              setResults(newResults);
              goNext(newResults);
            }}
          >
            <Text style={styles.nextBtnText}>
              {index + 1 >= total ? 'Yakunlash' : 'Keyingi savol ▶'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  timer: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, minWidth: 48, alignItems: 'center' },
  turboTag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  turboTagText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  progressTrack: { height: 5, width: '100%' },
  progressFill: { height: 5 },
  counter: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  qImage: { width: width - 36, height: 200, borderRadius: 12, marginBottom: 14, backgroundColor: '#0008' },
  question: { fontSize: 20, fontWeight: '700', lineHeight: 28 },
  hint: { fontSize: 14, marginTop: 10, fontStyle: 'italic' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  optionText: { fontSize: 16, flex: 1, marginRight: 8, fontWeight: '500' },
  nextBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
