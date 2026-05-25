import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ThemeId =
  | 'synthwave84'
  | 'synthwave-midnight'
  | 'synthwave-dawn'
  | 'dark'
  | 'light'
  | 'cyberpunk'
  | 'fallout-terminal';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  icon: string;
  description: string;
}

// ── Theme Registry ──────────────────────────────────────────

export const THEMES: ThemeInfo[] = [
  { id: 'synthwave84',         name: "Synthwave '84",       icon: '🌆', description: 'Deep purple neon. The grid classic.' },
  { id: 'synthwave-midnight',  name: 'Synthwave Midnight',  icon: '🌃', description: 'Cool navy blues. 3AM city drive.' },
  { id: 'synthwave-dawn',      name: 'Synthwave Dawn',      icon: '🌅', description: 'Warm amber sunrise. Golden hour.' },
  { id: 'dark',                name: 'Dark',                icon: '🌙', description: 'Clean modern dark. No frills.' },
  { id: 'light',               name: 'Light',               icon: '☀️', description: 'Clean modern light. Airy.' },
  { id: 'cyberpunk',           name: 'Cyberpunk',           icon: '⚡', description: 'High-contrast neon dystopia.' },
  { id: 'fallout-terminal',    name: 'Fallout Terminal',    icon: '🖥️', description: 'Green phosphor CRT. All monospace.' },
];

// ── Storage ─────────────────────────────────────────────────

const STORAGE_KEY = 'janus_theme';

function loadTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some(t => t.id === stored)) return stored as ThemeId;
  } catch { /* ignore */ }
  return 'synthwave84';
}

function saveTheme(theme: ThemeId) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

// ── Context ─────────────────────────────────────────────────

interface ThemeContextValue {
  theme: ThemeId;
  themeInfo: ThemeInfo;
  setTheme: (id: ThemeId) => void;
  themes: ThemeInfo[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(loadTheme);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    saveTheme(id);
  }, []);

  const themeInfo = THEMES.find(t => t.id === theme) || THEMES[0];

  // Apply theme class to root element
  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    THEMES.forEach(t => root.classList.remove(`theme-${t.id}`));
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  const value: ThemeContextValue = { theme, themeInfo, setTheme, themes: THEMES };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default ThemeContext;