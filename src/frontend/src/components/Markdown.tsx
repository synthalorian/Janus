import React from 'react';

// ── Lightweight Markdown Renderer ─────────────────────────
// Handles the common subset: code blocks, inline code,
// bold, italic, links, line breaks. No deps.

interface MarkdownProps {
  content: string;
  className?: string;
}

function Markdown({ content, className = '' }: MarkdownProps) {
  const rendered = renderMarkdown(content);
  return <div className={`markdown-body ${className}`}>{rendered}</div>;
}

function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;

  while (remaining.length > 0) {
    // Code block (triple backticks)
    const codeBlockMatch = remaining.match(/^```(\w*)\n([\s\S]*?)```\n?/);
    if (codeBlockMatch) {
      const [, lang, code] = codeBlockMatch;
      nodes.push(
        <div key={keyCounter++} className="md-code-block">
          {lang && <div className="md-code-lang">{lang}</div>}
          <pre><code>{code.trimEnd()}</code></pre>
        </div>
      );
      remaining = remaining.slice(codeBlockMatch[0].length);
      continue;
    }

    // Line-by-line processing for inline elements
    const lineEnd = remaining.indexOf('\n');
    const line = lineEnd === -1 ? remaining : remaining.slice(0, lineEnd);
    remaining = lineEnd === -1 ? '' : remaining.slice(lineEnd + 1);

    // Empty line
    if (line.trim() === '') {
      nodes.push(<br key={keyCounter++} />);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      nodes.push(<hr key={keyCounter++} />);
      continue;
    }

    nodes.push(
      <p key={keyCounter++}>
        {renderInline(line.trim())}
      </p>
    );
  }

  return nodes;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push(<code key={key++} className="md-inline-code">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Image ![alt](url)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      nodes.push(<img key={key++} src={imgMatch[2]} alt={imgMatch[1]} className="md-image" loading="lazy" />);
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      nodes.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="md-link">
          {renderInline(linkMatch[1])}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Bold + Italic ***text***
    const boldItalicMatch = remaining.match(/^\*\*\*([^*]+)\*\*\*/);
    if (boldItalicMatch) {
      nodes.push(<strong key={key++}><em>{boldItalicMatch[1]}</em></strong>);
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      nodes.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      nodes.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Bold __text__
    const boldUnderscoreMatch = remaining.match(/^__([^_]+)__/);
    if (boldUnderscoreMatch) {
      nodes.push(<strong key={key++}>{boldUnderscoreMatch[1]}</strong>);
      remaining = remaining.slice(boldUnderscoreMatch[0].length);
      continue;
    }

    // Italic _text_
    const italicUnderscoreMatch = remaining.match(/^_([^_]+)_/);
    if (italicUnderscoreMatch) {
      nodes.push(<em key={key++}>{italicUnderscoreMatch[1]}</em>);
      remaining = remaining.slice(italicUnderscoreMatch[0].length);
      continue;
    }

    // Strikethrough ~~text~~
    const strikeMatch = remaining.match(/^~~([^~]+)~~/);
    if (strikeMatch) {
      nodes.push(<del key={key++} className="md-strike">{strikeMatch[1]}</del>);
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Plain character
    nodes.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return nodes;
}

export default React.memo(Markdown);