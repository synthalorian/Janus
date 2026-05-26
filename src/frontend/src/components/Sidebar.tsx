import React, { useState } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);

  const handleSelectView = (view: ViewType) => {
    onSelectView(view);
    // Auto-collapse on mobile after selection
    if (window.innerWidth < 768) {
      setCollapsed(true);
    }
  };

  const handleSelectChannel = (channelId: string) => {
    onSelectChannel(channelId);
    if (window.innerWidth < 768) {
      setCollapsed(true);
    }
  };

  const toggleCollapse = () => setCollapsed(prev => !prev);

  return (
    <>
      {/* Mobile toggle button (always visible) */}
      <button
        className={`sidebar-toggle ${collapsed ? '' : 'open'}`}
        onClick={toggleCollapse}
        title={collapsed ? 'Open sidebar' : 'Close sidebar'}
      >
        <span className="toggle-bar" />
        <span className="toggle-bar" />
        <span className="toggle-bar" />
      </button>

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <h1>
              <span className="janus-icon">🚪</span>
              Janus
            </h1>
            <button className="sidebar-close-btn" onClick={toggleCollapse} title="Close sidebar">
              ×
            </button>
          </div>
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
            onClick={() => handleSelectView('chat')}
          />
          <NavItem
            icon="🤖"
            label="Bot Forge"
            active={currentView === 'bots'}
            onClick={() => handleSelectView('bots')}
          />
          <NavItem
            icon="🕸️"
            label="Knowledge Graph"
            active={currentView === 'graph'}
            onClick={() => handleSelectView('graph')}
          />
          <NavItem
            icon="⚖️"
            label="Oversight"
            active={currentView === 'oversight'}
            onClick={() => handleSelectView('oversight')}
          />
          <NavItem
            icon="🐝"
            label="Swarm"
            active={currentView === 'swarm'}
            onClick={() => handleSelectView('swarm')}
          />
          <NavItem
            icon="🩺"
            label="Health"
            active={currentView === 'health'}
            onClick={() => handleSelectView('health')}
          />
          <NavItem
            icon="👻"
            label="Souls"
            active={currentView === 'souls'}
            onClick={() => handleSelectView('souls')}
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
                onClick={() => handleSelectChannel(channel.id)}
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

      {/* Overlay when sidebar is open on mobile */}
      {!collapsed && <div className="sidebar-overlay" onClick={toggleCollapse} />}
    </>
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