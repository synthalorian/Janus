import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, Channel } from '../types';

const SERVER_URL = 'http://localhost:3001';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io(SERVER_URL);

    newSocket.on('connect', () => {
      console.log('Connected to Janus server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from Janus server');
      setConnected(false);
    });

    newSocket.on('channels:list', (channelList: Channel[]) => {
      setChannels(channelList);
    });

    newSocket.on('messages:history', ({ messages: msgs }: { messages: Message[] }) => {
      setMessages(msgs);
    });

    newSocket.on('message:new', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('message:stream:start', (data: { messageId: string; authorName: string }) => {
      // Create a placeholder message for streaming
      setMessages(prev => [...prev, {
        id: data.messageId,
        content: '',
        authorId: 'streaming',
        authorName: data.authorName,
        authorType: 'ai',
        channelId: currentChannel || '',
        timestamp: new Date(),
      }]);
    });

    newSocket.on('message:stream:chunk', (data: { messageId: string; chunk: string }) => {
      setMessages(prev => prev.map(msg =>
        msg.id === data.messageId
          ? { ...msg, content: msg.content + data.chunk }
          : msg
      ));
    });

    newSocket.on('message:stream:end', (message: Message) => {
      setMessages(prev => prev.map(msg =>
        msg.id === message.id ? message : msg
      ));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentChannel]);

  const joinChannel = useCallback((channelId: string) => {
    if (socket) {
      socket.emit('channel:join', channelId);
      setCurrentChannel(channelId);
    }
  }, [socket]);

  const leaveChannel = useCallback((channelId: string) => {
    if (socket) {
      socket.emit('channel:leave', channelId);
      setCurrentChannel(null);
      setMessages([]);
    }
  }, [socket]);

  const sendMessage = useCallback((data: {
    content: string;
    authorId: string;
    authorName: string;
    authorType: 'human' | 'ai';
    channelId: string;
  }) => {
    if (socket) {
      socket.emit('message:send', data);
    }
  }, [socket]);

  const startTyping = useCallback((channelId: string, userId: string, userName: string) => {
    if (socket) {
      socket.emit('typing:start', { channelId, userId, userName });
    }
  }, [socket]);

  const stopTyping = useCallback((channelId: string, userId: string) => {
    if (socket) {
      socket.emit('typing:stop', { channelId, userId });
    }
  }, [socket]);

  return {
    socket,
    connected,
    channels,
    messages,
    currentChannel,
    joinChannel,
    leaveChannel,
    sendMessage,
    startTyping,
    stopTyping,
  };
}
