import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/janus_api.dart';
import 'theme/janus_theme.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        Provider(create: (_) => JanusApiService()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const JanusMobileApp(),
    ),
  );
}

class JanusMobileApp extends StatelessWidget {
  const JanusMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>();

    return MaterialApp(
      title: 'Janus Mobile',
      debugShowCheckedModeBanner: false,
      theme: theme.currentTheme.toThemeData(),
      home: Consumer<JanusApiService>(
        builder: (context, api, _) {
          if (!api.isAuthenticated) {
            return const AuthScreen();
          }
          return const HomeScreen();
        },
      ),
    );
  }
}