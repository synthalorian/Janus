import React, { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from './Markdown';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

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
    textareaRef.current?.focus();
  }, [inputValue, currentChannel, userId, userName, onSendMessage, onStopTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const d = new Date(timestamp);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      if (isToday) return time;
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
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
            <p className="welcome-subtitle">The gateway between mankind and AI</p>
            <div className="welcome-stats">
              <div className="stat-chip">
                <span className="stat-value">{channels.length}</span>
                <span className="stat-label">Channels</span>
              </div>
              <div className="stat-chip">
                <span className="stat-value">{messages.length}</span>
                <span className="stat-label">Messages</span>
              </div>
              <div className="stat-chip">
                <span className="stat-value">{connected ? '●' : '○'}</span>
                <span className="stat-label">{connected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
            <p className="welcome-hint">Select a channel from the sidebar to start chatting</p>
          </div>
        </div>
      </main>
    );
  }

  // Check if any message is currently streaming
  const isStreaming = messages.some(m => m.authorId === 'streaming');

  return (
    <main className="main">
      {/* Chat Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          <h2>
            <span className="channel-hash">#</span>
            {channel?.name || 'channel'}
          </h2>
          {channel?.description && <p className="channel-desc-header">{channel.description}</p>}
        </div>
        <div className="chat-header-right">
          <span className={`channel-type-pill ${channel?.type || 'chat'}`}>
            {channel?.type || 'chat'}
          </span>
          {!connected && <span className="header-badge disconnected-badge">Disconnected</span>}
        </div>
      </header>

      {/* Messages */}
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">💬</span>
            <h3>No messages yet</h3>
            <p>Be the first to start the conversation in <strong>#{channel?.name}</strong>!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isStreamingMsg = msg.authorId === 'streaming' && msg.content === '';
              const showAvatar = i === 0 || messages[i - 1].authorId !== msg.authorId;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  showAvatar={showAvatar}
                  formatTime={formatTime}
                  isStreaming={isStreamingMsg}
                />
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="streaming-indicator">
          <div className="streaming-dot" />
          <div className="streaming-dot" />
          <div className="streaming-dot" />
          <span>AI is generating a response...</span>
        </div>
      )}

      {/* Input Area */}
      <div className="input-area">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channel?.name || 'channel'} (Shift+Enter for new line)`}
          disabled={!connected || isStreaming}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!connected || !inputValue.trim() || isStreaming}
          title="Send message"
        >
          <span className="send-icon">↑</span>
        </button>
      </div>
    </main>
  );
}

function MessageBubble({ message, showAvatar, formatTime, isStreaming }: {
  message: Message;
  showAvatar: boolean;
  formatTime: (t: string) => string;
  isStreaming: boolean;
}) {
  const isAI = message.authorType === 'ai';

  return (
    <div className={`message ${isAI ? 'ai' : 'human'} ${showAvatar ? 'with-avatar' : 'continuation'} ${isStreaming ? 'streaming' : ''}`}>
      {showAvatar && (
        <div
          className="message-avatar"
          style={{
            background: isAI
              ? 'linear-gradient(135deg, #9333ea, #ec4899)'
              : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
          }}
        >
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
        <div className="message-body">
          {isStreaming ? (
            <div className="streaming-cursor">▊</div>
          ) : !message.content ? (
            <span className="message-empty">...</span>
          ) : (
            <Markdown content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ChatView);