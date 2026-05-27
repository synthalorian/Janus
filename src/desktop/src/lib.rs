use std::sync::Mutex;

mod api;
mod state;
use state::AppState;

#[tauri::command]
fn get_health(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let api_base = state.lock().map_err(|e| e.to_string())?.api_base.clone();
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_health(&api_base))
}

#[tauri::command]
fn get_stats(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let api_base = state.lock().map_err(|e| e.to_string())?.api_base.clone();
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_stats(&api_base))
}

#[tauri::command]
fn register(state: tauri::State<'_, Mutex<AppState>>, name: String, agent_type: String) -> Result<String, String> {
    let api_base = state.lock().map_err(|e| e.to_string())?.api_base.clone();
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    let result = rt.block_on(api::register(&api_base, &name, &agent_type))?;
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&result) {
        if let Some(token) = parsed["data"]["token"].as_str() {
            state.lock().map_err(|e| e.to_string())?.auth_token = Some(token.to_string());
        }
    }
    Ok(result)
}

#[tauri::command]
fn get_channels(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_channels(&api_base, &token))
}

#[tauri::command]
fn get_channel_messages(state: tauri::State<'_, Mutex<AppState>>, channel_id: String) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_channel_messages(&api_base, &token, &channel_id))
}

#[tauri::command]
fn send_message(state: tauri::State<'_, Mutex<AppState>>, channel_id: String, content: String, author_id: String, author_name: String, author_type: String) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::send_message(&api_base, &token, &channel_id, &content, &author_id, &author_name, &author_type))
}

#[tauri::command]
fn get_bots(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_bots(&api_base, &token))
}

#[tauri::command]
fn spawn_bot(state: tauri::State<'_, Mutex<AppState>>, template: String, name: String) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::spawn_bot(&api_base, &token, &template, &name))
}

#[tauri::command]
fn get_souls(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_souls(&api_base, &token))
}

#[tauri::command]
fn get_oversight_stats(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_oversight_stats(&api_base, &token))
}

#[tauri::command]
fn get_plans(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_plans(&api_base, &token))
}

#[tauri::command]
fn get_graph_stats(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_graph_stats(&api_base, &token))
}

#[tauri::command]
fn get_api_keys(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let (api_base, token) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        (s.api_base.clone(), s.auth_token.clone())
    };
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(api::get_api_keys(&api_base, &token))
}

#[tauri::command]
fn get_user_name(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(s.user_name.clone().unwrap_or_default())
}

#[tauri::command]
fn get_user_id(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(s.user_id.clone().unwrap_or_default())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(AppState::new()))
        .invoke_handler(tauri::generate_handler![
            get_health,
            get_stats,
            register,
            get_channels,
            get_channel_messages,
            send_message,
            get_bots,
            spawn_bot,
            get_souls,
            get_oversight_stats,
            get_plans,
            get_graph_stats,
            get_api_keys,
            get_user_name,
            get_user_id,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                // DevTools open automatically in debug mode
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Janus Desktop");
}