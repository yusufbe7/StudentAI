import 'package:flutter/material.dart';
import '../services/api_service.dart';

class TestScreen extends StatefulWidget {
  final String myName;
  final String myUsername;
  const TestScreen({super.key, required this.myName, required this.myUsername});

  @override
  State<TestScreen> createState() => _TestScreenState();
}

class _TestScreenState extends State<TestScreen> {
  List<dynamic> _subjects = [];
  bool _loading = true;

  static const _green = Color(0xFF22C55E);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final s = await ApiService.getSubjects();
    if (mounted) setState(() { _subjects = s; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: const Row(
                children: [
                  Text('Test', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF111111))),
                  Spacer(),
                  Text('Fan tanlang', style: TextStyle(fontSize: 13, color: Color(0xFF888888))),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF22C55E)))
                  : _subjects.isEmpty
                      ? const Center(child: Text('Fanlar topilmadi', style: TextStyle(color: Color(0xFF888888))))
                      : GridView.builder(
                          padding: const EdgeInsets.all(12),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.1),
                          itemCount: _subjects.length,
                          itemBuilder: (ctx, i) => _subjectCard(_subjects[i]),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _subjectCard(dynamic subj) {
    final key = (subj['key'] ?? '').toString();
    final name = (subj['name'] ?? subj['key'] ?? '').toString();
    final count = subj['count'] ?? 0;
    final emoji = subj['emoji'] ?? _emojiFor(key);

    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(
          builder: (_) => _TestModeScreen(
              subjectKey: key, subjectName: name, questionCount: count,
              myName: widget.myName, myUsername: widget.myUsername))),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 32)),
            const Spacer(),
            Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF111111)), maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text('$count savol', style: const TextStyle(fontSize: 11, color: Color(0xFF888888))),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(20)),
              child: const Text('Boshlash →', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF22C55E))),
            ),
          ],
        ),
      ),
    );
  }

  String _emojiFor(String key) {
    const map = {
      'math': '🔢', 'fizika': '⚡', 'kimyo': '🧪', 'biologiya': '🧬',
      'tarix': '📜', 'ingliz': '🇬🇧', 'rus': '🇷🇺', 'ona_tili': '📖',
      'adabiyot': '📚', 'geografiya': '🌍', 'informatika': '💻',
    };
    for (final k in map.keys) {
      if (key.toLowerCase().contains(k)) return map[k]!;
    }
    return '📝';
  }
}

// ─── Test o'tkazish ekrani ─────────────────────────────────────
class _TestModeScreen extends StatefulWidget {
  final String subjectKey, subjectName, myName, myUsername;
  final int questionCount;
  const _TestModeScreen({required this.subjectKey, required this.subjectName,
      required this.questionCount, required this.myName, required this.myUsername});

  @override
  State<_TestModeScreen> createState() => _TestModeScreenState();
}

