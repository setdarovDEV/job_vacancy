import 'dart:convert' show utf8;

import '../../core/l10n/l10n.dart';

/// Client-side checks that mirror the API's rules, so most mistakes are caught before a
/// round trip. The server stays the authority: its `fields` errors are shown too.
class Validators {
  Validators(this.texts);

  final ErrorTexts texts;

  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  String? required(String? v) => (v == null || v.trim().isEmpty) ? texts.ruleText('required') : null;

  String? email(String? v) {
    final value = v?.trim() ?? '';
    if (value.isEmpty) return texts.ruleText('required');
    if (value.length > 254 || !_email.hasMatch(value)) return texts.ruleText('email');
    return null;
  }

  /// Same as the server's `password` rule (backend/internal/pkg/validate): 8–72 bytes of
  /// UTF-8, an ASCII digit, and a letter (ASCII, or any non-ASCII character). Every failure
  /// reports the same rule, like the server.
  static bool isStrongPassword(String p) {
    final bytes = utf8.encode(p).length;
    if (bytes < 8 || bytes > 72) return false;
    var letter = false, digit = false;
    for (final r in p.runes) {
      if (r >= 0x30 && r <= 0x39) {
        digit = true;
      } else if (r > 127 || ((r | 0x20) >= 0x61 && (r | 0x20) <= 0x7a)) {
        letter = true;
      }
    }
    return letter && digit;
  }

  String? password(String? v) {
    final value = v ?? '';
    if (value.isEmpty) return texts.ruleText('required');
    return isStrongPassword(value) ? null : texts.ruleText('password');
  }

  String? fullName(String? v) {
    final value = v?.trim() ?? '';
    if (value.isEmpty) return texts.ruleText('required');
    if (value.length < 2) return texts.ruleText('min=2');
    if (value.length > 100) return texts.ruleText('max=100');
    return null;
  }

  String? code(String? v) {
    final value = v ?? '';
    if (value.isEmpty) return texts.ruleText('required');
    if (!RegExp(r'^\d{6}$').hasMatch(value)) return texts.ruleText('len=6');
    return null;
  }

  /// Uzbek numbers: +998 and 9 digits (spaces and dashes allowed).
  String? phone(String? v) {
    final digits = (v ?? '').replaceAll(RegExp(r'[^\d+]'), '');
    if (digits.isEmpty || digits == '+998') return texts.ruleText('required');
    if (!RegExp(r'^\+?998\d{9}$').hasMatch(digits)) return texts.ruleText('phone');
    return null;
  }
}
