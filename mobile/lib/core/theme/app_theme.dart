import 'package:flutter/material.dart';

import 'tokens.dart';

/// Unbounded (display: headings, big numbers) + Onest (everything else), major-third
/// scale from 16 px like the web. Both are variable fonts: the weight is set on the wght
/// axis as well as fontWeight so it renders the same on every platform.
TextStyle _style(String family, double size, double height, FontWeight weight, {double letterSpacing = 0}) => TextStyle(
  fontFamily: family,
  fontSize: size,
  height: height,
  fontWeight: weight,
  letterSpacing: letterSpacing,
  fontVariations: [FontVariation('wght', weight.value.toDouble())],
);

TextTheme _textTheme(AppColors c) {
  const d = 'Unbounded', t = 'Onest';
  return TextTheme(
    displayLarge: _style(d, 39, 1.12, FontWeight.w600, letterSpacing: -0.8),
    displayMedium: _style(d, 31, 1.2, FontWeight.w600, letterSpacing: -0.6),
    displaySmall: _style(d, 25, 1.3, FontWeight.w600, letterSpacing: -0.4),
    headlineMedium: _style(d, 20, 1.35, FontWeight.w600, letterSpacing: -0.2),
    headlineSmall: _style(d, 17, 1.4, FontWeight.w600, letterSpacing: -0.1),
    titleLarge: _style(t, 20, 1.45, FontWeight.w600),
    titleMedium: _style(t, 16, 1.5, FontWeight.w600),
    titleSmall: _style(t, 14, 1.5, FontWeight.w600),
    bodyLarge: _style(t, 16, 1.6, FontWeight.w400),
    bodyMedium: _style(t, 14, 1.5, FontWeight.w400),
    bodySmall: _style(t, 12.8, 1.45, FontWeight.w400),
    labelLarge: _style(t, 15, 1.3, FontWeight.w600),
    labelMedium: _style(t, 13, 1.3, FontWeight.w500),
    labelSmall: _style(t, 12, 1.3, FontWeight.w500),
  ).apply(bodyColor: c.ink, displayColor: c.ink);
}

ThemeData buildTheme(Brightness brightness) {
  final c = brightness == Brightness.light ? AppColors.light : AppColors.dark;
  final text = _textTheme(c);
  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.lapis,
    onPrimary: c.onLapis,
    primaryContainer: c.lapisSoft,
    onPrimaryContainer: c.lapisInk,
    secondary: c.firuza,
    onSecondary: c.onLapis,
    tertiary: c.zafaron,
    onTertiary: c.ink,
    error: c.anor,
    onError: Colors.white,
    errorContainer: c.anorSoft,
    onErrorContainer: c.anorInk,
    surface: c.surface,
    onSurface: c.ink,
    onSurfaceVariant: c.ink2,
    outline: c.lineStrong,
    outlineVariant: c.line,
    surfaceContainerLowest: c.paper,
    surfaceContainerHighest: c.surface,
  );
  final controlShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.control));
  OutlineInputBorder border(Color color, [double w = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(AppRadii.control),
    borderSide: BorderSide(color: color, width: w),
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.paper,
    textTheme: text,
    fontFamily: 'Onest',
    extensions: [c],
    splashFactory: InkSparkle.splashFactory,
    dividerTheme: DividerThemeData(color: c.line, thickness: 1, space: 1),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      foregroundColor: c.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: text.headlineSmall,
    ),
    cardTheme: CardThemeData(
      color: c.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.panel),
        side: BorderSide(color: c.line),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      hintStyle: text.bodyLarge?.copyWith(color: c.ink3),
      labelStyle: text.bodyMedium?.copyWith(color: c.ink2),
      floatingLabelStyle: text.bodyMedium?.copyWith(color: c.lapisInk),
      errorStyle: text.bodySmall?.copyWith(color: c.anorInk),
      border: border(c.lineStrong),
      enabledBorder: border(c.lineStrong),
      focusedBorder: border(c.lapis, 1.5),
      errorBorder: border(c.anor),
      focusedErrorBorder: border(c.anor, 1.5),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.lapis,
        foregroundColor: c.onLapis,
        disabledBackgroundColor: c.lapis.withValues(alpha: 0.45),
        disabledForegroundColor: c.onLapis.withValues(alpha: 0.8),
        minimumSize: const Size.fromHeight(52),
        shape: controlShape,
        textStyle: text.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        minimumSize: const Size.fromHeight(52),
        side: BorderSide(color: c.lineStrong),
        shape: controlShape,
        textStyle: text.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: c.lapisInk, shape: controlShape, textStyle: text.labelLarge),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: c.ink,
      contentTextStyle: text.bodyMedium?.copyWith(color: c.paper),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.control)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      indicatorColor: c.lapisSoft,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => text.labelSmall?.copyWith(color: s.contains(WidgetState.selected) ? c.lapisInk : c.ink3),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(color: s.contains(WidgetState.selected) ? c.lapisInk : c.ink3, size: 24),
      ),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: c.ink2,
      textColor: c.ink,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
    ),
  );
}
