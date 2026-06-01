import React, { useState } from 'react';
import { View, ScrollView, Alert, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Card, Button, Input } from '../components/UI';

export default function EditProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const { user, updateLocalUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (name.trim().length < 3) {
      Alert.alert('Xatolik', 'Ism kamida 3 ta belgi bo\'lishi kerak');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      Alert.alert('Xatolik', 'Yangi parol kamida 6 ta belgi');
      return;
    }
    if (newPassword && newPassword !== newPassword2) {
      Alert.alert('Xatolik', 'Parollar mos kelmadi');
      return;
    }
    setLoading(true);
    try {
      const payload = { username: user.username, name: name.trim() };
      if (newPassword) payload.newPassword = newPassword;
      await api.updateProfile(payload);
      await updateLocalUser({ ...user, name: name.trim() });
      Alert.alert('Saqlandi', 'Profil yangilandi', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Xatolik', e.message || 'Saqlab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Text style={{ color: colors.textDim, marginBottom: 14 }}>Username (@{user?.username}) o'zgartirilmaydi</Text>
        <Input label="To'liq ism" value={name} onChangeText={setName} placeholder="Ismingiz" />
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 12 }}>Parolni o'zgartirish</Text>
        <Input
          label="Yangi parol"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Bo'sh qoldiring — o'zgarmaydi"
        />
        <Input label="Parolni takrorlang" value={newPassword2} onChangeText={setNewPassword2} secureTextEntry placeholder="••••••" />
      </Card>

      <Button title="Saqlash" loading={loading} onPress={save} />
    </ScrollView>
  );
}
