import { NextResponse } from 'next/server';
import { withPublic } from '@/lib/api';
import { handleClickRequest, readClickBody } from '@/lib/integrations/payments/click';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/click — Click SHOP API Prepare (action=0) / Complete (action=1).
 * Javob doim HTTP 200 + JSON {click_trans_id, merchant_trans_id, merchant_prepare_id|merchant_confirm_id, error, error_note}.
 */
export const POST = withPublic(async ({ req, ip }) => {
  const params = await readClickBody(req);
  const result = await handleClickRequest(params, { ip });
  return NextResponse.json(result, { status: 200 });
});
