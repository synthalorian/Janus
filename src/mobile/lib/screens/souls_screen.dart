import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import '../theme/janus_theme.dart';
import '../models/janus_models.dart';

class SoulsScreen extends StatefulWidget {
  const SoulsScreen({super.key});

  @override
  State<SoulsScreen> createState() => _SoulsScreenState();
}

class _SoulsScreenState extends State<SoulsScreen> {
  List<Soul> _souls = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSouls();
  }

  Future<void> _loadSouls() async {
    setState(() => _loading = true);
    try {
      final api = context.read<JanusApiService>();
      final data = await api.getSouls();
      setState(() {
        _souls = (data as List).map((j) => Soul.fromJson(j)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load souls: $e')),
        );
      }
    }
  }

  IconData _archetypeIcon(String? archetype) {
    switch (archetype?.toLowerCase()) {
      case 'warrior':
        return Icons.shield;
      case 'sage':
        return Icons.auto_stories;
      case 'creator':
        return Icons.palette;
      case 'guardian':
        return Icons.visibility;
      case 'explorer':
        return Icons.explore;
      default:
        return Icons.face;
    }
  }

  Color _archetypeColor(String? archetype, Color accent) {
    switch (archetype?.toLowerCase()) {
      case 'warrior':
        return Colors.redAccent;
      case 'sage':
        return Colors.purpleAccent;
      case 'creator':
        return Colors.amberAccent;
      case 'guardian':
        return Colors.tealAccent;
      case 'explorer':
        return Colors.cyanAccent;
      default:
        return accent;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>().currentTheme;

    return Scaffold(
      backgroundColor: theme.bgPrimary,
      appBar: AppBar(
        title: const Text('Souls'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: theme.accentPrimary),
            onPressed: _loadSouls,
          ),
        ],
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(color: theme.accentPrimary),
            )
          : _souls.isEmpty
              ? Center(
                  child: Text(
                    'No souls found',
                    style: TextStyle(color: theme.textPrimary.withOpacity(0.5)),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadSouls,
                  color: theme.accentPrimary,
                  child: GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 0.75,
                    ),
                    itemCount: _souls.length,
                    itemBuilder: (context, index) {
                      final soul = _souls[index];
                      final archColor = _archetypeColor(soul.archetype, theme.accentPrimary);

                      return Card(
                        color: theme.bgSurface,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: archColor.withOpacity(0.3),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Archetype icon row
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: archColor.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: archColor.withOpacity(0.4)),
                                    ),
                                    child: Icon(
                                      _archetypeIcon(soul.archetype),
                                      color: archColor,
                                      size: 20,
                                    ),
                                  ),
                                  const Spacer(),
                                  // Level badge
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: theme.accentPrimary.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(
                                        color: theme.accentPrimary.withOpacity(0.4),
                                      ),
                                    ),
                                    child: Text(
                                      'Lv.${soul.level ?? 0}',
                                      style: TextStyle(
                                        color: theme.accentPrimary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              // Soul name
                              Text(
                                soul.displayName ?? soul.name ?? 'Unknown',
                                style: TextStyle(
                                  color: theme.textPrimary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              // Archetype
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: archColor.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  soul.archetype ?? 'Unknown',
                                  style: TextStyle(
                                    color: archColor,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 6),
                              // Status
                              Row(
                                children: [
                                  Icon(Icons.circle, size: 8, color: soul.status == 'active' ? Colors.greenAccent : Colors.orangeAccent),
                                  const SizedBox(width: 4),
                                  Text(
                                    soul.status ?? 'unknown',
                                    style: TextStyle(
                                      color: theme.textPrimary.withOpacity(0.6),
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              // XP bar
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'XP: ${soul.experiencePoints ?? 0}',
                                      style: TextStyle(
                                        color: theme.textPrimary.withOpacity(0.5),
                                        fontSize: 10,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(3),
                                      child: LinearProgressIndicator(
                                        value: ((soul.experiencePoints ?? 0) % 1000) / 1000,
                                        backgroundColor: theme.bgPrimary,
                                        valueColor: AlwaysStoppedAnimation(archColor),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // Expertise tags
                              if (soul.expertiseTags != null && soul.expertiseTags!.isNotEmpty)
                                SizedBox(
                                  height: 20,
                                  child: ListView(
                                    scrollDirection: Axis.horizontal,
                                    children: soul.expertiseTags!.take(3).map((tag) {
                                      return Container(
                                        margin: const EdgeInsets.only(right: 4),
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: theme.accentPrimary.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          tag,
                                          style: TextStyle(
                                            color: theme.accentPrimary.withOpacity(0.8),
                                            fontSize: 9,
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}