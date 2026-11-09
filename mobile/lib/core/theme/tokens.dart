import 'package:flutter/material.dart';

/// Semantic colors from the web design system (web/app/styles/app.css, docs/DESIGN.md):
/// lapis (brand), firuza (positive: salary, verified), zafaron (featured, "soon"),
/// anor (errors only). Widgets use these, never raw colors.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.paper,
    required this.surface,
    required this.sunken,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.line,
    required this.lineStrong,
    required this.lapis,
    required this.lapisSoft,
    required this.lapisInk,
    required this.onLapis,
    required this.firuza,
    required this.firuzaSoft,
    required this.firuzaInk,
    required this.zafaron,
    required this.zafaronSoft,
    required this.zafaronInk,
    required this.anor,
    required this.anorSoft,
    required this.anorInk,
    required this.focus,
    required this.glassBar,
    required this.blobs,
  });

  // Cards are opaque on mobile (no per-card blur, which costs frames while scrolling);
  // only bars over scrolling content are frosted (glassBar).
  static const light = AppColors(
    paper: Color(0xFFEEF2FA),
    surface: Color(0xFFFFFFFF),
    sunken: Color(0x0E1B3A8C),
    ink: Color(0xFF151A33),
    ink2: Color(0xFF4B5272),
    ink3: Color(0xFF6B7191),
    line: Color(0x17151A33),
    lineStrong: Color(0x2B151A33),
    lapis: Color(0xFF1B3A8C),
    lapisSoft: Color(0xFFE7EDFB),
    lapisInk: Color(0xFF1B3A8C),
    onLapis: Color(0xFFFFFFFF),
    firuza: Color(0xFF0E9F96),
    firuzaSoft: Color(0xFFDDF3F1),
    firuzaInk: Color(0xFF0A6F69),
    zafaron: Color(0xFFF0B429),
    zafaronSoft: Color(0xFFFFF4D9),
    zafaronInk: Color(0xFF7D5200),
    anor: Color(0xFFD1344B),
    anorSoft: Color(0xFFFCE6E9),
    anorInk: Color(0xFFB0263B),
    focus: Color(0xFF3D6BFF),
    glassBar: Color(0xADF6F8FD),
    blobs: [Color(0x573D6BFF), Color(0x420E9F96), Color(0x3DF0B429)],
  );

  static const dark = AppColors(
    paper: Color(0xFF0A0F22),
    surface: Color(0xFF141A33),
    sunken: Color(0x0EFFFFFF),
    ink: Color(0xFFEDF0FA),
    ink2: Color(0xFFAAB1CE),
    ink3: Color(0xFF8A91B2),
    line: Color(0x14FFFFFF),
    lineStrong: Color(0x29FFFFFF),
    lapis: Color(0xFF8EA7FF),
    lapisSoft: Color(0xFF1C2757),
    lapisInk: Color(0xFFB7C7FF),
    onLapis: Color(0xFF0D1226),
    firuza: Color(0xFF2BC4B8),
    firuzaSoft: Color(0xFF0F3336),
    firuzaInk: Color(0xFF5BD8CE),
    zafaron: Color(0xFFF5C451),
    zafaronSoft: Color(0xFF3A2E0E),
    zafaronInk: Color(0xFFF5C451),
    anor: Color(0xFFFF6B7D),
    anorSoft: Color(0xFF3D1720),
    anorInk: Color(0xFFFF8795),
    focus: Color(0xFF8EA7FF),
    glassBar: Color(0x9E0A0F22),
    blobs: [Color(0x573D6BFF), Color(0x332BC4B8), Color(0x3D8E67FF)],
  );

  final Color paper, surface, sunken, ink, ink2, ink3, line, lineStrong;
  final Color lapis, lapisSoft, lapisInk, onLapis;
  final Color firuza, firuzaSoft, firuzaInk;
  final Color zafaron, zafaronSoft, zafaronInk;
  final Color anor, anorSoft, anorInk;
  final Color focus, glassBar;

  /// Soft lapis / firuza / saffron light behind the glass bars (web: --blob-*).
  final List<Color> blobs;

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(AppColors? other, double t) {
    if (other == null) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppColors(
      paper: c(paper, other.paper),
      surface: c(surface, other.surface),
      sunken: c(sunken, other.sunken),
      ink: c(ink, other.ink),
      ink2: c(ink2, other.ink2),
      ink3: c(ink3, other.ink3),
      line: c(line, other.line),
      lineStrong: c(lineStrong, other.lineStrong),
      lapis: c(lapis, other.lapis),
      lapisSoft: c(lapisSoft, other.lapisSoft),
      lapisInk: c(lapisInk, other.lapisInk),
      onLapis: c(onLapis, other.onLapis),
      firuza: c(firuza, other.firuza),
      firuzaSoft: c(firuzaSoft, other.firuzaSoft),
      firuzaInk: c(firuzaInk, other.firuzaInk),
      zafaron: c(zafaron, other.zafaron),
      zafaronSoft: c(zafaronSoft, other.zafaronSoft),
      zafaronInk: c(zafaronInk, other.zafaronInk),
      anor: c(anor, other.anor),
      anorSoft: c(anorSoft, other.anorSoft),
      anorInk: c(anorInk, other.anorInk),
      focus: c(focus, other.focus),
      glassBar: c(glassBar, other.glassBar),
      blobs: [for (var i = 0; i < blobs.length; i++) c(blobs[i], other.blobs[i])],
    );
  }
}

/// Radii follow hierarchy: controls, then panels, then sheets (web: --radius-*).
abstract final class AppRadii {
  static const control = 12.0;
  static const panel = 18.0;
  static const sheet = 24.0;
}

/// 4-pt spacing scale.
abstract final class AppSpace {
  static const xs = 4.0, sm = 8.0, md = 12.0, lg = 16.0, xl = 24.0, xxl = 32.0;
}

extension AppThemeX on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
  TextTheme get text => Theme.of(this).textTheme;
}
