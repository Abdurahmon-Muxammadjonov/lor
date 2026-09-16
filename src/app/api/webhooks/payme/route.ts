import { NextResponse } from 'next/server';
import { withPublic } from '@/lib/api';
import { handlePaymeRequest, paymeErrorResponse, PAYME_ERROR } from '@/lib/integrations/payments/payme';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/payme — Payme Merchant API (JSON-RPC 2.0).
 * Avtorizatsiya: Basic Paycom:<PAYME_KEY>. Javob doim HTTP 200 (xatolar `error` obyektida).
 */
export const POST = withPublic(async ({ req, ip }) => {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(paymeErrorResponse(null, PAYME_ERROR.PARSE), { status: 200 });
  }
  const result = await handlePaymeRequest(body, { authorization: req.headers.get('authorization'), ip });
  return NextResponse.json(result, { status: 200 });
});
