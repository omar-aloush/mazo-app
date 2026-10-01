import { ensureAuthSession } from '@/services/auth';
import { Platform } from 'react-native';
import { createDemoCompletionResponse } from '@/services/demoAI';
import { isLocalDemoMode } from '@/services/demoMode';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const supabasePublicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const localAIProxySetting = (process.env.EXPO_PUBLIC_LOCAL_AI_PROXY_URL || '').trim();

function getLocalAIProxyUrl(): string | null {
  if (!localAIProxySetting) return null;

  try {
    const url = new URL(localAIProxySetting);
    const isLoopbackHost = url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || url.hostname === '[::1]';

    if (url.protocol !== 'http:' || !isLoopbackHost) {
      throw new Error('must be an http:// loopback URL');
    }

    return url.origin;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'is invalid';
    throw new Error(`EXPO_PUBLIC_LOCAL_AI_PROXY_URL ${reason}.`);
  }
}

export interface AICompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
  }>;
  model?: string;
  temperature?: number;
  tools?: Array<Record<string, unknown>>;
  response_format?: { type: 'json_object' };
  stream?: boolean;
}

/**
 * Calls the authenticated server-side AI boundary. For local web testing only,
 * a loopback proxy can be opted into with EXPO_PUBLIC_LOCAL_AI_PROXY_URL. In
 * both paths, OpenAI credentials remain on a server and never enter the Expo
 * bundle.
 */
export async function fetchAICompletion(
  payload: AICompletionRequest,
  signal?: AbortSignal,
): Promise<Response> {
  if (isLocalDemoMode()) return createDemoCompletionResponse(payload, Platform.OS, signal);

  const localAIProxyUrl = getLocalAIProxyUrl();
  if (localAIProxyUrl) {
    return fetch(`${localAIProxyUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });
  }

  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error('AI service is unavailable because Supabase is not configured.');
  }

  const session = await ensureAuthSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublicKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  return response;
}
