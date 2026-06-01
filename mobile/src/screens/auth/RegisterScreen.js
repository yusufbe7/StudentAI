import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/UI';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (name.trim().length < 3) e.name = 'Ism kamida 3 ta belgi';
    if (!/^[a-z0-9_]{3,}$/.test(username.toLowerCase().trim()))
      e.username = 'Faqat a-z, 0-9, _ (kamida 3 ta)';
    if (password.length < 6) e.password = 'Parol kamida 6 ta belgi';
    if (password !== password2) e.password2 = 'Parollar mos kelmadi';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(username.toLowerCase().trim(), name.trim(), password);
    } catch (err) {
      const map = {
        exists: 'Bu username band',
        invalid_username: "Username noto'g'ri",
        invalid_name: "Ism noto'g'ri",
        invalid_password: 'Parol juda qisqa',
      };
      Alert.alert('Xatolik', map[err.message] || err.message || 'Server bilan aloqa yo\'q');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>Yangi akkount yarating</Text>
        <Text style={[styles.subtitle, { color: colors.textDim }]}>
          Reytingda qatnashish uchun ro'yxatdan o'ting
        </Text>

        <Input
          label="To'liq ism"
          placeholder="Masalan: Ali Valiyev"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />
        <Input
          label="Username"
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          error={errors.username}
        />
        <Input
          label="Parol"
          placeholder="••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />
        <Input
          label="Parolni takrorlang"
          placeholder="••••••"
          secureTextEntry
          value={password2}
          onChangeText={setPassword2}
          error={errors.password2}
        />

        <Button title="Ro'yxatdan o'tish" loading={loading} onPress={doRegister} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 24, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 24 },
});
