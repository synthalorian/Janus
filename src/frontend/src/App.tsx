import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './hooks/AuthContext';
import { ThemeProvider } from './hooks/ThemeContext';
import { useSocket } from './hooks/useSocket';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import BotForgeView from './components/BotForgeView';
import GraphView from './components/GraphView';
import OversightView from './components/OversightView';
import SwarmView from './components/SwarmView';
import SystemHealthView from './components/SystemHealthView';
import SoulsView from './components/SoulsView';
import AuthView from './components/AuthView';
import type { ViewType } from './types';
import './App.css';

// Only mounts when authenticated, so useSocket only connects when needed
function AuthenticatedApp() {
  const { user } = useAuth();
  const {
    connected,
    channels,
    messages,
    currentChannel,
    joinChannel,
    sendMessage,
    startTyping,
    stopTyping,
  } = useSocket();

  const [currentView, setCurrentView] = useState<ViewType>('chat');

  // Auto-join general channel on connect
  useEffect(() => {
    if (connected && channels.length > 0 && !currentChannel) {
      joinChannel(channels[0].id);
    }
  }, [connected, channels, currentChannel, joinChannel]);

  const handleSelectView = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  const handleSelectChannel = useCallback((channelId: string) => {
    joinChannel(channelId);
    setCurrentView('chat');
  }, [joinChannel]);

  const userId = user?.id || 'unknown';
  const userName = user?.name || 'Unknown';

  return (
    <div className="app">
      <Sidebar
        connected={connected}
        channels={channels}
        currentChannel={currentChannel}
        currentView={currentView}
        onSelectChannel={handleSelectChannel}
        onSelectView={handleSelectView}
      />

      {currentView === 'chat' && (
        <ChatView
          channels={channels}
          messages={messages}
          currentChannel={currentChannel}
          connected={connected}
          userId={userId}
          userName={userName}
          onSendMessage={sendMessage}
          onStartTyping={startTyping}
          onStopTyping={stopTyping}
        />
      )}

      {currentView === 'bots' && <BotForgeView />}

      {currentView === 'graph' && <GraphView />}

      {currentView === 'oversight' && <OversightView />}

      {currentView === 'swarm' && <SwarmView />}

      {currentView === 'health' && <SystemHealthView />}

      {currentView === 'souls' && <SoulsView />}
    </div>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();

  // Loading splash while validating stored token
  if (isLoading) {
    return (
      <div className="loading-splash">
        <div className="loading-splash-content">
          <span className="loading-splash-icon">🚪</span>
          <h1>Janus</h1>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // Auth gate
  if (!isAuthenticated) {
    return <AuthView />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
