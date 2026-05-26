import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import '../theme/janus_theme.dart';
import '../models/janus_models.dart';

class BotsScreen extends StatefulWidget {
  const BotsScreen({super.key});

  @override
  State<BotsScreen> createState() => _BotsScreenState();
}

class _BotsScreenState extends State<BotsScreen> {
  final _nameController = TextEditingController();
  String _selectedTemplate = 'coordinator';
  List<Bot> _bots = [];
  bool _loading = true;

  final List<String> _templates = [
    'coordinator',
    'researcher',
    'coder',
    'analyst',
    'watcher',
    'responder',
  ];

  @override
  void initState() {
    super.initState();
    _loadBots();
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _loadBots() async {
    setState(() => _loading = true);
    try {
      final api = context.read<JanusApiService>();
      final data = await api.getBots();
      setState(() {
        _bots = (data as List).map((j) => Bot.fromJson(j)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load bots: $e')),
        );
      }
    }
  }

  Future<void> _spawnBot() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;

    try {
      final api = context.read<JanusApiService>();
      await api.spawnBot(_selectedTemplate, name);
      _nameController.clear();
      await _loadBots();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bot spawned successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to spawn bot: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>().currentTheme;

    return Scaffold(
      backgroundColor: theme.bgPrimary,
      appBar: AppBar(
        title: const Text('Bots'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Spawn area
            Card(
              color: theme.bgSurface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: theme.accentPrimary.withOpacity(0.3)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Spawn New Bot',
                      style: TextStyle(
                        color: theme.accentPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _nameController,
                      style: TextStyle(color: theme.textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Bot Name',
                        labelStyle: TextStyle(color: theme.textPrimary.withOpacity(0.7)),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: theme.accentPrimary.withOpacity(0.4)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: theme.accentPrimary, width: 2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedTemplate,
                      dropdownColor: theme.bgSurface,
                      style: TextStyle(color: theme.textPrimary),
                      decoration: InputDecoration(
                        labelText: 'Template',
                        labelStyle: TextStyle(color: theme.textPrimary.withOpacity(0.7)),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: theme.accentPrimary.withOpacity(0.4)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: theme.accentPrimary, width: 2),
                        ),
                      ),
                      items: _templates.map((t) {
                        return DropdownMenuItem(
                          value: t,
                          child: Text(t),
                        );
                      }).toList(),
                      onChanged: (v) {
                        if (v != null) setState(() => _selectedTemplate = v);
                      },
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _spawnBot,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: theme.accentPrimary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: const Text('Spawn Bot', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            // Active bots list
            Text(
              'Active Bots',
              style: TextStyle(
                color: theme.accentPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? Center(
                      child: CircularProgressIndicator(color: theme.accentPrimary),
                    )
                  : _bots.isEmpty
                      ? Center(
                          child: Text(
                            'No active bots',
                            style: TextStyle(color: theme.textPrimary.withOpacity(0.5)),
                          ),
                        )
                      : ListView.builder(
                          itemCount: _bots.length,
                          itemBuilder: (context, index) {
                            final bot = _bots[index];
                            return Card(
                              color: theme.bgSurface,
                              margin: const EdgeInsets.only(bottom: 8),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                                side: BorderSide(color: theme.accentPrimary.withOpacity(0.2)),
                              ),
                              child: ListTile(
                                leading: Icon(Icons.smart_toy, color: theme.accentPrimary),
                                title: Text(
                                  bot.name ?? 'Unknown',
                                  style: TextStyle(
                                    color: theme.textPrimary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                subtitle: Text(
                                  'Template: ${bot.id ?? 'N/A'}',
                                  style: TextStyle(
                                    color: theme.textPrimary.withOpacity(0.6),
                                  ),
                                ),
                                trailing: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: theme.accentPrimary.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                      color: theme.accentPrimary.withOpacity(0.4),
                                    ),
                                  ),
                                  child: Text(
                                    bot.status ?? 'unknown',
                                    style: TextStyle(
                                      color: theme.accentPrimary,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}