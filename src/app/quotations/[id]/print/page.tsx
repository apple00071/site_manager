'use client';

import { useEffect, useState, Fragment, useRef } from 'react';
import { useParams } from 'next/navigation';
import Script from 'next/script';

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const PAYMENT_STAGES = [
  { stage: 'Stage 1', label: 'Token Advance', pct: 10 },
  { stage: 'Stage 2', label: 'Before Start of Work', pct: 40 },
  { stage: 'Stage 3', label: 'Completion of Boxes & Inside Laminate', pct: 30 },
  { stage: 'Stage 4', label: 'Completion of Outside Laminate', pct: 15 },
  { stage: 'Stage 5', label: 'At Handover', pct: 5 },
];

const MATERIAL_SPECS: [string, string][] = [
  ['Plywood', '18mm BWP Ply — DT Platinum'],
  ['Outer Laminate', '1.0mm thick up to ₹1,600/sheet — Glossy or Matt finish'],
  ['Inner Laminate', '0.8mm Fabric Liner'],
  ['Edge Finish', '2mm thick PVC edge tape'],
  ['Hinges', 'Hettich'],
  ['Channels', 'Hettich'],
  ['Handles', 'SS finish — small up to ₹100, big up to ₹250'],
  ['Glass', 'Modi Guard / Saint Gobain'],
  ['Drawers', '2 per bedroom wardrobe — ₹3,000 extra per drawer'],
  ['Kitchen Ply', 'Royale Touche (lifetime warranty) for base; 710 Gurjan BWP elsewhere'],
  ['Kitchen Shutters', '1mm High Glossy Laminate; 0.8mm Fabric Liner inside'],
  ['Kitchen Accessories', 'Sleek brand tandem baskets'],
  ['False Ceiling Board', 'Saint Gobain Gyproc 12mm Gypsum'],
  ['FC Channels', 'Ultra channels 0.4 & 0.6mm'],
  ['Wiring', 'Finolex or equivalent grade, flexible piping'],
];

const TERMS = [
  'Main power supply will be under customer scope of work.',
  'Any additional works will be charged extra.',
  'Material once purchased cannot be cancelled.',
  'Final price may vary ±5–10% based on actual site measurements.',
  'Changes in design, materials or finishes will result in a corresponding revision of quote.',
  'GST will be charged extra as applicable.',
  'Validity of this quotation is 30 days from the date of issue.',
];

