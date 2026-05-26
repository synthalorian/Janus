pub struct AppState {
    pub api_base: String,
    pub auth_token: Option<String>,
    pub user_name: Option<String>,
    pub user_id: Option<String>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            api_base: std::env::var("JANUS_API_URL").unwrap_or_else(|_| "http://localhost:3001".to_string()),
            auth_token: None,
            user_name: None,
            user_id: None,
        }
    }
}