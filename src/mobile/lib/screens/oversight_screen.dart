import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import '../theme/janus_theme.dart';
import '../models/janus_models.dart';

class OversightScreen extends StatefulWidget {
  const OversightScreen({super.key});

  @override
  State<OversightScreen> createState() => _OversightScreenState();
}

class _OversightScreenState extends State<OversightScreen> {
  OversightStats _stats = OversightStats();
  List<dynamic> _pending = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final api = context.read<JanusApiService>();
      final statsJson = await api.getOversightStats();
      final pending = await api.getOversightPending();
      if (mounted) {
        setState(() {
          _stats = OversightStats.fromJson(statsJson);
          _pending = pending;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>().currentTheme;

    return RefreshIndicator(
      onRefresh: _loadData,
      color: theme.accentPrimary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            Expanded(child: _StatCard(value: '${_stats.pending}', label: 'PENDING', color: theme.warning, theme: theme)),
            const SizedBox(width: 8),
            Expanded(child: _StatCard(value: '${_stats.approved}', label: 'APPROVED', color: theme.success, theme: theme)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _StatCard(value: '${_stats.rejected}', label: 'REJECTED', color: theme.error, theme: theme)),
            const SizedBox(width: 8),
            Expanded(child: _StatCard(value: '${_stats.total}', label: 'TOTAL', color: theme.accentSecondary, theme: theme)),
          ]),
          const SizedBox(height: 20),
          Text('Pending Review', style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.08,
            color: theme.textMuted, fontFamily: 'Share Tech Mono',
          )),
          const SizedBox(height: 8),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_pending.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(40),
                child: Column(children: [
                  const Text('⚖️', style: TextStyle(fontSize: 36)),
                  const SizedBox(height: 8),
                  Text('No pending actions', style: TextStyle(color: theme.textMuted, fontSize: 13)),
                ]),
              ),
            )
          else
            ..._pending.map((a) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text('${a['actionType'] ?? 'Action'}', style: TextStyle(
                        fontWeight: FontWeight.w600, color: theme.textPrimary, fontSize: 13,
                      )),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: theme.warning.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text('${a['oversightLevel'] ?? 'peer'}', style: TextStyle(
                          fontSize: 10, color: theme.warning, fontFamily: 'Share Tech Mono',
                        )),
                      ),
                    ]),
                    const SizedBox(height: 4),
                    Text('${a['description'] ?? ''}', style: TextStyle(
                      fontSize: 12, color: theme.textSecondary,
                    )),
                    const SizedBox(height: 4),
                    Text('by ${a['agentName'] ?? 'unknown'}', style: TextStyle(
                      fontSize: 10, color: theme.textMuted, fontFamily: 'Share Tech Mono',
                    )),
                  ],
                ),
              ),
            )),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  final JanusTheme theme;
  const _StatCard({required this.value, required this.label, required this.color, required this.theme});

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
          fontFamily: 'Orbitron', fontSize: 28, fontWeight: FontWeight.w700, color: color,
        )),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(
          fontSize: 11, fontWeight: FontWeight.w500, letterSpacing: 0.08, color: theme.textMuted,
        )),
      ]),
    );
  }
}