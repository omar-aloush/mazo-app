/**
 * DocumentsProvider — owns the Document Finder's folder grants, on-device index,
 * and search results. Self-contained: it talks to `@/services/documents` (which
 * persists to AsyncStorage), and never touches the chat/agent state.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import {
  isDocsSupported,
  getFolders,
  addFolder,
  removeFolder,
  reindex,
  getIndex,
  find,
  open,
} from '@/services/documents';
import type { SearchHit } from '@/services/documents';

interface DocumentsContextValue {
  supported: boolean;
  folders: string[];
  indexedCount: number;
  indexing: boolean;
  searching: boolean;
  results: SearchHit[];
  lastQuery: string;
  grantFolder: () => Promise<void>;
  forgetFolder: (uri: string) => Promise<void>;
  reindexNow: () => Promise<void>;
  runSearch: (query: string) => Promise<void>;
  openHit: (uri: string) => boolean;
  clearResults: () => void;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentsProvider');
  return ctx;
}

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = useState<string[]>([]);
  const [indexedCount, setIndexedCount] = useState(0);
  const [indexing, setIndexing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [lastQuery, setLastQuery] = useState('');

  const refresh = useCallback(async () => {
    const [f, idx] = await Promise.all([getFolders(), getIndex()]);
    setFolders(f);
    setIndexedCount(idx.length);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reindexNow = useCallback(async () => {
    setIndexing(true);
    try {
      const n = await reindex();
      setIndexedCount(n);
    } finally {
      setIndexing(false);
    }
  }, []);

  const grantFolder = useCallback(async () => {
    const uri = await addFolder();
    if (uri) {
      await refresh();
      await reindexNow();
    }
  }, [refresh, reindexNow]);

  const forgetFolder = useCallback(async (uri: string) => {
    await removeFolder(uri);
    await refresh();
    await reindexNow();
  }, [refresh, reindexNow]);

  const runSearch = useCallback(async (query: string) => {
    const q = query.trim();
    setLastQuery(q);
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await find(q));
    } finally {
      setSearching(false);
    }
  }, []);

  const openHit = useCallback((uri: string) => open(uri), []);

  const clearResults = useCallback(() => {
    setResults([]);
    setLastQuery('');
  }, []);

  const value = useMemo<DocumentsContextValue>(() => ({
    supported: isDocsSupported,
    folders,
    indexedCount,
    indexing,
    searching,
    results,
    lastQuery,
    grantFolder,
    forgetFolder,
    reindexNow,
    runSearch,
    openHit,
    clearResults,
  }), [folders, indexedCount, indexing, searching, results, lastQuery, grantFolder, forgetFolder, reindexNow, runSearch, openHit, clearResults]);

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}
