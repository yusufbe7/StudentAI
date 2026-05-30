import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Card, Button } from '../components/UI';
import { VIP_CARD, VIP_CARD_OWNER } from '../config';

const PERKS = [
  { icon: 'infinite', text: 'Cheksiz test ishlash imkoniyati' },
  { icon: 'rocket', text: 'Turbo yodlash rejimidan to\'liq foydalanish' },
  { icon: 'stats-chart', text: 'Batafsil statistika va tahlil' },
  { icon: 'color-palette', text: 'Maxsus profil belgisi (VIP nishon)' },
  { icon: 'flash', text: 'Reklama va cheklovlarsiz tezkor ishlash' },
];

export default function VipScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [vip, setVip] = useState({ isVip: false, vipEnd: null });
  const [price, setPrice] = useState(10000);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    api.myVip({ username: user?.username, name: user?.name }).then(setVip).catch(() => {});
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const copyCard = async () => {
    await Clipboard.setStringAsync(VIP_CARD);
    Alert.alert('Nusxalandi', 'Karta raqami nusxalandi');
  };

  const requestVip = async () => {
    setSending(true);
    try {
      await api.notifyNonVip(user.name);
      Alert.alert(
        "To'lov ma'lumoti yuborildi",
        "Karta ma'lumotlari Telegram orqali yuborildi. To'lovdan so'ng admin VIP'ni faollashtiradi."
      );
    } catch (e) {
      Alert.alert('Eslatma', "Iltimos, to'lovni amalga oshiring va admin bilan bog'laning");
    } finally {
      setSending(false);
    }
  };

  const vipEndStr = vip.vipEnd ? new Date(vip.vipEnd).toLocaleDateString('uz-UZ') : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <Text style={{ fontSize: 56 }}>💎</Text>
        <Text style={styles.heroTitle}>VIP A'zolik</Text>
        {vip.isVip ? (
          <View style={styles.activeTag}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.activeText}>Faol {vipEndStr ? `• ${vipEndStr} gacha` : ''}</Text>
          </View>
        ) : (
          <Text style={styles.heroSub}>Premium imkoniyatlarni oching</Text>
        )}
      </View>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Nimalar beradi?</Text>
        {PERKS.map((p, i) => (
          <View key={i} style={styles.perkRow}>
            <View style={[styles.perkIcon, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name={p.icon} size={18} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, flex: 1 }}>{p.text}</Text>
          </View>
        ))}
      </Card>

      {!vip.isVip ? (
        <>
          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>To'lov</Text>
            <View style={styles.priceRow}>
              <Text style={{ color: colors.textDim }}>Narx</Text>
              <Text style={[styles.price, { color: colors.gold }]}>
                {price.toLocaleString('uz-UZ')} so'm / oy
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.cardBox, { backgroundColor: colors.card2 }]}
              onPress={copyCard}
              activeOpacity={0.8}
            >
              <View>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>Karta raqami ({VIP_CARD_OWNER})</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 1 }}>
                  {VIP_CARD.replace(/(.{4})/g, '$1 ').trim()}
                </Text>
              </View>
              <Ionicons name="copy-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Button title="To'lov qildim — adminni xabardor qil" loading={sending} onPress={requestVip} style={{ marginTop: 14 }} />
          </Card>

          <Card style={{ borderColor: colors.accent }}>
            <Text style={[styles.cardTitle, { color: colors.accent }]}>🎁 Bepul VIP olish</Text>
            <Text style={{ color: colors.text, lineHeight: 20 }}>
              20 ta do'stingizni taklif qiling va <Text style={{ fontWeight: '800' }}>1 oylik VIP</Text> ni bepul oling!
              Referal havolangizni do'stlaringizga ulashing.
            </Text>
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 8 },
  heroSub: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  activeText: { color: '#fff', fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  perkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  perkIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  price: { fontSize: 18, fontWeight: '800' },
  cardBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14 },
});
