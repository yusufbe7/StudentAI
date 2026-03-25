import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  final String myName, myUsername;
  final Map<String, dynamic> session;
  const ProfileScreen({super.key, required this.myName, required this.myUsername, required this.session});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _stats;
  Map<String, dynamic> _followInfo = {'followers': 0, 'following': 0};
  bool _loading = true;

  static const _green = Color(0xFF22C55E);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final s = await ApiService.getUserStats(widget.myName);
    final f = await ApiService.getFollowInfo(widget.myName, widget.myName);
    if (mounted) setState(() { _stats = s; _followInfo = f; _loading = false; });
  }

  Future<void> _logout() async {
    await StorageService.clearSession();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.myName;
    final uname = '@${widget.myUsername}';
    final score = _stats?['score'] ?? 0;
    final tests = _stats?['totalTests'] ?? 0;
    final correct = _stats?['totalCorrect'] ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF22C55E)))
            : RefreshIndicator(
                color: _green,
                onRefresh: _load,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Column(
                    children: [
                      // Header
                      Container(
                        color: Colors.white,
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Text(uname, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111111))),
                                const Spacer(),
                                IconButton(
                                  icon: const Icon(Icons.settings_outlined, color: Color(0xFF444444)),
                                  onPressed: _showSettings,
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Stack(
                              children: [
                                CircleAvatar(
                                  radius: 40,
                                  backgroundColor: _avatarColor(name),
                                  child: Text(_avatar(name), style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
                                ),
                                Positioned(
                                  bottom: 2, right: 2,
                                  child: Container(
                                    width: 14, height: 14,
                                    decoration: BoxDecoration(color: _green, shape: BoxShape.circle,
                                        border: Border.all(color: Colors.white, width: 2)),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF111111))),
                            const SizedBox(height: 16),

                            // Stats row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                _statItem('${_followInfo['followers']}', 'Followers'),
                                Container(width: 1, height: 30, color: const Color(0xFFEEEEEE)),
                                _statItem('${_followInfo['following']}', 'Following'),
                              ],
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 8),

                      // Test stats
                      Container(
                        color: Colors.white,
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Test natijalari', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111111))),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                _scoreCard('$score', 'Jami ball', Icons.emoji_events_rounded, const Color(0xFFFFF3E0), const Color(0xFFF59E0B)),
                                const SizedBox(width: 10),
                                _scoreCard('$tests', 'Test soni', Icons.assignment_rounded, const Color(0xFFE8F5E9), _green),
                                const SizedBox(width: 10),
                                _scoreCard('$correct', "To'g'ri", Icons.check_circle_rounded, const Color(0xFFE3F2FD), const Color(0xFF3B82F6)),
                              ],
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 8),

                      // Fanlar
                      if (_stats?['subjects'] != null) ...[
                        Container(
                          color: Colors.white,
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Fanlar bo\'yicha', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                              const SizedBox(height: 10),
                              ...(_stats!['subjects'] as Map).entries.map((e) => _subjectRow(e.key, e.value)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],

                      // Logout
                      Container(
                        margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                        child: OutlinedButton.icon(
                          onPressed: _logout,
                          icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
                          label: const Text('Chiqish', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFFFFCDD2)),
                            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  void _showSettings() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(4))),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
            title: const Text('Chiqish', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w600)),
            onTap: () { Navigator.pop(context); _logout(); },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _statItem(String val, String label) {
    return Column(
      children: [
        Text(val, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF111111))),
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF888888))),
      ],
    );
  }

  Widget _scoreCard(String val, String label, IconData icon, Color bg, Color fg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        child: Column(
          children: [
            Icon(icon, color: fg, size: 22),
            const SizedBox(height: 4),
            Text(val, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: fg)),
            Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF888888)), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _subjectRow(String key, dynamic data) {
    final tests = data['tests'] ?? 0;
    final correct = data['correct'] ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(child: Text(key, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
          Text('$correct/$tests', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF22C55E))),
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
