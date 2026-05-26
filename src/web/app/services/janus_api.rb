require "net/http"
require "json"
require "uri"

class JanusApi
  BASE_URL = ENV.fetch("JANUS_API_URL", "http://localhost:3001")
  TIMEOUT = ENV.fetch("JANUS_API_TIMEOUT", "15").to_i

  class BackendError < StandardError; end
  class AuthError < StandardError; end

  # ── Connection ──────────────────────────────────────────────────
  class << self
    attr_writer :auth_token

    def auth_token
      @auth_token
    end
  end

  # ── Health ──────────────────────────────────────────────────────
  def self.health
    get("/api/health")
  end

  def self.stats
    get("/api/stats")
  end

  # ── Auth ────────────────────────────────────────────────────────
  def self.register(name:, type: "human", metadata: {})
    post("/api/auth/register", { name: name, type: type, metadata: metadata })
  end

  def self.me
    get("/api/auth/me")
  end

  def self.refresh(refresh_token)
    post("/api/auth/refresh", { refreshToken: refresh_token })
  end

  def self.logout(refresh_token = nil)
    post("/api/auth/logout", { refreshToken: refresh_token }.compact)
  end

  def self.create_api_key(name:, permissions: [], expires_in_days: nil)
    post("/api/auth/keys", { name: name, permissions: permissions, expiresInDays: expires_in_days }.compact)
  end

  def self.list_api_keys
    get("/api/auth/keys")
  end

  def self.revoke_api_key(key_id)
    delete("/api/auth/keys/#{key_id}")
  end

  # ── Channels ────────────────────────────────────────────────────
  def self.list_channels
    get("/api/channels")
  end

  def self.get_channel(id)
    get("/api/channels/#{id}")
  end

  def self.create_channel(name:, type: "chat", description: nil, created_by: nil)
    post("/api/channels", { name: name, type: type, description: description, createdBy: created_by }.compact)
  end

  def self.channel_messages(channel_id, limit: 50)
    get("/api/channels/#{channel_id}/messages", { limit: limit })
  end

  # ── Messages ────────────────────────────────────────────────────
  def self.send_message(content:, author_id:, author_name:, author_type:, channel_id:, thread_id: nil, reply_to: nil)
    post("/api/messages", {
      content: content, authorId: author_id, authorName: author_name,
      authorType: author_type, channelId: channel_id,
      threadId: thread_id, replyTo: reply_to
    }.compact)
  end

  def self.get_message(id)
    get("/api/messages/#{id}")
  end

  def self.related_messages(id, depth: 2)
    get("/api/messages/#{id}/related", { depth: depth })
  end

  def self.ai_message(channel_id:, content:, ai_name: nil)
    post("/api/ai/message", { channelId: channel_id, content: content, aiName: ai_name }.compact)
  end

  # ── Search ──────────────────────────────────────────────────────
  def self.search_messages(q, limit: 20)
    get("/api/search/messages", { q: q, limit: limit })
  end

  def self.search_by_topic(topic, limit: 20)
    get("/api/search/topic/#{URI.encode_www_form_component(topic)}", { limit: limit })
  end

  def self.search_decisions(limit: 20)
    get("/api/search/decisions", { limit: limit })
  end

  # ── Graph ───────────────────────────────────────────────────────
  def self.graph_nodes
    get("/api/graph/nodes")
  end

  def self.related_nodes(id, type: nil, depth: 1)
    params = { depth: depth }
    params[:type] = type if type
    get("/api/graph/nodes/#{id}/related", params)
  end

  def self.graph_query(query)
    post("/api/graph/query", { query: query })
  end

  # ── Bots ────────────────────────────────────────────────────────
  def self.list_bots(params = {})
    qs = params.any? ? "?#{params.to_query}" : ""
    get("/api/bots#{qs}")
  end

  def self.get_bot(id)
    get("/api/bots/#{id}")
  end

  def self.spawn_bot(template:, name: nil, display_name: nil, description: nil, config: nil)
    post("/api/bots/spawn", { template: template, name: name, displayName: display_name, description: description, config: config }.compact)
  end

  def self.spawn_team(name:, description: nil, bots: [])
    post("/api/bots/teams/spawn", { name: name, description: description, bots: bots }.compact)
  end

  def self.pause_bot(id)
    post("/api/bots/#{id}/pause", {})
  end

  def self.resume_bot(id)
    post("/api/bots/#{id}/resume", {})
  end

  def self.delete_bot(id)
    delete("/api/bots/#{id}")
  end

  def self.bot_templates
    get("/api/bots/templates")
  end

  def self.active_bots
    get("/api/bots/active")
  end

  def self.bot_metrics(id)
    get("/api/bots/#{id}/metrics")
  end

  def self.send_bot_message(bot_id, content, metadata: nil)
    post("/api/bots/#{bot_id}/message", { content: content, metadata: metadata }.compact)
  end

  # ── Souls ───────────────────────────────────────────────────────
  def self.list_souls(params = {})
    qs = params.any? ? "?#{params.to_query}" : ""
    get("/api/souls#{qs}")
  end

  def self.get_soul(id)
    get("/api/souls/#{id}")
  end

  def self.create_soul(data)
    post("/api/souls", data)
  end

  def self.update_soul(id, data)
    patch("/api/souls/#{id}", data)
  end

  def self.delete_soul(id)
    delete("/api/souls/#{id}")
  end

  def self.list_skills(soul_id)
    get("/api/souls/#{soul_id}/skills")
  end

  def self.create_skill(soul_id, data)
    post("/api/souls/#{soul_id}/skills", data)
  end

  def self.list_placements(soul_id)
    get("/api/souls/#{soul_id}/placements")
  end

  # ── Oversight ───────────────────────────────────────────────────
  def self.oversight_stats
    get("/api/oversight/stats")
  end

  def self.oversight_pending(params = {})
    qs = params.any? ? "?#{params.to_query}" : ""
    get("/api/oversight/pending#{qs}")
  end

  def self.oversight_board
    get("/api/oversight/board")
  end

  def self.oversight_get_action(id)
    get("/api/oversight/actions/#{id}")
  end

  def self.oversight_audit(agent_id: nil)
    path = agent_id ? "/api/oversight/audit/#{agent_id}" : "/api/oversight/audit"
    get(path)
  end

  def self.oversight_submit(data)
    post("/api/oversight/submit", data)
  end

  def self.oversight_review(data)
    post("/api/oversight/review", data)
  end

  # ── Orchestration (Swarm) ───────────────────────────────────────
  def self.orchestrate_plans
    get("/api/orchestrate")
  end

  def self.orchestrate_submit_goal(goal:, channel_id: nil, metadata: {})
    post("/api/orchestrate", { goal: goal, channelId: channel_id, metadata: metadata }.compact)
  end

  def self.orchestrate_get_plan(id)
    get("/api/orchestrate/#{id}")
  end

  def self.orchestrate_get_status(id)
    get("/api/orchestrate/#{id}/status")
  end

  def self.orchestrate_cancel_plan(id)
    post("/api/orchestrate/#{id}/cancel", {})
  end

  def self.list_capabilities(params = {})
    qs = params.any? ? "?#{params.to_query}" : ""
    get("/api/orchestrate/capabilities#{qs}")
  end

  def self.register_capability(data)
    post("/api/orchestrate/capabilities", data)
  end

  # ── Harnesses ───────────────────────────────────────────────────
  def self.list_harnesses
    get("/api/harnesses")
  end

  def self.register_harness(data)
    post("/api/harnesses/register", data)
  end

  private

  def self.headers
    h = { "Content-Type" => "application/json" }
    h["Authorization"] = "Bearer #{@auth_token}" if @auth_token
    h
  end

  def self.get(path, params = {})
    uri = URI("#{BASE_URL}#{path}")
    uri.query = URI.encode_www_form(params) if params.any?
    req = Net::HTTP::Get.new(uri, headers)
    handle(uri, req)
  end

  def self.post(path, body = {})
    uri = URI("#{BASE_URL}#{path}")
    req = Net::HTTP::Post.new(uri, headers)
    req.body = body.to_json
    handle(uri, req)
  end

  def self.patch(path, body = {})
    uri = URI("#{BASE_URL}#{path}")
    req = Net::HTTP::Patch.new(uri, headers)
    req.body = body.to_json
    handle(uri, req)
  end

  def self.delete(path)
    uri = URI("#{BASE_URL}#{path}")
    req = Net::HTTP::Delete.new(uri, headers)
    handle(uri, req)
  end

  def self.handle(uri, req)
    response = Net::HTTP.start(uri.hostname, uri.port,
      open_timeout: 5, read_timeout: TIMEOUT, use_ssl: uri.scheme == "https") do |http|
      http.request(req)
    end

    parsed = begin
      response.body.present? ? JSON.parse(response.body) : { "success" => true }
    rescue JSON::ParserError
      { "success" => false, "error" => "Invalid JSON response" }
    end

    case response
    when Net::HTTPOK, Net::HTTPCreated
      parsed
    when Net::HTTPUnauthorized
      raise AuthError, parsed["error"] || "Unauthorized"
    when Net::HTTPNotFound
      raise BackendError, "Endpoint not found: #{req.method} #{uri.path}"
    when Net::HTTPUnprocessableEntity
      raise BackendError, parsed["error"] || "Validation error"
    else
      raise BackendError, parsed["error"] || "HTTP #{response.code}"
    end
  rescue Net::TimeoutError
    raise BackendError, "Timeout connecting to Janus API at #{uri.host}:#{uri.port}"
  rescue Errno::ECONNREFUSED
    raise BackendError, "Janus API not running at #{uri.host}:#{uri.port}. Start it with: cd src/backend && npm run dev"
  rescue Errno::ECONNRESET
    raise BackendError, "Connection reset by Janus API"
  end
end
