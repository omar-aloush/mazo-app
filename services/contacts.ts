import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';

/**
 * Contact lookup so the agent can act on people by name ("text Omar", "call Mom")
 * instead of needing a raw number. Permission-gated; returns null when denied,
 * unavailable, or no match — callers surface a clear "couldn't find them" message.
 */
export interface ResolvedContact {
  name: string;
  number: string;
}

/** True when the string is already a dialable number (digits/+/() -, no letters). */
export function isPhoneNumber(s: string): boolean {
  const t = (s ?? '').trim();
  return t.length > 0 && /^[+(]?[\d][\d\s()\-]*$/.test(t);
}

export async function resolveContact(query: string): Promise<ResolvedContact | null> {
  const name = (query ?? '').trim();
  if (!name || Platform.OS === 'web') return null;
  try {
    const perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const { data } = await Contacts.getContactsAsync({
      name,
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    });
    const match = data.find((c) => c.phoneNumbers && c.phoneNumbers.length > 0);
    const number = match?.phoneNumbers?.[0]?.number ?? '';
    if (!number) return null;
    return { name: match?.name ?? name, number };
  } catch (e) {
    console.warn('[Contacts] resolveContact failed', e);
    return null;
  }
}
