import React, { useState } from 'react';
import { useOrchestration } from '../hooks/useOrchestration';
import { ViewShell, Tab } from './shared';
import type { OrchestrationPlan, OrchestrationTask, ExecutionSnapshot, AgentCapability } from '../types';

function SwarmView() {
  const {
    plans, selectedPlan, tasks, snapshot, capabilities,
    loading, error, submitting,
    submitGoal, selectPlan, cancelPlan,
  } = useOrchestration();

  const [activeTab, setActiveTab] = useState<'plans' | 'capabilities' | 'submit'>('plans');
  const [goalInput, setGoalInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const handleSubmit = async () => {
    if (!goalInput.trim()) return;
    const res = await submitGoal(goalInput.trim());
    if (res.success) {
      setStatusMsg(`Goal submitted! Plan ID: ${res.planId}`);
      setGoalInput('');
      setActiveTab('plans');
    } else {
      setStatusMsg(res.error || 'Failed to submit goal');
    }
  };

  const handleCancel = async (planId: string) => {
    if (!confirm('Cancel this orchestration?')) return;
    await cancelPlan(planId);
    setStatusMsg('Plan cancelled');
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'completed': return 'var(--success)';
      case 'failed': return 'var(--error)';
      case 'cancelled': return 'var(--text-muted)';
      case 'executing': return '#f59e0b';
      case 'spawning': return '#3b82f6';
      case 'planning': return '#a855f7';
      default: return 'var(--text-muted)';
    }
  };

  const activeCount = plans.filter(p => ['executing', 'spawning', 'planning'].includes(p.status)).length;

  if (loading) return <ViewShell title="Swarm"><div className="loading">Loading swarm...</div></ViewShell>;
  if (error) return <ViewShell title="Swarm"><div className="error-state">{error}</div></ViewShell>;

  return (
    <ViewShell title="Swarm" subtitle="Autonomous multi-agent orchestration" badge={`${activeCount} active`}>
      <div className="tabs">
        <Tab active={activeTab === 'plans'} onClick={() => { setActiveTab('plans'); selectPlan(null); }} label="Plans" count={plans.length} />
        <Tab active={activeTab === 'capabilities'} onClick={() => setActiveTab('capabilities')} label="Capabilities" count={capabilities.length} />
        <Tab active={activeTab === 'submit'} onClick={() => setActiveTab('submit')} label="Submit Goal" />
      </div>

      {statusMsg && (
        <div className={`status-banner ${statusMsg.includes('submitted') ? 'success' : 'error'}`}>
          {statusMsg}
          <button onClick={() => setStatusMsg('')}>×</button>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="swarm-plans">
          {plans.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🐝</span>
              <h3>No swarm plans yet</h3>
              <p>Submit a goal and watch AI agents autonomously execute it</p>
            </div>
          )}

          <div className="plans-grid">
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan?.id === plan.id}
                statusColor={statusColor}
                onClick={() => selectPlan(plan)}
                onCancel={() => handleCancel(plan.id)}
              />
            ))}
          </div>

          {selectedPlan && (
            <div className="plan-detail">
              <div className="plan-detail-header">
                <h3>{selectedPlan.goal}</h3>
                <span className="plan-status-badge" style={{ background: statusColor(selectedPlan.status) }}>
                  {selectedPlan.status}
                </span>
              </div>
              <div className="plan-meta">
                <span>ID: {selectedPlan.id.slice(0, 8)}</span>
                <span>Created: {new Date(selectedPlan.createdAt).toLocaleString()}</span>
                {selectedPlan.channelId && <span>War Room: #{selectedPlan.channelId.slice(0, 8)}</span>}
              </div>

              {snapshot && (
                <SnapshotPanel snapshot={snapshot} statusColor={statusColor} />
              )}

              <h4>Tasks ({tasks.length})</h4>
              {tasks.length === 0 ? (
                <p className="muted">No tasks yet</p>
              ) : (
                <div className="task-list">
                  {tasks.map(task => (
                    <TaskRow key={task.id} task={task} statusColor={statusColor} />
                  ))}
                </div>
              )}

              {selectedPlan.result && (
                <div className="plan-result">
                  <h4>Result</h4>
                  <pre>{selectedPlan.result}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'capabilities' && (
        <div className="capabilities-grid">
          {capabilities.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">⚡</span>
              <h3>No registered capabilities</h3>
              <p>AI agents will register their models and strengths here</p>
            </div>
          )}
          {capabilities.map(cap => (
            <CapabilityCard key={cap.id} capability={cap} statusColor={statusColor} />
          ))}
        </div>
      )}

      {activeTab === 'submit' && (
        <div className="submit-goal">
          <h3>Describe your goal</h3>
          <p className="muted">The orchestrator will decompose it into tasks, spawn bots, and execute autonomously.</p>
          <textarea
            value={goalInput}
            onChange={e => setGoalInput(e.target.value)}
            placeholder="e.g., Research the latest Rust async runtimes, compare them, and write a summary report"
            rows={5}
            className="goal-textarea"
          />
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting || !goalInput.trim()}>
            {submitting ? 'Submitting...' : '🚀 Submit Goal'}
          </button>
        </div>
      )}
    </ViewShell>
  );
}

