import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import '../theme/janus_theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _nameController = TextEditingController();
  String _selectedType = 'human';
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _errorMessage = 'Please enter an agent name.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await context.read<JanusApiService>().register(name, _selectedType);
      if (!mounted) return;

      if (result['success'] != true) {
        setState(() {
          _errorMessage = result['message'] ?? 'Registration failed.';
        });
      }
      // On success, the Consumer<JanusApiService> in main.dart will
      // auto-navigate to HomeScreen since isAuthenticated becomes true.
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Connection error: ${e.toString()}';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>().currentTheme;

    return Scaffold(
      backgroundColor: theme.bgPrimary,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Card(
              color: theme.bgSurface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: theme.border),
              ),
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Janus Logo — gradient circle with icon
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: theme.gradientPrimary,
                      ),
                      child: const Icon(
                        Icons.face_retouching_natural,
                        size: 48,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // App name
                    Text(
                      'JANUS',
                      style: TextStyle(
                        fontFamily: 'Orbitron',
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: theme.textPrimary,
                        letterSpacing: 0.08,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Enter the Grid',
                      style: TextStyle(
                        color: theme.textMuted,
                        fontSize: 13,
                        letterSpacing: 0.04,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Error banner
                    if (_errorMessage != null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: theme.error.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: theme.error.withOpacity(0.4)),
                        ),
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: theme.error, fontSize: 12),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Agent name input
                    TextField(
                      controller: _nameController,
                      style: TextStyle(color: theme.textPrimary),
                      decoration: const InputDecoration(
                        labelText: 'Agent Name',
                        hintText: 'Enter your callsign',
                        prefixIcon: Icon(Icons.badge_outlined, size: 18),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Type dropdown (human / AI)
                    Container(
                      decoration: BoxDecoration(
                        color: theme.bgTertiary,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: theme.border),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedType,
                          isExpanded: true,
                          dropdownColor: theme.bgSecondary,
                          icon: Icon(Icons.expand_more, color: theme.textMuted),
                          style: TextStyle(color: theme.textPrimary, fontSize: 14),
                          items: [
                            DropdownMenuItem(
                              value: 'human',
                              child: Row(
                                children: [
                                  Icon(Icons.person, size: 18, color: theme.accentCyan),
                                  const SizedBox(width: 8),
                                  const Text('Human'),
                                ],
                              ),
                            ),
                            DropdownMenuItem(
                              value: 'ai',
                              child: Row(
                                children: [
                                  Icon(Icons.smart_toy, size: 18, color: theme.accentSecondary),
                                  const SizedBox(width: 8),
                                  const Text('AI'),
                                ],
                              ),
                            ),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _selectedType = val);
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Enter the Grid button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _register,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: theme.accentPrimary,
                          foregroundColor: theme.bgPrimary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          textStyle: const TextStyle(
                            fontFamily: 'Share Tech Mono',
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            letterSpacing: 0.08,
                          ),
                        ),
                        child: _isLoading
                            ? SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: theme.bgPrimary,
                                ),
                              )
                            : const Text('ENTER THE GRID'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}