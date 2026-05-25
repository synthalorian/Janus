import React, { useState } from 'react';
import { useBots } from '../hooks/useBots';
import { ViewShell, Tab, FormField } from './shared';
import type { Bot, BotTemplate } from '../types';

function BotForgeView() {
  const {
    bots, templates, loading, error,
    spawnBot, spawnTeam, terminateBot, pauseBot, resumeBot,
  } = useBots();

  const [activeTab, setActiveTab] = useState<'bots' | 'templates' | 'spawn'>('bots');
  const [spawnForm, setSpawnForm] = useState({ template: '', name: '', displayName: '', description: '' });
  const [teamForm, setTeamForm] = useState({ name: '', bots: [{ template: '', name: '' }] });
  const [statusMsg, setStatusMsg] = useState('');

  const handleSpawn = async () => {
    if (!spawnForm.template) return;
    const res = await spawnBot(spawnForm.template, spawnForm.name || undefined, spawnForm.displayName || undefined, spawnForm.description || undefined);
    if (res.success) {
      setStatusMsg('Bot spawned successfully!');
      setSpawnForm({ template: '', name: '', displayName: '', description: '' });
    } else {
      setStatusMsg(res.error || 'Failed to spawn bot');
    }
  };

  const handleSpawnTeam = async () => {
    if (!teamForm.name) return;
    const res = await spawnTeam(teamForm.name, teamForm.bots.filter(b => b.template));
    if (res.success) {
      setStatusMsg('Team spawned successfully!');
      setTeamForm({ name: '', bots: [{ template: '', name: '' }] });
    } else {
      setStatusMsg(res.error || 'Failed to spawn team');
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'online': return 'var(--success)';
      case 'idle': return '#f59e0b';
      case 'error': return 'var(--error)';
      default: return 'var(--text-muted)';
    }
  };

  if (loading) return <ViewShell title="Bot Forge"><div className="loading">Loading bots...</div></ViewShell>;
  if (error) return <ViewShell title="Bot Forge"><div className="error-state">{error}</div></ViewShell>;

  return (
    <ViewShell title="Bot Forge" subtitle="Create and manage AI bots" badge={`${bots.length} bots`}>
      <div className="tabs">
        <Tab active={activeTab === 'bots'} onClick={() => setActiveTab('bots')} label="My Bots" count={bots.length} />
        <Tab active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} label="Templates" count={templates.length} />
        <Tab active={activeTab === 'spawn'} onClick={() => setActiveTab('spawn')} label="Spawn New" />
      </div>

      {statusMsg && (
        <div className={`status-banner ${statusMsg.includes('success') ? 'success' : 'error'}`}>
          {statusMsg}
          <button onClick={() => setStatusMsg('')}>×</button>
        </div>
      )}

      {activeTab === 'bots' && (
        <div className="bot-grid">
          {bots.length === 0 && <div className="empty-state"><span className="empty-icon">🤖</span><h3>No bots yet</h3><p>Spawn your first bot from templates!</p></div>}
          {bots.map(bot => (
            <BotCard
              key={bot.id}
              bot={bot}
              onPause={() => pauseBot(bot.id)}
              onResume={() => resumeBot(bot.id)}
              onTerminate={() => { if (confirm(`Terminate ${bot.displayName || bot.name}?`)) terminateBot(bot.id); }}
              statusColor={statusColor}
            />
          ))}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="template-grid">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onUse={() => { setSpawnForm(prev => ({ ...prev, template: t.id })); setActiveTab('spawn'); }}
            />
          ))}
        </div>
      )}

      {activeTab === 'spawn' && (
        <div className="spawn-section">
          <h3>Spawn a Bot</h3>
          <div className="form-grid">
            <FormField label="Template" value={spawnForm.template} onChange={v => setSpawnForm(p => ({ ...p, template: v }))} placeholder="e.g., researcher, coder, analyst" />
            <FormField label="Name" value={spawnForm.name} onChange={v => setSpawnForm(p => ({ ...p, name: v }))} placeholder="bot-name" />
            <FormField label="Display Name" value={spawnForm.displayName} onChange={v => setSpawnForm(p => ({ ...p, displayName: v }))} placeholder="My Bot" />
            <FormField label="Description" value={spawnForm.description} onChange={v => setSpawnForm(p => ({ ...p, description: v }))} placeholder="What does this bot do?" />
          </div>
          <button className="btn-primary" onClick={handleSpawn} disabled={!spawnForm.template}>
            🚀 Spawn Bot
          </button>

          <h3 style={{ marginTop: 32 }}>Spawn a Team</h3>
          <FormField label="Team Name" value={teamForm.name} onChange={v => setTeamForm(p => ({ ...p, name: v }))} placeholder="My Team" />
          {teamForm.bots.map((b, i) => (
            <div key={i} className="team-bot-row">
              <input value={b.template} onChange={e => {
                const next = [...teamForm.bots];
                next[i] = { ...next[i], template: e.target.value };
                setTeamForm(p => ({ ...p, bots: next }));
              }} placeholder="Template" />
              <input value={b.name} onChange={e => {
                const next = [...teamForm.bots];
                next[i] = { ...next[i], name: e.target.value };
                setTeamForm(p => ({ ...p, bots: next }));
              }} placeholder="Name (optional)" />
              {teamForm.bots.length > 1 && (
                <button className="btn-icon" onClick={() => setTeamForm(p => ({ ...p, bots: p.bots.filter((_, j) => j !== i) }))}>×</button>
              )}
            </div>
          ))}
          <button className="btn-secondary" onClick={() => setTeamForm(p => ({ ...p, bots: [...p.bots, { template: '', name: '' }] }))}>
            + Add Bot
          </button>
          <button className="btn-primary" onClick={handleSpawnTeam} disabled={!teamForm.name || teamForm.bots.every(b => !b.template)} style={{ marginTop: 8 }}>
            🚀 Spawn Team
          </button>
        </div>
      )}
    </ViewShell>
  );
}

