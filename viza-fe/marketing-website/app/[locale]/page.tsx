"use client";
import "./explore.css";
import { useEffect } from "react";
import { CircleFlag } from "react-circle-flags";

export default function ExplorePage() {
  useEffect(() => {
    // --- Tab pill indicator ---
    const tabsEl = document.getElementById('navTabs');
    const pill = document.getElementById('navPill');
    function movePill(target: Element) {
      if (!tabsEl || !pill) return;
      const r = target.getBoundingClientRect();
      const pr = tabsEl.getBoundingClientRect();
      (pill as HTMLElement).style.left = (r.left - pr.left) + 'px';
      (pill as HTMLElement).style.width = r.width + 'px';
    }
    tabsEl?.querySelectorAll('.nav-tab').forEach(b => {
      b.addEventListener('click', () => {
        tabsEl.querySelectorAll('.nav-tab').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        movePill(b);
      });
    });
    // initial
    requestAnimationFrame(() => {
      const active = tabsEl?.querySelector('.nav-tab.active');
      if (active) movePill(active);
    });
    const onResize = () => {
      const active = tabsEl?.querySelector('.nav-tab.active');
      if (active) movePill(active);
    };
    window.addEventListener('resize', onResize);

    // --- Country data (fewer is more — curated list) ---
    // Photos sourced from Unsplash hotlinks (open w=).
    type Country = {
      name: string;
      city: string;
      code: string;
      flag: string;
      type: string;
      valid: string;
      fee: string;
      eta: string;
      tag: string;
      img: string;
      featured?: boolean;
    };
    const FLAG_CDN = 'https://hatscripts.github.io/circle-flags/flags';
    const COUNTRIES: Country[] = [
      { name: 'Indonesia',     city: 'Bali · Jakarta',         code: 'id', flag: '🇮🇩', type: 'e-Visa',  valid: '90 days',  fee: 'SGD 40',  eta: '5 May, 12:03 AM', tag: 'fast', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&auto=format&fit=crop&q=70', featured: true },
      { name: 'Egypt',         city: 'Cairo · Giza',           code: 'eg', flag: '🇪🇬', type: 'e-Visa',  valid: '90 days',  fee: 'SGD 40',  eta: '10 May, 5:56 PM',  tag: 'fast', img: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=600&auto=format&fit=crop&q=70' },
      { name: 'Australia',     city: 'Sydney · Melbourne',     code: 'au', flag: '🇦🇺', type: 'e-Visa',  valid: '1 year',   fee: 'SGD 303', eta: '15 Jun, 5:50 PM',  tag: 'evisa', img: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=600&auto=format&fit=crop&q=70' },
      { name: 'Saudi Arabia',  city: 'Riyadh · AlUla',         code: 'sa', flag: '🇸🇦', type: 'e-Visa',  valid: '365 days', fee: 'SGD 219', eta: '7 May, 6:21 PM',   tag: 'fast', img: 'https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=600&auto=format&fit=crop&q=70' },
      { name: 'United Kingdom',city: 'London · Edinburgh',     code: 'gb', flag: '🇬🇧', type: 'Standard',valid: '6 months', fee: 'SGD 401', eta: '10 Jun, 5:59 PM',  tag: 'evisa', img: 'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=600&auto=format&fit=crop&q=70' },
      { name: 'Vietnam',       city: 'Hanoi · Hoi An',         code: 'vn', flag: '🇻🇳', type: 'e-Visa',  valid: '90 days',  fee: 'SGD 64',  eta: '8 May, 11:02 AM',  tag: 'fast', img: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=600&auto=format&fit=crop&q=70' },
      { name: 'Malaysia',      city: 'KL · Penang',            code: 'my', flag: '🇲🇾', type: 'e-Visa',  valid: '30 days',  fee: 'SGD 28',  eta: '6 May, 9:14 AM',   tag: 'fast', img: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&auto=format&fit=crop&q=70' },
      { name: 'Japan',         city: 'Tokyo · Kyoto',          code: 'jp', flag: '🇯🇵', type: 'Standard',valid: '90 days',  fee: 'SGD 78',  eta: '14 May, 2:00 PM',  tag: 'evisa', img: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?w=600&auto=format&fit=crop&q=70' },
      { name: 'United States', city: 'NYC · LA',               code: 'us', flag: '🇺🇸', type: 'B1/B2',   valid: '10 years', fee: 'SGD 285', eta: '24 Jul, 4:00 PM',  tag: 'evisa', img: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=600&auto=format&fit=crop&q=70' },
      { name: 'Canada',        city: 'Toronto · Vancouver',    code: 'ca', flag: '🇨🇦', type: 'eTA',     valid: '5 years',  fee: 'SGD 122', eta: '20 May, 10:30 AM', tag: 'evisa', img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=600&auto=format&fit=crop&q=70' },
      { name: 'Türkiye',       city: 'Istanbul · Cappadocia',  code: 'tr', flag: '🇹🇷', type: 'e-Visa',  valid: '180 days', fee: 'SGD 92',  eta: '11 May, 3:45 PM',  tag: 'fast', img: 'https://images.unsplash.com/photo-1527838832700-5059252407fa?w=600&auto=format&fit=crop&q=70' },
      { name: 'Thailand',      city: 'Bangkok · Phuket',       code: 'th', flag: '🇹🇭', type: 'eVOA',    valid: '60 days',  fee: 'SGD 35',  eta: '5 May, 8:00 AM',   tag: 'fast', img: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&auto=format&fit=crop&q=70' },
      { name: 'United Arab Emirates', city: 'Dubai · Abu Dhabi',  code: 'ae', flag: '🇦🇪', type: 'e-Visa', valid: '60 days', fee: 'SGD 145', eta: '6 May, 1:18 PM',  tag: 'fast', img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&auto=format&fit=crop&q=70' },
      { name: 'France',        city: 'Paris · Nice',           code: 'fr', flag: '🇫🇷', type: 'Schengen',valid: '90 days',  fee: 'SGD 117', eta: '4 Jun, 11:00 AM',  tag: 'evisa', img: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=600&auto=format&fit=crop&q=70' },
      { name: 'Italy',         city: 'Rome · Florence',        code: 'it', flag: '🇮🇹', type: 'Schengen',valid: '90 days',  fee: 'SGD 117', eta: '8 Jun, 9:00 AM',   tag: 'evisa', img: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=600&auto=format&fit=crop&q=70' },
      { name: 'India',         city: 'Delhi · Mumbai',         code: 'in', flag: '🇮🇳', type: 'e-Visa',  valid: '60 days',  fee: 'SGD 67',  eta: '7 May, 4:30 PM',   tag: 'fast', img: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&auto=format&fit=crop&q=70' },
    ];

    function makeCard(c: Country, opts: { featured?: boolean } = {}) {
      const tagLabel = c.tag === 'fast' ? 'Fast track' : c.type;
      const tagClass = c.tag === 'fast' ? 'tag-fast' : 'tag-evisa';
      const href = c.name === 'Indonesia' ? '/visa/indonesia' : '/visa/indonesia';
      return `
        <a class="card-c ${opts.featured ? 'featured' : ''}" href="${href}" style="text-decoration:none;color:inherit;">
          <div class="card-img">
            <div class="photo" style="background-image:url('${c.img}')"></div>
            <span class="card-tag ${tagClass}">${tagLabel}</span>
            <button class="card-fav" aria-label="Save">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <div class="card-name">
              <div>
                <div class="nm">${c.name}</div>
                <div class="ct">${c.city}</div>
              </div>
              <div class="flag"><img src="${FLAG_CDN}/${c.code}.svg" alt="${c.name}"/></div>
            </div>
          </div>
          <div class="card-body">
            <div class="card-stats">
              <div class="stat"><div class="k">Type</div><div class="v">${c.type}</div></div>
              <div class="stat"><div class="k">Valid</div><div class="v">${c.valid}</div></div>
              <div class="stat"><div class="k">VIZA fee</div><div class="v">${c.fee}</div></div>
            </div>
            <div class="card-foot">
              <div class="foot-eta">
                <span class="lk">Guaranteed by</span>
                <span class="lv">${c.eta}</span>
              </div>
              <button class="foot-cta" aria-label="Start application">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </a>
      `;
    }

    function render() {
      // First grid: 1 featured + 8 regular = 9 cards (featured spans 2)
      const first = COUNTRIES.slice(0, 9);
      const html1 = first.map((c, i) => makeCard(c, { featured: i === 0 })).join('');
      const grid = document.getElementById('grid');
      if (grid) grid.innerHTML = html1;
      const countNum = document.getElementById('countNum');
      if (countNum) countNum.textContent = String(COUNTRIES.length);
      // Second grid: rest
      const rest = COUNTRIES.slice(9);
      const grid2 = document.getElementById('grid2');
      if (grid2) grid2.innerHTML = rest.map(c => makeCard(c)).join('');
      bindCardFavs();
    }

    function bindCardFavs() {
      document.querySelectorAll('.card-fav').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          b.classList.toggle('on');
          const path = b.querySelector('path');
          if (b.classList.contains('on')) {
            path?.setAttribute('fill', 'currentColor');
          } else {
            path?.removeAttribute('fill');
          }
        });
      });
    }

    render();

    // --- Filter bar dropdowns ---
    const FILTER_OPTS: Record<string, string[]> = {
      delivery: ['Any time', 'Within 24 hours', 'Within 3 days', 'Within 1 week', 'Within 1 month'],
      type:     ['All types', 'Tourist', 'Business', 'Work', 'Student', 'Digital nomad'],
      documents:['Any documents', 'Minimal (passport only)', 'Standard', 'Detailed package'],
      dates:    ['Select dates', 'This week', 'This month', 'In 3 months', 'In 6 months']
    };
    let openDropdown: HTMLElement | null = null;
    function closeDropdown() {
      if (openDropdown) { openDropdown.remove(); openDropdown = null; }
      document.querySelectorAll('.filter.active').forEach(f => f.classList.remove('active'));
    }
    document.addEventListener('click', closeDropdown);

    document.querySelectorAll('#filterBar .filter').forEach(f => {
      f.addEventListener('click', e => {
        e.stopPropagation();
        const key = (f as HTMLElement).dataset.key as string;
        const isOpen = openDropdown && openDropdown.dataset.key === key;
        closeDropdown();
        if (isOpen) return;
        f.classList.add('active');
        const dd = document.createElement('div');
        dd.className = 'dropdown';
        dd.dataset.key = key;
        const cur = f.querySelector('[data-val]')?.textContent ?? '';
        dd.innerHTML = FILTER_OPTS[key].map(o => `
          <button class="${o === cur ? 'sel' : ''}">
            <span>${o}</span>
            <svg class="check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>`).join('');
        const r = f.getBoundingClientRect();
        dd.style.left = (r.left + window.scrollX) + 'px';
        dd.style.top  = (r.bottom + window.scrollY) + 'px';
        document.body.appendChild(dd);
        openDropdown = dd;
        dd.addEventListener('click', e2 => e2.stopPropagation());
        dd.querySelectorAll('button').forEach(b => {
          b.addEventListener('click', () => {
            const valEl = f.querySelector('[data-val]');
            if (valEl) valEl.textContent = b.querySelector('span')?.textContent ?? '';
            closeDropdown();
          });
        });
      });
    });

    // --- View toggle ---
    document.getElementById('vGrid')?.addEventListener('click', () => {
      document.getElementById('vGrid')?.classList.add('active');
      document.getElementById('vMap')?.classList.remove('active');
    });
    document.getElementById('vMap')?.addEventListener('click', () => {
      document.getElementById('vMap')?.classList.add('active');
      document.getElementById('vGrid')?.classList.remove('active');
    });

    // --- Sort ---
    const SORTS = ['Guaranteed delivery', 'Visa fee (low to high)', 'Visa duration', 'Popular destinations', 'Recently added'];
    document.getElementById('sortBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      closeDropdown();
      const dd = document.createElement('div');
      dd.className = 'dropdown';
      dd.dataset.key = 'sort';
      const cur = document.getElementById('sortLabel')?.textContent ?? '';
      dd.innerHTML = SORTS.map(s => `<button class="${s === cur ? 'sel' : ''}"><span>${s}</span><svg class="check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>`).join('');
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dd.style.left = (r.left + window.scrollX) + 'px';
      dd.style.top  = (r.bottom + window.scrollY) + 'px';
      document.body.appendChild(dd);
      openDropdown = dd;
      dd.addEventListener('click', e2 => e2.stopPropagation());
      dd.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          const sortLabel = document.getElementById('sortLabel');
          if (sortLabel) sortLabel.textContent = b.querySelector('span')?.textContent ?? '';
          closeDropdown();
        });
      });
    });

    // --- Passport selector ---
    type Passport = { code: string; name: string; flag: string; free: number; voa: number; req: number; rank: string };
    const PASSPORTS: Passport[] = [
      { code: 'SG', name: 'Singapore',      flag: '🇸🇬', free: 157, voa: 29, req: 9,  rank: '#1' },
      { code: 'JP', name: 'Japan',          flag: '🇯🇵', free: 154, voa: 30, req: 11, rank: '#2' },
      { code: 'KR', name: 'South Korea',    flag: '🇰🇷', free: 152, voa: 31, req: 12, rank: '#3' },
      { code: 'DE', name: 'Germany',        flag: '🇩🇪', free: 153, voa: 28, req: 14, rank: '#3' },
      { code: 'FR', name: 'France',         flag: '🇫🇷', free: 151, voa: 29, req: 15, rank: '#4' },
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', free: 148, voa: 30, req: 17, rank: '#5' },
      { code: 'US', name: 'United States',  flag: '🇺🇸', free: 145, voa: 31, req: 19, rank: '#6' },
      { code: 'AU', name: 'Australia',      flag: '🇦🇺', free: 144, voa: 32, req: 19, rank: '#6' },
      { code: 'CA', name: 'Canada',         flag: '🇨🇦', free: 144, voa: 31, req: 20, rank: '#7' },
      { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', free: 132, voa: 38, req: 25, rank: '#11' },
      { code: 'CN', name: 'China',          flag: '🇨🇳', free: 85,  voa: 32, req: 78, rank: '#60' },
      { code: 'IN', name: 'India',          flag: '🇮🇳', free: 58,  voa: 28, req: 109,rank: '#80' },
      { code: 'BR', name: 'Brazil',         flag: '🇧🇷', free: 134, voa: 26, req: 35, rank: '#15' },
      { code: 'PH', name: 'Philippines',    flag: '🇵🇭', free: 67,  voa: 30, req: 98, rank: '#73' },
      { code: 'ID', name: 'Indonesia',      flag: '🇮🇩', free: 76,  voa: 30, req: 89, rank: '#67' },
      { code: 'MY', name: 'Malaysia',       flag: '🇲🇾', free: 124, voa: 35, req: 36, rank: '#13' },
      { code: 'TH', name: 'Thailand',       flag: '🇹🇭', free: 81,  voa: 32, req: 82, rank: '#62' }
    ];

    let currentPassport: Passport = PASSPORTS[0];
    let passportPop: HTMLElement | null = null;

    const passportPill = document.getElementById('passportPill');

    function setPassport(p: Passport) {
      currentPassport = p;
      const code = p.code.toLowerCase();
      const passportBall = document.getElementById('passportBall');
      if (passportBall) passportBall.innerHTML = `<img src="${FLAG_CDN}/${code}.svg" alt="${p.name}"/>`;
      const passportName = document.getElementById('passportName');
      if (passportName) passportName.textContent = p.name;
      const psFlag = document.getElementById('psFlag');
      if (psFlag) psFlag.innerHTML = `<img src="${FLAG_CDN}/${code}.svg" alt="${p.name}"/>`;
      const psName = document.getElementById('psName');
      if (psName) psName.textContent = p.name;
      const psSub = document.getElementById('psSub');
      if (psSub) psSub.textContent = `Visa requirements across ${p.free + p.voa + p.req} destinations · Rank ${p.rank}`;
      const psFree = document.getElementById('psFree');
      if (psFree) psFree.textContent = String(p.free);
      const psVoa = document.getElementById('psVoa');
      if (psVoa) psVoa.textContent  = String(p.voa);
      const psReq = document.getElementById('psReq');
      if (psReq) psReq.textContent  = String(p.req);
    }

    function closePassportPop() {
      if (passportPop) { passportPop.remove(); passportPop = null; }
      passportPill?.classList.remove('open');
    }

    function renderPassportList(query: string) {
      const q = (query || '').trim().toLowerCase();
      const filtered = PASSPORTS.filter(p => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
      return filtered.map(p => `
        <button class="pp-row ${p.code === currentPassport.code ? 'sel' : ''}" data-code="${p.code}">
          <span class="pp-flag"><img src="${FLAG_CDN}/${p.code.toLowerCase()}.svg" alt="${p.name}"/></span>
          <span class="pp-name">${p.name}</span>
          <span class="pp-meta">${p.free} visa-free</span>
          <svg class="pp-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>`).join('') || `<div style="padding:24px 12px;text-align:center;color:var(--fg-2);font-size:13px;">No passports match "${query}"</div>`;
    }

    passportPill?.addEventListener('click', e => {
      e.stopPropagation();
      if (passportPop) { closePassportPop(); return; }
      closeDropdown();
      passportPill.classList.add('open');
      const pop = document.createElement('div');
      pop.className = 'passport-pop';
      pop.innerHTML = `
        <h4>Choose your passport</h4>
        <label class="pp-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="ppSearch" placeholder="Search passport country…" autocomplete="off"/>
        </label>
        <div class="pp-list" id="ppList">${renderPassportList('')}</div>
        <div class="pp-foot">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Updated for May 2026 · Sourced from IATA Timatic
        </div>`;
      passportPill.appendChild(pop);
      passportPop = pop;
      pop.addEventListener('click', e2 => e2.stopPropagation());
      const inp = pop.querySelector('#ppSearch') as HTMLInputElement | null;
      setTimeout(() => inp?.focus(), 0);
      inp?.addEventListener('input', e2 => {
        const list = pop.querySelector('#ppList');
        if (list) list.innerHTML = renderPassportList((e2.target as HTMLInputElement).value);
        bindPpRows();
      });
      bindPpRows();
    });

    function bindPpRows() {
      if (!passportPop) return;
      passportPop.querySelectorAll('.pp-row').forEach(r => {
        r.addEventListener('click', () => {
          const p = PASSPORTS.find(x => x.code === (r as HTMLElement).dataset.code);
          if (p) setPassport(p);
          closePassportPop();
        });
      });
    }

    document.addEventListener('click', closePassportPop);

    // --- Search filter (light) ---
    document.getElementById('searchInput')?.addEventListener('input', e => {
      const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
      document.querySelectorAll('.card-c').forEach(card => {
        const name = card.querySelector('.nm')?.textContent?.toLowerCase() ?? '';
        const city = card.querySelector('.ct')?.textContent?.toLowerCase() ?? '';
        (card as HTMLElement).style.display = (!q || name.includes(q) || city.includes(q)) ? '' : 'none';
      });
    });

    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('click', closeDropdown);
      document.removeEventListener('click', closePassportPop);
    };
  }, []);

  return (
    <>
      {/* Top nav */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-left">
            <a className="nav-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA"/></a>
            <button className="passport-pill" id="passportPill" type="button">
              <span className="ball" id="passportBall"><CircleFlag countryCode="sg" height={32}/></span>
              <span>
                <span className="lab-key">Your passport</span>
                <span className="lab-val">
                  <span id="passportName">Singapore</span>
                  <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </span>
            </button>
          </div>

          <div className="center-tabs nav-tabs" id="navTabs">
            <span className="pill-indicator" id="navPill"></span>
            <a className="nav-tab active" data-tab="explore" href="/">Explore</a>
            <a className="nav-tab" data-tab="events" href="/events">Events</a>
          </div>

          <div className="nav-right">
            <label className="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input id="searchInput" placeholder="Search a country or visa…"/>
            </label>
            <button className="icon-btn" title="Help">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <div className="avatar">CL</div>
          </div>
        </div>
      </nav>

      {/* Passport status strip */}
      <section className="passport-strip" id="passportStrip">
        <div className="passport-strip-inner">
          <div className="ps-head">
            <div className="ps-flag" id="psFlag"><CircleFlag countryCode="sg" height={36}/></div>
            <div>
              <div className="ps-name"><span id="psName">Singapore</span> passport</div>
              <div className="ps-sub" id="psSub">Visa requirements across 195 destinations</div>
            </div>
          </div>
          <div className="ps-stats">
            <div className="ps-stat free">
              <div className="ps-num"><span className="ps-dot"></span><span id="psFree">157</span></div>
              <div className="ps-lab"><b>Visa-free</b> · no paperwork</div>
            </div>
            <div className="ps-stat voa">
              <div className="ps-num"><span className="ps-dot"></span><span id="psVoa">29</span></div>
              <div className="ps-lab"><b>e-Visa or VOA</b> · we handle it</div>
            </div>
            <div className="ps-stat req">
              <div className="ps-num"><span className="ps-dot"></span><span id="psReq">9</span></div>
              <div className="ps-lab"><b>Visa required</b> · embassy filing</div>
            </div>
          </div>
          <button className="ps-cta">
            See full visa map
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </section>

      {/* Page */}
      <main className="page">

        <header className="pagehead">
          <h1>Where to next?</h1>
          <p>Browse visa options for any destination. Your VIZA consultant and our AI handle the paperwork — you book the trip.</p>
        </header>

        {/* Filter pill bar */}
        <div className="filter-bar" id="filterBar">
          <button className="filter" data-key="delivery">
            <span className="icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </span>
            <span className="text">
              <span className="label-key">Visa delivery</span>
              <span className="label-val"><span data-val>Any time</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </span>
          </button>
          <button className="filter" data-key="type">
            <span className="icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/><circle cx="12" cy="12" r="10"/></svg>
            </span>
            <span className="text">
              <span className="label-key">Visa type</span>
              <span className="label-val"><span data-val>All types</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </span>
          </button>
          <button className="filter" data-key="documents">
            <span className="icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            <span className="text">
              <span className="label-key">Documents</span>
              <span className="label-val"><span data-val>Any documents</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </span>
          </button>
          <button className="filter" data-key="dates">
            <span className="icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </span>
            <span className="text">
              <span className="label-key">Travel dates</span>
              <span className="label-val"><span data-val>Select dates</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </span>
          </button>
        </div>

        {/* Sort / count / view toggle row */}
        <div className="actions-row">
          <div className="results-count">Showing <strong id="countNum">12</strong> destinations <span style={{ color: '#cdcdcd' }}>·</span> sorted by <strong>guaranteed delivery</strong></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="sort-select" id="sortBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
              <span id="sortLabel">Guaranteed delivery</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="view-toggle">
              <button className="active" id="vGrid">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                Grid
              </button>
              <button id="vMap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                Map
              </button>
            </div>
          </div>
        </div>

        {/* Trending (5 wide) */}
        <div className="grid" id="grid"></div>

        <div className="section-head">
          <h2>For Singapore passports</h2>
          <a href="#" className="seeall">See all 84 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></a>
        </div>
        <div className="grid" id="grid2"></div>

        <p className="footnote">Government visa fees are charged separately and vary by country.</p>
      </main>

      {/* =====================  Site footer  ===================== */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>

        <div className="foot-main">
          {/* Brand column */}
          <div className="foot-brand">
            <a className="foot-logo" href="/"><img src="/assets/viza-logo-black.svg" alt="VIZA"/></a>
            <p className="foot-tag">VIZA helps you plan, apply, and track visas seamlessly across the world.</p>

            <div className="ask-ai">Ask AI about VIZA</div>
            <div className="ai-chips">
              <button className="ai-chip c1" title="Ask in your AI assistant" aria-label="Ask in chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </button>
              <button className="ai-chip c2" title="Ask in your AI assistant" aria-label="Ask via search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
              </button>
              <button className="ai-chip c3" title="Ask in your AI assistant" aria-label="Ask via assistant">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 13.8 8.4 20 10.5 13.8 12.6 12 19 10.2 12.6 4 10.5 10.2 8.4 12 2Z"/></svg>
              </button>
              <button className="ai-chip c4" title="Ask in your AI assistant" aria-label="Ask via voice">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
              </button>
            </div>
          </div>

          {/* Company */}
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

          {/* Products */}
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

          {/* Offices */}
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

          {/* App buttons span the brand column area */}
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
