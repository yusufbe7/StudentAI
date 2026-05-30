import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Card } from '../components/UI';
import Avatar from '../components/Avatar';

function Row({ icon, label, value, onPress, color, right, danger }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: (color || colors.primary) + '22' }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : color || colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
      {right || (
        <>
          {value ? <Text style={{ color: colors.textDim, marginRight: 6 }}>{value}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textDim} /> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { colors, pref, setTheme, isDark } = useTheme();
  const { user, logout, refreshUser, biometricEnabled, setBiometric, getSavedCred } = useAuth();
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState({ current: 0, max: 0 });
  const [badgeCount, setBadgeCount] = useState(0);
  const [vip, setVip] = useState({ isVip: false, vipEnd: null });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      api.userStats({ name: user.name, username: user.username }).then(setStats).catch(() => {}),
      api.streak(user.name).then(setStreak).catch(() => {}),
      api.badges(user.name).then((r) => setBadgeCount(r.badges?.length || 0)).catch(() => {}),
      api.myVip({ username: user.username, name: user.name }).then(setVip).catch(() => {}),
    ]);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshUser()]);
    setRefreshing(false);
  };

  const toggleBiometric = async (val) => {
    if (val) {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const cred = await getSavedCred();
      if (!hw || !enrolled) {
        Alert.alert('Mavjud emas', 'Qurilmangizda biometrik (Face ID / barmoq izi) sozlanmagan');
        return;
      }
      if (!cred) {
        Alert.alert('Eslatma', "Biometrik kirish uchun avval bir marta parol bilan kiring");
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Tasdiqlang' });
      if (res.success) setBiometric(true);
    } else {
      setBiometric(false);
    }
  };

  const cycleTheme = () => {
    const next = pref === 'system' ? 'light' : pref === 'light' ? 'dark' : 'system';
    setTheme(next);
  };

  const doLogout = () => {
    Alert.alert('Chiqish', 'Akkountdan chiqasizmi?', [
      { text: 'Yo\'q', style: 'cancel' },
      { text: 'Chiqish', style: 'destructive', onPress: logout },
    ]);
  };

  const vipEndStr = vip.vipEnd ? new Date(vip.vipEnd).toLocaleDateString('uz-UZ') : null;
  const themeLabel = pref === 'system' ? 'Tizim' : pref === 'light' ? 'Yorug\'' : 'Qorong\'u';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Profile header */}
        <View style={styles.header}>
          <Avatar name={user?.name} photo={user?.photo} size={88} />
          <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
          <Text style={{ color: colors.textDim }}>@{user?.username}</Text>
          {vip.isVip ? (
            <View style={[styles.vipBadge, { backgroundColor: colors.gold }]}>
              <Ionicons name="diamond" size={14} color="#000" />
              <Text style={styles.vipText}>VIP {vipEndStr ? `• ${vipEndStr} gacha` : ''}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        <Card>
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: colors.gold }]}>{Math.round(stats?.score || 0)}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>Ball</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{stats?.totalTests || 0}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>Testlar</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: colors.danger }]}>🔥 {streak.current || 0}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>Streak</Text>
            </View>
          </View>
        </Card>

        {/* Menu */}
        <Card style={{ padding: 4 }}>
          <Row icon="create-outline" label="Profilni tahrirlash" onPress={() => navigation.navigate('EditProfile')} />
          <Row icon="ribbon" label="Yutuqlarim" value={`${badgeCount} ta`} color={colors.accent} onPress={() => navigation.navigate('Badges')} />
          <Row icon="diamond" label="VIP a'zolik" color="#e84393" onPress={() => navigation.navigate('Vip')} />
          <Row icon="calendar" label="Imtihon kalendari" color={colors.danger} onPress={() => navigation.navigate('Calendar')} />
          <Row icon="videocam" label="Video darslar" color="#0984e3" onPress={() => navigation.navigate('VideoLessons')} />
        </Card>

        {/* Settings */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>SOZLAMALAR</Text>
        <Card style={{ padding: 4 }}>
          <Row
            icon={isDark ? 'moon' : 'sunny'}
            label="Mavzu (tema)"
            color={colors.warning}
            onPress={cycleTheme}
            value={themeLabel}
          />
          <Row
            icon="finger-print"
            label="Biometrik kirish"
            color={colors.accent}
            right={
              <Switch
                value={biometricEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            }
          />
        </Card>

        <Card style={{ padding: 4 }}>
          <Row icon="log-out-outline" label="Chiqish" danger onPress={doLogout} />
        </Card>

        <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 8, fontSize: 12 }}>
          StudentAI Mobile v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 18 },
  name: { fontSize: 22, fontWeight: '800', marginTop: 10 },
  vipBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 10 },
  vipText: { color: '#000', fontWeight: '700', fontSize: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCell: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
  divider: { width: 1, height: 36 },
  sectionTitle: { fontSize: 12, fontWeight: '700', marginVertical: 12, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});
