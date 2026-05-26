import { useState, useCallback, useEffect } from 'react';
import { graphApi, searchApi, messagesApi } from '../api/client';
import type { GraphStats } from '../types';

export function useGraph() {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await graphApi.nodes();
      if (res.success && res.data) setStats(res.data);
      else setError(res.error || 'Failed to fetch graph stats');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const search = useCallback(async (query: string, limit = 20) => {
    setSearching(true);
    try {
      const res = await searchApi.messages(query, limit);
      return (res.success && res.data) ? res.data : [];
    } finally {
      setSearching(false);
    }
  }, []);

  const queryGraph = useCallback(async (query: string) => {
    return graphApi.query(query);
  }, []);

  const getRelatedNodes = useCallback(async (nodeId: string, type?: string, depth?: number) => {
    return graphApi.relatedNodes(nodeId, type, depth);
  }, []);

  const searchByTopic = useCallback(async (topic: string, limit = 20) => {
    setSearching(true);
    try {
      const res = await searchApi.byTopic(topic, limit);
      return (res.success && res.data) ? res.data : [];
    } finally {
      setSearching(false);
    }
  }, []);

  const getDecisions = useCallback(async (limit = 20) => {
    setSearching(true);
    try {
      const res = await searchApi.decisions(limit);
      return (res.success && res.data) ? res.data : [];
    } finally {
      setSearching(false);
    }
  }, []);

  const getRelatedMessages = useCallback(async (messageId: string, depth = 2) => {
    return messagesApi.related(messageId, depth);
  }, []);

  return {
    stats, loading, error, refetch: fetchStats,
    search, searching,
    queryGraph, getRelatedNodes, searchByTopic, getDecisions, getRelatedMessages,
  };
}