function BotCard({ bot, onPause, onResume, onTerminate, statusColor }: {
  bot: Bot;
  onPause: () => void;
  onResume: () => void;
  onTerminate: () => void;
  statusColor: (s: string) => string;
}) {
  return (
    <div className={`bot-card status-${bot.status}`}>
      <div className="bot-card-header">
        <span className="bot-icon">🤖</span>
        <div className="bot-card-info">
          <h4>{bot.displayName || bot.name}</h4>
          {bot.description && <p>{bot.description}</p>}
        </div>
        <span className="bot-status" style={{ background: statusColor(bot.status) }}>{bot.status}</span>
      </div>
      {bot.capabilities && bot.capabilities.length > 0 && (
        <div className="bot-capabilities">
          {bot.capabilities.map(c => <span key={c} className="capability-tag">{c}</span>)}
        </div>
      )}
      <div className="bot-card-actions">
        {bot.status === 'online' && <button className="btn-sm" onClick={onPause}>⏸ Pause</button>}
        {bot.status === 'idle' && <button className="btn-sm btn-success" onClick={onResume}>▶ Resume</button>}
        <button className="btn-sm btn-danger" onClick={onTerminate}>✕ Terminate</button>
      </div>
    </div>
  );
}

function TemplateCard({ template, onUse }: { template: BotTemplate; onUse: () => void }) {
  return (
    <div className="template-card">
      <div className="template-card-header">
        <span className="template-icon">
          {template.id === 'researcher' ? '🔍' : template.id === 'coder' ? '💻' : template.id === 'analyst' ? '📊' : template.id === 'coordinator' ? '🎯' : template.id === 'watcher' ? '👀' : template.id === 'responder' ? '💬' : '⚙️'}
        </span>
        <div>
          <h4>{template.name}</h4>
          <span className="template-category">{template.category}</span>
        </div>
      </div>
      <p>{template.description}</p>
      <div className="template-capabilities">
        {template.capabilities.map(c => <span key={c} className="capability-tag">{c}</span>)}
      </div>
      <button className="btn-primary btn-sm" onClick={onUse}>Use Template</button>
    </div>
  );
}

export default React.memo(BotForgeView);