function PlanCard({ plan, selected, statusColor, onClick, onCancel }: {
  plan: OrchestrationPlan;
  selected: boolean;
  statusColor: (s: string) => string;
  onClick: () => void;
  onCancel: () => void;
}) {
  const isActive = ['executing', 'spawning', 'planning'].includes(plan.status);
  return (
    <div className={`plan-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="plan-card-header">
        <span className="plan-status-dot" style={{ background: statusColor(plan.status) }} />
        <span className="plan-goal">{plan.goal.slice(0, 60)}{plan.goal.length > 60 ? '...' : ''}</span>
      </div>
      <div className="plan-card-meta">
        <span className="plan-status" style={{ color: statusColor(plan.status) }}>{plan.status}</span>
        <span className="plan-date">{new Date(plan.createdAt).toLocaleDateString()}</span>
      </div>
      {isActive && (
        <button className="btn-sm btn-danger" onClick={e => { e.stopPropagation(); onCancel(); }}>
          Cancel
        </button>
      )}
    </div>
  );
}

function SnapshotPanel({ snapshot, statusColor }: { snapshot: ExecutionSnapshot; statusColor: (s: string) => string }) {
  const { readyTasks, blockedTasks, completedTasks } = snapshot;
  const total = snapshot.tasks.length;
  const completed = completedTasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="snapshot-panel">
      <div className="snapshot-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%`, background: statusColor('completed') }} />
        </div>
        <span className="progress-label">{completed}/{total} tasks ({pct}%)</span>
      </div>
      <div className="snapshot-stats">
        <SnapshotStat label="Ready" value={readyTasks.length} color="#3b82f6" />
        <SnapshotStat label="Blocked" value={blockedTasks.length} color="#f59e0b" />
        <SnapshotStat label="Done" value={completedTasks.length} color="var(--success)" />
      </div>
    </div>
  );
}

function SnapshotStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="snapshot-stat">
      <span className="snapshot-stat-value" style={{ color }}>{value}</span>
      <span className="snapshot-stat-label">{label}</span>
    </div>
  );
}

function TaskRow({ task, statusColor }: { task: OrchestrationTask; statusColor: (s: string) => string }) {
  return (
    <div className="task-row">
      <span className="task-status-dot" style={{ background: statusColor(task.status) }} />
      <div className="task-info">
        <span className="task-name">{task.description}</span>
        <span className="task-template">{task.template}</span>
      </div>
      <span className="task-status" style={{ color: statusColor(task.status) }}>{task.status}</span>
      {task.retryCount > 0 && <span className="task-retries">{task.retryCount} retry</span>}
    </div>
  );
}

function CapabilityCard({ capability, statusColor }: { capability: AgentCapability; statusColor: (s: string) => string }) {
  return (
    <div className="capability-card">
      <div className="capability-header">
        <span className="capability-model">{capability.modelName}</span>
        <span className="capability-status" style={{ background: statusColor(capability.status) }}>{capability.status}</span>
      </div>
      <div className="capability-agent">{capability.agentName}</div>
      <div className="capability-meta">
        <span>🛠 {capability.harnessType}</span>
        <span>🪟 {capability.contextWindow.toLocaleString()} tokens</span>
        {capability.costPer1kTokens !== undefined && <span>💰 ${(capability.costPer1kTokens / 1000).toFixed(4)}/1K</span>}
      </div>
      <div className="capability-strengths">
        {capability.strengths.map(s => <span key={s} className="strength-tag">{s}</span>)}
      </div>
    </div>
  );
}

export default React.memo(SwarmView);
