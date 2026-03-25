import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'user_profile_screen.dart';

class StatsScreen extends StatefulWidget {
  final String myName;
  const StatsScreen({super.key, required this.myName});

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  List<dynamic> _users = [];
  bool _loading = true;
  int _myRank = 0;

  static const _green = Color(0xFF22C55E);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final list = await ApiService.getLeaderboardFull();
    int rank = 0;
    for (int i = 0; i < list.length; i++) {
      if ((list[i]['name'] ?? '').toString().toLowerCase() == widget.myName.toLowerCase()) {
        rank = i + 1;
        break;
      }
    }
    if (mounted) setState(() { _users = list; _myRank = rank; _loading = false; });
  }

  String _avatar(String name) => name.isEmpty ? '?' : name[0].toUpperCase();

  Color _avatarColor(String name) {
    final colors = [_green, const Color(0xFF3B82F6), const Color(0xFFF59E0B),
      const Color(0xFFEF4444), const Color(0xFF8B5CF6)];
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
            // Header
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  const Text('Reyting', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF111111))),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(20)),
                    child: Text('Jami ${_users.length} ta', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF22C55E))),
                  ),
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
                          // Podium (top 3)
                          if (_users.length >= 3)
                            SliverToBoxAdapter(child: _buildPodium()),

                          // My rank
                          if (_myRank > 0)
                            SliverToBoxAdapter(child: _buildMyRank()),

                          // List (from 4th)
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
                            sliver: SliverList(
                              delegate: SliverChildBuilderDelegate(
                                (ctx, i) {
                                  final realIdx = _users.length >= 3 ? i + 3 : i;
                                  if (realIdx >= _users.length) return null;
                                  return _buildRow(realIdx, _users[realIdx]);
                                },
                                childCount: _users.length >= 3 ? _users.length - 3 : _users.length,
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

  Widget _buildPodium() {
    final first = _users[0];
    final second = _users[1];
    final third = _users[2];

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      margin: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // 2nd
          Expanded(child: _podiumItem(second, 2, 80)),
          // 1st
          Expanded(child: _podiumItem(first, 1, 100)),
          // 3rd
          Expanded(child: _podiumItem(third, 3, 65)),
        ],
      ),
    );
  }

  Widget _podiumItem(dynamic user, int rank, double height) {
    final name = (user['name'] ?? '').toString();
    final score = user['score'] ?? 0;
    final medals = ['🥇', '🥈', '🥉'];
    final colors = [const Color(0xFFFFD700), const Color(0xFFC0C0C0), const Color(0xFFCD7F32)];
    final bgColors = [const Color(0xFFFFFDE7), const Color(0xFFF5F5F5), const Color(0xFFFFF8E1)];

    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => UserProfileScreen(name: name, myName: widget.myName))),
      child: Column(
        children: [
          Text(medals[rank - 1], style: const TextStyle(fontSize: 28)),
          const SizedBox(height: 6),
          CircleAvatar(
            radius: rank == 1 ? 28 : 22,
            backgroundColor: _avatarColor(name),
            child: Text(_avatar(name), style: TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold,
                fontSize: rank == 1 ? 20 : 16)),
          ),
          const SizedBox(height: 6),
          Text(name.split(' ')[0], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('$score ball', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors[rank - 1])),
          const SizedBox(height: 8),
          Container(
            height: height,
            decoration: BoxDecoration(
              color: bgColors[rank - 1],
              borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
              border: Border.all(color: colors[rank - 1].withOpacity(0.4)),
            ),
            child: Center(
              child: Text('#$rank', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: colors[rank - 1])),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMyRank() {
    if (_myRank == 0 || _myRank <= 3) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _green.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.person_pin_rounded, color: Color(0xFF22C55E)),
          const SizedBox(width: 8),
          const Text('Sizning o\'rningiz', style: TextStyle(fontSize: 13, color: Color(0xFF22C55E))),
          const Spacer(),
          Text('#$_myRank / ${_users.length}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF22C55E))),
        ],
      ),
    );
  }

  Widget _buildRow(int idx, dynamic user) {
    final name = (user['name'] ?? '').toString();
    final score = user['score'] ?? 0;
    final tests = user['totalTests'] ?? 0;
    final isMe = name.toLowerCase() == widget.myName.toLowerCase();

    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => UserProfileScreen(name: name, myName: widget.myName))),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isMe ? const Color(0xFFE8F5E9) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: isMe ? Border.all(color: _green.withOpacity(0.3)) : null,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 1))],
        ),
        child: Row(
          children: [
            SizedBox(width: 28, child: Text('#${idx + 1}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                color: isMe ? _green : const Color(0xFF888888)))),
            CircleAvatar(radius: 18, backgroundColor: _avatarColor(name),
                child: Text(_avatar(name), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF111111))),
                  Text('$tests ta test', style: const TextStyle(fontSize: 11, color: Color(0xFF888888))),
                ],
              ),
            ),
            Text('$score', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800,
                color: isMe ? _green : const Color(0xFF111111))),
            const SizedBox(width: 2),
            const Text(' ball', style: TextStyle(fontSize: 11, color: Color(0xFF888888))),
          ],
        ),
      ),
    );
  }
}
