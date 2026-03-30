import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers/theme_provider.dart';
import 'router.dart';
import 'theme.dart';

class ShieldApp extends ConsumerWidget {
  const ShieldApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router    = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title:                      'Shield',
      debugShowCheckedModeBanner: false,
      theme:                      ShieldTheme.light,
      darkTheme:                  ShieldTheme.dark,
      themeMode:                  themeMode,
      routerConfig:               router,
    );
  }
}
