class JanusController < ApplicationController
  before_action :authenticate!

  def dashboard
    @health = JanusApi.health
    @stats = JanusApi.stats
  rescue JanusApi::BackendError
    @health = { "status" => "error" }
    @stats = {}
  end

  def chat
    @channels = JanusApi.list_channels["data"] || []
    @current_channel_id = params[:channel_id]
    if @current_channel_id
      @messages = JanusApi.channel_messages(@current_channel_id)["data"] || []
      @current_channel = @channels.find { |c| c["id"] == @current_channel_id }
    end
  rescue JanusApi::BackendError => e
    @error = e.message
    @channels = []
    @messages = []
  end

  def send_message
    result = JanusApi.send_message(
      content: params[:content],
      author_id: current_user["id"],
      author_name: current_user["name"],
      author_type: current_user["type"] || "human",
      channel_id: params[:channel_id]
    )

    if params[:turbo]
      render turbo_stream: turbo_stream.append("messages", partial: "janus/message", locals: { message: result["data"] })
    else
      redirect_to chat_path(channel_id: params[:channel_id])
    end
  rescue JanusApi::BackendError => e
    redirect_to chat_path(channel_id: params[:channel_id]), alert: e.message
  end

  def bots
    @bots = JanusApi.list_bots["data"] || []
    @templates = JanusApi.bot_templates["data"] || []
  rescue JanusApi::BackendError
    @bots = []
    @templates = []
  end

  def create_bot
    result = JanusApi.spawn_bot(
      template: params[:template],
      name: params[:name],
      display_name: params[:display_name]
    )
    redirect_to bots_path, notice: "Bot spawned successfully"
  rescue JanusApi::BackendError => e
    redirect_to bots_path, alert: e.message
  end

  def souls
    @souls = JanusApi.list_souls["data"] || []
  rescue JanusApi::BackendError
    @souls = []
  end

  def graph
    @graph_stats = JanusApi.graph_nodes["data"] || { "nodes" => 0, "edges" => 0 }
  rescue JanusApi::BackendError
    @graph_stats = { "nodes" => 0, "edges" => 0 }
  end

  def oversight
    @stats = JanusApi.oversight_stats["data"] || {}
    @pending = JanusApi.oversight_pending["data"] || []
    @board = JanusApi.oversight_board["data"]
  rescue JanusApi::BackendError
    @stats = {}
    @pending = []
  end

  def swarm
    @plans = JanusApi.orchestrate_plans["data"] || []
    @capabilities = JanusApi.list_capabilities["data"] || []
  rescue JanusApi::BackendError
    @plans = []
    @capabilities = []
  end

  def submit_goal
    result = JanusApi.orchestrate_submit_goal(
      goal: params[:goal],
      channel_id: params[:channel_id]
    )
    redirect_to swarm_path, notice: "Goal submitted for orchestration"
  rescue JanusApi::BackendError => e
    redirect_to swarm_path, alert: e.message
  end

  def health
    @health = JanusApi.health
  rescue JanusApi::BackendError => e
    @health = { "status" => "error", "error" => e.message }
  end

  def api_keys
    @keys = JanusApi.list_api_keys["data"] || []
  rescue JanusApi::BackendError
    @keys = []
  end

  def create_api_key
    result = JanusApi.create_api_key(
      name: params[:name],
      permissions: params[:permissions] || ["read"],
      expires_in_days: params[:expires_in_days]&.to_i
    )
    if result["success"]
      flash[:api_key] = result["data"]["key"]
      flash[:notice] = "API key created — copy it now, it won't be shown again"
    else
      flash[:alert] = result["error"] || "Failed to create API key"
    end
    redirect_to api_keys_path
  rescue JanusApi::BackendError => e
    redirect_to api_keys_path, alert: e.message
  end

  def revoke_api_key
    JanusApi.revoke_api_key(params[:id])
    redirect_to api_keys_path, notice: "API key revoked"
  rescue JanusApi::BackendError => e
    redirect_to api_keys_path, alert: e.message
  end
end