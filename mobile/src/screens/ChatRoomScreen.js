import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { getSocket } from '../socket/socket';
import Avatar from '../components/Avatar';

function fmtTime(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

export default function ChatRoomScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { otherName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const listRef = useRef(null);
  const typingTimeout = useRef(null);
  const myName = user?.name;

  const sortMsgs = (arr) => [...arr].sort((a, b) => a.ts - b.ts);

  // History
  const loadHistory = useCallback(async () => {
    try {
      const res = await api.chatMessages(myName, otherName, 0);
      setMessages(sortMsgs(res.messages || []));
    } catch {}
  }, [myName, otherName]);

  // Mark read
  const markRead = useCallback(() => {
    api.chatRead(myName, otherName).catch(() => {});
    const socket = getSocket();
    if (socket) socket.emit('mark_read', { myName, otherName });
  }, [myName, otherName]);

  useEffect(() => {
    loadHistory().then(markRead);
    api.onlineCount().then((r) => {
      const users = (r.users || []).map((u) => u.toLowerCase());
      setOnline(users.includes(otherName.toLowerCase()));
    }).catch(() => {});
  }, [loadHistory, markRead, otherName]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = ({ msg }) => {
      if (
        (msg.from || '').toLowerCase() === otherName.toLowerCase() ||
        (msg.to || '').toLowerCase() === otherName.toLowerCase()
      ) {
        setMessages((prev) => sortMsgs([...prev.filter((m) => m.id !== msg.id), msg]));
        markRead();
      }
    };
    const onSent = ({ msg, tempId }) => {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempId && m.id !== msg.id);
        return sortMsgs([...filtered, msg]);
      });
    };
    const onRead = ({ chatWith }) => {
      if ((chatWith || '').toLowerCase() === otherName.toLowerCase()) {
        setMessages((prev) => prev.map((m) => (m.from?.toLowerCase() === myName?.toLowerCase() ? { ...m, read: true } : m)));
      }
    };
    const onTyping = ({ name, isTyping }) => {
      if ((name || '').toLowerCase() === otherName.toLowerCase()) setOtherTyping(isTyping);
    };
    const onOnline = ({ name }) => {
      if ((name || '').toLowerCase() === otherName.toLowerCase()) setOnline(true);
    };
    const onOffline = ({ name }) => {
      if ((name || '').toLowerCase() === otherName.toLowerCase()) {
        setOnline(false);
        setOtherTyping(false);
      }
    };

    socket.on('new_message', onNew);
    socket.on('message_sent', onSent);
    socket.on('messages_read', onRead);
    socket.on('user_typing', onTyping);
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);
    return () => {
      socket.off('new_message', onNew);
      socket.off('message_sent', onSent);
      socket.off('messages_read', onRead);
      socket.off('user_typing', onTyping);
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
    };
  }, [otherName, myName, markRead]);

  // Header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={otherName} size={36} online={online} />
          <View style={{ marginLeft: 10 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{otherName}</Text>
            <Text style={{ color: online ? colors.online : colors.textDim, fontSize: 12 }}>
              {otherTyping ? 'yozmoqda...' : online ? 'online' : 'offline'}
            </Text>
          </View>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={confirmDelete} style={{ paddingHorizontal: 4 }}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, otherName, online, otherTyping, colors]);

  const confirmDelete = () => {
    Alert.alert('Suhbatni o\'chirish', 'Barcha xabarlar o\'chiriladi. Davom etasizmi?', [
      { text: 'Yo\'q', style: 'cancel' },
      {
        text: 'O\'chirish',
        style: 'destructive',
        onPress: async () => {
          await api.chatDelete(myName, otherName).catch(() => {});
          setMessages([]);
        },
      },
    ]);
  };

  const handleTyping = (val) => {
    setText(val);
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing', { fromName: myName, toName: otherName, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing', { fromName: myName, toName: otherName, isTyping: false });
    }, 1500);
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const socket = getSocket();
    const tempId = 'temp_' + Date.now();
    const optimistic = { id: tempId, from: myName, to: otherName, text: body, ts: Date.now(), read: false, pending: true };
    setMessages((prev) => sortMsgs([...prev, optimistic]));

    if (socket && socket.connected) {
      socket.emit('chat_message', { fromName: myName, toName: otherName, text: body, tempId });
    } else {
      // Fallback: REST
      try {
        const res = await api.chatSend({ fromName: myName, toName: otherName, text: body });
        setMessages((prev) => sortMsgs([...prev.filter((m) => m.id !== tempId), res.msg]));
      } catch {
        Alert.alert('Xatolik', 'Xabar yuborilmadi');
      }
    }
  };

  const renderItem = ({ item }) => {
    const mine = (item.from || '').toLowerCase() === (myName || '').toLowerCase();
    return (
      <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: mine ? colors.bubbleMe : colors.bubbleOther,
              borderBottomRightRadius: mine ? 4 : 16,
              borderBottomLeftRadius: mine ? 16 : 4,
            },
          ]}
        >
          <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15 }}>{item.text}</Text>
          <View style={styles.metaRow}>
            <Text style={{ color: mine ? 'rgba(255,255,255,0.7)' : colors.textDim, fontSize: 10 }}>
              {fmtTime(item.ts)}
            </Text>
            {mine ? (
              item.pending ? (
                <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
              ) : (
                <Ionicons
                  name={item.read ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.read ? '#7CFC00' : 'rgba(255,255,255,0.7)'}
                  style={{ marginLeft: 4 }}
                />
              )
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, flexGrow: 1, justifyContent: 'flex-end' }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {otherTyping ? (
        <Text style={{ color: colors.textDim, fontStyle: 'italic', paddingHorizontal: 16, paddingBottom: 4 }}>
          {otherName} yozmoqda...
        </Text>
      ) : null}

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
          placeholder="Xabar yozing..."
          placeholderTextColor={colors.textDim}
          value={text}
          onChangeText={handleTyping}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.card2 }]}
          onPress={send}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={20} color={text.trim() ? '#fff' : colors.textDim} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, gap: 8 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 110, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
