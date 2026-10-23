import type { ReactNode } from 'react';

// Inline formatting: **bold** and *italic*.
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

// Lightweight markdown renderer: headings, bullet & numbered lists, dividers,
// paragraphs and inline bold/italic — enough to make answers read like a chat.
export function Markdown({ text }: { text: string }) {
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*---+\s*$/.test(line)) { blocks.push(<hr key={key++} className="my-3 border-paper-200" />); i++; continue; }
    const h = line.match(/^\s*(#{1,3})\s+(.*)$/);
    if (h) { blocks.push(<p key={key++} className={`font-semibold ${h[1].length === 1 ? 'text-base' : 'text-sm'} mt-2 mb-1`}>{inline(h[2])}</p>); i++; continue; }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i++; }
      blocks.push(<ul key={key++} className="list-disc pl-5 my-1.5 space-y-1">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
      blocks.push(<ol key={key++} className="list-decimal pl-5 my-1.5 space-y-1">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !/^\s*---+\s*$/.test(lines[i]) && !/^\s*#{1,3}\s+/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    blocks.push(<p key={key++} className="my-1.5 first:mt-0 last:mb-0">{inline(para.join(' '))}</p>);
  }
  return <div>{blocks}</div>;
}
