import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'chat_screen.dart';

class UserProfileScreen extends StatefulWidget {
  final String name, myName;
  const UserProfileScreen({super.key, required this.name, required this.myName});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  Map<String, dynamic>? _stats;
  Map<String, dynamic> _followInfo = {'followers': 0, 'following': 0, 'isFollowing': false};
  bool _loading = true;
  bool _followLoading = false;

  static const _green = Color(0xFF22C55E);

  bool get _isMe => widget.name.toLowerCase() == widget.myName.toLowerCase();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final s = await ApiService.getUserStats(widget.name);
    final f = await ApiService.getFollowInfo(widget.name, widget.myName);
    if (mounted) setState(() { _stats = s; _followInfo = f; _loading = false; });
  }

  Future<void> _toggleFollow() async {
    setState(() => _followLoading = true);
    await ApiService.toggleFollow(widget.myName, widget.name);
    final f = await ApiService.getFollowInfo(widget.name, widget.myName);
    if (mounted) setState(() { _followInfo = f; _followLoading = false; });
  }

  String _avatar(String name) => name.isEmpty ? '?' : name[0].toUpperCase();

  Color _avatarColor(String name) {
    final colors = [_green, const Color(0xFF3B82F6), const Color(0xFFF59E0B), const Color(0xFF8B5CF6)];
    if (name.isEmpty) return colors[0];
    return colors[name.codeUnitAt(0) % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    final score = _stats?['score'] ?? 0;
    final tests = _stats?['totalTests'] ?? 0;
    final isFollowing = _followInfo['isFollowing'] ?? false;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => Navigator.pop(context)),
        title: Text(widget.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          if (!_isMe)
            IconButton(icon: const Icon(Icons.more_horiz_rounded), onPressed: () {}),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF22C55E)))
          : RefreshIndicator(
              color: _green,
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  children: [
                    Container(
                      color: Colors.white,
                      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 40,
                            backgroundColor: _avatarColor(widget.name),
                            child: Text(_avatar(widget.name), style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
                          ),
                          const SizedBox(height: 10),
                          Text(widget.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF111111))),
                          const SizedBox(height: 14),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _statItem('${_followInfo['followers']}', 'Followers'),
                              Container(width: 1, height: 30, color: const Color(0xFFEEEEEE)),
                              _statItem('${_followInfo['following']}', 'Following'),
                            ],
                          ),
                          if (!_isMe) ...[
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: GestureDetector(
                                    onTap: _followLoading ? null : _toggleFollow,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      decoration: BoxDecoration(
                                        color: isFollowing ? const Color(0xFFF5F5F7) : _green,
                                        borderRadius: BorderRadius.circular(12),
                                        border: isFollowing ? Border.all(color: const Color(0xFFDDDDDD)) : null,
                                      ),
                                      child: Center(
                                        child: _followLoading
                                            ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: isFollowing ? _green : Colors.white))
                                            : Text(isFollowing ? 'Unfollow' : 'Follow',
                                                style: TextStyle(fontWeight: FontWeight.w700,
                                                    color: isFollowing ? const Color(0xFF555555) : Colors.white)),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                GestureDetector(
                                  onTap: () => Navigator.push(context, MaterialPageRoute(
                                      builder: (_) => ChatScreen(myName: widget.myName, otherName: widget.name))),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      border: Border.all(color: const Color(0xFFDDDDDD)),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(Icons.chat_bubble_outline_rounded, size: 20, color: Color(0xFF555555)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      color: Colors.white,
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Test natijalari', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              _card('$score', 'Ball', Icons.emoji_events_rounded, const Color(0xFFFFF3E0), const Color(0xFFF59E0B)),
                              const SizedBox(width: 10),
                              _card('$tests', 'Testlar', Icons.assignment_rounded, const Color(0xFFE8F5E9), _green),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (_stats?['subjects'] != null) ...[
                      const SizedBox(height: 8),
                      Container(
                        color: Colors.white,
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Fanlar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 10),
                            ...(_stats!['subjects'] as Map).entries.map((e) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 5),
                              child: Row(children: [
                                Expanded(child: Text(e.key.toString(), style: const TextStyle(fontSize: 13))),
                                Text('${e.value['correct'] ?? 0}/${e.value['tests'] ?? 0}',
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF22C55E))),
                              ]),
                            )),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 80),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _statItem(String val, String label) => Column(children: [
    Text(val, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
    Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF888888))),
  ]);

  Widget _card(String val, String label, IconData icon, Color bg, Color fg) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Icon(icon, color: fg, size: 24),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(val, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: fg)),
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF888888))),
        ]),
      ]),
    ));
  }
}
