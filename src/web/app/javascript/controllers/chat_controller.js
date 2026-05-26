import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["messages", "input", "sendBtn", "empty", "channelList"]

  connect() {
    this.socket = null
    this.currentChannelId = null
    this.connected = false
    this.token = document.querySelector('meta[name="csrf-token"]')?.content
  }

  disconnect() {
    this.disconnectSocket()
  }

  connectSocket() {
    if (this.connected || typeof io === 'undefined') return

    try {
      this.socket = io('http://localhost:3001', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
      })

      this.socket.on('connect', () => {
        this.connected = true
        this.updateConnectionStatus(true)
        console.log('Socket.IO connected:', this.socket.id)
      })

      this.socket.on('channels:list', (channels) => {
        this.dispatch('channels-loaded', { detail: { channels } })
      })

      this.socket.on('message:new', (message) => {
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

      this.socket.on('user:typing', (data) => {
        this.showTypingIndicator(data)
      })

      this.socket.on('user:stopped-typing', (data) => {
        this.hideTypingIndicator(data)
      })

      this.socket.on('disconnect', () => {
        this.connected = false
        this.updateConnectionStatus(false)
      })

      this.socket.on('connect_error', (err) => {
        console.warn('Socket.IO connection error:', err.message)
      })
    } catch (e) {
      console.warn('Socket.IO not available, using polling fallback')
    }
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.connected = false
  }

  joinChannel(channelId) {
    if (this.currentChannelId) {
      this.socket?.emit('channel:leave', this.currentChannelId)
    }
    this.currentChannelId = channelId
    this.socket?.emit('channel:join', channelId)
  }

  leaveChannel() {
    if (this.currentChannelId) {
      this.socket?.emit('channel:leave', this.currentChannelId)
      this.currentChannelId = null
    }
  }

  send(event) {
    event.preventDefault()
    const input = this.inputTarget
    const content = input.value.trim()
    if (!content) return

    // Send via API (reliable)
    const form = event.target
    const formData = new FormData(form)

    fetch(form.action, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': this.token,
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
    }).catch(() => {})

    // Also send via WebSocket for real-time
    if (this.connected && this.currentChannelId) {
      this.socket?.emit('message:send', {
        content: content,
        authorId: this.data.get('userId') || 'unknown',
        authorName: this.data.get('userName') || 'Unknown',
        authorType: 'human',
        channelId: this.currentChannelId,
      })
    }
  }

  appendMessage(message) {
    if (!this.hasMessagesTarget || message.channelId !== this.currentChannelId) return

    // Hide empty state
    this.hideEmpty()

    const isUser = message.authorType === 'human'
    const bubble = document.createElement('div')
    bubble.className = `chat-message ${isUser ? 'user' : 'ai'}`
    bubble.innerHTML = `
      <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;opacity:0.7;font-family:var(--font-mono);">
        ${this.escapeHtml(message.authorName || message.authorId)}
        ${message.authorType === 'ai' ? '<span style="color:var(--accent-cyan);"> ● AI</span>' : ''}
      </div>
      <div>${this.escapeHtml(message.content)}</div>
      <div class="chat-timestamp">just now</div>
    `

    this.messagesTarget.appendChild(bubble)
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }

  startStreamingMessage(data) {
    if (!this.hasMessagesTarget) return

    this.hideEmpty()

    const bubble = document.createElement('div')
    bubble.className = 'chat-message ai'
    bubble.id = `stream-${data.messageId}`
    bubble.innerHTML = `
      <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;opacity:0.7;font-family:var(--font-mono);">
        ${this.escapeHtml(data.authorName)} <span style="color:var(--accent-cyan);"> ● AI</span>
      </div>
      <div class="stream-content"></div>
      <span class="stream-cursor" style="display:inline-block;width:8px;height:14px;background:var(--accent-tertiary);animation:pulse 1s infinite;"></span>
    `

    this.messagesTarget.appendChild(bubble)
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }

  appendStreamChunk(data) {
    const bubble = document.getElementById(`stream-${data.messageId}`)
    if (!bubble) return

    const content = bubble.querySelector('.stream-content')
    if (content) {
      content.textContent += data.chunk
      this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
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
    const existing = document.getElementById(`typing-${data.userId}`)
    if (existing) return

    const indicator = document.createElement('div')
    indicator.id = `typing-${data.userId}`
    indicator.className = 'chat-message system'
    indicator.style.cssText = 'align-self:flex-start;font-size:10px;padding:4px 12px;'
    indicator.textContent = `${data.userName} is typing...`
    this.messagesTarget?.appendChild(indicator)
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }

  hideTypingIndicator(data) {
    const indicator = document.getElementById(`typing-${data.userId}`)
    indicator?.remove()
  }

  handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      this.send(event)
    }
  }

  hideEmpty() {
    if (this.hasEmptyTarget) {
      this.emptyTarget.style.display = 'none'
    }
  }

  updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-indicator')
    if (statusEl) {
      statusEl.className = `connection-status`
      statusEl.innerHTML = connected
        ? '<span class="dot connected"></span><span>Connected</span>'
        : '<span class="dot disconnected"></span><span>Disconnected</span>'
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}