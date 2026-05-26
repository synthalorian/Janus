import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class JanusTheme {
  final String name;
  final String icon;
  final Color bgPrimary;
  final Color bgSecondary;
  final Color bgTertiary;
  final Color bgSurface;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color accentPrimary;
  final Color accentSecondary;
  final Color accentTertiary;
  final Color accentCyan;
  final Color success;
  final Color warning;
  final Color error;
  final Color border;
  final Color borderLight;

  const JanusTheme({
    required this.name, required this.icon,
    required this.bgPrimary, required this.bgSecondary, required this.bgTertiary,
    required this.bgSurface, required this.textPrimary, required this.textSecondary,
    required this.textMuted, required this.accentPrimary, required this.accentSecondary,
    required this.accentTertiary, required this.accentCyan,
    required this.success, required this.warning, required this.error,
    required this.border, required this.borderLight,
  });

  Gradient get gradientPrimary => LinearGradient(
    colors: [accentPrimary, accentSecondary],
    begin: Alignment.topLeft, end: Alignment.bottomRight,
  );

  ThemeData toThemeData() {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgPrimary,
      colorScheme: ColorScheme.dark(
        primary: accentPrimary,
        secondary: accentSecondary,
        surface: bgSurface,
        error: error,
      ),
      cardColor: bgSurface,
      dividerColor: border,
      textTheme: GoogleFonts.interTextTheme().copyWith(
        headlineLarge: GoogleFonts.orbitron(
          fontSize: 24, fontWeight: FontWeight.w700,
          color: textPrimary, letterSpacing: 0.04,
        ),
        headlineMedium: GoogleFonts.orbitron(
          fontSize: 18, fontWeight: FontWeight.w600,
          color: textPrimary, letterSpacing: 0.04,
        ),
        titleLarge: GoogleFonts.orbitron(
          fontSize: 16, fontWeight: FontWeight.w600,
          color: textPrimary, letterSpacing: 0.04,
        ),
        bodyLarge: TextStyle(color: textPrimary, fontFamily: 'Inter'),
        bodyMedium: TextStyle(color: textSecondary, fontFamily: 'Inter'),
        bodySmall: TextStyle(color: textMuted, fontFamily: 'Inter'),
        labelLarge: TextStyle(
          color: accentPrimary, fontFamily: 'Share Tech Mono',
          fontSize: 12, letterSpacing: 0.04,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bgSecondary,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.orbitron(
          fontSize: 16, fontWeight: FontWeight.w600,
          color: textPrimary, letterSpacing: 0.04,
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: bgSecondary,
        selectedItemColor: accentPrimary,
        unselectedItemColor: textMuted,
        type: BottomNavigationBarType.fixed,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgTertiary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: accentPrimary, width: 2),
        ),
        hintStyle: TextStyle(color: textMuted, fontSize: 13),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accentPrimary,
          foregroundColor: bgPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: const TextStyle(
            fontFamily: 'Share Tech Mono', fontWeight: FontWeight.w600, fontSize: 12, letterSpacing: 0.5,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: bgSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: border),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: bgSurface,
        contentTextStyle: TextStyle(color: textPrimary),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  static final Map<String, JanusTheme> all = {
    'synthwave84': const JanusTheme(
      name: "Synthwave '84", icon: '🌆',
      bgPrimary: Color(0xFF0D0221), bgSecondary: Color(0xFF16082E),
      bgTertiary: Color(0xFF240037), bgSurface: Color(0xFF1A0A30),
      textPrimary: Color(0xFFFFFFFF), textSecondary: Color(0xFFC8B8E8),
      textMuted: Color(0xFF7A6B9E), accentPrimary: Color(0xFF8F00FF),
      accentSecondary: Color(0xFFFF00FF), accentTertiary: Color(0xFFFFFF66),
      accentCyan: Color(0xFF03EDF9), success: Color(0xFF00FF41),
      warning: Color(0xFFF3E70F), error: Color(0xFFFF0040),
      border: Color(0xFF3D1F6E), borderLight: Color(0xFF5A2A9E),
    ),
    'dark': const JanusTheme(
      name: 'Dark', icon: '🌑',
      bgPrimary: Color(0xFF1E1E2E), bgSecondary: Color(0xFF181825),
      bgTertiary: Color(0xFF252538), bgSurface: Color(0xFF212135),
      textPrimary: Color(0xFFCDD6F4), textSecondary: Color(0xFFA6ADC8),
      textMuted: Color(0xFF6C7086), accentPrimary: Color(0xFF89B4FA),
      accentSecondary: Color(0xFFCBA6F7), accentTertiary: Color(0xFFF9E2AF),
      accentCyan: Color(0xFF89DCEB), success: Color(0xFFA6E3A1),
      warning: Color(0xFFF9E2AF), error: Color(0xFFF38BA8),
      border: Color(0xFF313244), borderLight: Color(0xFF45475A),
    ),
    'cyberpunk': const JanusTheme(
      name: 'Cyberpunk', icon: '⚡',
      bgPrimary: Color(0xFF0A0A0A), bgSecondary: Color(0xFF141414),
      bgTertiary: Color(0xFF1C1C1C), bgSurface: Color(0xFF111111),
      textPrimary: Color(0xFFFFFCB3), textSecondary: Color(0xFFCCCA80),
      textMuted: Color(0xFF666633), accentPrimary: Color(0xFFFFDD00),
      accentSecondary: Color(0xFF00FF88), accentTertiary: Color(0xFFFF0040),
      accentCyan: Color(0xFF00DDFF), success: Color(0xFF00FF55),
      warning: Color(0xFFFFDD00), error: Color(0xFFFF0033),
      border: Color(0xFF333300), borderLight: Color(0xFF555500),
    ),
  };
}

// Provider for theme management
class ThemeProvider extends ChangeNotifier {
  JanusTheme _currentTheme = JanusTheme.all['synthwave84']!;

  JanusTheme get currentTheme => _currentTheme;
  String get currentThemeKey => _getKey(_currentTheme);

  void setTheme(String key) {
    if (JanusTheme.all.containsKey(key)) {
      _currentTheme = JanusTheme.all[key]!;
      notifyListeners();
    }
  }

  String _getKey(JanusTheme theme) {
    return JanusTheme.all.entries.firstWhere((e) => e.value.name == theme.name).key;
  }
}