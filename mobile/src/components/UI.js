import React from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ── Card ──────────────────────────────────────────────────
export function Card({ children, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

// ── Button ────────────────────────────────────────────────
export function Button({ title, onPress, loading, disabled, variant = 'primary', style, icon }) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary' ? colors.primary
    : variant === 'danger' ? colors.danger
    : variant === 'accent' ? colors.accent
    : 'transparent';
  const isOutline = variant === 'outline';
  const txtColor = isOutline ? colors.text : '#fff';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.btn,
        {
          backgroundColor: isOutline ? 'transparent' : bg,
          borderColor: isOutline ? colors.border : 'transparent',
          borderWidth: isOutline ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={txtColor} />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Text style={[styles.btnText, { color: txtColor, marginLeft: icon ? 8 : 0 }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Input ─────────────────────────────────────────────────
export function Input({ label, error, style, ...props }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={[styles.label, { color: colors.textDim }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textDim}
        style={[
          styles.input,
          { backgroundColor: colors.inputBg, color: colors.text, borderColor: error ? colors.danger : colors.border },
          style,
        ]}
        {...props}
      />
      {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

// ── Loader (full screen) ──────────────────────────────────
export function Loader({ text }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.loader, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {text ? <Text style={{ color: colors.textDim, marginTop: 12 }}>{text}</Text> : null}
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 48, marginBottom: 8 }}>{icon || '🗂️'}</Text>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: colors.textDim, marginTop: 6, textAlign: 'center' }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// ── Badge / pill ──────────────────────────────────────────
export function Pill({ text, color, bg }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: bg || colors.card2 }]}>
      <Text style={{ color: color || colors.textDim, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700', fontSize: 16 },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  errorText: { fontSize: 12, marginTop: 4 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
});

export default { Card, Button, Input, Loader, EmptyState, Pill };
