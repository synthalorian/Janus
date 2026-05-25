import React from 'react';

// Shared shell for all main views
export function ViewShell({ title, subtitle, badge, children }: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="main">
      <header className="chat-header">
        <div className="chat-header-left">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {badge && <span className="header-badge">{badge}</span>}
      </header>
      <div className="view-content">{children}</div>
    </main>
  );
}

// Shared tab component
export function Tab({ active, onClick, label, count }: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button className={`tab ${active ? 'active' : ''}`} onClick={onClick}>
      {label}{count !== undefined && <span className="tab-count">{count}</span>}
    </button>
  );
}

// Shared form field
export function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default ViewShell;
