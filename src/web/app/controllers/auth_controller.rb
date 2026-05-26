class AuthController < ApplicationController
  skip_before_action :authenticate!, only: [:index, :login]

  def index
    if authenticated?
      redirect_to root_path
    else
      render "auth/index", layout: "auth"
    end
  end

  def login
    JanusApi.auth_token = nil
    name = params[:name].presence || "Web User"
    type = params[:type].presence || "human"

    result = JanusApi.register(name: name, type: type)

    if result["success"] && result["data"]
      store_auth(result["data"]["user"], result["data"]["token"])
      redirect_to root_path, notice: "Welcome to Janus"
    else
      flash.now[:error] = result["error"] || "Authentication failed"
      render "auth/index", layout: "auth", status: :unprocessable_entity
    end
  rescue JanusApi::BackendError => e
    flash.now[:error] = e.message
    render "auth/index", layout: "auth", status: :service_unavailable
  end

  def logout
    JanusApi.logout rescue nil
    clear_auth
    redirect_to login_path, notice: "Logged out"
  end
end