import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'router.dart';
import 'theme.dart';

class ShieldApp extends ConsumerWidget {
  const ShieldApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Shield',
      theme: ShieldTheme.theme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
