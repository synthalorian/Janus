import React, { useState, useEffect, useCallback } from 'react';
import { ViewShell, Tab } from './shared';
import { healthApi, statsApi } from '../api/client';
import { useBots } from '../hooks/useBots';
import { useOversight } from '../hooks/useOversight';

interface HealthData {
  status: string;
  timestamp: string;
  database: string;
  stats: {
    users?: number;
    channels?: number;
    messages?: number;
    graphNodes?: number;
    graphEdges?: number;
  };
  features: Record<string, boolean>;
}

interface StatsData {
  users: number;
  channels: number;
  messages: number;
  graphNodes: number;
  graphEdges: number;
}

function SystemHealthView() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'bots' | 'oversight'>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { bots, loading: botsLoading } = useBots();
  const { stats: oversightStats, loading: oversightLoading } = useOversight();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, statsRes] = await Promise.all([
        healthApi.check(),
        statsApi.get(),
      ]);
      if (healthRes.success && healthRes.data) {
        setHealth(healthRes.data as HealthData);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data as StatsData);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const onlineBots = bots.filter(b => b.status === 'online').length;
  const idleBots = bots.filter(b => b.status === 'idle').length;
  const errorBots = bots.filter(b => b.status === 'error').length;

  if (loading && !health) return <ViewShell title="System Health"><div className="loading">Loading diagnostics...</div></ViewShell>;
  if (error) return <ViewShell title="System Health"><div className="error-state">{error}</div></ViewShell>;

  return (
    <ViewShell title="System Health" subtitle="Live platform diagnostics" badge={health ? (health.database === 'connected' ? 'Healthy' : 'Degraded') : ''}>
      <div className="tabs">
        <Tab active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" />
        <Tab active={activeTab === 'bots'} onClick={() => setActiveTab('bots')} label="Bots" count={bots.length} />
        <Tab active={activeTab === 'oversight'} onClick={() => setActiveTab('oversight')} label="Oversight" />
      </div>

      {lastUpdated && (
        <div className="last-updated">
          Last updated: {lastUpdated.toLocaleTimeString()}
          <button className="btn-refresh" onClick={fetchData} title="Refresh now">⟳</button>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="health-overview">
          <div className="health-cards">
            <HealthCard
              icon="🟢"
              label="Server Status"
              value={health?.status || 'Unknown'}
              color={health?.status === 'ok' ? 'var(--success)' : 'var(--error)'}
            />
            <HealthCard
              icon="🗄️"
              label="Database"
              value={health?.database || 'Unknown'}
              color={health?.database === 'connected' ? 'var(--success)' : 'var(--error)'}
            />
            <HealthCard
              icon="👤"
              label="Users"
              value={String(stats?.users ?? 0)}
              color="#3b82f6"
            />
            <HealthCard
              icon="💬"
              label="Messages"
              value={String(stats?.messages ?? 0)}
              color="#a855f7"
            />
            <HealthCard
              icon="📢"
              label="Channels"
              value={String(stats?.channels ?? 0)}
              color="#f59e0b"
            />
            <HealthCard
              icon="🕸️"
              label="Graph Nodes"
              value={String(stats?.graphNodes ?? 0)}
              color="#22c55e"
            />
          </div>

          {health?.features && (
            <div className="features-section">
              <h4>Feature Flags</h4>
              <div className="feature-flags">
                {Object.entries(health.features).map(([name, enabled]) => (
                  <span key={name} className={`feature-flag ${enabled ? 'enabled' : 'disabled'}`}>
                    {enabled ? '✓' : '✗'} {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'bots' && (
        <div className="health-bots">
          <div className="bot-health-stats">
            <HealthCard icon="🟢" label="Online" value={String(onlineBots)} color="var(--success)" />
            <HealthCard icon="⏸️" label="Idle" value={String(idleBots)} color="#f59e0b" />
            <HealthCard icon="❌" label="Error" value={String(errorBots)} color="var(--error)" />
            <HealthCard icon="🤖" label="Total" value={String(bots.length)} color="#3b82f6" />
          </div>

          {botsLoading ? (
            <div className="loading">Loading bots...</div>
          ) : bots.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🤖</span>
              <h3>No bots registered</h3>
              <p>Spawn bots from the Bot Forge to see them here</p>
            </div>
          ) : (
            <div className="bot-health-list">
              {bots.map(bot => (
                <BotHealthRow key={bot.id} bot={bot} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'oversight' && (
        <div className="health-oversight">
          {oversightLoading ? (
            <div className="loading">Loading oversight stats...</div>
          ) : !oversightStats ? (
            <div className="empty-state">
              <span className="empty-icon">⚖️</span>
              <h3>No oversight data</h3>
              <p>Oversight stats will appear once actions are submitted</p>
            </div>
          ) : (
            <div className="oversight-health-stats">
              <HealthCard icon="📋" label="Total Actions" value={String(oversightStats.total)} color="#3b82f6" />
              <HealthCard icon="⏳" label="Pending" value={String(oversightStats.pending)} color="#f59e0b" />
              <HealthCard icon="✅" label="Approved" value={String(oversightStats.approved)} color="var(--success)" />
              <HealthCard icon="❌" label="Rejected" value={String(oversightStats.rejected)} color="var(--error)" />
              <HealthCard icon="🚩" label="Challenged" value={String(oversightStats.challenged)} color="#a855f7" />
              <HealthCard icon="🚨" label="Escalated" value={String(oversightStats.escalated)} color="#ef4444" />

              <div className="risk-distribution">
                <h4>Risk Distribution</h4>
                <div className="risk-bars">
                  {Object.entries(oversightStats.byRiskLevel || {}).map(([level, count]) => (
                    <div key={level} className="risk-bar-row">
                      <span className="risk-bar-label">{level}</span>
                      <div className="risk-bar-track">
                        <div
                          className="risk-bar-fill"
                          style={{
                            width: `${oversightStats.total > 0 ? (count / oversightStats.total) * 100 : 0}%`,
                            background:
                              level === 'emergency' ? '#ef4444' :
                              level === 'high' ? '#f59e0b' :
                              level === 'medium' ? '#3b82f6' :
                              '#22c55e'
                          }}
                        />
                      </div>
                      <span className="risk-bar-value">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="avg-risk">
                  Average Risk Score: {(oversightStats.averageRiskScore * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ViewShell>
  );
}

function HealthCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="health-card" style={{ borderTopColor: color }}>
      <span className="health-card-icon">{icon}</span>
      <div>
        <div className="health-card-value">{value}</div>
        <div className="health-card-label">{label}</div>
      </div>
    </div>
  );
}

function BotHealthRow({ bot }: { bot: { id: string; name: string; displayName?: string; status: string; type: string; ownerId: string; createdAt: string } }) {
  const statusColor = (s: string) => {
    switch (s) {
      case 'online': return 'var(--success)';
      case 'idle': return '#f59e0b';
      case 'error': return 'var(--error)';
      default: return 'var(--text-muted)';
    }
  };
  return (
    <div className="bot-health-row">
      <span className="bot-health-status" style={{ background: statusColor(bot.status) }} />
      <span className="bot-health-name">{bot.displayName || bot.name}</span>
      <span className="bot-health-type">{bot.type}</span>
      <span className="bot-health-owner">{bot.ownerId.slice(0, 8)}</span>
      <span className="bot-health-date">{new Date(bot.createdAt).toLocaleDateString()}</span>
    </div>
  );
}

export default React.memo(SystemHealthView);
