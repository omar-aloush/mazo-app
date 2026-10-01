import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FolderPlus,
  Search,
  FileText,
  RefreshCw,
  ExternalLink,
  X,
  FolderOpen,
} from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useDocuments } from '@/providers/DocumentsProvider';

/** Turn an ugly SAF tree/document URI into a readable folder name. */
function folderLabel(uri: string): string {
  try {
    const dec = decodeURIComponent(uri);
    const seg = dec.split(/[:/]/).filter(Boolean).pop();
    return seg || dec;
  } catch {
    return uri;
  }
}

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    supported,
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
  } = useDocuments();

  const [query, setQuery] = useState('');

  const onSearch = () => {
    if (query.trim()) runSearch(query);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Find a document', headerShown: true }} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro */}
        <Text style={[styles.h1, { color: colors.text }]}>Ask Mazō where something is</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Grant a folder and Mazō searches inside it — by name and by what&apos;s written in the file.
          Everything stays on your device.
        </Text>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearch}
            returnKeyType="search"
            placeholder="e.g. where's my thesis budget?"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={onSearch}
          style={[styles.searchBtn, { backgroundColor: colors.accent }]}
        >
          {searching ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Find it</Text>
          )}
        </Pressable>

        {/* Results */}
        {lastQuery.length > 0 && !searching && (
          <View style={{ marginTop: 18 }}>
            {results.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                Nothing matched &ldquo;{lastQuery}&rdquo;{indexedCount === 0 ? ' — grant a folder below first.' : '.'}
              </Text>
            ) : (
              results.map((hit) => (
                <View
                  key={hit.doc.uri}
                  style={[styles.hit, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.hitHead}>
                    <FileText size={20} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.hitName, { color: colors.text }]} numberOfLines={1}>
                        {hit.doc.name}
                      </Text>
                      {!!hit.doc.folderUri && (
                        <Text style={[styles.hitFolder, { color: colors.textSecondary }]} numberOfLines={1}>
                          in {folderLabel(hit.doc.folderUri)}
                        </Text>
                      )}
                    </View>
                  </View>
                  {!!hit.snippet && (
                    <Text style={[styles.hitSnippet, { color: colors.textSecondary }]} numberOfLines={3}>
                      {hit.snippet}
                    </Text>
                  )}
                  <Pressable
                    onPress={() => openHit(hit.doc.uri)}
                    style={[styles.openBtn, { borderColor: colors.accent }]}
                  >
                    <ExternalLink size={16} color={colors.accent} />
                    <Text style={[styles.openText, { color: colors.accent }]}>Open</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* Folders / index management */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Folders Mazō can see</Text>

          {!supported && (
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              Folder access works on an Android device build. {Platform.OS !== 'android' ? 'It’s unavailable here.' : ''}
            </Text>
          )}

          {folders.length === 0 ? (
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              No folders yet. Grant one to let Mazō find your files.
            </Text>
          ) : (
            folders.map((f) => (
              <View
                key={f}
                style={[styles.folderRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <FolderOpen size={18} color={colors.accent} />
                <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
                  {folderLabel(f)}
                </Text>
                <Pressable onPress={() => forgetFolder(f)} hitSlop={8}>
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))
          )}

          <Pressable
            onPress={grantFolder}
            disabled={!supported}
            style={[
              styles.grantBtn,
              { borderColor: colors.accent, opacity: supported ? 1 : 0.4 },
            ]}
          >
            <FolderPlus size={18} color={colors.accent} />
            <Text style={[styles.grantText, { color: colors.accent }]}>Grant a folder</Text>
          </Pressable>

          <View style={styles.indexRow}>
            <Text style={[styles.note, { color: colors.textSecondary, flex: 1 }]}>
              {indexing ? 'Indexing…' : `${indexedCount} file${indexedCount === 1 ? '' : 's'} indexed`}
            </Text>
            <Pressable
              onPress={reindexNow}
              disabled={indexing || folders.length === 0}
              style={[styles.reindexBtn, { opacity: indexing || folders.length === 0 ? 0.4 : 1 }]}
            >
              <RefreshCw size={15} color={colors.textSecondary} />
              <Text style={[styles.reindexText, { color: colors.textSecondary }]}>Re-index</Text>
            </Pressable>
          </View>

          <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
            Reads text from .txt, .md, .csv and similar files. PDFs and Word docs are found by their
            name. Nothing leaves your device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  h1: { fontSize: 26, fontWeight: '700', fontFamily: 'Spectral_600SemiBold' },
  sub: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 54,
  },
  input: { flex: 1, fontSize: 16 },
  searchBtn: {
    marginTop: 10,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  hit: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  hitHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hitName: { fontSize: 17, fontWeight: '600' },
  hitFolder: { fontSize: 13, marginTop: 2 },
  hitSnippet: { fontSize: 14, lineHeight: 20, marginTop: 10 },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  openText: { fontSize: 14, fontWeight: '600' },
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, fontFamily: 'Spectral_600SemiBold' },
  note: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  folderName: { flex: 1, fontSize: 15, fontWeight: '500' },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  grantText: { fontSize: 15, fontWeight: '700' },
  indexRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  reindexBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reindexText: { fontSize: 14, fontWeight: '600' },
  fineprint: { fontSize: 12, lineHeight: 18, marginTop: 16 },
});
