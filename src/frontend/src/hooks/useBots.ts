import { useState, useCallback, useEffect } from 'react';
import { botsApi } from '../api/client';
import type { Bot, BotTemplate } from '../types';

export function useBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [botsRes, templatesRes] = await Promise.all([
        botsApi.list(),
        botsApi.templates(),
      ]);
      if (botsRes.success && botsRes.data) setBots(botsRes.data);
      if (templatesRes.success && templatesRes.data) setTemplates(templatesRes.data);
      else if (botsRes.error) setError(botsRes.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const spawnBot = useCallback(async (template: string, name?: string, displayName?: string, description?: string) => {
    const res = await botsApi.spawn({ template, name, displayName, description });
    if (res.success) await fetchBots();
    return res;
  }, [fetchBots]);

  const spawnTeam = useCallback(async (name: string, bots: Array<{ template: string; name?: string }>) => {
    const res = await botsApi.spawnTeam({ name, bots });
    if (res.success) await fetchBots();
    return res;
  }, [fetchBots]);

  const terminateBot = useCallback(async (id: string) => {
    const res = await botsApi.delete(id);
    if (res.success) setBots(prev => prev.filter(b => b.id !== id));
    return res;
  }, []);

  const pauseBot = useCallback(async (id: string) => {
    const res = await botsApi.pause(id);
    if (res.success) setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'idle' as const } : b));
    return res;
  }, []);

  const resumeBot = useCallback(async (id: string) => {
    const res = await botsApi.resume(id);
    if (res.success) setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'online' as const } : b));
    return res;
  }, []);

  const sendToBot = useCallback(async (botId: string, content: string) => {
    return botsApi.sendMessage(botId, content);
  }, []);

  const assignTask = useCallback(async (botId: string, description: string, timeout?: number) => {
    return botsApi.assignTask(botId, description, timeout);
  }, []);

  const getMetrics = useCallback(async (botId: string) => {
    return botsApi.metrics(botId);
  }, []);

  const getCommands = useCallback(async (botId: string) => {
    return botsApi.commands(botId);
  }, []);

  return {
    bots, templates, loading, error, refetch: fetchBots,
    spawnBot, spawnTeam, terminateBot, pauseBot, resumeBot,
    sendToBot, assignTask, getMetrics, getCommands,
  };
}
