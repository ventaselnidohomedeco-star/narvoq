// Helpers de Mercado Pago Marketplace — OAuth + Preferences con split.
// SOLO se usan desde el server. Nunca exponer los tokens al cliente.

const MP_APP_ID = process.env.MP_APP_ID ?? '';
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET ?? '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function getOAuthAuthorizeUrl(state: string): string {
  const redirectUri = `${APP_URL}/api/mp/oauth/callback`;
  const params = new URLSearchParams({
    client_id: MP_APP_ID,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: redirectUri,
    state
  });
  return `https://auth.mercadopago.com.ar/authorization?${params.toString()}`;
}

// Intercambia un code por access/refresh token del complejo (marketplace).
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  public_key: string;
  user_id: number;
  expires_in: number;
}> {
  const redirectUri = `${APP_URL}/api/mp/oauth/callback`;
  const res = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MP_APP_ID,
      client_secret: MP_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });
  if (!res.ok) throw new Error(`MP OAuth error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Crea una preference de pago usando el token del complejo. Si feePct > 0,
// aplica marketplace_fee (comisión NarvoQ).
export async function createPreferenceForComplex(opts: {
  complexAccessToken: string;
  amount: number;
  title: string;
  externalReference: string;
  payerEmail?: string;
  backUrl: string;
  notificationUrl: string;
  feePct: number;   // 0..100
}): Promise<{ id: string; init_point: string; sandbox_init_point: string }> {
  const applicationFee = opts.feePct > 0
    ? Number((opts.amount * opts.feePct / 100).toFixed(2))
    : 0;

  const body: any = {
    items: [{
      title: opts.title,
      quantity: 1,
      unit_price: opts.amount,
      currency_id: 'ARS'
    }],
    external_reference: opts.externalReference,
    notification_url: opts.notificationUrl,
    back_urls: {
      success: opts.backUrl,
      pending: opts.backUrl,
      failure: opts.backUrl
    },
    auto_return: 'approved',
    binary_mode: true   // solo aprobado o rechazado, nada pendiente ambiguo
  };
  if (opts.payerEmail) body.payer = { email: opts.payerEmail };
  if (applicationFee > 0) body.marketplace_fee = applicationFee;

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.complexAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`MP preference error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point
  };
}

// Trae un pago por ID usando el token del complejo (para el webhook).
export async function getPayment(paymentId: string, complexAccessToken: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${complexAccessToken}` }
  });
  if (!res.ok) throw new Error(`MP payment fetch error ${res.status}: ${await res.text()}`);
  return res.json();
}
