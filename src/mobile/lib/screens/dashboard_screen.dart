import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import '../theme/janus_theme.dart';
import '../models/janus_models.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic> _health = {};
  Map<String, dynamic> _stats = {};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final api = context.read<JanusApiService>();
    final health = await api.getHealth();
    setState(() {
      _health = health;
      _stats = health['stats'] as Map<String, dynamic>? ?? {};
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>().currentTheme;
    final features = _health['features'] as Map<String, dynamic>? ?? {};

    return RefreshIndicator(
      onRefresh: _loadData,
      color: theme.accentPrimary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Stats grid
          _StatCard(value: '${_stats['users'] ?? '—'}', label: 'USERS', theme: theme),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _StatCard(value: '${_stats['channels'] ?? '—'}', label: 'CHANNELS', theme: theme)),
            const SizedBox(width: 8),
            Expanded(child: _StatCard(value: '${_stats['messages'] ?? '—'}', label: 'MESSAGES', theme: theme)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _StatCard(value: '${_stats['graphNodes'] ?? '—'}', label: 'GRAPH NODES', theme: theme)),
            const SizedBox(width: 8),
            Expanded(child: _StatCard(value: '${_stats['graphEdges'] ?? '—'}', label: 'GRAPH EDGES', theme: theme)),
          ]),
          const SizedBox(height: 20),

          // Welcome card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('🎹 Welcome to Janus', style: TextStyle(
                    fontFamily: 'Orbitron', fontSize: 13, fontWeight: FontWeight.w600,
                    color: theme.textSecondary, letterSpacing: 0.04,
                  )),
                  const SizedBox(height: 12),
                  Text(
                    'Your AI communication hub with knowledge graphs, bot orchestration, and multi-agent swarms.',
                    style: TextStyle(fontSize: 13, color: theme.textSecondary, height: 1.7),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // System card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('🔌 System', style: TextStyle(
                    fontFamily: 'Orbitron', fontSize: 13, fontWeight: FontWeight.w600,
                    color: theme.textSecondary, letterSpacing: 0.04,
                  )),
                  const SizedBox(height: 12),
                  _SysRow(label: 'Status', value: _health['status'] ?? 'unknown', color: theme.success, theme: theme),
                  _SysRow(label: 'Database', value: _health['database'] ?? 'unknown', color: theme.accentCyan, theme: theme),
                  if (features.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text('FEATURE FLAGS', style: TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.08,
                      color: theme.textMuted, fontFamily: 'Share Tech Mono',
                    )),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6, runSpacing: 6,
                      children: features.entries.map((e) => _Badge(
                        text: '${e.value == true ? '✓' : '✗'} ${e.key.replaceAllMapped(RegExp(r'[A-Z]'), (m) => ' ${m.group(0)}').trim()}',
                        color: e.value == true ? theme.success : theme.error,
                        theme: theme,
                      )).toList(),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String value;
  final String label;
  final JanusTheme theme;
  const _StatCard({required this.value, required this.label, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.border),
      ),
      child: Column(children: [
        Text(value, style: TextStyle(
          fontFamily: 'Orbitron', fontSize: 32, fontWeight: FontWeight.w700,
          color: theme.accentPrimary,
        )),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(
          fontSize: 11, fontWeight: FontWeight.w500, letterSpacing: 0.08,
          color: theme.textMuted,
        )),
      ]),
    );
  }
}

class _SysRow extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final JanusTheme theme;
  const _SysRow({required this.label, required this.value, required this.color, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Text('$label: ', style: TextStyle(fontSize: 12, color: theme.textMuted)),
        _Badge(text: value, color: color, theme: theme),
      ]),
    );
  }
}

class _Badge extends StatelessWidget {
  final String text;
  final Color color;
  final JanusTheme theme;
  const _Badge({required this.text, required this.color, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(30),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text, style: TextStyle(
        fontSize: 10, fontWeight: FontWeight.w600,
        color: color, fontFamily: 'Share Tech Mono', letterSpacing: 0.03,
      )),
    );
  }
}