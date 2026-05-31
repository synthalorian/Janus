import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/janus_api.dart';
import '../services/socket_service.dart';
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
  StreamSubscription? _messageSub;
  StreamSubscription? _streamStartSub;
  StreamSubscription? _streamChunkSub;
  StreamSubscription? _streamEndSub;
  final Map<String, String> _streamingMessages = {};

  @override
  void initState() {
    super.initState();
    _loadChannels();
    _listenToSocket();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _messageSub?.cancel();
    _streamStartSub?.cancel();
    _streamChunkSub?.cancel();
    _streamEndSub?.cancel();
    final socket = context.read<SocketService>();
    if (socket.currentChannelId != null) {
      socket.leaveChannel(socket.currentChannelId!);
    }
    super.dispose();
  }

  void _listenToSocket() {
    final socket = context.read<SocketService>();

    _messageSub = socket.messageStream.listen((data) {
      if (!mounted) return;
      final msg = Message.fromJson(data);
      if (_selectedChannel != null && msg.channelId == _selectedChannel!.id) {
        setState(() => _messages.add(msg));
        _scrollToBottom();
      }
    });

    _streamStartSub = socket.streamStartStream.listen((data) {
      if (!mounted || _selectedChannel == null) return;
      final messageId = data['messageId']?.toString() ?? '';
      final authorName = data['authorName']?.toString() ?? 'AI';
      final authorId = data['authorId']?.toString() ?? 'ai';
      _streamingMessages[messageId] = '';
      final msg = Message(
        id: messageId,
        content: '',
        authorId: authorId,
        authorName: authorName,
        authorType: 'ai',
        channelId: _selectedChannel!.id,
        timestamp: DateTime.now().toIso8601String(),
      );
      setState(() => _messages.add(msg));
      _scrollToBottom();
    });

    _streamChunkSub = socket.streamChunkStream.listen((data) {
      if (!mounted) return;
      final messageId = data['messageId']?.toString() ?? '';
      final chunk = data['chunk']?.toString() ?? '';
      if (_streamingMessages.containsKey(messageId)) {
        _streamingMessages[messageId] = _streamingMessages[messageId]! + chunk;
        final index = _messages.indexWhere((m) => m.id == messageId);
        if (index != -1) {
          setState(() {
            _messages[index] = Message(
              id: _messages[index].id,
              content: _streamingMessages[messageId]!,
              authorId: _messages[index].authorId,
              authorName: _messages[index].authorName,
              authorType: _messages[index].authorType,
              channelId: _messages[index].channelId,
              timestamp: _messages[index].timestamp,
            );
          });
        }
      }
    });

    _streamEndSub = socket.streamEndStream.listen((data) {
      if (!mounted) return;
      final messageId = data['id']?.toString() ?? data['messageId']?.toString() ?? '';
      _streamingMessages.remove(messageId);
      final index = _messages.indexWhere((m) => m.id == messageId);
      if (index != -1) {
        setState(() => _messages[index] = Message.fromJson(data));
      } else {
        final msg = Message.fromJson(data);
        if (_selectedChannel != null && msg.channelId == _selectedChannel!.id) {
          setState(() => _messages.add(msg));
          _scrollToBottom();
        }
      }
    });
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

    final api = context.read<JanusApiService>();
    final socket = context.read<SocketService>();
    if (!socket.isConnected) {
      socket.connect(
        token: api.isAuthenticated ? 'flutter-client-token' : '',
        userId: api.userId ?? 'unknown',
        userName: api.userName ?? 'Unknown',
        userType: 'human',
      );
    }
    socket.joinChannel(channel.id);
  }

  void _goBack() {
    final socket = context.read<SocketService>();
    if (socket.currentChannelId != null) {
      socket.leaveChannel(socket.currentChannelId!);
    }
    setState(() => _selectedChannel = null);
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty || _selectedChannel == null) return;

    _messageController.clear();
    final api = context.read<JanusApiService>();
    final socket = context.read<SocketService>();

    final optimisticMsg = Message(
      id: 'local-${DateTime.now().millisecondsSinceEpoch}',
      content: content,
      authorId: api.userId ?? 'unknown',
      authorName: api.userName ?? 'Unknown',
      authorType: 'human',
      channelId: _selectedChannel!.id,
      timestamp: DateTime.now().toIso8601String(),
    );
    setState(() => _messages.add(optimisticMsg));
    _scrollToBottom();

    try {
      if (socket.isConnected) {
        socket.sendMessage(
          channelId: _selectedChannel!.id,
          content: content,
          authorId: api.userId ?? 'unknown',
          authorName: api.userName ?? 'Unknown',
          authorType: 'human',
        );
      } else {
        await api.sendMessage(_selectedChannel!.id, content);
        _loadMessages(_selectedChannel!.id);
      }
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
      return Center(child: CircularProgressIndicator(color: theme.accentPrimary));
    }
    return RefreshIndicator(
      onRefresh: _loadChannels,
      color: theme.accentPrimary,
      child: _channels.isEmpty
          ? Center(child: Text('No channels available', style: TextStyle(color: theme.textMuted)))
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
                      style: TextStyle(color: theme.textPrimary, fontWeight: FontWeight.w500),
                    ),
                    subtitle: Text(
                      channel.type,
                      style: TextStyle(color: theme.textMuted, fontSize: 12),
                    ),
                    trailing: Icon(Icons.chevron_right, color: theme.textMuted, size: 20),
                    onTap: () => _selectChannel(channel),
                  ),
                );
              },
            ),
    );
  }

  Widget _buildChatView(JanusTheme theme) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: theme.bgSecondary,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: theme.textPrimary),
          onPressed: _goBack,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _selectedChannel!.name,
              style: TextStyle(color: theme.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
            ),
            Consumer<SocketService>(
              builder: (context, socket, _) => Text(
                socket.isConnected ? '● Live' : '○ Offline',
                style: TextStyle(
                  color: socket.isConnected ? theme.success : theme.textMuted,
                  fontSize: 11,
                ),
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loadingMessages
                ? Center(child: CircularProgressIndicator(color: theme.accentPrimary))
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      final isMe = msg.authorType == 'human' && msg.authorId == context.read<JanusApiService>().userId;
                      return Align(
                        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: isMe ? theme.accentTertiary.withOpacity(0.9) : theme.bgSurface,
                            borderRadius: BorderRadius.circular(12),
                            border: isMe ? null : Border.all(color: theme.borderLight),
                          ),
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                msg.authorName,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: isMe ? theme.bgPrimary.withOpacity(0.7) : theme.textMuted,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                msg.content,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isMe ? theme.bgPrimary : theme.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _formatTime(msg.timestamp),
                                style: TextStyle(
                                  fontSize: 9,
                                  color: isMe ? theme.bgPrimary.withOpacity(0.5) : theme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: theme.bgSecondary,
              border: Border(top: BorderSide(color: theme.border)),
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      style: TextStyle(color: theme.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Message...',
                        hintStyle: TextStyle(color: theme.textMuted),
                        filled: true,
                        fillColor: theme.bgPrimary,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: theme.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: theme.border),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: theme.accentPrimary),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: Icon(Icons.send, color: theme.accentPrimary),
                    onPressed: _sendMessage,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(String? timestamp) {
    if (timestamp == null) return '';
    try {
      final dt = DateTime.parse(timestamp);
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}
