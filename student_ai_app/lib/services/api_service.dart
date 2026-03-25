import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

class ApiService {
  static final _client = http.Client();

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
      };

  // ─── User Stats ────────────────────────────────────────────
  static Future<Map<String, dynamic>?> getUserStats(String name) async {
    try {
      final r = await _client
          .get(Uri.parse('$kBaseUrl/api/user-stats?name=${Uri.encodeComponent(name)}'))
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) return jsonDecode(r.body);
    } catch (_) {}
    return null;
  }

  // ─── Leaderboard ───────────────────────────────────────────
  static Future<List<dynamic>> getLeaderboardFull() async {
    try {
      final r = await _client
          .get(Uri.parse('$kBaseUrl/api/leaderboard-full'))
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        return d is List ? d : (d['users'] ?? []);
      }
    } catch (_) {}
    return [];
  }

  // ─── Activity Feed ─────────────────────────────────────────
  static Future<List<dynamic>> getActivityFeed({int limit = 30}) async {
    try {
      final r = await _client
          .get(Uri.parse('$kBaseUrl/api/activity-feed?limit=$limit'))
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        return d is List ? d : [];
      }
    } catch (_) {}
    return [];
  }

  // ─── Subjects ──────────────────────────────────────────────
  static Future<List<dynamic>> getSubjects() async {
    try {
      final r = await _client
          .get(Uri.parse('$kBaseUrl/api/subjects'))
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        return d is List ? d : [];
      }
    } catch (_) {}
    return [];
  }

  // ─── Submit Test Score ─────────────────────────────────────
  static Future<bool> submitScore({
    required String name,
    required String username,
    required int score,
    required int totalQ,
    required int wrongCount,
    required String subjectKey,
    required String subjectName,
    int durationMin = 1,
  }) async {
    try {
      final r = await _client
          .post(
            Uri.parse('$kBaseUrl/api/web-score'),
            headers: _headers,
            body: jsonEncode({
              'name': name,
              'username': username,
              'score': score,
              'totalQ': totalQ,
              'wrongCount': wrongCount,
              'subjectKey': subjectKey,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) {
        // Sessiyani ham saqlash (activity feed uchun)
        await _client
            .post(
              Uri.parse('$kBaseUrl/api/test-session'),
              headers: _headers,
              body: jsonEncode({
                'name': name,
                'tgUsername': username,
                'subjectKey': subjectKey,
                'subjectName': subjectName,
                'score': score,
                'totalQ': totalQ,
                'wrongCount': wrongCount,
                'correctCount': score,
                'durationMin': durationMin,
              }),
            )
            .timeout(const Duration(seconds: 5));
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ─── Chat: Xabar yuborish ──────────────────────────────────
  static Future<bool> sendMessage({
    required String fromName,
    required String toName,
    required String text,
    String? imageData,
  }) async {
    try {
      final r = await _client
          .post(
            Uri.parse('$kBaseUrl/api/chat/send'),
            headers: _headers,
            body: jsonEncode({
              'fromName': fromName,
              'toName': toName,
              'text': text,
              if (imageData != null) 'imageData': imageData,
            }),
          )
          .timeout(const Duration(seconds: 10));
      return r.statusCode == 200;
    } catch (_) {}
    return false;
  }

  // ─── Chat: Xabarlarni olish ────────────────────────────────
  static Future<List<dynamic>> getMessages({
    required String name1,
    required String name2,
    int since = 0,
  }) async {
    try {
      final r = await _client
          .get(Uri.parse(
              '$kBaseUrl/api/chat/messages?name1=${Uri.encodeComponent(name1)}&name2=${Uri.encodeComponent(name2)}&since=$since'))
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        return d['messages'] ?? [];
      }
    } catch (_) {}
    return [];
  }

  // ─── Chat: Suhbatlar ro'yxati ──────────────────────────────
  static Future<List<dynamic>> getChatList(String myName) async {
    try {
      final r = await _client
          .get(Uri.parse(
              '$kBaseUrl/api/chat/list?myName=${Uri.encodeComponent(myName)}'))
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) {
        final d = jsonDecode(r.body);
        return d is List ? d : [];
      }
    } catch (_) {}
    return [];
  }

  // ─── Chat: O'qilgan deb belgilash ─────────────────────────
  static Future<void> markRead(String myName, String otherName) async {
    try {
      await _client
          .post(
            Uri.parse('$kBaseUrl/api/chat/read'),
            headers: _headers,
            body: jsonEncode({'myName': myName, 'otherName': otherName}),
          )
          .timeout(const Duration(seconds: 5));
    } catch (_) {}
  }

  // ─── Chat: O'chirish ───────────────────────────────────────
  static Future<bool> deleteChat(String myName, String otherName) async {
    try {
      final req = http.Request(
          'DELETE', Uri.parse('$kBaseUrl/api/chat/delete'));
      req.headers.addAll(_headers);
      req.body = jsonEncode({'myName': myName, 'otherName': otherName});
      final streamed = await _client.send(req).timeout(const Duration(seconds: 10));
      return streamed.statusCode == 200;
    } catch (_) {}
    return false;
  }

  // ─── Chat: O'qilmagan xabarlar soni ───────────────────────
  static Future<int> getUnreadCount(String myName) async {
    try {
      final r = await _client
          .get(Uri.parse(
              '$kBaseUrl/api/chat/unread?myName=${Uri.encodeComponent(myName)}'))
          .timeout(const Duration(seconds: 5));
      if (r.statusCode == 200) {
        return jsonDecode(r.body)['total'] ?? 0;
      }
    } catch (_) {}
    return 0;
  }

  // ─── Follow ────────────────────────────────────────────────
  static Future<String?> toggleFollow(String follower, String following) async {
    try {
      final r = await _client
          .post(
            Uri.parse('$kBaseUrl/api/follow'),
            headers: _headers,
            body: jsonEncode({'follower': follower, 'following': following}),
          )
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) return jsonDecode(r.body)['action'];
    } catch (_) {}
    return null;
  }

  // ─── Follow Info ───────────────────────────────────────────
  static Future<Map<String, dynamic>> getFollowInfo(
      String name, String myName) async {
    try {
      final r = await _client
          .get(Uri.parse(
              '$kBaseUrl/api/follow-info?name=${Uri.encodeComponent(name)}&myName=${Uri.encodeComponent(myName)}'))
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) return jsonDecode(r.body);
    } catch (_) {}
    return {'followers': 0, 'following': 0, 'isFollowing': false};
  }

  // ─── Users Map (foydalanuvchilar ro'yxati) ─────────────────
  static Future<Map<String, dynamic>> getUsersMap() async {
    try {
      final r = await _client
          .get(Uri.parse('$kBaseUrl/api/users-map'))
          .timeout(const Duration(seconds: 10));
      if (r.statusCode == 200) return Map<String, dynamic>.from(jsonDecode(r.body));
    } catch (_) {}
    return {};
  }

  // ─── Photo ─────────────────────────────────────────────────
  static Future<String?> getPhoto(String name) async {
    try {
      final r = await _client
          .get(Uri.parse(
              '$kBaseUrl/api/get-photo?name=${Uri.encodeComponent(name)}'))
          .timeout(const Duration(seconds: 5));
      if (r.statusCode == 200) {
        return jsonDecode(r.body)['photo'];
      }
    } catch (_) {}
    return null;
  }

  static String photoUrl(String name) =>
      '$kBaseUrl/api/get-photo?name=${Uri.encodeComponent(name)}';
}
