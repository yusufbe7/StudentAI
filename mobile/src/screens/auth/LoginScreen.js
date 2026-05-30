import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/UI';

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const { login, biometricEnabled, getSavedCred } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [canBio, setCanBio] = useState(false);

  useEffect(() => {
    (async () => {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const cred = await getSavedCred();
      setCanBio(hw && enrolled && biometricEnabled && !!cred);
    })();
  }, [biometricEnabled, getSavedCred]);

  const doLogin = useCallback(
    async (u, p) => {
      if (!u || !p) {
        Alert.alert('Xatolik', 'Username va parolni kiriting');
        return;
      }
      setLoading(true);
      try {
        await login(u.trim(), p);
      } catch (e) {
        const map = {
          wrong_password: "Parol noto'g'ri",
          notfound: 'Bunday foydalanuvchi topilmadi',
          missing_fields: "Ma'lumotlar to'liq emas",
        };
        Alert.alert('Kirib bo\'lmadi', map[e.message] || e.message || 'Server bilan aloqa yo\'q');
      } finally {
        setLoading(false);
      }
    },
    [login]
  );

  const bioLogin = useCallback(async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Biometrik kirish',
        cancelLabel: 'Bekor qilish',
      });
      if (res.success) {
        const cred = await getSavedCred();
        if (cred) await doLogin(cred.username, cred.password);
      }
    } catch {
      Alert.alert('Xatolik', 'Biometrik tekshiruv ishlamadi');
    }
  }, [getSavedCred, doLogin]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>🎓</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>StudentAI</Text>
          <Text style={[styles.subtitle, { color: colors.textDim }]}>
            Bilimingizni sinab ko'ring va reytingda yuqoriga chiqing
          </Text>
        </View>

        <Input
          label="Username"
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <View>
          <Input
            label="Parol"
            placeholder="••••••"
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.eye} onPress={() => setShowPass((s) => !s)}>
            <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        <Button title="Kirish" loading={loading} onPress={() => doLogin(username, password)} />

        {canBio ? (
          <Button
            title="Biometrik kirish"
            variant="outline"
            style={{ marginTop: 12 }}
            icon={<Ionicons name="finger-print" size={20} color={colors.text} />}
            onPress={bioLogin}
          />
        ) : null}

        <View style={styles.footer}>
          <Text style={{ color: colors.textDim }}>Akkountingiz yo'qmi? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Ro'yxatdan o'tish</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 80, flexGrow: 1, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 44 },
  title: { fontSize: 30, fontWeight: '800', marginTop: 16 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  eye: { position: 'absolute', right: 14, top: 38 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
});
