import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'user_profile_screen.dart';

class HomeScreen extends StatefulWidget {
  final String myName;
  final String myUsername;
  const HomeScreen({super.key, required this.myName, required this.myUsername});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<dynamic> _feed = [];
  List<dynamic> _stories = [];
  bool _loading = true;

  static const _green = Color(0xFF22C55E);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final feed = await ApiService.getActivityFeed(limit: 30);
    // Stories: har bir userdan birinchisini olish
    final Map<String, dynamic> seen = {};
    for (final item in feed) {
      final n = (item['name'] ?? '').toString();
      if (!seen.containsKey(n)) seen[n] = item;
    }
    if (mounted) {
      setState(() {
        _feed = feed;
        _stories = seen.values.take(8).toList();
        _loading = false;
      });
    }
  }

  String _ago(dynamic ts) {
    if (ts == null) return '';
    final d = DateTime.fromMillisecondsSinceEpoch(ts is int ? ts : int.tryParse(ts.toString()) ?? 0);
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'Hozir';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m oldin';
    if (diff.inHours < 24) return '${diff.inHours}h oldin';
    return DateFormat('d MMM').format(d);
  }

  String _avatar(String name) {
    if (name.isEmpty) return '?';
    return name[0].toUpperCase();
  }

  Color _avatarColor(String name) {
    final colors = [
      const Color(0xFF22C55E), const Color(0xFF3B82F6), const Color(0xFFF59E0B),
      const Color(0xFFEF4444), const Color(0xFF8B5CF6), const Color(0xFF06B6D4),
    ];
    if (name.isEmpty) return colors[0];
    return colors[name.codeUnitAt(0) % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      body: SafeArea(
        child: Column(
          children: [
            // TopBar
            Container(
              height: 54,
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(color: _green, borderRadius: BorderRadius.circular(10)),
                    child: const Center(child: Text('⚡', style: TextStyle(fontSize: 16))),
                  ),
                  const SizedBox(width: 10),
                  const Text('Student AI', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF111111))),
                  const Spacer(),
                  IconButton(icon: const Icon(Icons.search_rounded, color: Color(0xFF444444)), onPressed: () {}),
                  IconButton(icon: const Icon(Icons.notifications_outlined, color: Color(0xFF444444)), onPressed: () {}),
                ],
              ),
            ),

            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF22C55E)))
                  : RefreshIndicator(
                      color: _green,
                      onRefresh: _load,
                      child: CustomScrollView(
                        slivers: [
                          // Stories
                          if (_stories.isNotEmpty)
                            SliverToBoxAdapter(child: _buildStories()),

                          // Feed
                          if (_feed.isEmpty)
                            SliverFillRemaining(
                              child: Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Text('📭', style: TextStyle(fontSize: 48)),
                                    const SizedBox(height: 8),
                                    const Text('Hozircha faoliyat yo\'q', style: TextStyle(color: Color(0xFF888888))),
                                  ],
                                ),
                              ),
                            )
                          else
                            SliverPadding(
                              padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
                              sliver: SliverList(
                                delegate: SliverChildBuilderDelegate(
                                  (ctx, i) => _buildCard(_feed[i]),
                                  childCount: _feed.length,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStories() {
    return Container(
      color: Colors.white,
      height: 100,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        itemCount: _stories.length,
        itemBuilder: (ctx, i) {
          final item = _stories[i];
          final name = (item['name'] ?? '').toString();
          final isMe = name.toLowerCase() == widget.myName.toLowerCase();
          return GestureDetector(
            onTap: () => Navigator.push(ctx, MaterialPageRoute(
                builder: (_) => UserProfileScreen(name: name, myName: widget.myName))),
            child: Container(
              margin: const EdgeInsets.only(right: 12),
              child: Column(
                children: [
                  Container(
                    width: 54, height: 54,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: isMe ? Colors.grey.shade300 : _green, width: 2.5),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(2),
                      child: CircleAvatar(
                        backgroundColor: _avatarColor(name),
                        child: Text(_avatar(name), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  SizedBox(
                    width: 58,
                    child: Text(
                      isMe ? 'Siz' : name.split(' ')[0],
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF333333)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildCard(dynamic item) {
    final name = (item['name'] ?? '').toString();
    final subject = (item['subjectName'] ?? item['subjectKey'] ?? 'Test').toString();
    final score = item['score'] ?? 0;
    final totalQ = item['totalQ'] ?? 0;
    final dur = item['durationMin'] ?? 0;
    final ts = item['ts'];
    final correct = item['correctCount'] ?? score;

    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => UserProfileScreen(name: name, myName: widget.myName))),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(text: '$correct', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF111111))),
                      const TextSpan(text: '  to\'g\'ri', style: TextStyle(fontSize: 14, color: Color(0xFF888888), fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
                const Spacer(),
                if (dur > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(20)),
                    child: Text('${dur}m', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF22C55E))),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(subject, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF333333))),
            if (totalQ > 0)
              Text('$totalQ savol · ${score} ball', style: const TextStyle(fontSize: 12, color: Color(0xFF888888))),
            const SizedBox(height: 12),
            Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: _avatarColor(name),
                  child: Text(_avatar(name), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF222222))),
                      Text(_ago(ts), style: const TextStyle(fontSize: 11, color: Color(0xFFAAAAAA))),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: score > (totalQ ~/ 2) ? const Color(0xFFE8F5E9) : const Color(0xFFFFF3E0),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      Text(score > (totalQ ~/ 2) ? '⚡' : '📝', style: const TextStyle(fontSize: 12)),
                      const SizedBox(width: 4),
                      Text('$score', style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700,
                          color: score > (totalQ ~/ 2) ? const Color(0xFF22C55E) : const Color(0xFFF59E0B))),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
