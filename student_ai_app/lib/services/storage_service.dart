import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static const _usersKey = 'sa_users';
  static const _sessionKey = 'sa_session';
  static const _adminKey = 'sa_admin';

  // ─── Foydalanuvchilar ───────────────────────────────────────
  static Future<Map<String, dynamic>> getUsers() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_usersKey);
    if (raw == null) return {};
    return Map<String, dynamic>.from(jsonDecode(raw));
  }

  static Future<void> saveUsers(Map<String, dynamic> users) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_usersKey, jsonEncode(users));
  }

  // ─── Session ───────────────────────────────────────────────
  static Future<Map<String, dynamic>?> getSession() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_sessionKey);
    if (raw == null) return null;
    return Map<String, dynamic>.from(jsonDecode(raw));
  }

  static Future<void> saveSession(Map<String, dynamic> sess) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_sessionKey, jsonEncode(sess));
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionKey);
  }

  // ─── Admin ─────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getAdmin() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_adminKey);
    if (raw == null) return {'username': 'admin', 'name': 'Admin', 'pass': 'admin123'};
    return Map<String, dynamic>.from(jsonDecode(raw));
  }

  static bool isValidUsername(String u) {
    if (u.length < 3) return false;
    return RegExp(r'^[a-z0-9_.]+$').hasMatch(u);
  }

  static bool isValidName(String n) => n.trim().length >= 3;
}