class _TestModeScreenState extends State<_TestModeScreen> {
  int _count = 10;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        title: Text(widget.subjectName),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Savol soni', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111111))),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8, runSpacing: 8,
                    children: [10, 20, 30, 50].where((n) => n <= widget.questionCount).map((n) =>
                      GestureDetector(
                        onTap: () => setState(() => _count = n),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
                          decoration: BoxDecoration(
                            color: _count == n ? const Color(0xFF22C55E) : const Color(0xFFF5F5F7),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text('$n ta', style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: _count == n ? Colors.white : const Color(0xFF555555))),
                        ),
                      ),
                    ).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(
                    builder: (_) => _ActiveTestScreen(
                        subjectKey: widget.subjectKey, subjectName: widget.subjectName,
                        count: _count, myName: widget.myName, myUsername: widget.myUsername))),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF22C55E),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: const Text('Testni boshlash', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Aktiv test ────────────────────────────────────────────────
class _ActiveTestScreen extends StatefulWidget {
  final String subjectKey, subjectName, myName, myUsername;
  final int count;
  const _ActiveTestScreen({required this.subjectKey, required this.subjectName,
      required this.count, required this.myName, required this.myUsername});

  @override
  State<_ActiveTestScreen> createState() => _ActiveTestScreenState();
}

class _ActiveTestScreenState extends State<_ActiveTestScreen> {
  List<dynamic> _questions = [];
  int _current = 0;
  int _correct = 0;
  int? _selected;
  bool _answered = false;
  bool _loading = true;
  bool _done = false;
  final _startTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    final subjects = await ApiService.getSubjects();
    final subj = subjects.firstWhere(
      (s) => s['key'] == widget.subjectKey, orElse: () => null);
    if (subj == null || subj['questions'] == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final allQ = List<dynamic>.from(subj['questions']);
    allQ.shuffle();
    if (mounted) setState(() {
      _questions = allQ.take(widget.count).toList();
      _loading = false;
    });
  }

  void _answer(int idx) {
    if (_answered) return;
    final q = _questions[_current];
    final correct = q['correct'] ?? 0;
    setState(() {
      _selected = idx;
      _answered = true;
      if (idx == correct) _correct++;
    });
  }

  void _next() {
    if (_current + 1 >= _questions.length) {
      _finish();
    } else {
      setState(() { _current++; _selected = null; _answered = false; });
    }
  }

  Future<void> _finish() async {
    final dur = DateTime.now().difference(_startTime).inMinutes;
    await ApiService.submitScore(
      name: widget.myName,
      username: widget.myUsername,
      score: _correct,
      totalQ: _questions.length,
      wrongCount: _questions.length - _correct,
      subjectKey: widget.subjectKey,
      subjectName: widget.subjectName,
      durationMin: dur < 1 ? 1 : dur,
    );
    if (mounted) setState(() => _done = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFF22C55E))));
    if (_questions.isEmpty) return Scaffold(
      appBar: AppBar(title: Text(widget.subjectName), backgroundColor: Colors.white, elevation: 0),
      body: const Center(child: Text('Savollar topilmadi')),
    );
    if (_done) return _ResultScreen(correct: _correct, total: _questions.length,
        subjectName: widget.subjectName, onBack: () => Navigator.of(context).pop());

    final q = _questions[_current];
    final options = List<dynamic>.from(q['options'] ?? []);
    final correctIdx = q['correct'] ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        title: Text(widget.subjectName),
        backgroundColor: Colors.white,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: (_current + 1) / _questions.length,
            backgroundColor: const Color(0xFFE0E0E0),
            valueColor: const AlwaysStoppedAnimation(Color(0xFF22C55E)),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Savol ${_current + 1} / ${_questions.length}',
                style: const TextStyle(color: Color(0xFF888888), fontSize: 13)),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: Text((q['question'] ?? q['q'] ?? '').toString(),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF111111))),
            ),
            const SizedBox(height: 14),
            ...List.generate(options.length, (i) {
              Color bg = Colors.white;
              Color border = Colors.transparent;
              if (_answered) {
                if (i == correctIdx) { bg = const Color(0xFFE8F5E9); border = const Color(0xFF22C55E); }
                else if (i == _selected) { bg = const Color(0xFFFFEBEE); border = const Color(0xFFEF4444); }
              } else if (_selected == i) {
                bg = const Color(0xFFE8F5E9); border = const Color(0xFF22C55E);
              }
              return GestureDetector(
                onTap: () => _answer(i),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: border, width: 1.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: border != Colors.transparent ? border.withOpacity(0.15) : const Color(0xFFF5F5F7),
                        ),
                        child: Center(child: Text(String.fromCharCode(65 + i),
                            style: TextStyle(fontWeight: FontWeight.w700,
                                color: border != Colors.transparent ? border : const Color(0xFF555555)))),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text(options[i].toString(),
                          style: const TextStyle(fontSize: 14, color: Color(0xFF222222)))),
                    ],
                  ),
                ),
              );
            }),
            const Spacer(),
            if (_answered)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _next,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF22C55E), foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: Text(_current + 1 >= _questions.length ? 'Tugatish' : 'Keyingisi →',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ResultScreen extends StatelessWidget {
  final int correct, total;
  final String subjectName;
  final VoidCallback onBack;
  const _ResultScreen({required this.correct, required this.total, required this.subjectName, required this.onBack});

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (correct * 100 ~/ total) : 0;
    final emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(emoji, style: const TextStyle(fontSize: 64)),
                const SizedBox(height: 16),
                Text('$correct / $total', style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w900, color: Color(0xFF111111))),
                Text('$pct% to\'g\'ri', style: const TextStyle(fontSize: 18, color: Color(0xFF888888))),
                const SizedBox(height: 8),
                Text(subjectName, style: const TextStyle(fontSize: 16, color: Color(0xFF555555))),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () { Navigator.pop(context); Navigator.pop(context); onBack(); },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF22C55E), foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0),
                    child: const Text('Ortga qaytish', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
