// Helper de Mercado Pago — SDK oficial v3.
// SOLO se usa desde el server (endpoints /api/mp/*). No exponer el
// MP_ACCESS_TOKEN al cliente.

import { MercadoPagoConfig, PreApproval } from 'mercadopago';

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN no está configurado en variables de entorno.');
  return token;
}

// Cliente de MP (se crea una sola vez y se reutiliza).
let _client: MercadoPagoConfig | null = null;
export function getMpClient(): MercadoPagoConfig {
  if (!_client) {
    _client = new MercadoPagoConfig({
      accessToken: getAccessToken(),
      options: { timeout: 15000 }
    });
  }
  return _client;
}

// Crea una PreApproval (suscripción recurrente) y devuelve init_point.
export async function createPreApproval(opts: {
  payerEmail: string;
  amount: number;
  periodMonths: number;   // 1 = mensual, 12 = anual
  reason: string;         // ej: "NarvoQ Verificado - Jugador Anual"
  externalReference: string;  // nuestro ID interno (subscription.id)
  backUrl: string;        // a dónde vuelve el usuario después de pagar
}): Promise<{ id: string; init_point: string; status: string }> {
  const preapproval = new PreApproval(getMpClient());
  const now = new Date();
  const endDate = new Date(now);
  endDate.setFullYear(endDate.getFullYear() + 5);  // MP requiere fecha fin. Usamos 5 años.

  const body = {
    reason: opts.reason,
    external_reference: opts.externalReference,
    payer_email: opts.payerEmail,
    back_url: opts.backUrl,
    status: 'pending',
    auto_recurring: {
      frequency: opts.periodMonths,
      frequency_type: 'months' as const,
      transaction_amount: opts.amount,
      currency_id: 'ARS' as const,
      start_date: now.toISOString(),
      end_date: endDate.toISOString()
    }
  };

  const result = await preapproval.create({ body });
  if (!result.id || !result.init_point) {
    throw new Error('MP no devolvió init_point. Revisá los datos.');
  }
  return {
    id: result.id,
    init_point: result.init_point,
    status: result.status ?? 'pending'
  };
}

// Trae una PreApproval por ID (para el webhook).
export async function getPreApproval(id: string) {
  const preapproval = new PreApproval(getMpClient());
  return preapproval.get({ id });
}

// Cancela una PreApproval.
export async function cancelPreApproval(id: string) {
  const preapproval = new PreApproval(getMpClient());
  return preapproval.update({ id, body: { status: 'cancelled' } });
}
