import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketService extends ChangeNotifier {
  io.Socket? _socket;
  bool _isConnected = false;
  bool _isAuthenticated = false;
  String? _currentChannelId;

  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final _presenceController = StreamController<Map<String, dynamic>>.broadcast();
  final _typingController = StreamController<Map<String, dynamic>>.broadcast();
  final _streamStartController = StreamController<Map<String, dynamic>>.broadcast();
  final _streamChunkController = StreamController<Map<String, dynamic>>.broadcast();
  final _streamEndController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get messageStream => _messageController.stream;
  Stream<Map<String, dynamic>> get presenceStream => _presenceController.stream;
  Stream<Map<String, dynamic>> get typingStream => _typingController.stream;
  Stream<Map<String, dynamic>> get streamStartStream => _streamStartController.stream;
  Stream<Map<String, dynamic>> get streamChunkStream => _streamChunkController.stream;
  Stream<Map<String, dynamic>> get streamEndStream => _streamEndController.stream;

  bool get isConnected => _isConnected;
  bool get isAuthenticated => _isAuthenticated;
  String? get currentChannelId => _currentChannelId;

  static String get _serverUrl {
    if (kIsWeb) return 'http://localhost:3001';
    if (Platform.isAndroid) return 'http://10.0.2.2:3001';
    return 'http://localhost:3001';
  }

  void connect({
    required String token,
    required String userId,
    required String userName,
    String userType = 'human',
  }) {
    if (_socket != null) {
      disconnect();
    }

    _socket = io.io(
      _serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .setReconnectionAttempts(10)
          .setTimeout(5000)
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('[SocketService] Connected');
      _isConnected = true;
      notifyListeners();

      // Authenticate immediately after connect
      _socket!.emit('auth', {
        'token': token,
        'userId': userId,
        'userName': userName,
        'userType': userType,
      });
    });

    _socket!.onDisconnect((_) {
      debugPrint('[SocketService] Disconnected');
      _isConnected = false;
      _isAuthenticated = false;
      _currentChannelId = null;
      notifyListeners();
    });

    _socket!.onConnectError((err) {
      debugPrint('[SocketService] Connect error: $err');
      _isConnected = false;
      notifyListeners();
    });

    _socket!.onError((err) {
      debugPrint('[SocketService] Error: $err');
    });

    _socket!.onReconnect((_) {
      debugPrint('[SocketService] Reconnected');
      _isConnected = true;
      notifyListeners();
    });

    _socket!.onReconnectAttempt((attempt) {
      debugPrint('[SocketService] Reconnect attempt $attempt');
    });

    _socket!.onReconnectError((err) {
      debugPrint('[SocketService] Reconnect error: $err');
    });

    _socket!.onReconnectFailed((_) {
      debugPrint('[SocketService] Reconnect failed');
    });

    // Auth response
    _socket!.on('auth:success', (_) {
      debugPrint('[SocketService] Auth success');
      _isAuthenticated = true;
      notifyListeners();
    });

    _socket!.on('auth:error', (data) {
      debugPrint('[SocketService] Auth error: $data');
      _isAuthenticated = false;
      notifyListeners();
    });

    // Messages
    _socket!.on('message:new', (data) {
      debugPrint('[SocketService] message:new: $data');
      if (data is Map<String, dynamic>) {
        _messageController.add(data);
      }
    });

    _socket!.on('messages:history', (data) {
      debugPrint('[SocketService] messages:history');
      if (data is Map<String, dynamic> && data['messages'] is List) {
        for (final msg in data['messages'] as List) {
          if (msg is Map<String, dynamic>) {
            _messageController.add(msg);
          }
        }
      }
    });

    // Presence
    _socket!.on('presence:update', (data) {
      debugPrint('[SocketService] presence:update: $data');
      if (data is Map<String, dynamic>) {
        _presenceController.add(data);
      }
    });

    // Typing
    _socket!.on('user:typing', (data) {
      debugPrint('[SocketService] user:typing: $data');
      if (data is Map<String, dynamic>) {
        _typingController.add(data);
      }
    });

    _socket!.on('user:stopped-typing', (data) {
      debugPrint('[SocketService] user:stopped-typing: $data');
      if (data is Map<String, dynamic>) {
        _typingController.add(data);
      }
    });

    // Streaming
    _socket!.on('message:stream:start', (data) {
      debugPrint('[SocketService] message:stream:start: $data');
      if (data is Map<String, dynamic>) {
        _streamStartController.add(data);
      }
    });

    _socket!.on('message:stream:chunk', (data) {
      debugPrint('[SocketService] message:stream:chunk: $data');
      if (data is Map<String, dynamic>) {
        _streamChunkController.add(data);
      }
    });

    _socket!.on('message:stream:end', (data) {
      debugPrint('[SocketService] message:stream:end: $data');
      if (data is Map<String, dynamic>) {
        _streamEndController.add(data);
      }
    });
  }

  void joinChannel(String channelId) {
    if (_socket == null || !_isConnected) return;
    if (_currentChannelId != null && _currentChannelId != channelId) {
      leaveChannel(_currentChannelId!);
    }
    _currentChannelId = channelId;
    _socket!.emit('channel:join', channelId);
    debugPrint('[SocketService] Joined channel $channelId');
    notifyListeners();
  }

  void leaveChannel(String channelId) {
    if (_socket == null || !_isConnected) return;
    _socket!.emit('channel:leave', channelId);
    if (_currentChannelId == channelId) {
      _currentChannelId = null;
    }
    debugPrint('[SocketService] Left channel $channelId');
    notifyListeners();
  }

  void sendMessage({
    required String channelId,
    required String content,
    required String authorId,
    required String authorName,
    String authorType = 'human',
  }) {
    if (_socket == null || !_isConnected) return;
    _socket!.emit('message:send', {
      'channelId': channelId,
      'content': content,
      'authorId': authorId,
      'authorName': authorName,
      'authorType': authorType,
    });
  }

  void startTyping(String channelId, String userId, String userName) {
    if (_socket == null || !_isConnected) return;
    _socket!.emit('typing:start', {
      'channelId': channelId,
      'userId': userId,
      'userName': userName,
    });
  }

  void stopTyping(String channelId, String userId) {
    if (_socket == null || !_isConnected) return;
    _socket!.emit('typing:stop', {
      'channelId': channelId,
      'userId': userId,
    });
  }

  void disconnect() {
    if (_currentChannelId != null) {
      leaveChannel(_currentChannelId!);
    }
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
    _isAuthenticated = false;
    _currentChannelId = null;
    notifyListeners();
    debugPrint('[SocketService] Disconnected and cleaned up');
  }

  @override
  void dispose() {
    disconnect();
    _messageController.close();
    _presenceController.close();
    _typingController.close();
    _streamStartController.close();
    _streamChunkController.close();
    _streamEndController.close();
    super.dispose();
  }
}
