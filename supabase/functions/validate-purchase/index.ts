import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const PACKAGE_NAME = 'app.mazo.ai';
const MAX_BODY_BYTES = 8_000;
const ALLOWED_PRODUCTS = new Set(['mazo_pro_monthly', 'mazo_pro_yearly']);
const ACTIVE_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
]);
const configuredOrigins = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://mazo.app,http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SubscriptionPurchase {
  subscriptionState?: string;
  latestOrderId?: string;
  orderId?: string;
  lineItems?: Array<{ productId?: string; expiryTime?: string }>;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

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

function base64Url(value: string): string {
  return btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signInput = `${header}.${payload}`;
  const pemContents = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), (character) => character.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signInput),
  );
  const signatureB64 = base64Url(String.fromCharCode(...new Uint8Array(signature)));
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signInput}.${signatureB64}`,
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenResponse.ok) throw new Error('google_auth_failed');

  const tokenData = await tokenResponse.json() as GoogleTokenResponse;
  if (!tokenData.access_token || !Number.isFinite(tokenData.expires_in)) throw new Error('google_auth_invalid');
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };
  return tokenData.access_token;
}

async function verifySubscription(purchaseToken: string, accessToken: string): Promise<SubscriptionPurchase> {
  const encodedToken = encodeURIComponent(purchaseToken);
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodedToken}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000) },
  );
  if (!response.ok) throw new Error('google_verification_failed');
  return await response.json() as SubscriptionPurchase;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabasePublicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? '';
  if (!supabaseUrl || !supabasePublicKey || !supabaseServiceKey || !serviceAccountJson) {
    return jsonResponse(request, 503, { error: 'Purchase service is not configured.' });
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
    return jsonResponse(request, 400, { error: 'Invalid request.' });
  }
  if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
    return jsonResponse(request, 400, { error: 'Invalid request.' });
  }
  const payload = parsedPayload as Record<string, unknown>;
  const purchaseToken = typeof payload.purchaseToken === 'string' ? payload.purchaseToken : '';
  const productId = typeof payload.productId === 'string' ? payload.productId : '';
  if (!purchaseToken || purchaseToken.length > 4096 || !ALLOWED_PRODUCTS.has(productId)) {
    return jsonResponse(request, 400, { error: 'Invalid or unsupported purchase.' });
  }

  let serviceAccount: GoogleServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as GoogleServiceAccount;
    if (!serviceAccount.client_email || !serviceAccount.private_key) throw new Error('invalid_credentials');
  } catch {
    console.error('validate-purchase service account configuration invalid');
    return jsonResponse(request, 503, { error: 'Purchase service is not configured.' });
  }

  let purchase: SubscriptionPurchase;
  try {
    const accessToken = await getGoogleAccessToken(serviceAccount);
    purchase = await verifySubscription(purchaseToken, accessToken);
  } catch {
    console.error('validate-purchase Google verification unavailable');
    return jsonResponse(request, 502, { error: 'Purchase verification is temporarily unavailable.' });
  }

  if (!purchase.subscriptionState || !ACTIVE_STATES.has(purchase.subscriptionState)) {
    return jsonResponse(request, 400, { error: 'Subscription is not active.' });
  }
  const matchingExpiries = (purchase.lineItems ?? [])
    .filter((item) => item.productId === productId && ALLOWED_PRODUCTS.has(item.productId ?? ''))
    .map((item) => Date.parse(item.expiryTime ?? ''))
    .filter(Number.isFinite);
  const expiryMs = matchingExpiries.length > 0 ? Math.max(...matchingExpiries) : Number.NaN;
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
    return jsonResponse(request, 400, { error: 'Purchase product or expiry did not match.' });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.rpc('record_google_purchase', {
    p_owner_id: user.id,
    p_platform: 'android',
    p_package_name: PACKAGE_NAME,
    p_purchase_token: purchaseToken,
    p_product_id: productId,
    p_order_id: purchase.latestOrderId ?? purchase.orderId ?? null,
    p_expires_at: new Date(expiryMs).toISOString(),
    p_google_state: purchase.subscriptionState,
  });
  if (error) {
    if (['P0001', 'P0002', 'P0003'].includes(error.code)) {
      return jsonResponse(request, 409, { error: 'Purchase receipt is already associated with another entitlement.' });
    }
    console.error('validate-purchase transaction failed');
    return jsonResponse(request, 500, { error: 'Could not activate subscription.' });
  }
  if (!data || typeof data !== 'object') {
    return jsonResponse(request, 500, { error: 'Could not activate subscription.' });
  }

  return jsonResponse(request, 200, data as Record<string, unknown>);
});
