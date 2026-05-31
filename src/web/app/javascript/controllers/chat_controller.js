import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["messages", "input", "sendBtn", "empty", "channelList"]
  static values = {
    userId: String,
    userName: String,
    userType: { type: String, default: "human" },
    channelId: String,
    token: String,
    socketUrl: { type: String, default: "http://localhost:3001" }
  }

  connect() {
    this.socket = null
    this.currentChannelId = this.hasChannelIdValue ? this.channelIdValue : null
    this.connected = false
    this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
    this.authToken = this.hasTokenValue ? this.tokenValue : null
    this.typingTimeout = null
    this.streamMessages = new Map()

    // Auto-connect Socket.IO when controller connects
    this.connectSocket()
  }

  disconnect() {
    this.disconnectSocket()
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
    }
  }

  connectSocket() {
    if (this.connected || typeof io === 'undefined') {
      if (typeof io === 'undefined') {
        console.warn('Socket.IO client not loaded')
        this.updateConnectionStatus(false, 'Socket.IO not available')
      }
      return
    }

    try {
      this.socket = io(this.socketUrlValue, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
      })

      this.socket.on('connect', () => {
        this.connected = true
        this.updateConnectionStatus(true, 'Connected')
        console.log('Socket.IO connected:', this.socket.id)

        // Authenticate with the server
        this.authenticate()

        // Re-join current channel if we have one
        if (this.currentChannelId) {
          this.joinChannel(this.currentChannelId)
        }
      })

      this.socket.on('disconnect', (reason) => {
        this.connected = false
        this.updateConnectionStatus(false, `Disconnected: ${reason}`)
        console.log('Socket.IO disconnected:', reason)
      })

      this.socket.on('connect_error', (err) => {
        console.warn('Socket.IO connection error:', err.message)
        this.updateConnectionStatus(false, 'Connection error')
      })

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('Socket.IO reconnected after', attemptNumber, 'attempts')
      })

      this.socket.on('reconnect_failed', () => {
        console.error('Socket.IO reconnection failed')
        this.updateConnectionStatus(false, 'Reconnection failed')
      })

      // Server events
      this.socket.on('channels:list', (channels) => {
        this.dispatch('channels-loaded', { detail: { channels } })
      })

      this.socket.on('messages:history', ({ channelId, messages }) => {
        if (channelId === this.currentChannelId) {
          // Optionally prepend history — currently we rely on server-rendered messages
          console.log('Received message history for channel', channelId, ':', messages.length, 'messages')
        }
      })

      this.socket.on('message:new', (message) => {
        this.appendMessage(message)
      })

      this.socket.on('message:receive', (message) => {
        // Alias for message:new if server uses this event name
        this.appendMessage(message)
      })

      this.socket.on('message:stream:start', (data) => {
        this.startStreamingMessage(data)
      })

      this.socket.on('message:stream:chunk', (data) => {
        this.appendStreamChunk(data)
      })

      this.socket.on('message:stream:end', (message) => {
        this.finalizeStreamingMessage(message)
      })

      this.socket.on('presence:update', (data) => {
        this.dispatch('presence-update', { detail: data })
        console.log('Presence update:', data)
      })

      this.socket.on('user:typing', (data) => {
        this.showTypingIndicator(data)
      })

      this.socket.on('user:stopped-typing', (data) => {
        this.hideTypingIndicator(data)
      })

      this.socket.on('auth:success', (data) => {
        console.log('Socket.IO auth success:', data)
      })

      this.socket.on('auth:error', (data) => {
        console.error('Socket.IO auth error:', data)
        this.updateConnectionStatus(false, 'Auth failed')
      })
    } catch (e) {
      console.warn('Socket.IO initialization failed:', e)
      this.updateConnectionStatus(false, 'Init failed')
    }
  }

  authenticate() {
    if (!this.socket || !this.connected) return

    const authPayload = {
      token: this.authToken || this.csrfToken,
      userId: this.userIdValue || 'unknown',
      userName: this.userNameValue || 'Unknown',
      userType: this.userTypeValue || 'human'
    }

    this.socket.emit('auth', authPayload)
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.connected = false
    this.updateConnectionStatus(false, 'Disconnected')
  }

  joinChannel(channelId) {
    if (!channelId) return

    // Leave previous channel
    if (this.currentChannelId && this.currentChannelId !== channelId) {
      this.socket?.emit('channel:leave', this.currentChannelId)
    }

    this.currentChannelId = channelId

    if (this.connected && this.socket) {
      this.socket.emit('channel:join', channelId)
      console.log('Joined channel:', channelId)
    }
  }

  leaveChannel() {
    if (this.currentChannelId) {
      this.socket?.emit('channel:leave', this.currentChannelId)
      console.log('Left channel:', this.currentChannelId)
      this.currentChannelId = null
    }
  }

  send(event) {
    event.preventDefault()
    const input = this.inputTarget
    const content = input.value.trim()
    if (!content) return

    // Send via API (reliable delivery + persistence)
    const form = event.target
    const formData = new FormData(form)

    fetch(form.action, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': this.csrfToken,
        'Accept': 'text/html, application/json'
      },
      body: new URLSearchParams(formData)
    }).then(response => {
      if (response.headers.get('content-type')?.includes('text/vnd.turbo-stream.html')) {
        return response.text()
      }
      return response.text()
    }).then(() => {
      input.value = ''
      input.style.height = 'auto'
      this.stopTyping()
    }).catch((err) => {
      console.error('Failed to send message via API:', err)
    })

    // Also broadcast via WebSocket for real-time to other clients
    if (this.connected && this.currentChannelId) {
      this.socket.emit('message:send', {
        content: content,
        authorId: this.userIdValue || 'unknown',
        authorName: this.userNameValue || 'Unknown',
        authorType: this.userTypeValue || 'human',
        channelId: this.currentChannelId,
      })
    }
  }

  handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      this.send(event)
    } else {
      this.startTyping()
    }
  }

  startTyping() {
    if (!this.connected || !this.currentChannelId) return

    this.socket?.emit('typing:start', {
      channelId: this.currentChannelId,
      userId: this.userIdValue,
      userName: this.userNameValue
    })

    // Auto-stop typing after 2 seconds of inactivity
    if (this.typingTimeout) clearTimeout(this.typingTimeout)
    this.typingTimeout = setTimeout(() => this.stopTyping(), 2000)
  }

  stopTyping() {
    if (!this.connected || !this.currentChannelId) return

    this.socket?.emit('typing:stop', {
      channelId: this.currentChannelId,
      userId: this.userIdValue
    })

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
      this.typingTimeout = null
    }
  }

  appendMessage(message) {
    if (!this.hasMessagesTarget) return

    // Only show messages for the current channel
    const msgChannelId = message.channelId || message.channel_id
    if (msgChannelId && msgChannelId !== this.currentChannelId) return

    // Hide empty state
    this.hideEmpty()

    const isUser = (message.authorType || message.author_type) === 'human'
    const bubble = document.createElement('div')
    bubble.className = `chat-message ${isUser ? 'user' : 'ai'}`
    bubble.innerHTML = `
      <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;opacity:0.7;font-family:var(--font-mono);">
        ${this.escapeHtml(message.authorName || message.authorId || message.author_id || 'Unknown')}
        ${!isUser ? '<span style="color:var(--accent-cyan);"> ● AI</span>' : ''}
      </div>
      <div>${this.escapeHtml(message.content || '')}</div>
      <div class="chat-timestamp">just now</div>
    `

    this.messagesTarget.appendChild(bubble)
    this.scrollToBottom()
  }

  startStreamingMessage(data) {
    if (!this.hasMessagesTarget) return

    this.hideEmpty()

    const bubble = document.createElement('div')
    bubble.className = 'chat-message ai'
    bubble.id = `stream-${data.messageId}`
    bubble.innerHTML = `
      <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;opacity:0.7;font-family:var(--font-mono);">
        ${this.escapeHtml(data.authorName || 'AI')} <span style="color:var(--accent-cyan);"> ● AI</span>
      </div>
      <div class="stream-content"></div>
      <span class="stream-cursor" style="display:inline-block;width:8px;height:14px;background:var(--accent-tertiary);animation:pulse 1s infinite;"></span>
    `

    this.messagesTarget.appendChild(bubble)
    this.scrollToBottom()
  }

  appendStreamChunk(data) {
    const bubble = document.getElementById(`stream-${data.messageId}`)
    if (!bubble) return

    const content = bubble.querySelector('.stream-content')
    if (content) {
      content.textContent += data.chunk
      this.scrollToBottom()
    }
  }

  finalizeStreamingMessage(message) {
    const bubble = document.getElementById(`stream-${message.id}`)
    if (!bubble) return

    const cursor = bubble.querySelector('.stream-cursor')
    if (cursor) cursor.remove()

    const content = bubble.querySelector('.stream-content')
    if (content) {
      content.textContent = message.content
    }

    // Add timestamp
    const ts = document.createElement('div')
    ts.className = 'chat-timestamp'
    ts.textContent = 'just now'
    bubble.appendChild(ts)
  }

  showTypingIndicator(data) {
    // Only show typing for the current channel
    if (data.channelId && data.channelId !== this.currentChannelId) return

    const existing = document.getElementById(`typing-${data.userId}`)
    if (existing) return

    const indicator = document.createElement('div')
    indicator.id = `typing-${data.userId}`
    indicator.className = 'chat-message system'
    indicator.style.cssText = 'align-self:flex-start;font-size:10px;padding:4px 12px;'
    indicator.textContent = `${data.userName} is typing...`
    this.messagesTarget?.appendChild(indicator)
    this.scrollToBottom()
  }

  hideTypingIndicator(data) {
    const indicator = document.getElementById(`typing-${data.userId}`)
    indicator?.remove()
  }

  hideEmpty() {
    if (this.hasEmptyTarget) {
      this.emptyTarget.style.display = 'none'
    }
  }

  scrollToBottom() {
    if (this.hasMessagesTarget) {
      this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
    }
  }

  updateConnectionStatus(connected, message) {
    const statusEl = document.getElementById('connection-indicator')
    if (statusEl) {
      statusEl.className = `connection-status`
      statusEl.innerHTML = connected
        ? '<span class="dot connected"></span><span>Connected</span>'
        : `<span class="dot disconnected"></span><span>${this.escapeHtml(message || 'Disconnected')}</span>`
    }
  }

  autoResize(event) {
    const textarea = event.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  escapeHtml(text) {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
