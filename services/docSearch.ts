/**
 * Pure document search core for the Mazō Document Finder.
 *
 * No React Native / native imports — keyword + content ranking and snippet
 * extraction only, so it is unit-testable on its own. `services/documents.ts`
 * wraps this with the native folder-grant + indexing layer.
 */

export interface SearchableDoc {
  uri: string;
  name: string;
  mime: string;
  text: string;
  modified?: number;
  folderUri?: string;
}

export interface SearchHit {
  doc: SearchableDoc;
  score: number;
  snippet: string;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'my', 'me', 'is', 'it',
  'where', 'find', 'show', 'get', 'wheres', 'whats', 'file',
  'files', 'doc', 'docs', 'document', 'documents',
]);

/** Lowercase, split on non-alphanumerics, drop empties and noise words. */
export function tokenize(input: string): string[] {
  return (input || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

/** Relevance of one doc to the query terms. 0 means no match. */
export function scoreDoc(doc: SearchableDoc, terms: string[], phrase: string): number {
  const name = (doc?.name || '').toLowerCase();
  const text = (doc?.text || '').toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (name.includes(term)) score += 5;
    const hits = countOccurrences(text, term);
    if (hits > 0) score += Math.min(hits, 5);
  }

  // Phrase bonuses reward the whole query appearing intact.
  if (phrase.length > 2) {
    if (name.includes(phrase)) score += 10;
    else if (text.includes(phrase)) score += 3;
  }

  // Recency tiebreaker (tiny — never overrides a real text match).
  if (score > 0 && doc.modified) {
    const days = (Date.now() - doc.modified) / 86_400_000;
    score += Math.max(0, 1 - days / 365);
  }

  return score;
}

/** A short, readable window of text around the first matched term. */
export function makeSnippet(text: string, terms: string[], radius = 60): string {
  if (!text) return '';
  const lower = (text || '').toLowerCase();
  let at = -1;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) {
    const head = text.replace(/\s+/g, ' ').trim().slice(0, radius * 2);
    return head + (text.length > radius * 2 ? '…' : '');
  }
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + radius);
  let slice = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) slice = '…' + slice;
  if (end < text.length) slice = slice + '…';
  return slice;
}

/** Rank docs against a natural-language query. Returns the best `limit` hits. */
export function searchDocs(docs: SearchableDoc[], query: string, limit = 5): SearchHit[] {
  const terms = Array.from(new Set(tokenize(query)));
  if (terms.length === 0) return [];
  const phrase = query.toLowerCase().trim();

  return docs
    .map((doc) => ({ doc, score: scoreDoc(doc, terms, phrase), snippet: '' }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => ({ ...h, snippet: makeSnippet(h.doc.text, terms) }));
}

