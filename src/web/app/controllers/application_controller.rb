class ApplicationController < ActionController::Base
  include AuthConcern

  # Only allow modern browsers
  allow_browser versions: :modern

  # Allow external API requests
  skip_forgery_protection if: -> { request.headers["Accept"]&.include?("application/json") }
end
