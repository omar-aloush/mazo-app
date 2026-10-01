import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const MAX_BODY_BYTES = 1_000;
const CODE_PATTERN = /^[A-Z0-9_-]{4,64}$/;
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
  if (request.method !== 'POST') return jsonResponse(request, 405, { success: false, message: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabasePublicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !supabasePublicKey || !supabaseServiceKey) {
    return jsonResponse(request, 503, { success: false, message: 'Voucher service is not configured.' });
  }

  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return jsonResponse(request, 401, { success: false, message: 'Authentication required.' });
  }

  const userClient = createClient(supabaseUrl, supabasePublicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse(request, 401, { success: false, message: 'Invalid or expired session.' });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse(request, 413, { success: false, message: 'Request is too large.' });
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(request, 400, { success: false, message: 'Invalid request.' });
  }
  if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
    return jsonResponse(request, 400, { success: false, message: 'Invalid request.' });
  }
  const payload = parsedPayload as Record<string, unknown>;

  const code = typeof payload.code === 'string' ? payload.code.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(code)) {
    return jsonResponse(request, 400, { success: false, message: 'Enter a valid voucher code.' });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.rpc('redeem_voucher_for_owner', {
    p_owner_id: user.id,
    p_code: code,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    console.error('redeem-voucher transaction failed');
    return jsonResponse(request, 500, { success: false, message: 'Could not redeem voucher.' });
  }

  const result = data[0] as { result_code: string; expires_at: string | null };
  if (result.result_code === 'invalid') {
    return jsonResponse(request, 404, { success: false, message: 'Invalid or expired voucher code.' });
  }
  if (result.result_code === 'exhausted') {
    return jsonResponse(request, 409, { success: false, message: 'This voucher has reached its usage limit.' });
  }
  if (result.result_code === 'already_redeemed') {
    return jsonResponse(request, 409, { success: false, message: 'You have already redeemed this voucher.' });
  }
  if (result.result_code === 'already_entitled') {
    return jsonResponse(request, 409, { success: false, message: 'Your account already has non-expiring Pro access.' });
  }
  if (result.result_code !== 'success' || !result.expires_at) {
    return jsonResponse(request, 500, { success: false, message: 'Could not redeem voucher.' });
  }

  return jsonResponse(request, 200, {
    success: true,
    message: 'Voucher redeemed successfully.',
    expiresAt: result.expires_at,
    isPro: true,
  });
});
