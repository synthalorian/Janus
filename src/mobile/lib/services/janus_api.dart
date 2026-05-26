import 'dart:convert';
import 'package:http/http.dart' as http;

class JanusApiService {
  static const String _baseUrl = 'http://10.0.2.2:3001'; // Android emulator
  String? _authToken;
  String? _userId;
  String? _userName;

  bool get isAuthenticated => _authToken != null;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_authToken != null) 'Authorization': 'Bearer $_authToken',
  };

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await http.get(Uri.parse('$_baseUrl$path'), headers: _headers);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final res = await http.post(Uri.parse('$_baseUrl$path'), headers: _headers, body: jsonEncode(body));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  // Auth
  Future<Map<String, dynamic>> register(String name, String type) async {
    final result = await _post('/api/auth/register', {'name': name, 'type': type});
    if (result['success'] == true && result['data'] != null) {
      _authToken = result['data']['token'];
      _userId = result['data']['user']['id'];
      _userName = result['data']['user']['name'];
    }
    return result;
  }

  String? get userId => _userId;
  String? get userName => _userName;

  // Health
  Future<Map<String, dynamic>> getHealth() => _get('/api/health');
  Future<Map<String, dynamic>> getStats() => _get('/api/stats');

  // Channels
  Future<List<dynamic>> getChannels() async {
    final res = await _get('/api/channels');
    return res['data'] ?? [];
  }

  Future<List<dynamic>> getChannelMessages(String channelId) async {
    final res = await _get('/api/channels/$channelId/messages?limit=50');
    return res['data'] ?? [];
  }

  // Messages
  Future<void> sendMessage(String channelId, String content) async {
    await _post('/api/messages', {
      'content': content,
      'authorId': _userId ?? 'unknown',
      'authorName': _userName ?? 'Unknown',
      'authorType': 'human',
      'channelId': channelId,
    });
  }

  // Bots
  Future<List<dynamic>> getBots() async {
    final res = await _get('/api/bots');
    return res['data'] ?? [];
  }

  Future<void> spawnBot(String template, String name) async {
    await _post('/api/bots/spawn', {'template': template, 'name': name});
  }

  // Souls
  Future<List<dynamic>> getSouls() async {
    final res = await _get('/api/souls');
    return res['data'] ?? [];
  }

  // Oversight
  Future<Map<String, dynamic>> getOversightStats() async {
    final res = await _get('/api/oversight/stats');
    return res['data'] ?? {};
  }

  Future<List<dynamic>> getOversightPending() async {
    final res = await _get('/api/oversight/pending');
    return res['data'] ?? [];
  }

  // Swarm
  Future<List<dynamic>> getPlans() async {
    final res = await _get('/api/orchestrate');
    return res['data'] ?? [];
  }

  Future<void> submitGoal(String goal) async {
    await _post('/api/orchestrate', {'goal': goal});
  }

  // Graph
  Future<Map<String, dynamic>> getGraphStats() async {
    final res = await _get('/api/graph/nodes');
    return res['data'] ?? {};
  }

  // API Keys
  Future<List<dynamic>> getApiKeys() async {
    final res = await _get('/api/auth/keys');
    return res['data'] ?? [];
  }
}