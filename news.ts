import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';

// Feeds por editoria da Agência Brasil (EBC). Padrão confirmado para geral/política/saúde;
// esportes segue o mesmo padrão mas não pôde ser verificado neste ambiente (sem internet) --
// se a URL não existir, a função ignora esse feed sem derrubar o site (ver tryFetch).
const SOURCE = process.env.NEWS_SOURCE_NAME || 'Agência Brasil';
const FEEDS: { url: string; category: string }[] = (() => {
  const base = process.env.NEWS_FEED_URL;
  if (base) return [{ url: base, category: 'geral' }];
  return [
    { url: 'https://agenciabrasil.ebc.com.br/feed/ultimasnoticias/feed.xml', category: 'geral' },
    { url: 'https://agenciabrasil.ebc.com.br/rss/esportes/feed.xml', category: 'esportes' },
  ];
})();

const unwrap = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
const tag = (x: string, t: string) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i')); return m ? unwrap(m[1]) : ''; };
const all = (x: string, t: string) => [...x.matchAll(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'gi'))].map(m => unwrap(m[1]));
const txt = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const safeUrl = (u?: string | null) => { try { const x = new URL(u || ''); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const FUTEBOL_RE = /futebol|libertadores|brasileir[ãa]o|copa do (brasil|mundo)|champions league|flamengo|palmeiras|corinthians|s[ãa]o paulo|santos|vasco|fluminense|botafogo|gr[êe]mio|internacional\b|cruzeiro|atl[ée]tico[- ]mg|bahia|fifa|conmebol|sele[çc][ãa]o brasileira|copa am[ée]rica/i;

type Raw = { title: string; summary: string; url: string; categories: string[]; publishedAt: string | null; image: string | null; feedCategory: string };

function parseFeed(xml: string, feedCategory: string): Raw[] {
  const out: Raw[] = [];
  for (const raw of xml.split(/<item[\s>]/i).slice(1)) {
    const url = safeUrl(tag(raw, 'link')); const title = txt(tag(raw, 'title'));
    if (!url || !title) continue;
    const d = new Date(tag(raw, 'pubDate')); const cats = all(raw, 'category').map(txt).filter(Boolean);
    const img = raw.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1] || raw.match(/<media:content[^>]*url="([^"]+)"/i)?.[1];
    out.push({ title, summary: txt(tag(raw, 'description')).slice(0, 320), url, categories: cats, publishedAt: isNaN(d.getTime()) ? null : d.toISOString(), image: safeUrl(img), feedCategory });
  }
  return out;
}

async function tryFetch(url: string, category: string, signal: AbortSignal): Promise<Raw[]> {
  try {
    const r = await fetch(url, { signal, headers: { 'user-agent': 'FattoNews/0.1 (RSS reader)' } });
    if (!r.ok) return [];
    return parseFeed(await r.text(), category);
  } catch { return []; }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const results = await Promise.all(FEEDS.map(f => tryFetch(f.url, f.category, ctl.signal)));
    const raws = results.flat();
    if (raws.length === 0) throw new Error('nenhum feed respondeu');
    const seen = new Set<string>(); const items = [];
    for (const it of raws) {
      if (seen.has(it.url)) continue; seen.add(it.url);
      const isSport = it.feedCategory === 'esportes' || it.categories.some(c => /esport/i.test(c));
      const tags = [...it.categories];
      if (isSport && !tags.some(c => /esport/i.test(c))) tags.push('Esportes');
      if (isSport && FUTEBOL_RE.test(it.title + ' ' + it.summary + ' ' + it.categories.join(' '))) tags.push('Futebol');
      items.push({
        id: createHash('sha1').update(it.url).digest('hex').slice(0, 12), title: it.title, summary: it.summary,
        url: it.url, source: SOURCE, categories: tags, publishedAt: it.publishedAt, image: it.image, imageCredit: null,
        urgent: tags.some(c => /urgente/i.test(c)),
      });
    }
    items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ items });
  } catch {
    res.status(502).json({ error: 'Fonte de notícias indisponível.' });
  } finally { clearTimeout(timer); }
}
