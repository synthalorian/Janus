module AuthConcern
  extend ActiveSupport::Concern

  included do
    helper_method :current_user, :authenticated?, :current_token, :current_theme
    before_action :authenticate!
  end

  def authenticate!
    unless authenticated?
      redirect_to login_path and return
    end
  end

  def current_user
    session[:janus_user]
  end

  def current_token
    session[:janus_token]
  end

  def authenticated?
    session[:janus_token].present? && session[:janus_user].present?
  end

  def store_auth(user_data, token)
    session[:janus_user] = {
      "id" => user_data["id"],
      "name" => user_data["name"],
      "type" => user_data["type"]
    }
    session[:janus_token] = token
    JanusApi.auth_token = token
  end

  def clear_auth
    session.delete(:janus_user)
    session.delete(:janus_token)
    JanusApi.auth_token = nil
  end

  def current_theme
    session[:theme] || "synthwave84"
  end

  VALID_THEMES = {
    "synthwave84"       => { name: "Synthwave '84",       icon: "🌆" },
    "synthwave-midnight" => { name: "Synthwave Midnight",  icon: "🌃" },
    "synthwave-dawn"    => { name: "Synthwave Dawn",      icon: "🌅" },
    "dark"              => { name: "Dark",                icon: "🌑" },
    "light"             => { name: "Light",               icon: "☀️" },
    "cyberpunk"         => { name: "Cyberpunk",           icon: "⚡" },
    "fallout-terminal"  => { name: "Fallout Terminal",    icon: "📟" }
  }.freeze
end