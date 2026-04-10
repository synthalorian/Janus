import { useState, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import type { Message } from './types';
import './App.css';

function App() {
  const {
    connected,
    channels,
    messages,
    currentChannel,
    joinChannel,
    sendMessage,
    startTyping,
    stopTyping
  } = useSocket();

  const [inputValue, setInputValue] = useState('');
  const [userId] = useState(() => `user-${Date.now()}`);
  const [userName] = useState('synth');
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-join general channel on connect
  useEffect(() => {
    if (connected && channels.length > 0 && !currentChannel) {
      joinChannel(channels[0].id);
    }
  }, [connected, channels, currentChannel, joinChannel]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    // Typing indicator
    if (currentChannel) {
      startTyping(currentChannel, userId, userName);

      if (typingTimeout) clearTimeout(typingTimeout);
      const timeout = setTimeout(() => {
        stopTyping(currentChannel, userId);
      }, 1000);
      setTypingTimeout(timeout);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || !currentChannel) return;

    sendMessage({
      content: inputValue,
      authorId: userId,
      authorName: userName,
      authorType: 'human',
      channelId: currentChannel,
    });

    setInputValue('');
    stopTyping(currentChannel, userId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>🚪 Janus</h1>
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="channels">
          <h2>Channels</h2>
          {channels.map(channel => (
            <div
              key={channel.id}
              className={`channel ${currentChannel === channel.id ? 'active' : ''}`}
              onClick={() => joinChannel(channel.id)}
            >
              <span className="channel-icon">#</span>
              <span className="channel-name">{channel.name}</span>
            </div>
          ))}
        </div>

        <div className="user-info">
          <div className="user-avatar">{userName[0].toUpperCase()}</div>
          <div className="user-details">
            <div className="user-name">{userName}</div>
            <div className="user-type">Human</div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main">
        {currentChannel ? (
          <>
            <header className="chat-header">
              <h2>#{channels.find(c => c.id === currentChannel)?.name || 'channel'}</h2>
              <p>{channels.find(c => c.id === currentChannel)?.description}</p>
            </header>

            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageComponent key={msg.id} message={msg} formatTime={formatTime} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={!connected}
              />
              <button onClick={handleSend} disabled={!connected || !inputValue.trim()}>
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="no-channel">
            <h2>Welcome to Janus</h2>
            <p>Select a channel to start chatting</p>
          </div>
        )}
      </main>
    </div>
  );
}

function MessageComponent({ message, formatTime }: { message: Message; formatTime: (t: Date | string) => string }) {
  const isAI = message.authorType === 'ai';

  return (
    <div className={`message ${isAI ? 'ai-message' : 'human-message'}`}>
      <div className="message-avatar" style={{ backgroundColor: isAI ? '#9333ea' : '#3b82f6' }}>
        {message.authorName[0].toUpperCase()}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-author">{message.authorName}</span>
          {isAI && <span className="ai-badge">AI</span>}
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>
        <div className="message-body">{message.content}</div>
      </div>
    </div>
  );
}

export default App;
