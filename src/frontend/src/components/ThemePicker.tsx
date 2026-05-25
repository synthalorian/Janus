import React, { useState } from 'react';
import { useTheme, THEMES, type ThemeId } from '../hooks/ThemeContext';

function ThemePicker() {
  const { theme: currentTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const current = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  const handleSelect = (id: ThemeId) => {
    setTheme(id);
    setOpen(false);
  };

  return (
    <div className="theme-picker">
      <button
        className="theme-picker-toggle"
        onClick={() => setOpen(!open)}
        title="Change theme"
      >
        <span className="theme-picker-current-icon">{current.icon}</span>
        <span className="theme-picker-current-name">{current.name}</span>
        <span className={`theme-picker-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="theme-picker-dropdown">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-option ${t.id === currentTheme ? 'active' : ''}`}
              onClick={() => handleSelect(t.id)}
            >
              <span className="theme-option-icon">{t.icon}</span>
              <div className="theme-option-info">
                <span className="theme-option-name">{t.name}</span>
                <span className="theme-option-desc">{t.description}</span>
              </div>
              {t.id === currentTheme && <span className="theme-option-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(ThemePicker);