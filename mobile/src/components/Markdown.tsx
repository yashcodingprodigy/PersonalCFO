// Small markdown renderer for assistant answers: headings, bullets, numbered lists, **bold**, *italic*.
import React from 'react';
import { Text, View } from 'react-native';
import { C, T } from '@/lib/theme';

function inline(text: string, base: any) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <Text key={i} style={[base, { fontWeight: '700' }]}>{p.slice(2, -2)}</Text>;
    if (/^\*[^*]+\*$/.test(p)) return <Text key={i} style={[base, { fontStyle: 'italic' }]}>{p.slice(1, -1)}</Text>;
    return <Text key={i} style={base}>{p}</Text>;
  });
}

export function Markdown({ text, color = C.ink }: { text: string; color?: string }) {
  const base = [T.body, { color, fontSize: 15.5, lineHeight: 23 }];
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const out: React.ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*---+\s*$/.test(line)) { out.push(<View key={k++} style={{ height: 1, backgroundColor: C.paper200, marginVertical: 8 }} />); i++; continue; }
    const h = line.match(/^\s*(#{1,3})\s+(.*)$/);
    if (h) { out.push(<Text key={k++} style={[base, { fontWeight: '700', marginTop: 6 }]}>{inline(h[2], base)}</Text>); i++; continue; }
    const bullet = /^\s*[-*•]\s+/, num = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || num.test(line)) {
      const isNum = num.test(line);
      const re = isNum ? num : bullet;
      let n = 1;
      while (i < lines.length && re.test(lines[i])) {
        const item = lines[i].replace(re, '');
        out.push(<View key={k++} style={{ flexDirection: 'row', gap: 8, marginTop: 4, paddingLeft: 2 }}>
          <Text style={[base, { color: C.pine700, fontWeight: '700', minWidth: 14 }]}>{isNum ? `${n}.` : '•'}</Text>
          <Text style={[base, { flex: 1 }]}>{inline(item, base)}</Text>
        </View>);
        i++; n++;
      }
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !bullet.test(lines[i]) && !num.test(lines[i]) && !/^\s*#{1,3}\s+/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(<Text key={k++} style={[base, { marginTop: out.length ? 6 : 0 }]}>{inline(para.join(' '), base)}</Text>);
  }
  return <View>{out}</View>;
}
