import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Message, Channel } from '../types';

interface ChatViewProps {
  channels: Channel[];
  messages: Message[];
  currentChannel: string | null;
  connected: boolean;
  userId: string;
  userName: string;
  onSendMessage: (data: { content: string; authorId: string; authorName: string; authorType: 'human' | 'ai'; channelId: string }) => void;
  onStartTyping: (channelId: string, userId: string, userName: string) => void;
  onStopTyping: (channelId: string, userId: string) => void;
}

function ChatView({ channels, messages, currentChannel, connected, userId, userName, onSendMessage, onStartTyping, onStopTyping }: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const channel = channels.find(c => c.id === currentChannel);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (currentChannel) {
      onStartTyping(currentChannel, userId, userName);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (currentChannel) onStopTyping(currentChannel, userId);
      }, 1500);
    }
  };

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || !currentChannel) return;
    onSendMessage({
      content: inputValue.trim(),
      authorId: userId,
      authorName: userName,
      authorType: 'human',
      channelId: currentChannel,
    });
    setInputValue('');
    if (currentChannel) onStopTyping(currentChannel, userId);
  }, [inputValue, currentChannel, userId, userName, onSendMessage, onStopTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!currentChannel) {
    return (
      <main className="main">
        <div className="no-channel">
          <div className="welcome-hero">
            <span className="welcome-icon">🚪</span>
            <h2>Welcome to Janus</h2>
            <p>The gateway between mankind and AI</p>
            <div className="welcome-stats">
              <div className="stat-chip">
                <span className="stat-value">{channels.length}</span>
                <span className="stat-label">Channels</span>
              </div>
              <div className="stat-chip">
                <span className="stat-value">{messages.length}</span>
                <span className="stat-label">Messages</span>
              </div>
            </div>
            <p className="welcome-hint">Select a channel from the sidebar to start chatting</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      {/* Chat Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          <h2>
            <span className="channel-hash">#</span>
            {channel?.name || 'channel'}
          </h2>
          {channel?.description && <p>{channel.description}</p>}
        </div>
        <div className="chat-header-right">
          <span className={`channel-type-pill ${channel?.type || 'chat'}`}>
            {channel?.type || 'chat'}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">💬</span>
            <h3>No messages yet</h3>
            <p>Be the first to start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const showAvatar = i === 0 || messages[i - 1].authorId !== msg.authorId;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  showAvatar={showAvatar}
                  formatTime={formatTime}
                />
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">
        <textarea
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channel?.name || 'channel'}`}
          disabled={!connected}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!connected || !inputValue.trim()}
          title="Send message"
        >
          <span className="send-icon">↑</span>
        </button>
      </div>
    </main>
  );
}

function MessageBubble({ message, showAvatar, formatTime }: {
  message: Message;
  showAvatar: boolean;
  formatTime: (t: string) => string;
}) {
  const isAI = message.authorType === 'ai';

  return (
    <div className={`message ${isAI ? 'ai' : 'human'} ${showAvatar ? 'with-avatar' : 'continuation'}`}>
      {showAvatar && (
        <div className="message-avatar" style={{ background: isAI ? 'linear-gradient(135deg, #9333ea, #ec4899)' : 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
          {isAI ? '🤖' : message.authorName[0]?.toUpperCase()}
        </div>
      )}
      <div className="message-content">
        {showAvatar && (
          <div className="message-header">
            <span className="message-author">{message.authorName}</span>
            {isAI && <span className="ai-badge">AI</span>}
            <span className="message-time">{formatTime(message.timestamp)}</span>
          </div>
        )}
        <div className="message-body">{message.content}</div>
      </div>
    </div>
  );
}

export default React.memo(ChatView);
