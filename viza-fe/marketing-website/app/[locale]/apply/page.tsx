"use client";
import "./apply.css";
import { useEffect } from "react";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";

export default function ApplyPage() {
  useEffect(() => {
    // -------------- STATE --------------
    let currentStep = 1;
    const steps: Record<number, { name: string; next: string }> = {
      1: { name: 'Upload passport',  next: 'Continue' },
      2: { name: 'Confirm details',  next: 'Continue to checkout' },
      3: { name: 'Travel & checkout',next: 'Pay SGD 100.00' }
    };
    let canProceed = false;

    // -------------- NAVIGATION --------------
    function goStep(n: number) {
      currentStep = n;
      // panes
      document.querySelectorAll('.step-pane').forEach(p => {
        const el = p as HTMLElement;
        el.classList.toggle('active', Number(el.dataset.pane) === n);
      });
      // top progress
      document.querySelectorAll('.pstep').forEach(r => {
        const el = r as HTMLElement;
        const i = Number(el.dataset.step);
        el.classList.toggle('done', i < n);
        el.classList.toggle('current', i === n);
        const num = el.querySelector('.num');
        if (!num) return;
        if (i < n) num.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        else num.textContent = String(i);
      });
      // connectors
      const conns = document.querySelectorAll('#progressBar .pconn');
      conns.forEach((c, idx) => c.classList.toggle('done', idx < n - 1));
      // actions
      const actStepNum = document.getElementById('actStepNum');
      const actStepName = document.getElementById('actStepName');
      const btnNextLabel = document.getElementById('btnNextLabel');
      const btnBack = document.getElementById('btnBack');
      if (actStepNum) actStepNum.textContent = 'Step ' + n;
      if (actStepName) actStepName.textContent = steps[n].name;
      if (btnNextLabel) btnNextLabel.textContent = steps[n].next;
      if (btnBack) (btnBack as HTMLElement).style.visibility = n === 1 ? 'hidden' : 'visible';
      canProceed = (n === 2 || n === 3); // step 2/3 always proceed (data prefilled / selections valid)
      syncNext();

      // Show summary rail only on step 3
      const frame = document.getElementById('frame');
      if (frame) frame.classList.toggle('with-summary', n === 3);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function syncNext() {
      const btn = document.getElementById('btnNext') as HTMLButtonElement | null;
      if (btn) btn.disabled = !canProceed;
    }
    const btnBackEl = document.getElementById('btnBack');
    if (btnBackEl) btnBackEl.addEventListener('click', () => { if (currentStep > 1) goStep(currentStep - 1); });
    const btnNextEl = document.getElementById('btnNext');
    if (btnNextEl) btnNextEl.addEventListener('click', () => {
      if (!canProceed) return;
      if (currentStep === 3) {
        const lbl = document.getElementById('btnNextLabel');
        const btn = document.getElementById('btnNext') as HTMLButtonElement | null;
        if (lbl) lbl.textContent = 'Submitting…';
        if (btn) btn.disabled = true;
        setTimeout(() => alert('Application submitted. Reference VZ-IDN-294017.'), 800);
        return;
      }
      goStep(currentStep + 1);
    });

    // -------------- STEP 1: upload + inline AI extraction --------------
    const segBtns = document.querySelectorAll('#uploadSeg button');
    segBtns.forEach(b => b.addEventListener('click', () => {
      segBtns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    }));

    const dz = document.getElementById('dz');
    if (dz) {
      ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, (e: Event) => { e.preventDefault(); dz.classList.add('drag'); }));
      ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, (e: Event) => { e.preventDefault(); dz.classList.remove('drag'); }));
      dz.addEventListener('click', startExtraction);
      dz.addEventListener('drop', startExtraction);
    }

    let extractionStarted = false;
    function startExtraction() {
      if (extractionStarted) return; extractionStarted = true;
      const uploadView = document.getElementById('uploadView');
      const extractView = document.getElementById('extractView');
      const uploadSeg = document.querySelector('#uploadSeg') as HTMLElement | null;
      const btnNextLabel = document.getElementById('btnNextLabel');
      if (uploadView) uploadView.style.display = 'none';
      if (extractView) extractView.style.display = 'block';
      if (uploadSeg) uploadSeg.style.display = 'none';
      if (btnNextLabel) btnNextLabel.textContent = 'Reading…';
      const rows = document.querySelectorAll('#extractList .extract-row');
      let i = 0;
      function tick() {
        if (i > 0) { rows[i-1].classList.remove('active'); rows[i-1].classList.add('done'); }
        if (i < rows.length) {
          rows[i].classList.add('active');
          i++;
          setTimeout(tick, 1200);
        } else {
          canProceed = true; syncNext();
          const lbl = document.getElementById('btnNextLabel');
          if (lbl) lbl.textContent = 'Continue';
          setTimeout(() => goStep(2), 500);
        }
      }
      setTimeout(tick, 400);
    }

    // -------------- STEP 3: dates + upgrades --------------
    function buildDates() {
      const strip = document.getElementById('dateStrip');
      if (!strip) return;
      const today = new Date('2026-05-08T00:00:00');
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      let html = '';
      for (let i = 0; i < 7; i++) {
        const d = new Date(today); d.setDate(today.getDate() + i);
        html += `<div class="date-pill ${i===2?'active':''}" data-d="${i}"><div class="dow">${days[d.getDay()]}</div><div class="day">${d.getDate()}</div><div class="mon">${months[d.getMonth()]}</div></div>`;
      }
      strip.innerHTML = html;
      strip.querySelectorAll('.date-pill').forEach(p => p.addEventListener('click', () => {
        strip.querySelectorAll('.date-pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
      }));
    }
    buildDates();

    function bindUpgrades() {
      const speedPrice: Record<string, number> = { standard: 0, express: 28, superrush: 89 };
      const addonPrice: Record<string, number> = { insurance: 32, esim: 12 };

      document.querySelectorAll('.upgrade').forEach(u => {
        const el = u as HTMLElement;
        el.addEventListener('click', () => {
          if (el.dataset.group === 'speed') {
            document.querySelectorAll('.upgrade[data-group="speed"]').forEach(s => s.classList.remove('active'));
            el.classList.add('active');
          } else {
            el.classList.toggle('active');
          }
          recompute();
        });
      });

      function recompute() {
        const base = 50 + 32 - 10;
        const activeSpeed = document.querySelector('.upgrade[data-group="speed"].active') as HTMLElement | null;
        const speed = activeSpeed ? (activeSpeed.dataset.up || 'standard') : 'standard';
        const speedAdd = speedPrice[speed] || 0;
        let addons = 0;
        ['insurance','esim'].forEach(a => {
          const el = document.querySelector(`.upgrade[data-up="${a}"]`);
          if (el && el.classList.contains('active')) addons += addonPrice[a];
        });
        const total = base + speedAdd + addons;
        const sumTotal = document.getElementById('sumTotal');
        if (sumTotal) sumTotal.textContent = 'SGD ' + total.toFixed(2);
        if (currentStep === 3) {
          const lbl = document.getElementById('btnNextLabel');
          if (lbl) lbl.textContent = 'Pay SGD ' + total.toFixed(2);
        }
        const er = document.getElementById('sumExpressRow');
        const parts: string[] = [];
        if (speed !== 'standard') parts.push(speed === 'express' ? 'Express' : 'Super rush');
        const insEl = document.querySelector('.upgrade[data-up="insurance"]');
        const esimEl = document.querySelector('.upgrade[data-up="esim"]');
        if (insEl && insEl.classList.contains('active')) parts.push('Insurance');
        if (esimEl && esimEl.classList.contains('active')) parts.push('eSIM');
        if (er) {
          const k = er.querySelector('.k');
          const v = er.querySelector('.v');
          if (k) k.textContent = parts.length ? parts.join(' + ') : 'Upgrades';
          if (v) v.textContent = parts.length ? '+ SGD ' + (speedAdd + addons).toFixed(2) : '—';
        }

        const etaMap: Record<string, string> = { standard: '12 May 2026, 8:00 AM SGT', express: '8 May 2026, 3:00 PM SGT', superrush: '6 May 2026, 6:00 PM SGT' };
        const sumEta = document.getElementById('sumEta');
        if (sumEta) sumEta.textContent = etaMap[speed] || etaMap.express;
      }
      recompute();
    }
    bindUpgrades();

    // Help bubble click handler
    const helpBubble = document.getElementById('helpBubble');
    if (helpBubble) helpBubble.addEventListener('click', () => {
      alert('Opening chat with Priya M., your VIZA consultant…');
    });

    // -------------- INITIAL --------------
    goStep(1);
  }, []);

  return (
    <>
      {/* Top nav */}
      <SiteNav />

      {/* Top progress */}
      <div className="progress-bar">
        <div className="progress-inner" id="progressBar">
          <div className="pstep current" data-step="1">
            <span className="num">1</span>
            <span className="lab">Upload passport</span>
          </div>
          <span className="pconn"></span>
          <div className="pstep" data-step="2">
            <span className="num">2</span>
            <span className="lab">Confirm details</span>
          </div>
          <span className="pconn"></span>
          <div className="pstep" data-step="3">
            <span className="num">3</span>
            <span className="lab">Travel & checkout</span>
          </div>
        </div>
      </div>

      {/* Frame */}
      <div className="frame" id="frame">

        <main className="main">

          {/* ============= STEP 1: UPLOAD (with inline AI extraction) ============= */}
          <section className="step step-pane active" data-pane="1">
            <header className="step-head">
              <div className="step-eyebrow">Step 1 of 3</div>
              <h1>Upload your passport</h1>
              <p>We{'’'}ll read your details automatically — no typing required. Use the bio page (the one with your photo).</p>
            </header>

            <div className="seg" id="uploadSeg">
              <button className="active" data-mode="upload">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload file
              </button>
              <button data-mode="capture">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Take a photo
              </button>
            </div>

            {/* Pre-upload */}
            <div id="uploadView">
              <div className="dropzone" id="dz">
                <div className="dz-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="11.5" cy="14.5" r="2.5"/><path d="M9 19l3-3 3 3"/></svg>
                </div>
                <div className="dz-title">Drop your passport photo here</div>
                <div className="dz-sub">Or click to browse — your file is encrypted and never shared</div>
                <button className="dz-browse">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Choose file
                </button>
                <div className="dz-formats">
                  <span className="pill">JPG</span>
                  <span className="pill">PNG</span>
                  <span className="pill">PDF</span>
                  <span>Up to 10 MB</span>
                </div>
              </div>

              <div className="tips">
                <div className="tip">
                  <div className="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                  <div><div className="tt">All four corners visible</div><div className="ts">Frame the entire bio page including the bottom MRZ.</div></div>
                </div>
                <div className="tip">
                  <div className="ico warn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg></div>
                  <div><div className="tt">Bright, even lighting</div><div className="ts">Avoid shadows from your hand or phone case.</div></div>
                </div>
                <div className="tip">
                  <div className="ico bad"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg></div>
                  <div><div className="tt">No glare or reflections</div><div className="ts">Tilt slightly if your seal is reflecting.</div></div>
                </div>
              </div>
            </div>

            {/* Inline post-upload extraction (shows in place) */}
            <div id="extractView" style={{ display: 'none' }}>
              <div className="extract-inline">
                <div className="scan-doc">
                  <div className="pp">
                    <i className="pp-row"></i><i className="pp-row"></i><i className="pp-row"></i><i className="pp-row"></i><i className="pp-row"></i>
                  </div>
                  <div className="scanline"></div>
                </div>
                <div className="extract-list" id="extractList">
                  <div className="extract-row" data-i="0">
                    <div className="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <span className="lab">Reading document</span>
                  </div>
                  <div className="extract-row" data-i="1">
                    <div className="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <span className="lab">Extracting your details</span>
                  </div>
                  <div className="extract-row" data-i="2">
                    <div className="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <span className="lab">Verifying authenticity</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============= STEP 2: CONFIRM (review + contact) ============= */}
          <section className="step step-pane" data-pane="2">
            <header className="step-head">
              <div className="step-eyebrow">Step 2 of 3</div>
              <h1>Confirm your details</h1>
              <p>We pulled these directly from your passport. Tap any field to edit.</p>
            </header>

            <div className="step-success-strip show">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Passport extracted successfully — 100% confidence
            </div>

            <div className="review-card">
              <div className="review-head">
                <h3>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Passport details
                </h3>
                <span className="verified"><span className="dot"></span> Auto-extracted</span>
              </div>
              <div className="review-grid">
                <div className="review-field"><div className="k">Surname</div><div className="v">TAN</div><button className="edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button></div>
                <div className="review-field"><div className="k">Given names</div><div className="v">JIA WEI</div><button className="edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button></div>
                <div className="review-field"><div className="k">Passport number</div><div className="v">K3402872J</div><button className="edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button></div>
                <div className="review-field"><div className="k">Date of birth</div><div className="v">14 Aug 1991</div><button className="edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button></div>
                <div className="review-field"><div className="k">Nationality</div><div className="v">🇸🇬 Singapore</div><button className="edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button></div>
                <div className="review-field"><div className="k">Expires</div><div className="v">14 Aug 2031</div><button className="edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button></div>
              </div>
            </div>

            <h2 style={{ font: '500 18px/1.2 var(--font-heading)', letterSpacing: '-0.3px', marginBottom: '6px' }}>How should we reach you?</h2>
            <p style={{ fontSize: '13px', color: 'var(--fg-2)', marginBottom: '18px', lineHeight: '1.5' }}>We{'’'}ll send your visa here, plus text status updates to your phone.</p>

            <div className="field-row">
              <div className="field">
                <label>Email <span className="req">*</span></label>
                <input type="email" placeholder="you@example.com" defaultValue="jia.wei.tan@gmail.com"/>
              </div>
              <div className="field">
                <label>Phone <span className="req">*</span></label>
                <div className="phone-grp">
                  <select defaultValue="🇸🇬 +65">
                    <option>🇸🇬 +65</option>
                    <option>🇲🇾 +60</option>
                    <option>🇮🇩 +62</option>
                  </select>
                  <input type="tel" placeholder="9123 4567" defaultValue="9847 2210"/>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '8px' }}>
              <input type="checkbox" id="consent" defaultChecked style={{ height: '18px', width: '18px', marginTop: '2px' }}/>
              <label htmlFor="consent" style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--fg-2)', cursor: 'pointer' }}>
                I confirm the details above match my passport, and I authorise VIZA to submit this application on my behalf to the Indonesian government.
              </label>
            </div>
          </section>

          {/* ============= STEP 3: CHECKOUT ============= */}
          <section className="step step-pane" data-pane="3">
            <header className="step-head">
              <div className="step-eyebrow">Step 3 of 3</div>
              <h1>Travel & checkout</h1>
              <p>Pick your arrival window. We{'’'}ll guarantee your visa is approved before you fly — or we refund every cent.</p>
            </header>

            <h2 className="checkout-h2">Arrival in Indonesia</h2>
            <div className="date-strip" id="dateStrip"></div>

            <h2 className="checkout-h2">Processing speed</h2>
            <div id="speedGroup">
              <div className="upgrade" data-up="standard" data-group="speed">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div className="txt"><div className="tt">Standard processing</div><div className="ts">Guaranteed by 12 May, 8:00 AM SGT · ~5 business days</div></div>
                <div className="price"><span className="free">Included</span></div>
                <div className="check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              </div>
              <div className="upgrade active" data-up="express" data-group="speed">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
                <div className="txt"><div className="tt">Express processing <span className="recom">Recommended</span></div><div className="ts">Guaranteed by 8 May, 3:00 PM SGT · ~24 hours</div></div>
                <div className="price">+ SGD 28</div>
                <div className="check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              </div>
              <div className="upgrade" data-up="superrush" data-group="speed">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></div>
                <div className="txt"><div className="tt">Super rush</div><div className="ts">Guaranteed by 6 May, 6:00 PM SGT · ~4 hours</div></div>
                <div className="price">+ SGD 89</div>
                <div className="check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              </div>
            </div>

            <h2 className="checkout-h2">Add-ons</h2>
            <div>
              <div className="upgrade" data-up="insurance">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                <div className="txt"><div className="tt">Travel insurance</div><div className="ts">Trip cancellation, medical, lost baggage — Allianz, 7-day cover</div></div>
                <div className="price">+ SGD 32</div>
                <div className="check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              </div>
              <div className="upgrade" data-up="esim">
                <div className="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/></svg></div>
                <div className="txt"><div className="tt">Indonesia eSIM · 5 GB</div><div className="ts">Activates the moment you land — no roaming fees</div></div>
                <div className="price">+ SGD 12</div>
                <div className="check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              </div>
            </div>

            <div className="info-strip">
              <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div><strong>Heads up:</strong> the Indonesian government charges its visa fee separately when they approve your application. We don{'’'}t mark up that amount.</div>
            </div>
          </section>

        </main>

        {/* Right summary rail (only step 3) */}
        <aside className="summary">
          <div className="sum-title">Your application</div>
          <div className="sum-country">
            <div className="flag"><CircleFlag countryCode="id" height={40}/></div>
            <div>
              <div className="nm">Indonesia</div>
              <div className="vt">e-Visa on Arrival · 60 days · Single entry</div>
            </div>
          </div>

          <div className="sum-eta">
            <div className="lab">Guaranteed delivery by</div>
            <div className="val" id="sumEta">8 May 2026, 3:00 PM SGT</div>
            <div className="sub"><span className="dot"></span> On time, or your money back</div>
          </div>

          <div className="price-row"><span className="k">Government fee</span><span className="v">SGD 50.00</span></div>
          <div className="price-row"><span className="k">VIZA processing</span><span className="v">SGD 32.00</span></div>
          <div className="price-row" id="sumExpressRow"><span className="k">Express upgrade</span><span className="v">+ SGD 28.00</span></div>
          <div className="price-row discount"><span className="k">First-time discount</span><span className="v">−SGD 10.00</span></div>

          <div className="price-total">
            <span className="k">Total</span>
            <span className="v" id="sumTotal">SGD 100.00</span>
          </div>

          <div className="price-foot">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto', marginTop: '1px' }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Encrypted end-to-end. Charged only once your application is queued with the Indonesian government.</span>
          </div>
        </aside>

      </div>

      {/* Floating help bubble */}
      <div className="help-bubble" id="helpBubble">
        <img src="https://i.pravatar.cc/64?img=47" alt=""/>
        <div>
          <div className="ht">Priya is online</div>
          <div className="hs">Tap to chat with your VIZA consultant</div>
        </div>
        <span className="pulse"></span>
      </div>

      {/* Sticky bottom action bar */}
      <div className="actions">
        <div className="actions-inner">
          <div className="actions-meta">
            <span><strong id="actStepNum">Step 1</strong> of 3 · <span id="actStepName">Upload passport</span></span>
          </div>
          <div className="actions-buttons">
            <button className="btn-back" id="btnBack" style={{ visibility: 'hidden' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
            <button className="btn-next" id="btnNext" disabled>
              <span id="btnNextLabel">Continue</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* =====================  Site footer  ===================== */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>

        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA"/></a>
            <p className="foot-tag">VIZA helps you plan, apply, and track visas seamlessly across the world.</p>

            <div className="ask-ai">Ask AI about VIZA</div>
            <div className="ai-chips">
              <button className="ai-chip c1" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </button>
              <button className="ai-chip c2" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
              </button>
              <button className="ai-chip c3" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 13.8 8.4 20 10.5 13.8 12.6 12 19 10.2 12.6 4 10.5 10.2 8.4 12 2Z"/></svg>
              </button>
              <button className="ai-chip c4" title="Ask in your AI assistant">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
              </button>
            </div>
          </div>

          <div className="col-company">
            <h4 className="col-head">Company</h4>
            <ul className="col-list">
              <li><a href="/careers">Careers</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/security">Security</a></li>
              <li><a href="/refunds">Refunds Policy</a></li>
              <li><a href="/status">Status</a></li>
              <li><a href="/legal/privacy">Privacy</a></li>
              <li><a href="/legal/terms">Terms</a></li>
            </ul>
          </div>

          <div className="col-products">
            <h4 className="col-head">Products</h4>
            <ul className="col-list">
              <li><a href="#">U.S. Mock Interview</a></li>
              <li><a href="#">Visa Requirements</a></li>
              <li><a href="#">Schengen Appointment Checker</a></li>
              <li><a href="#">Visa Photo Creator</a></li>
              <li><a href="#">VIZA Emergency Helpline</a></li>
              <li><a href="#">Student Visa</a></li>
            </ul>
          </div>

          <div className="col-offices">
            <h4 className="col-head">Offices</h4>
            <ul className="col-list">
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>1 Marina Boulevard, #20-01,<br/>Singapore 018989</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>301 Mission Street, San Francisco,<br/>CA 94105, USA</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>M16 — Al Makateb Building,<br/>Al Quoz 3, Sheikh Zayed Rd, Dubai</span>
              </li>
              <li className="office-row">
                <svg className="office-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>Suite 203, Davina House,<br/>137-149 Goswell Road, London EC1V 7ET</span>
              </li>
            </ul>
          </div>

          <div className="foot-apps">
            <a className="app-btn" href="#" aria-label="Download VIZA on the App Store">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.04c-.03-2.93 2.39-4.34 2.5-4.41-1.36-1.99-3.48-2.26-4.24-2.29-1.81-.18-3.53 1.06-4.45 1.06-.93 0-2.34-1.04-3.85-1.01-1.98.03-3.81 1.15-4.83 2.91-2.06 3.58-.53 8.86 1.48 11.77.98 1.42 2.15 3.02 3.68 2.96 1.48-.06 2.04-.96 3.83-.96 1.78 0 2.29.96 3.85.93 1.59-.03 2.6-1.45 3.57-2.88 1.13-1.65 1.59-3.25 1.61-3.34-.04-.02-3.08-1.18-3.11-4.69zM14.07 3.62c.81-.99 1.36-2.36 1.21-3.72-1.17.05-2.59.78-3.43 1.76-.75.87-1.41 2.27-1.23 3.6 1.31.1 2.65-.66 3.45-1.64z"/></svg>
              <span className="ab-text">
                <span className="ab-pre">Download on the</span>
                <span className="ab-name">App Store</span>
              </span>
            </a>
            <a className="app-btn" href="#" aria-label="Get VIZA on Google Play">
              <svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 2 21 12 3 22 3 2" fill="currentColor"/><line x1="3" y1="2" x2="14" y2="13" stroke="#03110A"/><line x1="3" y1="22" x2="14" y2="11" stroke="#03110A"/></svg>
              <span className="ab-text">
                <span className="ab-pre">Get it on</span>
                <span className="ab-name">Google Play</span>
              </span>
            </a>
          </div>
        </div>

        <div className="foot-rule"></div>

        <div className="foot-bottom">
          <div className="legal">
            <span>© VIZA, All rights reserved</span>
            <span className="sep"></span>
            <a href="#">Privacy</a>
            <span className="sep"></span>
            <a href="#">Terms</a>
          </div>
          <div className="foot-mark">
            <img src="/assets/viza-logo-black.svg" alt="VIZA"/>
          </div>
        </div>
      </footer>
    </>
  );
}
