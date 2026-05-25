import React, { useState } from 'react';
import { useGraph } from '../hooks/useGraph';
import { ViewShell, Tab } from './shared';
import type { Message } from '../types';

function GraphView() {
  const {
    stats, loading, error,
    search, searching,
    searchByTopic, getDecisions,
  } = useGraph();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [activeMode, setActiveMode] = useState<'search' | 'topics' | 'decisions'>('search');

  const handleSearch = async () => {
    if (!query.trim()) return;
    const res = await search(query.trim());
    if (res) setResults(res);
  };

  const handleTopicSearch = async (topic: string) => {
    setQuery(topic);
    setActiveMode('topics');
    const res = await searchByTopic(topic);
    if (res) setResults(res);
  };

  const handleGetDecisions = async () => {
    setActiveMode('decisions');
    const res = await getDecisions();
    if (res) setResults(res);
  };

  if (loading) return <ViewShell title="Knowledge Graph"><div className="loading">Loading graph...</div></ViewShell>;
  if (error) return <ViewShell title="Knowledge Graph"><div className="error-state">{error}</div></ViewShell>;

  return (
    <ViewShell title="Knowledge Graph" subtitle="Explore the living knowledge base" badge={stats ? `${stats.nodes} nodes, ${stats.edges} edges` : ''}>
      {stats && (
        <div className="graph-stats-row">
          <GraphStatCard icon="🟢" label="Nodes" value={stats.nodes} color="#22c55e" />
          <GraphStatCard icon="🔗" label="Edges" value={stats.edges} color="#3b82f6" />
          <GraphStatCard icon="📊" label="Density" value={stats.nodes > 0 ? ((stats.edges / (stats.nodes * (stats.nodes - 1))) * 100).toFixed(1) + '%' : '0%'} color="#f59e0b" />
        </div>
      )}

      <div className="tabs" style={{ marginTop: 16 }}>
        <Tab active={activeMode === 'search'} onClick={() => setActiveMode('search')} label="Search" />
        <Tab active={activeMode === 'topics'} onClick={() => setActiveMode('topics')} label="Topics" />
        <Tab active={activeMode === 'decisions'} onClick={handleGetDecisions} label="Decisions" />
      </div>

      {activeMode === 'search' && (
        <div className="graph-search">
          <div className="search-bar">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search the knowledge graph..."
            />
            <button onClick={handleSearch} disabled={searching || !query.trim()}>
              {searching ? '...' : '🔍'}
            </button>
          </div>
        </div>
      )}

      {activeMode === 'topics' && (
        <div className="topic-chips">
          {['AI', 'authentication', 'database', 'bots', 'oversight', 'deployment', 'API', 'security'].map(topic => (
            <button key={topic} className="topic-chip" onClick={() => handleTopicSearch(topic)}>
              #{topic}
            </button>
          ))}
        </div>
      )}

      <div className="graph-results">
        {(results.length === 0 && !searching) ? (
          <div className="empty-state">
            <span className="empty-icon">🕸️</span>
            <h3>Explore the graph</h3>
            <p>Search for topics, entities, or decisions to see connections</p>
          </div>
        ) : (
          <div className="result-list">
            {results.map((msg, i) => (
              <GraphResultCard key={msg.id || i} message={msg} index={i} />
            ))}
          </div>
        )}
      </div>
    </ViewShell>
  );
}

function GraphStatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <span className="stat-card-icon">{icon}</span>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}

function GraphResultCard({ message, index }: { message: Message; index: number }) {
  const isAI = message.authorType === 'ai';
  return (
    <div className="graph-result-card">
      <div className="result-index">#{index + 1}</div>
      <div className="result-content">
        <div className="result-header">
          <span className="result-author">{message.authorName}</span>
          {isAI && <span className="ai-badge">AI</span>}
          <span className="result-channel">#{message.channelId}</span>
          <span className="result-time">{new Date(message.timestamp).toLocaleDateString()}</span>
        </div>
        <div className="result-body">{message.content}</div>
      </div>
    </div>
  );
}

export default React.memo(GraphView);
