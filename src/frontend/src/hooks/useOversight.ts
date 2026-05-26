import { useState, useCallback, useEffect } from 'react';
import { oversightApi } from '../api/client';
import type { OversightAction, OversightStats, OversightBoard } from '../types';

export function useOversight() {
  const [actions, setActions] = useState<OversightAction[]>([]);
  const [stats, setStats] = useState<OversightStats | null>(null);
  const [board, setBoard] = useState<OversightBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, statsRes, boardRes] = await Promise.all([
        oversightApi.pending(),
        oversightApi.stats(),
        oversightApi.board(),
      ]);
      if (pendingRes.success && pendingRes.data) setActions(pendingRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (boardRes.success && boardRes.data) setBoard(boardRes.data);
      if (pendingRes.error) setError(pendingRes.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch oversight data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const assessRisk = useCallback(async (actionType: string, agentId: string, payload?: unknown) => {
    return oversightApi.assess(actionType, agentId, payload);
  }, []);

  const submitAction = useCallback(async (data: { agentId: string; agentName?: string; actionType: string; description: string; payload?: unknown }) => {
    const res = await oversightApi.submit(data);
    if (res.success) await fetchAll();
    return res;
  }, [fetchAll]);

  const reviewAction = useCallback(async (data: { actionId: string; reviewerId: string; reviewerName?: string; decision: string; reasoning: string; confidence?: number }) => {
    const res = await oversightApi.review(data);
    if (res.success) await fetchAll();
    return res;
  }, [fetchAll]);

  const challengeAction = useCallback(async (data: { actionId: string; challengerId: string; challengerName?: string; reasoning: string }) => {
    const res = await oversightApi.challenge(data);
    if (res.success) await fetchAll();
    return res;
  }, [fetchAll]);

  const getAction = useCallback(async (id: string) => {
    return oversightApi.getAction(id);
  }, []);

  const getAudit = useCallback(async (agentId?: string) => {
    return oversightApi.audit(agentId);
  }, []);

  return {
    actions, stats, board, loading, error, refetch: fetchAll,
    assessRisk, submitAction, reviewAction, challengeAction, getAction, getAudit,
  };
}
