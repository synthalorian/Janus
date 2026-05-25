import { useState, useEffect, useCallback } from 'react';
import { soulsApi } from '../api/client';
import type { AgentSoul } from '../types';

// Archetype icons and colors
const ARCHETYPE_META: Record<string, { icon: string; color: string }> = {
  creator:   { icon: '🔧', color: '#8f00ff' },
  analyst:   { icon: '📊', color: '#0080ff' },
  guardian:  { icon: '🛡️', color: '#00ff41' },
  explorer:  { icon: '🧭', color: '#03edf9' },
  sage:      { icon: '📚', color: '#ffff66' },
  artisan:   { icon: '🎨', color: '#ff6600' },
  commander: { icon: '⚔️', color: '#ff0040' },
};

function SoulsView() {
  const [souls, setSouls] = useState<AgentSoul[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSoul, setSelectedSoul] = useState<AgentSoul | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadSouls = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await soulsApi.list({
        search: searchQuery || undefined,
        status: statusFilter || undefined,
      });
      if (res.success && res.data) {
        setSouls(res.data);
      } else {
        setError(res.error || 'Failed to load souls');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => { loadSouls(); }, [loadSouls]);

  const handleSoulClick = async (soul: AgentSoul) => {
    try {
      const res = await soulsApi.get(soul.id);
      if (res.success && res.data) {
        setSelectedSoul(res.data);
      }
    } catch {
      // If get fails, use the list data
      setSelectedSoul(soul);
    }
  };

  return (
    <main className="main">
      <header className="chat-header">
        <div className="chat-header-left">
          <h2><span className="channel-hash">✦</span> Agent Souls</h2>
          <p>AI agent identities, skills, and placements</p>
        </div>
        <div className="chat-header-right">
          <span className="header-badge">{souls.length} souls</span>
        </div>
      </header>

      <div className="view-content">
        {/* Filters */}
        <div className="bot-controls">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search souls by name, personality..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button onClick={loadSouls} title="Refresh">⟳</button>
          </div>
          <div className="filter-tabs">
            {['', 'active', 'dormant', 'archived'].map(s => (
              <button
                key={s}
                className={`tab ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-state">{error}</div>}

        {loading ? (
          <div className="loading">Loading souls...</div>
        ) : (
          <div className="souls-layout">
            {/* Soul Cards Grid */}
            <div className="souls-grid">
              {souls.length === 0 && !loading && (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <span className="empty-icon">👻</span>
                  <h3>No souls found</h3>
                  <p>Register an AI agent to create its soul</p>
                </div>
              )}
              {souls.map(soul => {
                const meta = ARCHETYPE_META[soul.archetype] || { icon: '❓', color: '#7a6b9e' };
                const isSelected = selectedSoul?.id === soul.id;
                return (
                  <div
                    key={soul.id}
                    className={`soul-card ${isSelected ? 'active' : ''} ${soul.status}`}
                    onClick={() => handleSoulClick(soul)}
                  >
                    <div className="soul-card-header">
                      <span className="soul-avatar" style={{ background: meta.color }}>
                        {soul.avatar || meta.icon}
                      </span>
                      <div className="soul-card-info">
                        <span className="soul-name">{soul.displayName || soul.name}</span>
                        <span className="soul-archetype">{meta.icon} {soul.archetype}</span>
                      </div>
                      <span className={`soul-status-badge ${soul.status}`}>
                        {soul.status}
                      </span>
                    </div>
                    <div className="soul-card-body">
                      <p className="soul-personality">{soul.personality || 'No personality defined'}</p>
                    </div>
                    <div className="soul-card-footer">
                      <span className="soul-level">Lv.{soul.level}</span>
                      <span className="soul-xp">{soul.experiencePoints} XP</span>
                      <span className="soul-skills-count">{soul.skills?.length || 0} skills</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Soul Detail Panel */}
            {selectedSoul && (
              <div className="soul-detail">
                <div className="soul-detail-header">
                  <h3>{selectedSoul.displayName || selectedSoul.name}</h3>
                  <button className="btn-sm" onClick={() => setSelectedSoul(null)}>✕</button>
                </div>

                {/* Personality */}
                <div className="detail-section">
                  <h4>Personality</h4>
                  <p>{selectedSoul.personality || 'Not defined'}</p>
                </div>

                {/* Backstory */}
                {selectedSoul.backstory && (
                  <div className="detail-section">
                    <h4>Backstory</h4>
                    <p className="soul-backstory">{selectedSoul.backstory}</p>
                  </div>
                )}

                {/* Voice Style */}
                {selectedSoul.voiceStyle && (
                  <div className="detail-section">
                    <h4>Voice</h4>
                    <p>{selectedSoul.voiceStyle}</p>
                  </div>
                )}

                {/* Expertise Tags */}
                {selectedSoul.expertiseTags && selectedSoul.expertiseTags.length > 0 && (
                  <div className="detail-section">
                    <h4>Expertise</h4>
                    <div className="tag-list">
                      {selectedSoul.expertiseTags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                <div className="detail-section">
                  <h4>Skills ({selectedSoul.skills?.length || 0})</h4>
                  {(!selectedSoul.skills || selectedSoul.skills.length === 0) ? (
                    <p className="muted">No skills defined</p>
                  ) : (
                    <div className="skills-list">
                      {selectedSoul.skills.map(skill => (
                        <div key={skill.id} className="skill-item">
                          <div className="skill-header">
                            <span className="skill-name">{skill.name}</span>
                            <span className="skill-category">{skill.category}</span>
                          </div>
                          {skill.description && <p className="skill-desc">{skill.description}</p>}
                          <div className="skill-meta">
                            <span className="skill-proficiency">
                              Proficiency: {Math.round(skill.proficiency * 100)}%
                            </span>
                            <span className="skill-uses">{skill.useCount} uses</span>
                          </div>
                          {skill.triggers && skill.triggers.length > 0 && (
                            <div className="tag-list">
                              {skill.triggers.map(t => <span key={t} className="tag tag-sm">{t}</span>)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Placements */}
                <div className="detail-section">
                  <h4>Placements ({selectedSoul.placements?.length || 0})</h4>
                  {(!selectedSoul.placements || selectedSoul.placements.length === 0) ? (
                    <p className="muted">Not deployed anywhere</p>
                  ) : (
                    <div className="placements-list">
                      {selectedSoul.placements.map(p => (
                        <div key={p.id} className={`placement-item ${p.isActive ? 'active' : 'inactive'}`}>
                          <div className="placement-header">
                            <span className="placement-channel">#{p.channelId || 'global'}</span>
                            <span className={`placement-mode ${p.activationMode}`}>{p.activationMode}</span>
                            <span className={`placement-status ${p.isActive ? 'active' : 'inactive'}`}>
                              {p.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {p.matchPattern && <p className="placement-pattern">Match: {p.matchPattern}</p>}
                          <span className="placement-priority">Priority: {p.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="detail-section">
                  <h4>Evolution</h4>
                  <div className="soul-stats-row">
                    <div className="soul-stat">
                      <span className="stat-value">{selectedSoul.level}</span>
                      <span className="stat-label">Level</span>
                    </div>
                    <div className="soul-stat">
                      <span className="stat-value">{selectedSoul.experiencePoints}</span>
                      <span className="stat-label">XP</span>
                    </div>
                    <div className="soul-stat">
                      <span className="stat-value">{selectedSoul.interactionsCount}</span>
                      <span className="stat-label">Interactions</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default SoulsView;