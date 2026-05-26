import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import '../theme/janus_theme.dart';
import '../models/janus_models.dart';

class HealthScreen extends StatefulWidget {
  const HealthScreen({super.key});

  @override
  State<HealthScreen> createState() => _HealthScreenState();
}

class _HealthScreenState extends State<HealthScreen> {
  Map<String, dynamic>? _health;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadHealth();
  }

  Future<void> _loadHealth() async {
    setState(() => _loading = true);
    try {
      final api = context.read<JanusApiService>();
      _health = await api.getHealth();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load health: $e')),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  Color _statusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'ok':
      case 'up':
      case 'connected':
        return Colors.greenAccent;
      case 'degraded':
      case 'slow':
        return Colors.orangeAccent;
      case 'down':
      case 'error':
      case 'disconnected':
        return Colors.redAccent;
      default:
        return Colors.grey;
    }
  }

  IconData _statusIcon(String? status) {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'ok':
      case 'up':
      case 'connected':
        return Icons.check_circle;
      case 'degraded':
      case 'slow':
        return Icons.warning_amber;
      case 'down':
      case 'error':
      case 'disconnected':
        return Icons.error;
      default:
        return Icons.help;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>().currentTheme;

    return Scaffold(
      backgroundColor: theme.bgPrimary,
      appBar: AppBar(
        title: const Text('Health'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: theme.accentPrimary),
            onPressed: _loadHealth,
          ),
        ],
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(color: theme.accentPrimary),
            )
          : RefreshIndicator(
              onRefresh: _loadHealth,
              color: theme.accentPrimary,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Server status
                    Text(
                      'Server Status',
                      style: TextStyle(
                        color: theme.accentPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_health != null) ...[
                      // Overall status card
                      _buildStatusCard(
                        theme: theme,
                        title: 'API Server',
                        status: _health!['status']?.toString() ?? _health!['server']?.toString() ?? 'unknown',
                      ),
                      const SizedBox(height: 8),
                      // Database status card
                      if (_health!['database'] != null || _health!['db'] != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _buildStatusCard(
                            theme: theme,
                            title: 'Database',
                            status: _health!['database']?.toString() ?? _health!['db']?.toString() ?? 'unknown',
                          ),
                        ),
                      // Other service statuses
                      ..._health!.entries
                          .where((e) =>
                              e.key != 'status' &&
                              e.key != 'server' &&
                              e.key != 'database' &&
                              e.key != 'db' &&
                              e.key != 'features' &&
                              e.key != 'version')
                          .map((entry) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: _buildStatusCard(
                                  theme: theme,
                                  title: _formatKey(entry.key),
                                  status: entry.value?.toString() ?? 'unknown',
                                ),
                              )),
                      // Version info
                      if (_health!['version'] != null) ...[
                        const SizedBox(height: 16),
                        Card(
                          color: theme.bgSurface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                            side: BorderSide(color: theme.accentPrimary.withOpacity(0.2)),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Icon(Icons.info_outline, color: theme.accentPrimary.withOpacity(0.7), size: 18),
                                const SizedBox(width: 10),
                                Text(
                                  'Version: ${_health!['version']}',
                                  style: TextStyle(
                                    color: theme.textPrimary.withOpacity(0.7),
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                    const SizedBox(height: 24),
                    // Feature flags
                    Text(
                      'Feature Flags',
                      style: TextStyle(
                        color: theme.accentPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_health != null && _health!['features'] != null)
                      ...(_health!['features'] as Map).entries.map((entry) {
                        final enabled = entry.value == true || entry.value == 'true' || entry.value == 1;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Card(
                            color: theme.bgSurface,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                              side: BorderSide(
                                color: enabled ? Colors.greenAccent.withOpacity(0.3) : Colors.redAccent.withOpacity(0.2),
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: enabled
                                          ? Colors.greenAccent.withOpacity(0.12)
                                          : Colors.redAccent.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(
                                        color: enabled
                                            ? Colors.greenAccent.withOpacity(0.4)
                                            : Colors.redAccent.withOpacity(0.3),
                                      ),
                                    ),
                                    child: Icon(
                                      enabled ? Icons.toggle_on : Icons.toggle_off_outlined,
                                      color: enabled ? Colors.greenAccent : Colors.redAccent,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _formatKey(entry.key),
                                      style: TextStyle(
                                        color: theme.textPrimary,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: enabled
                                          ? Colors.greenAccent.withOpacity(0.12)
                                          : Colors.redAccent.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(
                                        color: enabled
                                            ? Colors.greenAccent.withOpacity(0.4)
                                            : Colors.redAccent.withOpacity(0.3),
                                      ),
                                    ),
                                    child: Text(
                                      enabled ? 'ON' : 'OFF',
                                      style: TextStyle(
                                        color: enabled ? Colors.greenAccent : Colors.redAccent,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      })
                    else
                      Card(
                        color: theme.bgSurface,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: BorderSide(color: theme.accentPrimary.withOpacity(0.2)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Center(
                            child: Text(
                              'No feature flags available',
                              style: TextStyle(color: theme.textPrimary.withOpacity(0.5)),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildStatusCard({
    required dynamic theme,
    required String title,
    required String status,
  }) {
    final color = _statusColor(status);
    return Card(
      color: theme.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: color.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: color.withOpacity(0.4)),
              ),
              child: Icon(
                _statusIcon(status),
                color: color,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: theme.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    status,
                    style: TextStyle(
                      color: theme.textPrimary.withOpacity(0.5),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: color.withOpacity(0.4)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.circle, size: 8, color: color),
                  const SizedBox(width: 4),
                  Text(
                    _shortStatus(status),
                    style: TextStyle(
                      color: color,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatKey(String key) {
    return key
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .split(' ')
        .map((word) => word.isNotEmpty ? '${word[0].toUpperCase()}${word.substring(1)}' : '')
        .join(' ');
  }

  String _shortStatus(String status) {
    if (status.length > 6) return status.substring(0, 6).toUpperCase();
    return status.toUpperCase();
  }

  }