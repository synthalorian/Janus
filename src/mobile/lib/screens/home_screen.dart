import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import 'dashboard_screen.dart';
import 'chat_screen.dart';
import 'bots_screen.dart';
import 'souls_screen.dart';
import 'swarm_screen.dart';
import 'oversight_screen.dart';
import 'health_screen.dart';
import '../theme/janus_theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const DashboardScreen(),
    const ChatScreen(),
    const BotsScreen(),
    const SoulsScreen(),
    const SwarmScreen(),
    const OversightScreen(),
    const HealthScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>().currentTheme;
    final api = context.watch<JanusApiService>();

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_currentIndex]),
        actions: [
          // Theme picker
          PopupMenuButton<String>(
            icon: const Icon(Icons.palette_outlined),
            onSelected: (key) {
              context.read<ThemeProvider>().setTheme(key);
            },
            itemBuilder: (_) => JanusTheme.all.entries.map((e) =>
              PopupMenuItem(
                value: e.key,
                child: Row(
                  children: [
                    Text('${e.value.icon} ', style: const TextStyle(fontSize: 16)),
                    Text(e.value.name),
                    if (e.key == context.read<ThemeProvider>().currentThemeKey)
                      const Spacer(),
                    if (e.key == context.read<ThemeProvider>().currentThemeKey)
                      const Icon(Icons.check, size: 16),
                  ],
                ),
              ),
            ).toList(),
          ),
          // Logout
          IconButton(
            icon: const Icon(Icons.logout, size: 18),
            onPressed: () {
              // Quick restart by popping to root
              Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const Scaffold()), 
                (_) => false,
              );
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: theme.border)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard, size: 20), label: 'Dashboard'),
            BottomNavigationBarItem(icon: Icon(Icons.chat, size: 20), label: 'Chat'),
            BottomNavigationBarItem(icon: Icon(Icons.smart_toy_outlined, size: 20), label: 'Bots'),
            BottomNavigationBarItem(icon: Icon(Icons.auto_awesome, size: 20), label: 'Souls'),
            BottomNavigationBarItem(icon: Icon(Icons.groups, size: 20), label: 'Swarm'),
            BottomNavigationBarItem(icon: Icon(Icons.gavel, size: 20), label: 'Oversight'),
            BottomNavigationBarItem(icon: Icon(Icons.monitor_heart_outlined, size: 20), label: 'Health'),
          ],
        ),
      ),
    );
  }

  static const _titles = [
    'DASHBOARD', 'CHAT', 'BOT FORGE', 'SOULS',
    'SWARM', 'OVERSIGHT', 'HEALTH',
  ];
}

