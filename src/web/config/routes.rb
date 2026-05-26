Rails.application.routes.draw do
  # Health check
  get "up" => "rails/health#show", as: :rails_health_check

  # Auth
  get  "login"  => "auth#index", as: :login
  post "login"  => "auth#login"
  post "logout" => "auth#logout", as: :logout

  # Theme
  post "theme/:name" => "theme#switch", as: :switch_theme

  # Janus Views
  root "janus#dashboard"
  get  "dashboard" => "janus#dashboard", as: :dashboard

  # Chat
  get  "chat"    => "janus#chat", as: :chat
  post "chat/send" => "janus#send_message", as: :send_message

  # Bots
  get  "bots"       => "janus#bots", as: :bots
  post "bots/create" => "janus#create_bot", as: :create_bot

  # Souls
  get  "souls" => "janus#souls", as: :souls

  # Graph
  get  "graph" => "janus#graph", as: :graph

  # Oversight
  get  "oversight" => "janus#oversight", as: :oversight

  # Swarm
  get  "swarm"        => "janus#swarm", as: :swarm
  post "swarm/submit" => "janus#submit_goal", as: :submit_goal

  # Health
  get  "health" => "janus#health", as: :system_health

  # API Keys
  get  "api_keys"         => "janus#api_keys", as: :api_keys
  post "api_keys/create"  => "janus#create_api_key", as: :create_api_key
  post "api_keys/:id/revoke" => "janus#revoke_api_key", as: :revoke_api_key
end