export default function QuotationPrintPage() {
  const params = useParams();
  const id = params?.id as string;
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const lead = quotation?.quotation_leads;

  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [wrapperHeight, setWrapperHeight] = useState<string | number>('auto');

  // Dynamic Page Title
  useEffect(() => {
    if (lead?.client_name) {
      document.title = `Quotation — ${lead.client_name}`;
    }
  }, [lead]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/quotations/by-id?id=${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setQuotation(d.data);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load quotation'); setLoading(false); });
  }, [id]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 840) {
        const padding = 20;
        const scaleFactor = (window.innerWidth - padding) / 794; // 210mm ≈ 794px
        setScale(scaleFactor);
        if (pageRef.current) {
          setWrapperHeight(pageRef.current.offsetHeight * scaleFactor + 40);
        }
      } else {
        setScale(1);
        setWrapperHeight('auto');
      }
    };
    handleResize();
    const timer = setTimeout(handleResize, 400);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [quotation]);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Inter, sans-serif' }}>Loading quotation…</div>;
  if (error || !quotation) return <div style={{ textAlign: 'center', padding: '60px', color: '#cc4444' }}>{error || 'Quotation not found'}</div>;

  const items: any[] = (quotation.quotation_items || []).sort((a: any, b: any) => a.sort_order - b.sort_order);

  const handleDownloadPDF = () => {
    const element = document.querySelector('.page');
    if (!element) return;
    
    // Temporarily hide the no-print buttons
    const noPrint = document.querySelector('.no-print') as HTMLElement;
    if (noPrint) noPrint.style.display = 'none';

    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) {
      alert('PDF download utility is still loading. Please try again in a second...');
      if (noPrint) noPrint.style.display = '';
      return;
    }

    const opt = {
      margin:       0,
      filename:     `Quotation_${lead?.client_name || 'Client'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2.2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      if (noPrint) noPrint.style.display = '';
    }).catch((err: any) => {
      console.error(err);
      if (noPrint) noPrint.style.display = '';
    });
  };

  // Group by section
  const sections: Record<string, any[]> = {};
  items.forEach(item => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  const discountAmt = quotation.subtotal - quotation.final_amount;
  const hasDiscount = quotation.discount_type !== 'none' && quotation.discount_value > 0;
  const printDate = new Date(quotation.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: #f5f5f5; }
        .page { width: 210mm; margin: 0 auto; background: #fff; padding: 10mm 12mm; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        .header-bar { background: #f5c518; height: 6px; }
        .header { background: #2b2b2b; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; }
        .header-title { color: #f5c518; font-size: 18pt; font-weight: 800; }
        .header-contact { color: #bbb; font-size: 7.5pt; text-align: right; line-height: 1.6; }
        .header-contact b { color: #f5c518; }
        .client-section { padding: 10px 0 6px; border-bottom: 2px solid #f5c518; margin-bottom: 10px; }
        .doc-title { text-align: center; font-size: 13pt; font-weight: 700; color: #2b2b2b; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
        .client-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
        .client-row { display: flex; gap: 6px; font-size: 9pt; }
        .client-label { font-weight: 600; color: #555; white-space: nowrap; }
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
        .no-print { background: #fff; padding: 10px 0; text-align: right; display: flex; gap: 8px; justify-content: flex-end; }
        
        @media screen and (max-width: 640px) {
          body {
            overflow-x: hidden !important;
          }
          .print-header-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            padding: 10px !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .print-header-actions button {
            width: 100% !important;
            padding: 10px 6px !important;
            font-size: 11px !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }
          .print-header-actions button:last-child {
            grid-column: span 2 !important;
          }
        }

        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            overflow-x: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body { background: #fff; }
          .no-print { display: none !important; }
          .page { box-shadow: none; padding: 10mm 12mm; width: 100% !important; margin: 0 !important; transform: none !important; }
        }
      `}</style>

      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" 
        strategy="lazyOnload" 
      />

      <div className="no-print print-header-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '10px 16px', background: '#fff', borderBottom: '1px solid #eee', maxWidth: '794px', margin: '0 auto' }}>
        <button
          onClick={handleDownloadPDF}
          style={{ background: '#4caf50', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
        >
          📥 Download PDF
        </button>
        <button
          onClick={() => window.print()}
          style={{ background: '#f5c518', border: 'none', borderRadius: '6px', padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
        >
          🖨 Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ background: '#eee', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}
        >
          Close
        </button>
      </div>

      <div 
        className="page-scale-wrapper" 
        style={{ 
          width: '100%', 
          overflow: 'hidden', 
          height: wrapperHeight,
          display: 'flex',
          justifyContent: scale !== 1 ? 'flex-start' : 'center',
          padding: scale !== 1 ? '0 10px' : '0'
        }}
      >
        <div 
          className="page" 
          ref={pageRef}
          style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: 'top left', boxShadow: 'none', margin: '0' } : {}}
        >
          <div className="header-bar" />
          <div className="header">
            <div style={{ background: '#ffffff', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <img 
                src="/New-logo.png" 
                alt="Apple Interiors" 
                style={{ height: '50px', width: 'auto', objectFit: 'contain' }} 
              />
            </div>
            <div className="header-contact">
              <b>Kukatpally, Hyderabad</b><br />
              +91 96039 60337 · +91 91606 77899<br />
              www.appleinteriors.in
            </div>
          </div>

          <div className="client-section">
            <div className="doc-title">Interior Design Quotation</div>
            <div className="client-grid">
              <div>
                <div className="client-row"><span className="client-label">Client Name :</span><span>{lead?.client_name}</span></div>
                <div className="client-row"><span className="client-label">Phone :</span><span>{lead?.phone}</span></div>
                <div className="client-row"><span className="client-label">Site Location :</span><span>{lead?.site_project}</span></div>
              </div>
              <div>
                <div className="client-row"><span className="client-label">Date :</span><span>{printDate}</span></div>
                <div className="client-row"><span className="client-label">Ref No :</span><span>{lead?.ref_no}</span></div>
                <div className="client-row"><span className="client-label">Version :</span><span>v{quotation.version}</span></div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th className="col-no">#</th>
                <th>Description of Work</th>
                <th className="col-l">L (ft)</th>
                <th className="col-w">W (ft)</th>
                <th className="col-area">Area (sq.ft)</th>
                <th className="col-rate">Rate (₹)</th>
                <th className="col-amt">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(sections).map(([section, sItems]) => {
                const sectionTotal = sItems.reduce((s, i) => s + i.amount, 0);
                return (
                  <Fragment key={section}>
                    <tr key={`h-${section}`} className="section-row">
                      <td colSpan={7}>&nbsp;&nbsp;{section.toUpperCase()}</td>
                    </tr>
                    {sItems.map((item: any, idx: number) => (
                      <tr key={item.id} className={idx % 2 === 0 ? 'item-even' : 'item-odd'}>
                        <td className="col-no">{idx + 1}</td>
                        <td>{item.item_name}</td>
                        <td className="col-l">{item.is_lumpsum ? '—' : (item.length_ft ?? '—')}</td>
                        <td className="col-w">{item.is_lumpsum ? '—' : (item.width_ft ?? '—')}</td>
                        <td className="col-area">{item.is_lumpsum ? 1 : item.area_sqft}</td>
                        <td className="col-rate">{fmt(item.rate)}</td>
                        <td className="col-amt">{fmt(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="subtotal-row">
                      <td colSpan={6} style={{ textAlign: 'right', paddingRight: '8px' }}>Sub-Total — {section}</td>
                      <td className="col-amt">{fmt(sectionTotal)}</td>
                    </tr>
                  </Fragment>
                );
              })}

              {hasDiscount && (
                <tr style={{ background: '#fff8e1' }}>
                  <td colSpan={6} style={{ textAlign: 'right', padding: '5px 8px', fontStyle: 'italic', color: '#cc4444' }}>
                    Discount {quotation.discount_type === 'percent' ? `(${quotation.discount_value}%)` : '(Flat)'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '5px 6px', color: '#cc4444', fontWeight: 600 }}>
                    − {fmt(discountAmt)}
                  </td>
                </tr>
              )}

              <tr className="grand-total">
                <td colSpan={6} className="lbl">GRAND TOTAL &nbsp;<span style={{ fontSize: '8pt', fontWeight: 400 }}>(Exclusive of GST)</span></td>
                <td className="val">{fmt(quotation.final_amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="section-heading">PAYMENT SCHEDULE</div>
          <table className="payment-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Milestone</th>
                <th style={{ textAlign: 'center' }}>Percentage</th>
                <th style={{ textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENT_STAGES.map(({ stage, label, pct }, idx) => (
                <tr key={stage} className={idx % 2 === 0 ? 'pay-even' : 'pay-odd'}>
                  <td style={{ fontWeight: 600 }}>{stage}</td>
                  <td>{label}</td>
                  <td style={{ textAlign: 'center' }}>{pct}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt((quotation.final_amount * pct) / 100)}</td>
                </tr>
              ))}
              <tr className="pay-total">
                <td colSpan={3} style={{ textAlign: 'right' }}>Total</td>
                <td style={{ textAlign: 'right' }}>{fmt(quotation.final_amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="section-heading">MATERIAL & HARDWARE SPECIFICATIONS</div>
          <table className="spec-table">
            <tbody>
              {(quotation.material_specs 
                ? (Object.entries(quotation.material_specs) as [string, string][])
                : MATERIAL_SPECS
              ).map(([label, value], idx) => (
                <tr key={label} className={idx % 2 !== 0 ? 'spec-odd' : ''}>
                  <td className="spec-label">{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-heading">TERMS & CONDITIONS</div>
          <div style={{ padding: '8px 10px' }}>
            <ol className="terms-list">
              {TERMS.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </div>

          {quotation.notes && (
            <div style={{ padding: '8px 10px', fontStyle: 'italic', color: '#888', fontSize: '8pt' }}>
              Note: {quotation.notes}
            </div>
          )}

          <div className="footer-bar">
            <b>Apple Interiors</b> · Kukatpally, Hyderabad · +91 96039 60337 · www.appleinteriors.in
          </div>
        </div>
      </div>
    </>
  );
}
