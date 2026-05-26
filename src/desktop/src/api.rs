/// Janus API client in Rust

const DEFAULT_TIMEOUT: u64 = 15;

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(DEFAULT_TIMEOUT))
        .build()
        .unwrap()
}

fn headers(token: &Option<String>) -> reqwest::header::HeaderMap {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert(reqwest::header::CONTENT_TYPE, "application/json".parse().unwrap());
    if let Some(t) = token {
        h.insert(reqwest::header::AUTHORIZATION, format!("Bearer {}", t).parse().unwrap());
    }
    h
}

pub async fn get_health(api_base: &str) -> Result<String, String> {
    let url = format!("{}/api/health", api_base);
    client().get(&url)
        .headers(headers(&None))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn get_stats(api_base: &str) -> Result<String, String> {
    let url = format!("{}/api/stats", api_base);
    client().get(&url)
        .headers(headers(&None))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn register(api_base: &str, name: &str, agent_type: &str) -> Result<String, String> {
    let url = format!("{}/api/auth/register", api_base);
    let body = serde_json::json!({ "name": name, "type": agent_type });
    let resp = client().post(&url)
        .headers(headers(&None))
        .json(&body)
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?;
    resp.text().await.map_err(|e| format!("Read error: {}", e))
}

pub async fn get_channels(api_base: &str, token: &Option<String>) -> Result<String, String> {
    let url = format!("{}/api/channels", api_base);
    client().get(&url)
        .headers(headers(token))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn get_channel_messages(api_base: &str, token: &Option<String>, channel_id: &str) -> Result<String, String> {
    let url = format!("{}/api/channels/{}/messages?limit=50", api_base, channel_id);
    client().get(&url)
        .headers(headers(token))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn send_message(api_base: &str, token: &Option<String>, channel_id: &str, content: &str, author_id: &str, author_name: &str, author_type: &str) -> Result<String, String> {
    let url = format!("{}/api/messages", api_base);
    let body = serde_json::json!({
        "content": content,
        "authorId": author_id,
        "authorName": author_name,
        "authorType": author_type,
        "channelId": channel_id
    });
    let resp = client().post(&url)
        .headers(headers(token))
        .json(&body)
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?;
    resp.text().await.map_err(|e| format!("Read error: {}", e))
}

pub async fn get_bots(api_base: &str, token: &Option<String>) -> Result<String, String> {
    let url = format!("{}/api/bots", api_base);
    client().get(&url)
        .headers(headers(token))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn spawn_bot(api_base: &str, token: &Option<String>, template: &str, name: &str) -> Result<String, String> {
    let url = format!("{}/api/bots/spawn", api_base);
    let body = serde_json::json!({ "template": template, "name": name });
    let resp = client().post(&url)
        .headers(headers(token))
        .json(&body)
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?;
    resp.text().await.map_err(|e| format!("Read error: {}", e))
}

pub async fn get_souls(api_base: &str, token: &Option<String>) -> Result<String, String> {
    let url = format!("{}/api/souls", api_base);
    client().get(&url)
        .headers(headers(token))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn get_oversight_stats(api_base: &str, token: &Option<String>) -> Result<String, String> {
    let url = format!("{}/api/oversight/stats", api_base);
    client().get(&url)
        .headers(headers(token))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn get_plans(api_base: &str, token: &Option<String>) -> Result<String, String> {
    let url = format!("{}/api/orchestrate", api_base);
    client().get(&url)
        .headers(headers(token))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn get_graph_stats(api_base: &str, token: &Option<String>) -> Result<String, String> {
    let url = format!("{}/api/graph/nodes", api_base);
    client().get(&url)
        .headers(headers(token))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}

pub async fn get_api_keys(api_base: &str, token: &Option<String>) -> Result<String, String> {
    let url = format!("{}/api/auth/keys", api_base);
    client().get(&url)
        .headers(headers(token))
        .send().await
        .map_err(|e| format!("Connection error: {}", e))?
        .text().await
        .map_err(|e| format!("Read error: {}", e))
}