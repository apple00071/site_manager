import { LOGO_BASE64 } from './logoBase64';

export function buildQuotationHtmlString(quotation: any, lead: any): string {
  const items: any[] = (quotation?.quotation_items || quotation?.items || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

  const sections: Record<string, any[]> = {};
  items.forEach(item => {
    const sec = item.section || 'GENERAL';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(item);
  });

  const printDate = quotation?.created_at 
    ? new Date(quotation.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const subtotal = quotation?.subtotal || lead?.quote_value || 0;
  const finalAmount = quotation?.final_amount || subtotal;
  const discountAmt = subtotal - finalAmount;
  const hasDiscount = quotation?.discount_type !== 'none' && (quotation?.discount_value > 0 || discountAmt > 0);

  const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

  let rowsHtml = '';
  let itemCounter = 1;

  Object.entries(sections).forEach(([secName, secItems]) => {
    rowsHtml += `
      <tr class="section-row">
        <td colspan="7">${secName.toUpperCase()}</td>
      </tr>
    `;

    let secSubtotal = 0;
    secItems.forEach((item, idx) => {
      const amt = Number(item.amount || item.total_amount || 0);
      secSubtotal += amt;
      const rowClass = idx % 2 === 0 ? 'item-even' : 'item-odd';

      rowsHtml += `
        <tr class="${rowClass}">
          <td class="col-no">${itemCounter++}</td>
          <td>${item.item_name || item.title || 'Item'}</td>
          <td class="col-l">${item.length ? item.length : '—'}</td>
          <td class="col-w">${item.height || item.width ? (item.height || item.width) : '—'}</td>
          <td class="col-area">${item.area_sqft || item.area || 0}</td>
          <td class="col-rate">${item.rate ? fmt(Number(item.rate)) : '—'}</td>
          <td class="col-amt">${fmt(amt)}</td>
        </tr>
      `;
    });

    rowsHtml += `
      <tr class="subtotal-row">
        <td colspan="6" style="text-align: right; font-weight: 600;">${secName} Subtotal:</td>
        <td class="col-amt">${fmt(secSubtotal)}</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: #fff; }
        .page { width: 210mm; margin: 0 auto; background: #fff; padding: 10mm 12mm; }
        .header-bar { background: #f5c518; height: 6px; }
        .header { background: #2b2b2b; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; border-radius: 4px; }
        .header-title { color: #f5c518; font-size: 18pt; font-weight: 800; }
        .header-contact { color: #ccc; font-size: 8.5pt; text-align: right; line-height: 1.65; }
        .header-contact b { color: #f5c518; font-size: 10.5pt; display: block; margin-bottom: 2px; }
        .client-section { padding: 14px 0 10px; border-bottom: 3px solid #f5c518; margin-bottom: 14px; }
        .doc-title { text-align: center; font-size: 15pt; font-weight: 800; color: #2b2b2b; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }
        .client-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
        .client-row { display: flex; gap: 8px; font-size: 9.5pt; padding: 2px 0; }
        .client-label { font-weight: 700; color: #333; white-space: nowrap; }
        table { width: 100%; border-collapse: collapse; }
        thead tr th { background: #2b2b2b; color: #fff; padding: 6px; font-size: 8.5pt; font-weight: 600; border-bottom: 2px solid #f5c518; }
        .col-no { width: 28px; text-align: center; }
        .col-l, .col-w { width: 46px; text-align: center; }
        .col-area { width: 56px; text-align: center; }
        .col-rate { width: 72px; text-align: right; }
        .col-amt { width: 88px; text-align: right; }
        .section-row td { background: #f5c518; color: #2b2b2b; font-weight: 700; font-size: 9pt; padding: 5px 8px; }
        .item-even td { background: #fff; padding: 4px 6px; border-bottom: 1px solid #ebebeb; }
        .item-odd td { background: #fafaf7; padding: 4px 6px; border-bottom: 1px solid #ebebeb; }
        .subtotal-row td { background: #f0ebe0; font-weight: 700; padding: 5px 6px; border-bottom: 2px solid #d4a800; }
        .grand-total td { background: #2b2b2b; padding: 8px 6px; font-size: 12pt; font-weight: 800; }
        .grand-total .lbl { color: #ddd; }
        .grand-total .val { color: #f5c518; text-align: right; }
        .section-heading { background: #2b2b2b; color: #f5c518; font-size: 10pt; font-weight: 700; padding: 7px 10px; margin: 14px 0 0; }
        .payment-table th { background: #f5c518; color: #2b2b2b; font-size: 8.5pt; font-weight: 700; padding: 5px 8px; text-align: left; }
        .pay-even td { background: #fff; padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 8.5pt; }
        .pay-odd td { background: #fafaf7; padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 8.5pt; }
        .pay-total td { background: #2b2b2b; color: #f5c518; font-weight: 700; padding: 5px 8px; font-size: 9pt; }
        .spec-table td { padding: 3px 8px; font-size: 8.5pt; border-bottom: 1px solid #f0f0f0; }
        .spec-label { font-weight: 600; color: #444; width: 130px; white-space: nowrap; }
        .spec-odd { background: #fafaf7; }
        .terms-list { padding-left: 16px; }
        .terms-list li { font-size: 8.5pt; margin-bottom: 3px; color: #444; }
        .footer-bar { background: #2b2b2b; color: #999; text-align: center; font-size: 7pt; padding: 6px; margin-top: 14px; }
        .footer-bar b { color: #f5c518; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header-bar"></div>
        <div class="header">
          <div style="background: #ffffff; padding: 12px 24px; border-radius: 12px; display: flex; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
            <img src="${LOGO_BASE64}" alt="Apple Interiors" style="height: 62px; width: auto; object-fit: contain; display: block;" />
          </div>
          <div class="header-contact">
            <b>Kukatpally, Hyderabad</b><br />
            +91 9603 9603 37 · +91 91606 77899<br />
            www.appleinteriors.in
          </div>
        </div>

        <div class="client-section">
          <div class="doc-title">Interior Design Quotation</div>
          <div class="client-grid">
            <div>
              <div class="client-row"><span class="client-label">Client Name :</span><span>${lead?.client_name || 'Customer'}</span></div>
              <div class="client-row"><span class="client-label">Phone :</span><span>${lead?.phone || '-'}</span></div>
              <div class="client-row"><span class="client-label">Site Location :</span><span>${lead?.site_project || '-'}</span></div>
            </div>
            <div>
              <div class="client-row"><span class="client-label">Date :</span><span>${printDate}</span></div>
              <div class="client-row"><span class="client-label">Ref No :</span><span>${lead?.ref_no || '-'}</span></div>
              <div class="client-row"><span class="client-label">Version :</span><span>v${quotation?.version || 1}</span></div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="col-no">#</th>
              <th>Description of Work</th>
              <th class="col-l">L (ft)</th>
              <th class="col-w">W (ft)</th>
              <th class="col-area">Area (sq.ft)</th>
              <th class="col-rate">Rate (₹)</th>
              <th class="col-amt">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <table style="margin-top: 10px;">
          <tbody>
            ${hasDiscount ? `
              <tr>
                <td style="text-align: right; padding: 4px 6px; font-weight: 600;">Subtotal:</td>
                <td style="width: 120px; text-align: right; padding: 4px 6px; font-weight: 600;">${fmt(subtotal)}</td>
              </tr>
              <tr>
                <td style="text-align: right; padding: 4px 6px; color: #e53e3e; font-weight: 600;">Discount:</td>
                <td style="width: 120px; text-align: right; padding: 4px 6px; color: #e53e3e; font-weight: 600;">-${fmt(discountAmt)}</td>
              </tr>
            ` : ''}
            <tr class="grand-total">
              <td class="lbl">GRAND TOTAL</td>
              <td class="val">${fmt(finalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-heading">PAYMENT SCHEDULE</div>
        <table class="payment-table">
          <thead>
            <tr>
              <th style="width: 60px;">Stage</th>
              <th>Milestone Description</th>
              <th style="width: 90px; text-align: right;">Payment %</th>
            </tr>
          </thead>
          <tbody>
            <tr class="pay-even"><td>Stage 1</td><td>Token Advance</td><td style="text-align: right; font-weight: 600;">10%</td></tr>
            <tr class="pay-odd"><td>Stage 2</td><td>Before Start of Work</td><td style="text-align: right; font-weight: 600;">40%</td></tr>
            <tr class="pay-even"><td>Stage 3</td><td>Completion of Boxes & Inside Laminate</td><td style="text-align: right; font-weight: 600;">30%</td></tr>
            <tr class="pay-odd"><td>Stage 4</td><td>Completion of Outside Laminate</td><td style="text-align: right; font-weight: 600;">15%</td></tr>
            <tr class="pay-even"><td>Stage 5</td><td>At Handover</td><td style="text-align: right; font-weight: 600;">5%</td></tr>
            <tr class="pay-total"><td colspan="2">TOTAL</td><td style="text-align: right;">100%</td></tr>
          </tbody>
        </table>

        <div class="section-heading">MATERIAL & HARDWARE SPECIFICATIONS</div>
        <table class="spec-table" style="width: 100%; margin-top: 4px;">
          <tbody>
            ${Object.entries(quotation?.material_specs || {
              'Plywood': '18mm BWP Ply — DT Platinum',
              'Outer Laminate': '1.0mm thick up to ₹1,600/sheet — Glossy or Matt finish',
              'Inner Laminate': '0.8mm Fabric Liner',
              'Edge Finish': '2mm thick PVC edge tape',
              'Hinges': 'Hettich',
              'Channels': 'Hettich',
              'Handles': 'SS finish — small up to ₹100, big up to ₹250',
              'Glass': 'Modi Guard / Saint Gobain',
              'Drawers': '2 per bedroom wardrobe — ₹3,000 extra per drawer',
              'Kitchen Ply': 'Royale Touche (lifetime warranty) for base; 710 Gurjan BWP elsewhere',
              'Kitchen Shutters': '1mm High Glossy Laminate; 0.8mm Fabric Liner inside',
              'Kitchen Accessories': 'Sleek brand tandem baskets',
              'False Ceiling Board': 'Saint Gobain Gyproc 12mm Gypsum',
              'FC Channels': 'Ultra channels 0.4 & 0.6mm',
              'Wiring': 'Finolex or equivalent grade, flexible piping',
            }).map(([label, value], idx) => `
              <tr class="${idx % 2 !== 0 ? 'spec-odd' : ''}">
                <td class="spec-label">${label}</td>
                <td>${value}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="padding: 8px 10px; font-weight: 700; color: #b45309; font-size: 8.5pt; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; margin-top: 14px; margin-bottom: 10px; line-height: 1.4;">
          NOTE : Any Civil works, Plumbing works, Extra switches &amp; Boards, Decorative lighting, Accessories, Designer Glass works &amp; Wallpaper, Kitchen Sink, Handwash Bowl cost not included in the above quote
        </div>

        <div class="section-heading">TERMS & CONDITIONS</div>
        <ol class="terms-list" style="margin-top: 8px;">
          <li>Main power supply will be under customer scope of work.</li>
          <li>Any additional works will be charged extra.</li>
          <li>Material once purchased cannot be cancelled.</li>
          <li>Final price may vary ±5–10% based on actual site measurements.</li>
          <li>Changes in design, materials or finishes will result in a corresponding revision of quote.</li>
          <li>GST will be charged extra as applicable.</li>
          <li>Validity of this quotation is 30 days from the date of issue.</li>
        </ol>

        ${quotation?.notes ? `
          <div style="padding: 6px 10px; font-style: italic; color: #666; font-size: 8pt; margin-top: 6px;">
            Note: ${quotation.notes}
          </div>
        ` : ''}

        <div class="footer-bar">
          <b>APPLE INTERIORS</b> · Interior Design & Execution · Kukatpally, Hyderabad · +91 9603 9603 37 · +91 91606 77899
        </div>
      </div>
    </body>
    </html>
  `;
}
