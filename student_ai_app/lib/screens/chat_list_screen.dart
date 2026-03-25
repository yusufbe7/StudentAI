import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'chat_screen.dart';

class ChatListScreen extends StatefulWidget {
  final String myName;
  const ChatListScreen({super.key, required this.myName});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  List<dynamic> _chats = [];
  bool _loading = true;

  static const _green = Color(0xFF22C55E);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    // MUHIM: faqat o'z chatlarini yuklash (myName orqali filter)
    final list = await ApiService.getChatList(widget.myName);
    if (mounted) setState(() { _chats = list; _loading = false; });
  }

  String _timeAgo(dynamic ts) {
    if (ts == null) return '';
    final d = DateTime.fromMillisecondsSinceEpoch(ts is int ? ts : int.tryParse(ts.toString()) ?? 0);
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'Hozir';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return '${diff.inDays}k';
  }

  String _avatar(String name) => name.isEmpty ? '?' : name[0].toUpperCase();

  Color _avatarColor(String name) {
    final colors = [_green, const Color(0xFF3B82F6), const Color(0xFFF59E0B), const Color(0xFF8B5CF6)];
    if (name.isEmpty) return colors[0];
    return colors[name.codeUnitAt(0) % colors.length];
  }

  Future<void> _deleteChat(String otherName) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Chatni o\'chirish'),
        content: Text('$otherName bilan suhbatni o\'chirmoqchimisiz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Bekor')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('O\'chirish', style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await ApiService.deleteChat(widget.myName, otherName);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        title: const Text('Xabarlar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white, elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: _showNewChatSheet,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF22C55E)))
          : RefreshIndicator(
              color: _green,
              onRefresh: _load,
              child: _chats.isEmpty
                  ? Center(
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Text('💬', style: TextStyle(fontSize: 48)),
                        const SizedBox(height: 8),
                        const Text('Hali xabar yo\'q', style: TextStyle(color: Color(0xFF888888))),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _showNewChatSheet,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _green, foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0),
                          child: const Text('Yangi xabar yozish'),
                        ),
                      ]),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: _chats.length,
                      itemBuilder: (ctx, i) => _chatTile(_chats[i]),
                    ),
            ),
    );
  }

  Widget _chatTile(dynamic chat) {
    final other = (chat['otherName'] ?? '').toString();
    final lastMsg = (chat['lastMsg'] ?? '').toString();
    final lastFrom = (chat['lastFrom'] ?? '').toString();
    final unread = chat['unread'] ?? 0;
    final ts = chat['lastTs'];
    final isFromMe = lastFrom.toLowerCase() == widget.myName.toLowerCase();

    return Dismissible(
      key: Key(other),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: const Color(0xFFEF4444),
        child: const Icon(Icons.delete_outline_rounded, color: Colors.white, size: 28),
      ),
      confirmDismiss: (_) async {
        await _deleteChat(other);
        return false; // _load() already refreshes
      },
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        tileColor: Colors.white,
        leading: CircleAvatar(
          radius: 24,
          backgroundColor: _avatarColor(other),
          child: Text(_avatar(other), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        ),
        title: Text(other, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF111111))),
        subtitle: Text(
          isFromMe ? 'Siz: $lastMsg' : lastMsg,
          maxLines: 1, overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 13, color: unread > 0 ? const Color(0xFF111111) : const Color(0xFF888888),
              fontWeight: unread > 0 ? FontWeight.w600 : FontWeight.normal),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(_timeAgo(ts), style: const TextStyle(fontSize: 11, color: Color(0xFFAAAAAA))),
            if (unread > 0) ...[
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: _green, borderRadius: BorderRadius.circular(10)),
                child: Text('$unread', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ],
        ),
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(
              builder: (_) => ChatScreen(myName: widget.myName, otherName: other)));
          _load();
        },
        onLongPress: () => _deleteChat(other),
      ),
    );
  }

  void _showNewChatSheet() async {
    final users = await ApiService.getUsersMap();
    if (!mounted) return;
    final names = users.values
        .map((u) => (u['name'] ?? '').toString())
        .where((n) => n.isNotEmpty && n.toLowerCase() != widget.myName.toLowerCase())
        .toList()
      ..sort();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(4))),
            const Padding(padding: EdgeInsets.all(16), child: Text('Foydalanuvchi tanlang', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
            Expanded(
              child: ListView.builder(
                itemCount: names.length,
                itemBuilder: (_, i) => ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _avatarColor(names[i]),
                    child: Text(_avatar(names[i]), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                  title: Text(names[i]),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(context, MaterialPageRoute(
                        builder: (_) => ChatScreen(myName: widget.myName, otherName: names[i])));
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
