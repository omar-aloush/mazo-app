import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isSupported,
  pickDocsFolder,
  listDocsInTree,
  readDocText,
  openDocument,
  DocFile,
} from '@/modules/mazo-focus-guard';
import { SearchableDoc, SearchHit, searchDocs } from '@/services/docSearch';

/**
 * Document Finder. Indexes the text of files inside folders the user has granted
 * (Android Storage Access Framework), then answers "where is X" with the file,
 * its folder, a matching snippet, and the ability to open it.
 *
 * The index lives on-device only. The ranking/snippet logic lives in the pure,
 * unit-tested `@/services/docSearch` module; this file owns the native folder
 * grant, extraction, persistence, and query plumbing.
 */

export type { SearchableDoc, SearchHit } from '@/services/docSearch';

export const isDocsSupported = isSupported;

const FOLDERS_KEY = 'mazo.docs.folders.v1';
const INDEX_KEY = 'mazo.docs.index.v1';

/** How much text we keep per file (snippet + scoring). Keeps the index bounded. */
const MAX_TEXT_CHARS = 4000;
/** Cap bytes read from any one file. */
const MAX_READ_BYTES = 1_000_000;

/** Files whose text we actually extract in v1. Everything else is name-searchable. */
const TEXTUAL_EXT = /\.(txt|md|markdown|csv|tsv|json|log|rtf|html?|xml|yml|yaml)$/i;

// ── Folder & index management (native + AsyncStorage) ────────────────────────

export async function getFolders(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FOLDERS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function saveFolders(folders: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(Array.from(new Set(folders))));
  } catch {
    // best-effort
  }
}

/** Prompt the user to grant a folder. Returns the new folder URI, or null. */
export async function addFolder(): Promise<string | null> {
  if (!isSupported) return null;
  const uri = await pickDocsFolder();
  if (!uri) return null;
  const folders = await getFolders();
  folders.push(uri);
  await saveFolders(folders);
  return uri;
}

export async function removeFolder(folderUri: string): Promise<void> {
  const folders = (await getFolders()).filter((f) => f !== folderUri);
  await saveFolders(folders);
}

function isTextual(d: DocFile): boolean {
  return d.mime.startsWith('text/') || TEXTUAL_EXT.test(d.name);
}

/** Walk every granted folder, (re)build the index, persist it. Returns the count. */
export async function reindex(): Promise<number> {
  if (!isSupported) return 0;
  const folders = await getFolders();
  const out: SearchableDoc[] = [];

  for (const folderUri of folders) {
    let files: DocFile[] = [];
    try {
      files = await listDocsInTree(folderUri);
    } catch {
      files = [];
    }
    for (const f of files) {
      let text = '';
      if (isTextual(f)) {
        try {
          text = (await readDocText(f.uri, MAX_READ_BYTES)).slice(0, MAX_TEXT_CHARS);
        } catch {
          text = '';
        }
      }
      out.push({
        uri: f.uri,
        name: f.name,
        mime: f.mime,
        text,
        modified: f.modified,
        folderUri,
      });
    }
  }

  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(out));
  } catch {
    // best-effort
  }
  return out.length;
}

export async function getIndex(): Promise<SearchableDoc[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as SearchableDoc[]) : [];
  } catch {
    return [];
  }
}

/** The headline call: "where's my X" → ranked hits from the local index. */
export async function find(query: string, limit = 5): Promise<SearchHit[]> {
  const docs = await getIndex();
  return searchDocs(docs, query, limit);
}

/** Open a found document in the user's default app for that type. */
export function open(uri: string): boolean {
  return openDocument(uri);
}
