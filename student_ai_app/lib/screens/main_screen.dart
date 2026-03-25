import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'stats_screen.dart';
import 'test_screen.dart';
import 'profile_screen.dart';
import 'chat_list_screen.dart';
import '../services/api_service.dart';

class MainScreen extends StatefulWidget {
  final Map<String, dynamic> session;
  const MainScreen({super.key, required this.session});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _tab = 0;
  int _unread = 0;

  static const _green = Color(0xFF22C55E);
  static const _grey = Color(0xFF888888);

  @override
  void initState() {
    super.initState();
    _checkUnread();
  }

  Future<void> _checkUnread() async {
    final name = widget.session['name'] ?? '';
    if (name.isEmpty) return;
    final n = await ApiService.getUnreadCount(name);
    if (mounted) setState(() => _unread = n);
    await Future.delayed(const Duration(seconds: 5));
    if (mounted) _checkUnread();
  }

  String get _myName => widget.session['name'] ?? '';
  String get _myUsername => widget.session['username'] ?? '';

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(myName: _myName, myUsername: _myUsername),
      StatsScreen(myName: _myName),
      TestScreen(myName: _myName, myUsername: _myUsername),
      ProfileScreen(myName: _myName, myUsername: _myUsername, session: widget.session),
    ];

    return Scaffold(
      body: IndexedStack(index: _tab, children: screens),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, -2))],
        ),
        child: SafeArea(
          child: SizedBox(
            height: 60,
            child: Row(
              children: [
                _navItem(0, Icons.home_rounded, Icons.home_outlined, 'Home'),
                _navItem(1, Icons.bar_chart_rounded, Icons.bar_chart_outlined, 'Statistika'),
                _navItem(2, Icons.quiz_rounded, Icons.quiz_outlined, 'Test'),
                _navItemWithBadge(3, Icons.person_rounded, Icons.person_outlined, 'Profil', _unread),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: _tab == 3
          ? FloatingActionButton(
              mini: true,
              backgroundColor: _green,
              foregroundColor: Colors.white,
              elevation: 2,
              onPressed: () {
                Navigator.push(context, MaterialPageRoute(
                    builder: (_) => ChatListScreen(myName: _myName)));
              },
              child: Stack(
                children: [
                  const Icon(Icons.chat_bubble_outline_rounded, size: 22),
                  if (_unread > 0)
                    Positioned(
                      right: 0, top: 0,
                      child: Container(
                        width: 10, height: 10,
                        decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                      ),
                    ),
                ],
              ),
            )
          : null,
    );
  }

  Widget _navItem(int idx, IconData active, IconData inactive, String label) {
    final sel = _tab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = idx),
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(sel ? active : inactive, size: 24, color: sel ? _green : _grey),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                color: sel ? _green : _grey)),
          ],
        ),
      ),
    );
  }

  Widget _navItemWithBadge(int idx, IconData active, IconData inactive, String label, int badge) {
    final sel = _tab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = idx),
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              children: [
                Icon(sel ? active : inactive, size: 24, color: sel ? _green : _grey),
                if (badge > 0)
                  Positioned(
                    right: 0, top: 0,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                      child: Text('$badge', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                color: sel ? _green : _grey)),
          ],
        ),
      ),
    );
  }
}
