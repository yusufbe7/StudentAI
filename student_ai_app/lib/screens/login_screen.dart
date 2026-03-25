import 'package:flutter/material.dart';
import '../services/storage_service.dart';
import 'main_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isSignIn = true;
  bool _loading = false;

  final _siU = TextEditingController();
  final _siP = TextEditingController();
  final _suU = TextEditingController();
  final _suN = TextEditingController();
  final _suP = TextEditingController();
  final _suP2 = TextEditingController();

  String? _err;

  static const _green = Color(0xFF22C55E);
  static const _bg = Color(0xFFF5F5F7);

  @override
  void dispose() {
    _siU.dispose(); _siP.dispose();
    _suU.dispose(); _suN.dispose(); _suP.dispose(); _suP2.dispose();
    super.dispose();
  }

  Future<void> _doSignIn() async {
    setState(() { _err = null; _loading = true; });
    final u = _siU.text.trim().toLowerCase();
    final p = _siP.text;
    if (u.isEmpty || p.isEmpty) {
      setState(() { _err = 'Username va parol kiriting'; _loading = false; });
      return;
    }
    final users = await StorageService.getUsers();
    if (!users.containsKey(u) || users[u]['pass'] != p) {
      setState(() { _err = 'Username yoki parol noto\'g\'ri'; _loading = false; });
      return;
    }
    final sess = {'username': u, 'name': users[u]['name'], 'isAdmin': false};
    await StorageService.saveSession(sess);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => MainScreen(session: sess)));
  }

  Future<void> _doSignUp() async {
    setState(() { _err = null; _loading = true; });
    final u = _suU.text.trim().toLowerCase();
    final n = _suN.text.trim();
    final p = _suP.text;
    final p2 = _suP2.text;

    if (!StorageService.isValidUsername(u)) {
      setState(() { _err = 'Username: kamida 3 harf, faqat a-z 0-9 . _'; _loading = false; });
      return;
    }
    if (!StorageService.isValidName(n)) {
      setState(() { _err = 'Ism kamida 3 harf bo\'lishi kerak'; _loading = false; });
      return;
    }
    if (p.length < 6) {
      setState(() { _err = 'Parol kamida 6 belgi'; _loading = false; });
      return;
    }
    if (p != p2) {
      setState(() { _err = 'Parollar mos kelmadi'; _loading = false; });
      return;
    }
    final users = await StorageService.getUsers();
    if (users.containsKey(u)) {
      setState(() { _err = 'Bu username band'; _loading = false; });
      return;
    }
    users[u] = {'username': u, 'name': n, 'pass': p, 'createdAt': DateTime.now().millisecondsSinceEpoch};
    await StorageService.saveUsers(users);
    setState(() { _isSignIn = true; _siU.text = u; _err = null; _loading = false; });
    _showToast('Muvaffaqiyatli ro\'yxatdan o\'tildi!');
  }

  void _showToast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: _green, duration: const Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                // Logo
                Container(
                  width: 64, height: 64,
                  decoration: BoxDecoration(
                    color: _green,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [BoxShadow(color: _green.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 8))],
                  ),
                  child: const Center(child: Text('⚡', style: TextStyle(fontSize: 28))),
                ),
                const SizedBox(height: 12),
                const Text('Student AI', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF111111))),
                const Text('AITEX · O\'quv platformasi', style: TextStyle(fontSize: 13, color: Color(0xFF888888))),
                const SizedBox(height: 32),

                // Card
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 20, offset: const Offset(0, 4))],
                  ),
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      // Tabs
                      Container(
                        decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.all(4),
                        child: Row(children: [
                          _tab('Kirish', _isSignIn, () => setState(() { _isSignIn = true; _err = null; })),
                          _tab('Ro\'yxat', !_isSignIn, () => setState(() { _isSignIn = false; _err = null; })),
                        ]),
                      ),
                      const SizedBox(height: 20),

                      // Error
                      if (_err != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: const Color(0xFFFFEEEE), borderRadius: BorderRadius.circular(10)),
                          child: Text(_err!, style: const TextStyle(color: Color(0xFFE53E3E), fontSize: 13)),
                        ),
                        const SizedBox(height: 12),
                      ],

                      if (_isSignIn) ..._signInFields() else ..._signUpFields(),
                      const SizedBox(height: 4),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _loading ? null : (_isSignIn ? _doSignIn : _doSignUp),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _green,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          child: _loading
                              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : Text(_isSignIn ? 'Kirish' : 'Ro\'yxatdan o\'tish', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _tab(String label, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: active ? const Color(0xFF22C55E) : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                  color: active ? Colors.white : const Color(0xFF888888))),
        ),
      ),
    );
  }

  List<Widget> _signInFields() => [
    _field('Username', _siU, hint: '@username', keyboardType: TextInputType.text),
    _field('Parol', _siP, hint: '••••••', obscure: true),
  ];

  List<Widget> _signUpFields() => [
    _field('Username', _suU, hint: '@username'),
    _field('Ism Familiya', _suN, hint: 'To\'liq ism'),
    _field('Parol', _suP, hint: 'Kamida 6 belgi', obscure: true),
    _field('Parolni tasdiqlash', _suP2, hint: 'Takrorlang', obscure: true),
  ];

  Widget _field(String label, TextEditingController ctrl, {String hint = '', bool obscure = false, TextInputType? keyboardType}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF888888), letterSpacing: 0.5)),
          const SizedBox(height: 6),
          TextField(
            controller: ctrl,
            obscureText: obscure,
            keyboardType: keyboardType,
            style: const TextStyle(fontSize: 14),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: Color(0xFFBBBBBB)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              filled: true,
              fillColor: const Color(0xFFF5F5F7),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(11),
                borderSide: const BorderSide(color: Color(0xFF22C55E), width: 1.5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
