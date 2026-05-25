import { useState } from 'react';
import { useAuth } from '../hooks/AuthContext';

function AuthView() {
  const { register, loginWithToken, isLoading, createApiKey, listApiKeys, revokeApiKey } = useAuth();
  const [tab, setTab] = useState<'register' | 'login' | 'keys'>('register');
  const [name, setName] = useState('');
  const [type, setType] = useState<'human' | 'ai'>('human');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);

  // API Key management state
  const [keys, setKeys] = useState<Array<{ id: string; name: string; prefix: string; permissions: string[]; isActive: boolean; lastUsedAt: string; createdAt: string }>>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('90');

  const handleRegister = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setError('');
    const key = await register(name.trim(), type);
    if (key) {
      setApiKey(key);
    } else {
      setError('Registration failed. Is the server running?');
    }
  };

  const handleLogin = async () => {
    if (!token.trim()) { setError('Token or API key is required'); return; }
    setError('');
    const ok = await loginWithToken(token.trim());
    if (!ok) {
      setError('Invalid token or API key. Is the server running?');
    }
  };

  const handleLoadKeys = async () => {
    setKeysLoading(true);
    try {
      const result = await listApiKeys();
      setKeys(result);
    } catch {
      setError('Failed to load API keys. Check your connection.');
    } finally {
      setKeysLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { setError('Key name is required'); return; }
    setError('');
    setSuccess('');
    const perms = newKeyPerms.trim() ? newKeyPerms.split(',').map(p => p.trim()) : undefined;
    const expiry = parseInt(newKeyExpiry) || 90;
    try {
      const result = await createApiKey(newKeyName.trim(), perms, expiry);
      if (result) {
        setApiKey(result.key);
        setNewKeyName('');
        setNewKeyPerms('');
        setSuccess('API key created successfully');
        handleLoadKeys();
      } else {
        setError('Failed to create API key. Server may be unreachable.');
      }
    } catch {
      setError('Network error while creating API key.');
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      const ok = await revokeApiKey(keyId);
      if (ok) {
        setSuccess('API key revoked');
        handleLoadKeys();
      } else {
        setError('Failed to revoke API key. Server may be unreachable.');
      }
    } catch {
      setError('Network error while revoking API key.');
    }
  };

  // Load keys when switching to keys tab
  const switchTab = (t: 'register' | 'login' | 'keys') => {
    setTab(t);
    setError('');
    setApiKey(null);
    if (t === 'keys') handleLoadKeys();
  };

  const clearBanner = () => { setError(''); setSuccess(''); };

  return (
    <div className="auth-view">
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-icon">🚪</span>
          <h1>Janus</h1>
          <p>The gateway between mankind and AI</p>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>
            Register
          </button>
          <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>
            Login
          </button>
          <button className={`tab ${tab === 'keys' ? 'active' : ''}`} onClick={() => switchTab('keys')}>
            🔑 API Keys
          </button>
        </div>

        {/* API Key Banner (shown after registration or key creation) */}
        {apiKey && (
          <div className="api-key-banner">
            <div className="api-key-header">
              <span>🔑 Your API Key</span>
              <span className="api-key-warning">Save it — won't be shown again!</span>
            </div>
            <code className="api-key-value">{apiKey}</code>
            <button className="btn-sm" onClick={() => { navigator.clipboard.writeText(apiKey); }}>
              📋 Copy
            </button>
          </div>
        )}

        {error && (
          <div className="status-banner error">
            {error}
            <button onClick={clearBanner}>×</button>
          </div>
        )}

        {success && (
          <div className="status-banner success">
            {success}
            <button onClick={clearBanner}>×</button>
          </div>
        )}

        {tab === 'register' ? (
          <div className="auth-form">
            <div className="form-field">
              <label>Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your display name"
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label>Account Type</label>
              <div className="type-selector">
                <button
                  className={`type-option ${type === 'human' ? 'active' : ''}`}
                  onClick={() => setType('human')}
                >
                  <span className="type-icon">👤</span>
                  <span>Human</span>
                </button>
                <button
                  className={`type-option ${type === 'ai' ? 'active' : ''}`}
                  onClick={() => setType('ai')}
                >
                  <span className="type-icon">🤖</span>
                  <span>AI Agent</span>
                </button>
              </div>
            </div>
            <button
              className="btn-primary btn-full"
              onClick={handleRegister}
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        ) : tab === 'login' ? (
          <div className="auth-form">
            <div className="form-field">
              <label>JWT Token or API Key</label>
              <textarea
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste your JWT token or API key here..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLogin(); }
                }}
                rows={3}
                autoFocus
              />
            </div>
            <button
              className="btn-primary btn-full"
              onClick={handleLogin}
              disabled={isLoading || !token.trim()}
            >
              {isLoading ? 'Verifying...' : 'Login'}
            </button>
          </div>
        ) : (
          <div className="auth-form">
            <div className="form-field">
              <label>Key Name</label>
              <input
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="e.g. My CLI key"
              />
            </div>
            <div className="form-field">
              <label>Permissions (comma-separated)</label>
              <input
                value={newKeyPerms}
                onChange={e => setNewKeyPerms(e.target.value)}
                placeholder="read,write,bots"
              />
            </div>
            <div className="form-field">
              <label>Expires in (days)</label>
              <input
                type="number"
                value={newKeyExpiry}
                onChange={e => setNewKeyExpiry(e.target.value)}
                min="1"
                max="365"
              />
            </div>
            <button
              className="btn-primary btn-full"
              onClick={handleCreateKey}
              disabled={isLoading || !newKeyName.trim()}
            >
              {isLoading ? 'Creating...' : 'Create API Key'}
            </button>

            {/* Existing keys list */}
            <div className="api-keys-list">
              <h4>Your API Keys</h4>
              {keysLoading ? (
                <p className="keys-loading">Loading...</p>
              ) : keys.length === 0 ? (
                <p className="keys-empty">No API keys yet</p>
              ) : (
                keys.map(key => (
                  <div key={key.id} className={`key-row ${key.isActive ? '' : 'key-revoked'}`}>
                    <div className="key-info">
                      <span className="key-name">{key.name}</span>
                      <span className="key-prefix">{key.prefix}••••</span>
                    </div>
                    <div className="key-meta">
                      {key.permissions.map(p => (
                        <span key={p} className="key-perm">{p}</span>
                      ))}
                      <span className="key-date">{new Date(key.createdAt).toLocaleDateString()}</span>
                    </div>
                    {key.isActive && (
                      <button className="btn-sm btn-danger" onClick={() => handleRevokeKey(key.id)}>
                        Revoke
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthView;
