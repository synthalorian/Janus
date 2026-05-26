import { useState, useCallback, useEffect, useRef } from 'react';
import { orchestrationApi } from '../api/client';
import type { OrchestrationPlan, OrchestrationTask, ExecutionSnapshot, AgentCapability } from '../types';

export function useOrchestration() {
  const [plans, setPlans] = useState<OrchestrationPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<OrchestrationPlan | null>(null);
  const [tasks, setTasks] = useState<OrchestrationTask[]>([]);
  const [snapshot, setSnapshot] = useState<ExecutionSnapshot | null>(null);
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orchestrationApi.listPlans();
      if (res.success && res.data) {
        setPlans(res.data);
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCapabilities = useCallback(async () => {
    try {
      const res = await orchestrationApi.listCapabilities({ limit: 50 });
      if (res.success && res.data) {
        setCapabilities(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch capabilities:', err);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchCapabilities();
  }, [fetchPlans, fetchCapabilities]);

  const submitGoal = useCallback(async (goal: string, channelId?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await orchestrationApi.submitGoal({ goal, channelId });
      if (res.success) {
        await fetchPlans();
        setSubmitting(false);
        return { success: true as const, planId: res.data?.planId };
      } else {
        setError(res.error || 'Failed to submit goal');
        setSubmitting(false);
        return { success: false as const, error: res.error };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit goal';
      setError(msg);
      setSubmitting(false);
      return { success: false as const, error: msg };
    }
  }, [fetchPlans]);

  const selectPlan = useCallback(async (plan: OrchestrationPlan | null) => {
    setSelectedPlan(plan);
    setSnapshot(null);
    setTasks([]);
    if (!plan) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    try {
      const detailRes = await orchestrationApi.getPlan(plan.id);
      if (detailRes.success && detailRes.data) {
        setTasks(detailRes.data.tasks);
      }

      const statusRes = await orchestrationApi.getStatus(plan.id);
      if (statusRes.success && statusRes.data) {
        setSnapshot(statusRes.data);
      }
    } catch (err) {
      console.warn('Failed to load plan details:', err);
    }
  }, []);

  const cancelPlan = useCallback(async (planId: string) => {
    try {
      const res = await orchestrationApi.cancelPlan(planId);
      if (res.success) {
        setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: 'cancelled' as const } : p));
        if (selectedPlan?.id === planId) {
          setSelectedPlan(prev => prev ? { ...prev, status: 'cancelled' as const } : null);
        }
      }
      return res;
    } catch (err) {
      console.warn('Failed to cancel plan:', err);
      return { success: false, error: 'Failed to cancel' };
    }
  }, [selectedPlan]);

  // Auto-poll snapshot for active plans
  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (!selectedPlan) return;
    const isActive = selectedPlan.status === 'executing' || selectedPlan.status === 'spawning' || selectedPlan.status === 'planning';
    if (!isActive) return;

    const poll = async () => {
      try {
        const statusRes = await orchestrationApi.getStatus(selectedPlan.id);
        if (statusRes.success && statusRes.data) {
          setSnapshot(statusRes.data);
          // If status changed, refresh the plan list too
          if (statusRes.data.plan.status !== selectedPlan.status) {
            setSelectedPlan(statusRes.data.plan);
            await fetchPlans();
          }
        }
      } catch (err) {
        console.warn('Poll error:', err);
      }
    };

    pollTimerRef.current = setInterval(poll, 3000);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [selectedPlan, fetchPlans]);

  return {
    plans, selectedPlan, tasks, snapshot, capabilities,
    loading, error, submitting,
    submitGoal, selectPlan, cancelPlan, refetch: fetchPlans,
  };
}
