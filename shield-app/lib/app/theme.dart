import 'package:flutter/material.dart';

class ShieldTheme {
  static const Color primary = Color(0xFF1565C0);
  static const Color secondary = Color(0xFF43A047);
  static const Color error = Color(0xFFE53935);
  static const Color background = Color(0xFFF8FAFC);

  static ThemeData get theme => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: primary, primary: primary, secondary: secondary, error: error, surface: Colors.white),
    fontFamily: 'Roboto',
    scaffoldBackgroundColor: background,
    appBarTheme: const AppBarTheme(backgroundColor: Colors.white, foregroundColor: Color(0xFF1A1A2E), elevation: 0, scrolledUnderElevation: 1, centerTitle: false),
    cardTheme: CardTheme(elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFE8EDF2)))),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(backgroundColor: primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)), minimumSize: const Size(double.infinity, 50), textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600))),
    inputDecorationTheme: InputDecorationTheme(border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)), filled: true, fillColor: const Color(0xFFF8FAFC), contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14)),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(selectedItemColor: primary, unselectedItemColor: Color(0xFF9E9E9E), backgroundColor: Colors.white, type: BottomNavigationBarType.fixed, elevation: 8),
  );
}
