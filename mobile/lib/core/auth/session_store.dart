import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/auth_result.dart';
import '../models/user.dart';

/// Where tokens (and the last known user, for offline launches) survive restarts.
abstract interface class SessionStore {
  Future<Tokens?> readTokens();
  Future<User?> readUser();
  Future<void> save(Tokens tokens, User user);
  Future<void> saveTokens(Tokens tokens);
  Future<void> saveUser(User user);
  Future<void> clear();
}

/// Keychain (iOS) / EncryptedSharedPreferences-backed keystore (Android).
class SecureSessionStore implements SessionStore {
  SecureSessionStore([FlutterSecureStorage? storage]) : _s = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _s;
  static const _tokensKey = 'jv.tokens';
  static const _userKey = 'jv.user';

  @override
  Future<Tokens?> readTokens() => _read(_tokensKey, Tokens.fromJson);

  @override
  Future<User?> readUser() => _read(_userKey, User.fromJson);

  @override
  Future<void> save(Tokens tokens, User user) async {
    await saveTokens(tokens);
    await saveUser(user);
  }

  @override
  Future<void> saveTokens(Tokens tokens) => _s.write(key: _tokensKey, value: jsonEncode(tokens.toJson()));

  @override
  Future<void> saveUser(User user) => _s.write(key: _userKey, value: jsonEncode(user.toJson()));

  @override
  Future<void> clear() async {
    await _s.delete(key: _tokensKey);
    await _s.delete(key: _userKey);
  }

  Future<T?> _read<T>(String key, T Function(Map<String, Object?>) parse) async {
    final raw = await _s.read(key: key);
    if (raw == null) return null;
    try {
      return parse(jsonDecode(raw) as Map<String, Object?>);
    } on Object {
      await _s.delete(key: key); // written by an older, incompatible build
      return null;
    }
  }
}

final sessionStoreProvider = Provider<SessionStore>((_) => SecureSessionStore());

/// For tests and previews.
class MemorySessionStore implements SessionStore {
  Tokens? tokens;
  User? user;

  @override
  Future<Tokens?> readTokens() async => tokens;
  @override
  Future<User?> readUser() async => user;
  @override
  Future<void> save(Tokens t, User u) async {
    tokens = t;
    user = u;
  }

  @override
  Future<void> saveTokens(Tokens t) async => tokens = t;
  @override
  Future<void> saveUser(User u) async => user = u;
  @override
  Future<void> clear() async {
    tokens = null;
    user = null;
  }
}
