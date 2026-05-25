import React from 'react';
import { useAuth } from '../hooks/AuthContext';
import ThemePicker from './ThemePicker';
import type { Channel, ViewType } from '../types';

interface SidebarProps {
  connected: boolean;
  channels: Channel[];
  currentChannel: string | null;
  currentView: ViewType;
  onSelectChannel: (channelId: string) => void;
  onSelectView: (view: ViewType) => void;
}

function Sidebar({ connected, channels, currentChannel, currentView, onSelectChannel, onSelectView }: SidebarProps) {
  const { user, logout } = useAuth();
  const userName = user?.name || 'Guest';
  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h1>
          <span className="janus-icon">🚪</span>
          Janus
        </h1>
        <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot" />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <NavItem
          icon="💬"
          label="Chat"
          active={currentView === 'chat'}
          onClick={() => onSelectView('chat')}
        />
        <NavItem
          icon="🤖"
          label="Bot Forge"
          active={currentView === 'bots'}
          onClick={() => onSelectView('bots')}
        />
        <NavItem
          icon="🕸️"
          label="Knowledge Graph"
          active={currentView === 'graph'}
          onClick={() => onSelectView('graph')}
        />
        <NavItem
          icon="⚖️"
          label="Oversight"
          active={currentView === 'oversight'}
          onClick={() => onSelectView('oversight')}
        />
        <NavItem
          icon="🐝"
          label="Swarm"
          active={currentView === 'swarm'}
          onClick={() => onSelectView('swarm')}
        />
        <NavItem
          icon="🩺"
          label="Health"
          active={currentView === 'health'}
          onClick={() => onSelectView('health')}
        />
        <NavItem
          icon="👻"
          label="Souls"
          active={currentView === 'souls'}
          onClick={() => onSelectView('souls')}
        />
      </nav>

      {/* Channels (shown in chat view) */}
      {currentView === 'chat' && (
        <div className="channels">
          <h2>Channels</h2>
          {channels.length === 0 && (
            <div className="channels-empty">No channels yet</div>
          )}
          {channels.map(channel => (
            <div
              key={channel.id}
              className={`channel ${currentChannel === channel.id ? 'active' : ''}`}
              onClick={() => onSelectChannel(channel.id)}
            >
              <span className="channel-icon">{channel.type === 'forum' ? '📋' : '#'}</span>
              <div className="channel-info">
                <span className="channel-name">{channel.name}</span>
                {channel.description && (
                  <span className="channel-desc">{channel.description}</span>
                )}
              </div>
              <span className="channel-type-badge">{channel.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* Theme Picker */}
      <div className="sidebar-theme-section">
        <ThemePicker />
      </div>

      {/* User info */}
      <div className="user-info">
        <div className="user-avatar">{userName[0]?.toUpperCase() || '?'}</div>
        <div className="user-details">
          <div className="user-name">{userName}</div>
          <div className="user-type">{user?.type === 'ai' ? 'AI Agent' : 'Human'}</div>
        </div>
        <button className="logout-btn" onClick={logout} title="Logout">
          🚪
        </button>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, onClick }: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {active && <span className="nav-indicator" />}
    </div>
  );
}

export default React.memo(Sidebar);
