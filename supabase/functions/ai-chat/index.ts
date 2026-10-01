import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const MAX_BODY_BYTES = 200_000;
const MAX_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 20_000;
const MAX_TOTAL_MESSAGE_CHARS = 100_000;
const MAX_TOOLS = 32;

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabasePublicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const openAIKey = Deno.env.get('OPENAI_API_KEY') ?? '';
const defaultModel = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
const allowedModels = new Set(
  (Deno.env.get('OPENAI_ALLOWED_MODELS') ?? 'gpt-4o-mini,gpt-4o,o3-mini')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
);
const configuredOrigins = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://mazo.app,http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function isLoopbackDevelopmentOrigin(origin: string | null): origin is string {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const allowedOrigin = origin && (
    configuredOrigins.has(origin) || isLoopbackDevelopmentOrigin(origin)
  )
    ? origin
    : 'https://mazo.app';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(request: Request, status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

function validatePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return 'Request body must be an object.';
  const body = payload as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length === 0) return 'Messages are required.';
  if (body.messages.length > MAX_MESSAGES) return 'Too many messages.';

  let totalChars = 0;
  for (const message of body.messages) {
    if (!message || typeof message !== 'object') return 'Invalid message.';
    const { role, content } = message as Record<string, unknown>;
    if (!['system', 'user', 'assistant', 'tool'].includes(String(role))) return 'Invalid message role.';
    if (typeof content !== 'string' || content.length > MAX_MESSAGE_CHARS) return 'Invalid message content.';
    totalChars += content.length;
  }
  if (totalChars > MAX_TOTAL_MESSAGE_CHARS) return 'Conversation is too large.';
  if (body.tools !== undefined && (!Array.isArray(body.tools) || body.tools.length > MAX_TOOLS)) {
    return 'Invalid tools payload.';
  }
  if (body.temperature !== undefined) {
    const temperature = Number(body.temperature);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) return 'Invalid temperature.';
  }
  return null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'Method not allowed.' });
  if (!supabaseUrl || !supabasePublicKey || !supabaseServiceKey || !openAIKey) {
    return jsonResponse(request, 503, { error: 'AI service is not configured.' });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return jsonResponse(request, 413, { error: 'Request is too large.' });

  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return jsonResponse(request, 401, { error: 'Authentication required.' });

  const userClient = createClient(supabaseUrl, supabasePublicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonResponse(request, 401, { error: 'Invalid or expired session.' });

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse(request, 413, { error: 'Request is too large.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(request, 400, { error: 'Invalid JSON.' });
  }
  const validationError = validatePayload(payload);
  if (validationError) return jsonResponse(request, 400, { error: validationError });

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const dailyLimit = user.is_anonymous ? 30 : 100;
  const { data: quotaAccepted, error: quotaError } = await adminClient.rpc('consume_ai_daily_quota', {
    p_user_id: user.id,
    p_daily_limit: dailyLimit,
  });
  if (quotaError) return jsonResponse(request, 503, { error: 'AI quota service is unavailable.' });
  if (!quotaAccepted) return jsonResponse(request, 429, { error: 'Daily AI request limit reached.' });

  const requestedModel = typeof payload.model === 'string' ? payload.model : defaultModel;
  const model = allowedModels.has(requestedModel) ? requestedModel : defaultModel;
  const upstreamBody = {
    messages: payload.messages,
    model,
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.7,
    tools: payload.tools,
    response_format: payload.response_format,
    stream: payload.stream === true,
  };

  let upstream: Response;
  try {
    upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIKey}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    return jsonResponse(request, 502, { error: 'AI provider is unavailable.' });
  }

  if (!upstream.ok) {
    return jsonResponse(request, 502, { error: 'AI provider request failed.', providerStatus: upstream.status });
  }

  const headers = new Headers(corsHeaders(request));
  headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(upstream.body, { status: 200, headers });
});
