import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { generateQuotationPDF } from '@/lib/reports/pdfGenerator';

export const dynamic = 'force-dynamic';

// GET /api/quotations/pdf?id=xxx — Download crystal clear vector PDF
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: quotation, error } = await supabaseAdmin
    .from('quotations')
    .select('*, quotation_items(*), quotation_leads!lead_id(*)')
    .eq('id', id)
    .single();

  if (error || !quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });

  const lead = quotation.quotation_leads;
  const pdfBuffer = await generateQuotationPDF(quotation, lead);

  const cleanName = (lead?.client_name || 'Client').trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  const filename = `Apple_Interior_Quotation_${cleanName}_v${quotation.version || 1}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
