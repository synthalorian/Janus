class ThemeController < ApplicationController
  # POST /theme/:name
  def switch
    if AuthConcern::VALID_THEMES.key?(params[:name])
      session[:theme] = params[:name]
      flash[:notice] = "Theme switched to #{AuthConcern::VALID_THEMES[params[:name]][:name]}"
    end
    redirect_back fallback_location: root_path
  end
end