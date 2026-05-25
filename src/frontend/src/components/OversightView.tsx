import React, { useState } from 'react';
import { useOversight } from '../hooks/useOversight';
import { ViewShell } from './shared';
import type { OversightAction } from '../types';

function OversightView() {
  const {
    actions, stats, board, loading, error,
    reviewAction, challengeAction,
  } = useOversight();

  const [selectedAction, setSelectedAction] = useState<OversightAction | null>(null);
  const [reviewForm, setReviewForm] = useState({ decision: 'approve', reasoning: '' });
  const [challengeForm, setChallengeForm] = useState({ actionId: '', reasoning: '' });
  const [statusMsg, setStatusMsg] = useState('');
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  const handleReview = async () => {
    if (!selectedAction || !reviewForm.reasoning) return;
    const res = await reviewAction({
      actionId: selectedAction.id,
      reviewerId: 'human-reviewer',
      reviewerName: 'Human Reviewer',
      decision: reviewForm.decision,
      reasoning: reviewForm.reasoning,
    });
    if (res.success) {
      setStatusMsg('Review submitted!');
      setReviewForm({ decision: 'approve', reasoning: '' });
      setSelectedAction(null);
    } else {
      setStatusMsg(res.error || 'Review failed');
    }
  };

  const openChallenge = (action: OversightAction) => {
    setChallengeForm({ actionId: action.id, reasoning: '' });
    setShowChallengeModal(true);
  };

  const handleChallenge = async () => {
    if (!challengeForm.reasoning) return;
    const res = await challengeAction({
      actionId: challengeForm.actionId,
      challengerId: 'human-challenger',
      challengerName: 'Human Operator',
      reasoning: challengeForm.reasoning,
    });
    if (res.success) {
      setStatusMsg('Action challenged!');
      setShowChallengeModal(false);
    } else {
      setStatusMsg(res.error || 'Challenge failed');
    }
  };

  const riskLevelColor = (level: string) => {
    switch (level) {
      case 'none': return '#22c55e';
      case 'peer': return '#3b82f6';
      case 'committee': return '#f59e0b';
      case 'human': return '#ef4444';
      case 'emergency': return '#dc2626';
      default: return '#666';
    }
  };

  if (loading) return <ViewShell title="AI Oversight"><div className="loading">Loading oversight data...</div></ViewShell>;
  if (error) return <ViewShell title="AI Oversight"><div className="error-state">{error}</div></ViewShell>;

  return (
    <ViewShell title="AI Oversight" subtitle="AI-to-AI governance & risk management" badge={stats ? `${stats.pending} pending` : ''}>
      {statusMsg && (
        <div className={`status-banner ${statusMsg.includes('!') ? 'success' : 'error'}`}>
          {statusMsg}
          <button onClick={() => setStatusMsg('')}>×</button>
        </div>
      )}

      {/* Challenge Modal */}
      {showChallengeModal && (
        <div className="modal-overlay" onClick={() => setShowChallengeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Challenge Action</h3>
            <textarea
              value={challengeForm.reasoning}
              onChange={e => setChallengeForm(p => ({ ...p, reasoning: e.target.value }))}
              placeholder="Provide reasoning for your challenge..."
              rows={3}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowChallengeModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleChallenge} disabled={!challengeForm.reasoning}>Submit Challenge</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="oversight-stats-row">
          <OversightStatCard label="Pending" value={stats.pending} color="#f59e0b" />
          <OversightStatCard label="Approved" value={stats.approved} color="#22c55e" />
          <OversightStatCard label="Rejected" value={stats.rejected} color="#ef4444" />
          <OversightStatCard label="Challenged" value={stats.challenged} color="#dc2626" />
          <OversightStatCard label="Avg Risk" value={stats.averageRiskScore.toFixed(2)} color="#3b82f6" />
        </div>
      )}

      {/* Board Info */}
      {board && (
        <div className="board-info">
          <h3>Oversight Board</h3>
          <div className="board-meta">
            <span>Quorum: {board.quorum}</span>
            <span>Threshold: {(board.approvalThreshold * 100).toFixed(0)}%</span>
            <span>Members: {board.members?.length || 0}</span>
          </div>
        </div>
      )}

      {/* Risk Distribution */}
      {stats && (
        <div className="risk-bars">
          <h3>Risk Distribution</h3>
          <div className="risk-bar-row">
            {Object.entries(stats.byRiskLevel).map(([level, count]) => (
              <div key={level} className="risk-bar-item">
                <div className="risk-bar-label">{level}</div>
                <div className="risk-bar-track">
                  <div
                    className="risk-bar-fill"
                    style={{
                      width: stats.total > 0 ? `${((count as number) / stats.total) * 100}%` : '0%',
                      background: riskLevelColor(level),
                    }}
                  />
                </div>
                <div className="risk-bar-count">{count as number}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Actions */}
      <div className="actions-section">
        <h3>Pending Actions</h3>
        {actions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✓</span>
            <h3>All clear</h3>
            <p>No pending actions requiring review</p>
          </div>
        ) : (
          <div className="action-list">
            {actions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                selected={selectedAction?.id === action.id}
                onClick={() => setSelectedAction(selectedAction?.id === action.id ? null : action)}
                onChallenge={() => openChallenge(action)}
                riskColor={riskLevelColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Review Panel */}
      {selectedAction && (
        <div className="review-panel">
          <h3>Review: {selectedAction.description}</h3>
          <div className="review-detail">
            <DetailRow label="Agent" value={selectedAction.agentName} />
            <DetailRow label="Action Type" value={selectedAction.actionType} />
            <DetailRow label="Risk Score" value={selectedAction.risk.score.toFixed(2)} />
            <DetailRow label="Level" value={selectedAction.oversightLevel} badge={riskLevelColor(selectedAction.oversightLevel)} />
            <DetailRow label="Status" value={selectedAction.status} />
            <div className="review-payload">
              <strong>Payload:</strong>
              <pre>{JSON.stringify(selectedAction.payload, null, 2)}</pre>
            </div>
          </div>
          <div className="review-form">
            <select
              value={reviewForm.decision}
              onChange={e => setReviewForm(p => ({ ...p, decision: e.target.value }))}
            >
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
              <option value="challenge">Challenge</option>
              <option value="escalate">Escalate</option>
            </select>
            <textarea
              value={reviewForm.reasoning}
              onChange={e => setReviewForm(p => ({ ...p, reasoning: e.target.value }))}
              placeholder="Provide reasoning for your decision..."
              rows={3}
            />
            <button className="btn-primary" onClick={handleReview} disabled={!reviewForm.reasoning}>
              Submit Review
            </button>
          </div>
        </div>
      )}
    </ViewShell>
  );
}

function OversightStatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="oversight-stat-card">
      <div className="oversight-stat-value" style={{ color }}>{value}</div>
      <div className="oversight-stat-label">{label}</div>
    </div>
  );
}

function ActionCard({ action, selected, onClick, onChallenge, riskColor }: {
  action: OversightAction;
  selected: boolean;
  onClick: () => void;
  onChallenge: () => void;
  riskColor: (level: string) => string;
}) {
  return (
    <div className={`action-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="action-card-left">
        <div className="risk-indicator" style={{ background: riskColor(action.oversightLevel) }} />
        <div>
          <div className="action-card-title">{action.description}</div>
          <div className="action-card-meta">
            <span>{action.agentName}</span>
            <span>•</span>
            <span>{action.actionType}</span>
            <span>•</span>
            <span>Risk: {action.risk.score.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="action-card-right">
        <span className={`level-badge level-${action.oversightLevel}`}>{action.oversightLevel}</span>
        <button className="btn-sm btn-danger" onClick={e => { e.stopPropagation(); onChallenge(); }}>⚡ Challenge</button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value" style={badge ? { color: badge } : {}}>{value}</span>
    </div>
  );
}

export default React.memo(OversightView);
