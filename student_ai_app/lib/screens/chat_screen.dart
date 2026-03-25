import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ChatScreen extends StatefulWidget {
  final String myName, otherName;
  const ChatScreen({super.key, required this.myName, required this.otherName});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  List<dynamic> _messages = [];
  final _ctrl = TextEditingController();
  final _scroll = ScrollController();
  Timer? _timer;
  int _lastTs = 0;
  bool _sending = false;

  static const _green = Color(0xFF22C55E);

  @override
  void initState() {
    super.initState();
    _loadAll();
    ApiService.markRead(widget.myName, widget.otherName);
    // Real-time polling (har 2 soniyada yangi xabarlar)
    _timer = Timer.periodic(const Duration(seconds: 2), (_) => _loadNew());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    // MUHIM: faqat bu ikki foydalanuvchi o'rtasidagi xabarlarni olish
    final msgs = await ApiService.getMessages(
        name1: widget.myName, name2: widget.otherName);
    if (mounted) {
      setState(() {
        _messages = msgs;
        if (msgs.isNotEmpty) _lastTs = msgs.last['ts'] ?? 0;
      });
      _scrollBottom();
      ApiService.markRead(widget.myName, widget.otherName);
    }
  }

  Future<void> _loadNew() async {
    if (!mounted) return;
    final msgs = await ApiService.getMessages(
        name1: widget.myName, name2: widget.otherName, since: _lastTs);
    if (msgs.isNotEmpty && mounted) {
      setState(() {
        _messages.addAll(msgs);
        _lastTs = msgs.last['ts'] ?? _lastTs;
      });
      _scrollBottom();
      ApiService.markRead(widget.myName, widget.otherName);
    }
  }

  void _scrollBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    _ctrl.clear();
    final ok = await ApiService.sendMessage(
        fromName: widget.myName, toName: widget.otherName, text: text);
    if (ok) await _loadAll();
    if (mounted) setState(() => _sending = false);
  }

  bool _isMe(dynamic msg) =>
      (msg['from'] ?? '').toString().toLowerCase() == widget.myName.toLowerCase();

  String _timeStr(dynamic ts) {
    if (ts == null) return '';
    final d = DateTime.fromMillisecondsSinceEpoch(ts is int ? ts : int.tryParse(ts.toString()) ?? 0);
    return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        titleSpacing: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => Navigator.pop(context)),
        title: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: _avatarColor(widget.otherName),
              child: Text(_avatar(widget.otherName), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
            ),
            const SizedBox(width: 8),
            Text(widget.otherName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? Center(
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Text('👋', style: TextStyle(fontSize: 40)),
                      const SizedBox(height: 8),
                      Text('${widget.otherName} bilan suhbat boshlang!',
                          style: const TextStyle(color: Color(0xFF888888), fontSize: 14)),
                    ]),
                  )
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                    itemCount: _messages.length,
                    itemBuilder: (ctx, i) => _buildBubble(_messages[i]),
                  ),
          ),
          _buildInput(),
        ],
      ),
    );
  }

  Widget _buildBubble(dynamic msg) {
    final me = _isMe(msg);
    final text = (msg['text'] ?? '').toString();
    final ts = _timeStr(msg['ts']);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: me ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!me) ...[
            CircleAvatar(
              radius: 14,
              backgroundColor: _avatarColor(widget.otherName),
              child: Text(_avatar(widget.otherName), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: me ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
                  decoration: BoxDecoration(
                    color: me ? _green : Colors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: Radius.circular(me ? 18 : 4),
                      bottomRight: Radius.circular(me ? 4 : 18),
                    ),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1))],
                  ),
                  child: Text(text, style: TextStyle(fontSize: 14, color: me ? Colors.white : const Color(0xFF111111))),
                ),
                const SizedBox(height: 2),
                Text(ts, style: const TextStyle(fontSize: 10, color: Color(0xFFAAAAAA))),
              ],
            ),
          ),
          if (me) const SizedBox(width: 4),
        ],
      ),
    );
  }

  Widget _buildInput() {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(12, 8, 12, MediaQuery.of(context).padding.bottom + 8),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _ctrl,
              minLines: 1, maxLines: 4,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _send(),
              decoration: InputDecoration(
                hintText: 'Xabar yozing...',
                hintStyle: const TextStyle(color: Color(0xFFBBBBBB)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                filled: true,
                fillColor: const Color(0xFFF5F5F7),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _send,
            child: Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: _sending ? const Color(0xFF88D4A4) : _green,
                shape: BoxShape.circle,
              ),
              child: _sending
                  ? const SizedBox(width: 20, height: 20, child: Padding(padding: EdgeInsets.all(10), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)))
                  : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  String _avatar(String name) => name.isEmpty ? '?' : name[0].toUpperCase();

  Color _avatarColor(String name) {
    final colors = [_green, const Color(0xFF3B82F6), const Color(0xFFF59E0B), const Color(0xFF8B5CF6)];
    if (name.isEmpty) return colors[0];
    return colors[name.codeUnitAt(0) % colors.length];
  }
}
