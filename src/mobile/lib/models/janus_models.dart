import 'dart:convert';
import 'package:flutter/foundation.dart';

class Channel {
  final String id;
  final String name;
  final String type;

  Channel({required this.id, required this.name, required this.type});

  factory Channel.fromJson(Map<String, dynamic> json) => Channel(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    type: json['type'] ?? 'chat',
  );
}

class Message {
  final String id;
  final String content;
  final String authorId;
  final String authorName;
  final String authorType;
  final String channelId;
  final String timestamp;

  Message({
    required this.id, required this.content, required this.authorId,
    required this.authorName, required this.authorType, required this.channelId,
    required this.timestamp,
  });

  factory Message.fromJson(Map<String, dynamic> json) => Message(
    id: json['id'] ?? '',
    content: json['content'] ?? '',
    authorId: json['authorId'] ?? '',
    authorName: json['authorName'] ?? '',
    authorType: json['authorType'] ?? 'human',
    channelId: json['channelId'] ?? '',
    timestamp: json['timestamp'] ?? '',
  );

  bool get isUser => authorType == 'human';
}

class Bot {
  final String id;
  final String name;
  final String? displayName;
  final String? description;
  final String status;
  final List<String> capabilities;

  Bot({
    required this.id, required this.name, this.displayName, this.description,
    required this.status, this.capabilities = const [],
  });

  factory Bot.fromJson(Map<String, dynamic> json) => Bot(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    displayName: json['displayName'],
    description: json['description'],
    status: json['status'] ?? 'offline',
    capabilities: (json['capabilities'] as List?)?.cast<String>() ?? [],
  );
}

class Soul {
  final String id;
  final String name;
  final String? displayName;
  final String archetype;
  final String status;
  final int level;
  final int experiencePoints;
  final String? backstory;
  final List<String> expertiseTags;

  Soul({
    required this.id, required this.name, this.displayName,
    required this.archetype, required this.status, this.level = 1,
    this.experiencePoints = 0, this.backstory, this.expertiseTags = const [],
  });

  factory Soul.fromJson(Map<String, dynamic> json) => Soul(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    displayName: json['displayName'],
    archetype: json['archetype'] ?? 'unknown',
    status: json['status'] ?? 'active',
    level: json['level'] ?? 1,
    experiencePoints: json['experiencePoints'] ?? 0,
    backstory: json['backstory'],
    expertiseTags: (json['expertiseTags'] as List?)?.cast<String>() ?? [],
  );
}

class OversightStats {
  final int pending;
  final int approved;
  final int rejected;
  final int total;

  OversightStats({this.pending = 0, this.approved = 0, this.rejected = 0, this.total = 0});

  factory OversightStats.fromJson(Map<String, dynamic> json) => OversightStats(
    pending: json['pending'] ?? 0,
    approved: json['approved'] ?? 0,
    rejected: json['rejected'] ?? 0,
    total: json['total'] ?? 0,
  );
}

class SwarmPlan {
  final String id;
  final String goal;
  final String status;

  SwarmPlan({required this.id, required this.goal, required this.status});

  factory SwarmPlan.fromJson(Map<String, dynamic> json) => SwarmPlan(
    id: json['id'] ?? '',
    goal: json['goal'] ?? 'Untitled',
    status: json['status'] ?? 'pending',
  );
}

class ApiKey {
  final String id;
  final String name;
  final String prefix;
  final List<String> permissions;

  ApiKey({required this.id, required this.name, required this.prefix, this.permissions = const []});

  factory ApiKey.fromJson(Map<String, dynamic> json) => ApiKey(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    prefix: json['prefix'] ?? '',
    permissions: (json['permissions'] as List?)?.cast<String>() ?? ['read'],
  );
}