import { describe, it, expect } from 'bun:test';
import { tokenize, scoreDoc, makeSnippet, searchDocs, SearchableDoc } from './docSearch';

const docs: SearchableDoc[] = [
  {
    uri: 'u1',
    name: 'Thesis Budget 2026.csv',
    mime: 'text/csv',
    text: 'category,amount\nstipend,1200\nconference travel,800\nequipment,450',
    modified: Date.now(),
  },
  {
    uri: 'u2',
    name: 'notes_final_v3.md',
    mime: 'text/markdown',
    text: 'Scholarship deadline is March 14. Remember to attach the budget spreadsheet.',
    modified: Date.now() - 86_400_000 * 10,
  },
  {
    uri: 'u3',
    name: 'random.txt',
    mime: 'text/plain',
    text: 'grocery list: milk, eggs, bread',
    modified: Date.now() - 86_400_000 * 100,
  },
];

describe('tokenize', () => {
  it('lowercases, splits, and drops stopwords/noise', () => {
    expect(tokenize("where's my thesis budget?")).toEqual(['thesis', 'budget']);
  });
  it('drops one-char tokens', () => {
    expect(tokenize('a b cc')).toEqual(['cc']);
  });
});

describe('searchDocs', () => {
  it('finds a file by its filename', () => {
    const hits = searchDocs(docs, 'thesis budget');
    expect(hits[0].doc.uri).toBe('u1');
  });

  it('finds a file by content even when the filename is messy', () => {
    const hits = searchDocs(docs, 'scholarship deadline');
    expect(hits[0].doc.uri).toBe('u2');
    expect(hits[0].snippet.toLowerCase()).toContain('scholarship deadline');
  });

  it('ranks a filename match above a content-only match', () => {
    // "budget" is in u1's NAME and u2's TEXT — u1 should win.
    const hits = searchDocs(docs, 'budget');
    expect(hits[0].doc.uri).toBe('u1');
    expect(hits.find((h) => h.doc.uri === 'u2')).toBeDefined();
  });

  it('returns nothing for an all-stopword query', () => {
    expect(searchDocs(docs, 'where is my file')).toEqual([]);
  });

  it('does not match unrelated documents', () => {
    const hits = searchDocs(docs, 'scholarship');
    expect(hits.some((h) => h.doc.uri === 'u3')).toBe(false);
  });
});

describe('scoreDoc', () => {
  it('scores a filename hit higher than a single content hit', () => {
    const nameHit = scoreDoc(docs[0], ['budget'], 'budget'); // in name
    const textHit = scoreDoc(docs[1], ['budget'], 'budget'); // in text only
    expect(nameHit).toBeGreaterThan(textHit);
  });

  it('returns 0 when nothing matches', () => {
    expect(scoreDoc(docs[2], ['scholarship'], 'scholarship')).toBe(0);
  });
});

describe('makeSnippet', () => {
  it('windows around the first matched term with ellipses', () => {
    const long = 'x'.repeat(200) + ' SCHOLARSHIP here ' + 'y'.repeat(200);
    const snip = makeSnippet(long, ['scholarship']);
    expect(snip.toLowerCase()).toContain('scholarship');
    expect(snip.startsWith('…')).toBe(true);
    expect(snip.endsWith('…')).toBe(true);
  });

  it('falls back to opening text when no term is present', () => {
    expect(makeSnippet('just some opening text', ['absent'])).toContain('just some opening text');
  });

  it('returns empty string for empty text', () => {
    expect(makeSnippet('', ['x'])).toBe('');
  });
});
