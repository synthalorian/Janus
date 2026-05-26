import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import '../theme/janus_theme.dart';
import '../models/janus_models.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  List<Channel> _channels = [];
  Channel? _selectedChannel;
  List<Message> _messages = [];
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  bool _loadingChannels = true;
  bool _loadingMessages = false;

  @override
  void initState() {
    super.initState();
    _loadChannels();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadChannels() async {
    setState(() => _loadingChannels = true);
    try {
      final api = context.read<JanusApiService>();
      final data = await api.getChannels();
      if (!mounted) return;
      setState(() {
        _channels = data.map((json) => Channel.fromJson(json as Map<String, dynamic>)).toList();
        _loadingChannels = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingChannels = false);
    }
  }

  Future<void> _loadMessages(String channelId) async {
    setState(() => _loadingMessages = true);
    try {
      final api = context.read<JanusApiService>();
      final data = await api.getChannelMessages(channelId);
      if (!mounted) return;
      setState(() {
        _messages = data.map((json) => Message.fromJson(json as Map<String, dynamic>)).toList();
        _loadingMessages = false;
      });
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingMessages = false);
    }
  }

  void _selectChannel(Channel channel) {
    setState(() => _selectedChannel = channel);
    _loadMessages(channel.id);
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty || _selectedChannel == null) return;

    _messageController.clear();
    try {
      final api = context.read<JanusApiService>();
      await api.sendMessage(_selectedChannel!.id, content);
      _loadMessages(_selectedChannel!.id);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send message: $e')),
      );
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>().currentTheme;

    if (_selectedChannel == null) {
      return _buildChannelList(theme);
    }

    return _buildChatView(theme);
  }

  Widget _buildChannelList(JanusTheme theme) {
    if (_loadingChannels) {
      return Center(
        child: CircularProgressIndicator(color: theme.accentPrimary),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadChannels,
      color: theme.accentPrimary,
      child: _channels.isEmpty
          ? Center(
              child: Text(
                'No channels available',
                style: TextStyle(color: theme.textMuted),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _channels.length,
              itemBuilder: (context, index) {
                final channel = _channels[index];
                return Card(
                  child: ListTile(
                    leading: Icon(
                      channel.type == 'direct' ? Icons.person : Icons.tag,
                      color: theme.accentPrimary,
                    ),
                    title: Text(
                      channel.name,
                      style: TextStyle(
                        color: theme.textPrimary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    subtitle: Text(
                      channel.type,
                      style: TextStyle(color: theme.textMuted, fontSize: 12),
                    ),
                    trailing: Icon(
                      Icons.chevron_right,
                      color: theme.textMuted,
                      size: 20,
                    ),
                    onTap: () => _selectChannel(channel),
                  ),
                );
              },
            ),
    );
  }

  Widget _buildChatView(JanusTheme theme) {
    return Column(
      children: [
        // Channel header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: theme.bgSecondary,
            border: Border(bottom: BorderSide(color: theme.border)),
          ),
          child: Row(
            children: [
              IconButton(
                icon: Icon(Icons.arrow_back, color: theme.textPrimary, size: 20),
                onPressed: () => setState(() => _selectedChannel = null),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 12),
              Icon(
                _selectedChannel!.type == 'direct' ? Icons.person : Icons.tag,
                color: theme.accentPrimary,
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _selectedChannel!.name,
                  style: TextStyle(
                    color: theme.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Messages list
        Expanded(
          child: _loadingMessages
              ? Center(
                  child: CircularProgressIndicator(color: theme.accentPrimary),
                )
              : _messages.isEmpty
                  ? Center(
                      child: Text(
                        'No messages yet',
                        style: TextStyle(color: theme.textMuted),
                      ),
                    )
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      itemCount: _messages.length,
                      itemBuilder: (context, index) {
                        final message = _messages[index];
                        return _MessageBubble(
                          message: message,
                          theme: theme,
                        );
                      },
                    ),
        ),

        // Input bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: theme.bgSecondary,
            border: Border(top: BorderSide(color: theme.border)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _messageController,
                  style: TextStyle(color: theme.textPrimary, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Type a message...',
                    hintStyle: TextStyle(color: theme.textMuted, fontSize: 14),
                    filled: true,
                    fillColor: theme.bgTertiary,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _sendMessage,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: theme.accentPrimary,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Icon(Icons.send, color: theme.bgPrimary, size: 20),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  final JanusTheme theme;

  const _MessageBubble({required this.message, required this.theme});

  @override
  Widget build(BuildContext context) {
    final bool isUser = message.isUser;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          // Author name
          Padding(
            padding: EdgeInsets.only(
              left: isUser ? 0 : 12,
              right: isUser ? 12 : 0,
              bottom: 2,
            ),
            child: Text(
              message.authorName,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: theme.textMuted,
              ),
            ),
          ),

          // Bubble
          Row(
            mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            children: [
              if (!isUser) const SizedBox(width: 8),
              Flexible(
                child: Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.75,
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isUser ? const Color(0xFF00897B) : theme.bgSurface,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                    border: isUser ? null : Border.all(color: theme.border),
                  ),
                  child: Text(
                    message.content,
                    style: TextStyle(
                      color: isUser ? Colors.white : theme.textPrimary,
                      fontSize: 14,
                      height: 1.4,
                    ),
                  ),
                ),
              ),
              if (isUser) const SizedBox(width: 8),
            ],
          ),

          // Timestamp
          Padding(
            padding: EdgeInsets.only(
              left: isUser ? 0 : 12,
              right: isUser ? 12 : 0,
              top: 2,
            ),
            child: Text(
              message.timestamp,
              style: TextStyle(
                fontSize: 10,
                color: theme.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}