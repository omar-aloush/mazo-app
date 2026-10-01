import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const MAX_BODY_BYTES = 2_000;
const DEVICE_ID_PATTERN = /^dev_[a-z0-9_]{8,80}$/;
const VALID_PLATFORMS = new Set(['android', 'ios', 'web']);
const configuredOrigins = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://mazo.app,http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && configuredOrigins.has(origin) ? origin : 'https://mazo.app',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonResponse(request: Request, status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabasePublicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !supabasePublicKey || !supabaseServiceKey) {
    return jsonResponse(request, 503, { error: 'Subscription service is not configured.' });
  }

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

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(request, 400, { error: 'Invalid JSON.' });
  }
  if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
    return jsonResponse(request, 400, { error: 'Invalid request.' });
  }
  const payload = parsedPayload as Record<string, unknown>;
  const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId : '';
  const platform = typeof payload.platform === 'string' ? payload.platform : '';
  if (!DEVICE_ID_PATTERN.test(deviceId)) return jsonResponse(request, 400, { error: 'Invalid device ID.' });
  if (!VALID_PLATFORMS.has(platform)) return jsonResponse(request, 400, { error: 'Invalid platform.' });

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.rpc('register_subscriber_device', {
    p_owner_id: user.id,
    p_device_id: deviceId,
    p_platform: platform,
  });
  if (error) {
    console.error('register-device transaction failed');
    return jsonResponse(request, 500, { error: 'Could not register device.' });
  }
  if (!data || typeof data !== 'object') {
    return jsonResponse(request, 500, { error: 'Could not register device.' });
  }
  const result = data as Record<string, unknown>;
  if (result.resultCode === 'legacy_migration_required') {
    return jsonResponse(request, 409, {
      error: 'This existing subscription needs account migration before it can be used.',
      code: 'LEGACY_MIGRATION_REQUIRED',
    });
  }

  return jsonResponse(request, 200, result);
});
