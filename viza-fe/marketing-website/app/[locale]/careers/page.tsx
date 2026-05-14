"use client";

import { useEffect } from "react";
import { CircleFlag } from "react-circle-flags";
import SiteNav from "@/components/SiteNav";
import "./careers.css";

export default function CareersPage() {
  useEffect(() => {
    // --- Tab pill indicator ---
    const tabsEl = document.getElementById("navTabs");
    const pill = document.getElementById("navPill");
    function movePill(target: Element | null) {
      if (!target || !tabsEl || !pill) return;
      const r = (target as HTMLElement).getBoundingClientRect();
      const pr = tabsEl.getBoundingClientRect();
      (pill as HTMLElement).style.left = r.left - pr.left + "px";
      (pill as HTMLElement).style.width = r.width + "px";
    }
    const onResize = () =>
      movePill(tabsEl ? tabsEl.querySelector(".nav-tab.active") : null);
    requestAnimationFrame(() =>
      movePill(tabsEl ? tabsEl.querySelector(".nav-tab.active") : null),
    );
    window.addEventListener("resize", onResize);

    // --- Roles data ---
    const ROLES = [
      { dep: "eng", title: "Senior Backend Engineer — Payments", team: "Engineering", loc: "Singapore", type: "Full-time" },
      { dep: "eng", title: "Staff Engineer — Document Pipeline", team: "Engineering", loc: "San Francisco", type: "Full-time" },
      { dep: "eng", title: "iOS Engineer — Applicant App", team: "Engineering", loc: "Singapore", type: "Full-time" },
      { dep: "eng", title: "Platform Engineer — Infra & Security", team: "Engineering", loc: "San Francisco", type: "Full-time" },
      { dep: "eng", title: "Frontend Engineer — Consultant Console", team: "Engineering", loc: "Singapore", type: "Full-time" },
      { dep: "eng", title: "Engineering Manager — Web", team: "Engineering", loc: "London", type: "Full-time" },
      { dep: "eng", title: "Site Reliability Engineer", team: "Engineering", loc: "Singapore", type: "Full-time" },
      { dep: "eng", title: "Senior Android Engineer", team: "Engineering", loc: "San Francisco", type: "Full-time" },
      { dep: "eng", title: "Engineering Lead — Embassy Integrations", team: "Engineering", loc: "Dubai", type: "Full-time" },

      { dep: "design", title: "Senior Product Designer — Applicant Flow", team: "Design", loc: "Singapore", type: "Full-time" },
      { dep: "design", title: "Brand Designer", team: "Design", loc: "San Francisco", type: "Full-time" },
      { dep: "design", title: "Design Lead — Consultant Tools", team: "Design", loc: "Singapore", type: "Full-time" },

      { dep: "ops", title: "Head of Operations, Middle East", team: "Operations", loc: "Dubai", type: "Full-time" },
      { dep: "ops", title: "Visa Operations Lead — Schengen", team: "Operations", loc: "London", type: "Full-time" },
      { dep: "ops", title: "Logistics & Courier Manager", team: "Operations", loc: "Singapore", type: "Full-time" },
      { dep: "ops", title: "Process Engineer — Document QA", team: "Operations", loc: "San Francisco", type: "Full-time" },
      { dep: "ops", title: "Operations Analyst — Bookings", team: "Operations", loc: "Singapore", type: "Full-time" },

      { dep: "consult", title: "Visa Consultant — Schengen", team: "Consultants", loc: "London", type: "Full-time" },
      { dep: "consult", title: "Visa Consultant — US B1/B2", team: "Consultants", loc: "San Francisco", type: "Full-time" },
      { dep: "consult", title: "Visa Consultant — UAE Residency", team: "Consultants", loc: "Dubai", type: "Full-time" },
      { dep: "consult", title: "Senior Consultant — Student Visas", team: "Consultants", loc: "Singapore", type: "Full-time" },
      { dep: "consult", title: "Consultant Lead — Asia-Pacific", team: "Consultants", loc: "Singapore", type: "Full-time" },
      { dep: "consult", title: "Visa Consultant — UK", team: "Consultants", loc: "London", type: "Full-time" },

      { dep: "data", title: "Senior Data Scientist — Approval Modeling", team: "Data & ML", loc: "Singapore", type: "Full-time" },
      { dep: "data", title: "ML Engineer — OCR & Document AI", team: "Data & ML", loc: "San Francisco", type: "Full-time" },

      { dep: "gtm", title: "Performance Marketing Manager", team: "Marketing & GTM", loc: "Singapore", type: "Full-time" },
      { dep: "gtm", title: "Content Lead — Storytelling", team: "Marketing & GTM", loc: "San Francisco", type: "Full-time" },
      { dep: "gtm", title: "Lifecycle & CRM Manager", team: "Marketing & GTM", loc: "London", type: "Full-time" },
    ];

    const DEP_LABEL: Record<string, string> = {
      eng: "Engineering",
      design: "Design",
      ops: "Operations",
      consult: "Consultants",
      data: "Data & ML",
      gtm: "Marketing & GTM",
    };
    const DEP_ORDER = ["eng", "design", "ops", "consult", "data", "gtm"];

    function renderRoles(dep: string) {
      const list = document.getElementById("roleList");
      if (!list) return;
      const filtered = dep === "all" ? ROLES : ROLES.filter((r) => r.dep === dep);
      const countEl = document.getElementById("roleCount");
      if (countEl) countEl.textContent = String(filtered.length);

      const groups: Record<string, typeof ROLES> = {};
      filtered.forEach((r) => {
        (groups[r.dep] = groups[r.dep] || []).push(r);
      });

      const order = dep === "all" ? DEP_ORDER : [dep];
      list.innerHTML = order
        .filter((d) => groups[d] && groups[d].length)
        .map(
          (d) => `
      <div class="role-group">
        <h3>${DEP_LABEL[d]} <span class="grp-cnt">${groups[d].length} open</span></h3>
        ${groups[d]
          .map(
            (r) => `
          <a class="role-row" href="/apply">
            <div class="title-block">
              <div class="pos">${r.title}</div>
              <div class="pos-sub">${r.team} · we hire on craft and judgement, not pedigree</div>
            </div>
            <div class="role-cell">
              <small>Location</small>
              <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${r.loc}</span>
            </div>
            <div class="role-cell">
              <small>Type</small>
              <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${r.type}</span>
            </div>
            <span class="role-cta">
              View role
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
          </a>
        `,
          )
          .join("")}
      </div>
    `,
        )
        .join("");
    }
    renderRoles("all");

    const tabButtons = document.querySelectorAll<HTMLButtonElement>(
      "#roleTabs .role-tab",
    );
    const handlers: Array<() => void> = [];
    tabButtons.forEach((b) => {
      const handler = () => {
        document
          .querySelectorAll("#roleTabs .role-tab")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        renderRoles(b.dataset.dep || "all");
      };
      b.addEventListener("click", handler);
      handlers.push(() => b.removeEventListener("click", handler));
    });

    return () => {
      window.removeEventListener("resize", onResize);
      handlers.forEach((h) => h());
    };
  }, []);

  return (
    <>
      {/* Top nav */}
      <SiteNav />

      {/* ============================= HERO ============================= */}
      <section className="hero" data-screen-label="Hero">
        <div className="hero-inner">
          <div>
            <div className="hiring-ticker">
              <span className="pulse"></span>
              <span className="label">Now hiring in</span>
              <span className="cities">
                <span>Singapore</span>
                <span>San Francisco</span>
                <span>Dubai</span>
                <span>London</span>
              </span>
              <span className="sep">/</span>
              <span>28 open roles</span>
            </div>
            <h1>
              Help us make borders
              <br />
              <em>disappear</em> — <span className="underline">quietly,</span>
              <br />
              at the speed of software.
            </h1>
            <p className="lead">
              We{"’"}re turning months of visa paperwork into hours of
              software, for millions of people who just want to get on a plane.
              Bring your craft to a team that ships against real-world deadlines.
            </p>
            <div className="hero-ctas">
              <a className="btn-hero-primary" href="#roles">
                See all open roles
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
              <a className="btn-hero-ghost" href="#mission">
                Why we exist
              </a>
            </div>
          </div>

          <div className="board-wrap">
            <div
              className="board"
              role="img"
              aria-label="Departures board listing open roles at VIZA"
            >
              <div className="board-head">
                <span>Open positions · live</span>
                <span className="live">On time</span>
              </div>
              <div className="board-cols">
                <span>Req.</span>
                <span>Role</span>
                <span>Office</span>
                <span>Status</span>
              </div>
              <div className="board-row">
                <div className="code">VZ·041</div>
                <div className="role">
                  Staff Engineer<small>Document pipeline</small>
                </div>
                <div className="loc">SG</div>
                <div className="status status-board">Boarding</div>
              </div>
              <div className="board-row">
                <div className="code">VZ·038</div>
                <div className="role">
                  Product Designer<small>Applicant flows</small>
                </div>
                <div className="loc">SF</div>
                <div className="status status-open">Open</div>
              </div>
              <div className="board-row">
                <div className="code">VZ·035</div>
                <div className="role">
                  Embassy Liaison<small>Government partnerships</small>
                </div>
                <div className="loc">DXB</div>
                <div className="status status-final">Final call</div>
              </div>
              <div className="board-row">
                <div className="code">VZ·033</div>
                <div className="role">
                  Customer Operations<small>Tier-2 escalations</small>
                </div>
                <div className="loc">LDN</div>
                <div className="status status-open">Open</div>
              </div>
              <div className="board-foot">
                <span>+24 more roles across engineering, ops &amp; design</span>
                <a href="#roles">Browse all</a>
              </div>
            </div>

            <div className="board-chip board-chip-1">
              <div className="ic">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div className="lab">Hiring across</div>
                <div>4 offices</div>
              </div>
            </div>
            <div className="board-chip board-chip-2">
              <div className="ic">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <div className="lab">Avg. response</div>
                <div>3.2 days to first call</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-stats">
          <div className="hstat">
            <div className="v">
              2.4M<small>+</small>
            </div>
            <div className="k">Visas issued through VIZA last year</div>
          </div>
          <div className="hstat">
            <div className="v">194</div>
            <div className="k">Destinations supported with live processing</div>
          </div>
          <div className="hstat">
            <div className="v">
              96.4<small>%</small>
            </div>
            <div className="k">Approval rate across all visa types in 2025</div>
          </div>
          <div className="hstat">
            <div className="v">340</div>
            <div className="k">
              People across Singapore, San Francisco, Dubai &amp; London
            </div>
          </div>
        </div>
      </section>

      {/* ============================= MISSION ============================= */}
      <section className="mission" id="mission">
        <div className="section">
          <div className="mission-grid">
            <div className="left">
              <div className="sec-eyebrow">Our story</div>
              <h2>
                Most of the world
                <br />
                still travels with
                <br />
                <em>printed paperwork.</em>
              </h2>
              <p className="kicker">
                We started VIZA in 2021 after spending one too many weeks on
                hold with embassies. The system for moving people across borders
                is older than the internet, and the people stuck inside it
                deserve better.
              </p>
              <p className="kicker">
                Today, a team of 340 across four offices ships software, files
                documents, and runs operations in 194 countries. We do the
                boring, exhausting work so that travel can feel like the rest of
                the internet does: a few taps, then you{"’"}re moving.
              </p>
              <div className="signature">
                <div className="avatar">MK</div>
                <div className="who">
                  Mira Kohli
                  <small>Co-founder &amp; CEO · Singapore</small>
                </div>
              </div>
            </div>

            <div className="right">
              <div className="belief">
                <span className="num">01</span>
                <div>
                  <h4>We{"’"}re an operations company that ships software.</h4>
                  <p>
                    Half of VIZA is engineers, designers, and PMs. The other
                    half is consultants, ops, and document specialists in
                    country. Neither half wins without the other.
                  </p>
                </div>
              </div>
              <div className="belief">
                <span className="num">02</span>
                <div>
                  <h4>The applicant is always the customer.</h4>
                  <p>
                    Embassies, partners, airlines — they all matter. But the
                    person stuck in line at 3am refreshing a portal is the one
                    we work for, and the one we measure ourselves against.
                  </p>
                </div>
              </div>
              <div className="belief">
                <span className="num">03</span>
                <div>
                  <h4>Speed compounds when you{"’"}re patient with quality.</h4>
                  <p>
                    We move fast on shipping, slow on irreversible decisions. A
                    wrong visa decision can wreck a wedding, a job, a funeral.
                    We hold that bar even when it slows us down.
                  </p>
                </div>
              </div>
              <div className="belief">
                <span className="num">04</span>
                <div>
                  <h4>Distance is a UX problem, not a constraint.</h4>
                  <p>
                    Our teams sit in four time zones. Async writing, clear
                    ownership, and good doc culture are how we trade time for
                    trust — and how we ship across the world without exhausting
                    anyone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= VALUES ============================= */}
      <section className="section" id="values">
        <div className="sec-head">
          <div className="sec-eyebrow">What we hold ourselves to</div>
          <h2>Five things we believe, even when it{"’"}s expensive.</h2>
          <p>
            Values are easy to write down and hard to act on. These are the five
            that we actually use during hiring, during reviews, and during the
            rare hard decisions.
          </p>
        </div>

        <div className="values-grid">
          <div className="value-card tone-a">
            <div className="value-glyph">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h3>Tell the truth, especially when it costs us.</h3>
            <p>
              If a visa won{"’"}t come through in time, say so today, not
              the day before the flight. We{"’"}d rather lose a sale than
              ship a lie.
            </p>
            <div className="kicker">
              In practice → published refund policy, fee change audit
            </div>
          </div>

          <div className="value-card tone-b">
            <div className="value-glyph">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h3>Earn velocity. Don{"’"}t just feel busy.</h3>
            <p>
              We celebrate decisions and shipped work, not meetings and threads.
              The point is throughput against the mission — not motion against
              your calendar.
            </p>
            <div className="kicker">In practice → quarterly throughput review</div>
          </div>

          <div className="value-card tone-c">
            <div className="value-glyph">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15 15 0 0 1 0 20" />
                <path d="M12 2a15 15 0 0 0 0 20" />
              </svg>
            </div>
            <h3>Think in passports, not personas.</h3>
            <p>
              Visa rules are nationality-specific. A {"“"}user{"”"}{" "}
              doesn{"’"}t exist — a Filipino passport holder applying to
              Schengen does. We build for real people, not averages.
            </p>
            <div className="kicker">In practice → passport-first product spec</div>
          </div>

          <div className="value-card tone-d">
            <div className="value-glyph">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <h3>Write things down. Decisions especially.</h3>
            <p>
              Four offices, four time zones. If a decision isn{"’"}t
              written, it didn{"’"}t happen. Our wiki is required reading;
              our standups are optional.
            </p>
            <div className="kicker">In practice → ADRs, weekly memo, async-first</div>
          </div>

          <div className="value-card tone-e">
            <div className="value-glyph">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12h4l3-9 4 18 3-9h4" />
              </svg>
            </div>
            <h3>Stay close to the queue.</h3>
            <p>
              Every engineer does one shift a quarter on the consultant floor.
              You can{"’"}t design out friction you{"’"}ve never felt
              at 11pm on a Sunday.
            </p>
            <div className="kicker">In practice → rotational queue shifts</div>
          </div>

          <div className="value-card">
            <div className="value-glyph">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h3>Pick the long version.</h3>
            <p>
              The thirty-second answer is usually wrong. We invest in deep
              documentation, robust playbooks, and explanations that hold up —
              even when the easy version would do.
            </p>
            <div className="kicker">
              In practice → onboarding handbook, public playbooks
            </div>
          </div>
        </div>
      </section>

      {/* ============================= INSIDE ============================= */}
      <section className="inside" id="inside">
        <div className="section" style={{ paddingBottom: "80px" }}>
          <div className="sec-head">
            <div className="sec-eyebrow">Inside VIZA</div>
            <h2>
              What it actually
              <br />
              looks like to work here.
            </h2>
            <p>
              We have offices in four cities because we hire close to where
              applications get filed. We{"’"}re loud about wins, quiet
              about politics, and honest about how much we still have to build.
            </p>
          </div>

          <div className="photo-row">
            <div className="photo">
              <div className="ph-stripes"></div>
              <div className="ph-label">photo · singapore HQ — open floor</div>
              <div className="ph-mark">Marina Boulevard, SG</div>
            </div>
            <div className="photo">
              <div className="ph-stripes"></div>
              <div className="ph-label">photo · consultant queue floor</div>
              <div className="ph-mark">Mission Street, SF</div>
            </div>
            <div className="photo">
              <div className="ph-stripes"></div>
              <div className="ph-label">photo · whiteboard session</div>
              <div className="ph-mark">Tech offsite, Bali</div>
            </div>
          </div>
          <div className="photo-row r2">
            <div className="photo">
              <div className="ph-stripes"></div>
              <div className="ph-label">photo · dubai ops floor</div>
              <div className="ph-mark">Sheikh Zayed Rd, DXB</div>
            </div>
            <div className="photo">
              <div className="ph-stripes"></div>
              <div className="ph-label">photo · team dinner</div>
              <div className="ph-mark">All-hands, Lisbon</div>
            </div>
            <div className="photo">
              <div className="ph-stripes"></div>
              <div className="ph-label">photo · embassy partner visit</div>
              <div className="ph-mark">Goswell Road, London</div>
            </div>
          </div>

          <div className="inside-words">
            <div>
              <p className="pull">
                {"“"}We hire people who have an opinion about visas before
                they join. By month two, you{"’"}ll have a stronger one.
                {"”"}
              </p>
              <p
                style={{
                  marginTop: "20px",
                  color: "var(--fg-2)",
                  fontSize: "14px",
                }}
              >
                — Felix Adekunle, VP Engineering
              </p>
            </div>
            <div>
              <p>
                VIZA is high autonomy and high context. You{"’"}ll get an
                owner for everything you do, real budgets, and the expectation
                that you{"’"}ll explain the reasoning behind your work to
                the rest of the company.
              </p>
              <p>
                If you want to be told what to do every day, this is not the
                right place. If you{"’"}ve been waiting for someone to hand
                you the steering wheel — it{"’"}s right here.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= HOW WE WORK ============================= */}
      <section className="section" id="how">
        <div className="sec-head">
          <div className="sec-eyebrow">Engineering &amp; ops at VIZA</div>
          <h2>How the work actually moves.</h2>
          <p>
            If you build, file, or design here, this is what your week looks
            like. Less ceremony, more shipped work. Less Slack, more decisions
            written down.
          </p>
        </div>

        <div className="work-grid">
          <div className="work-cell">
            <span className="tag">/own</span>
            <h3>End-to-end ownership</h3>
            <p>
              You design it, build it, ship it, and own it in production. No
              handoff queues, no roadmaps written by people three layers away.
              If it{"’"}s yours, it{"’"}s actually yours.
            </p>
          </div>
          <div className="work-cell">
            <span className="tag">/ship</span>
            <h3>Deploys every day, by default</h3>
            <p>
              Most teams ship multiple times a day. Feedback loops are tight by
              design, and a thirty-minute reversal is preferred to a three-week
              argument.
            </p>
          </div>
          <div className="work-cell">
            <span className="tag">/hard</span>
            <h3>Real, messy problems</h3>
            <p>
              This isn{"’"}t CRUD. You{"’"}ll work on document OCR,
              latency-sensitive scheduling against 90+ government portals, and
              consumer flows used by millions.
            </p>
          </div>
          <div className="work-cell">
            <span className="tag">/craft</span>
            <h3>The bar is high, openly</h3>
            <p>
              We pair on design reviews. We comment in line on PRs. We believe
              taste is teachable, and we expect people to actively help everyone
              around them get better.
            </p>
          </div>
          <div className="work-cell">
            <span className="tag">/learn</span>
            <h3>A real learning budget</h3>
            <p>
              $2,000 per person per year, no questions asked, for conferences,
              books, courses — anything that compounds back into the work you do
              here.
            </p>
          </div>
          <div className="work-cell">
            <span className="tag">/open</span>
            <h3>Architecture written by you</h3>
            <p>
              RFCs are open to everyone. New engineers have shaped core infra in
              their first month. If you have a stronger plan, write it up —
              we{"’"}ll read it.
            </p>
          </div>
        </div>
      </section>

      {/* ============================= ROLES ============================= */}
      <section className="roles" id="roles">
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">Open roles · updated weekly</div>
            <h2>Be part of the journey.</h2>
            <p>
              28 open roles across four offices. We hire across engineering,
              design, operations, consultants, and partnerships. New roles show
              up on Mondays.
            </p>
          </div>

          <div className="role-tabs" id="roleTabs">
            <button className="role-tab active" data-dep="all">
              All departments <span className="cnt">28</span>
            </button>
            <button className="role-tab" data-dep="eng">
              Engineering <span className="cnt">9</span>
            </button>
            <button className="role-tab" data-dep="design">
              Design <span className="cnt">3</span>
            </button>
            <button className="role-tab" data-dep="ops">
              Operations <span className="cnt">5</span>
            </button>
            <button className="role-tab" data-dep="consult">
              Consultants <span className="cnt">6</span>
            </button>
            <button className="role-tab" data-dep="data">
              Data &amp; ML <span className="cnt">2</span>
            </button>
            <button className="role-tab" data-dep="gtm">
              Marketing &amp; GTM <span className="cnt">3</span>
            </button>
          </div>

          <div className="role-toolbar">
            <div className="left">
              Showing <strong id="roleCount">28</strong> roles · all locations ·
              all teams
            </div>
            <button className="role-loc-select">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Any location
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          <div id="roleList"></div>
        </div>
      </section>

      {/* ============================= FELLOWSHIP ============================= */}
      <section
        className="section"
        id="fellowship"
        style={{ paddingTop: 0 }}
      >
        <div className="fellowship">
          <div className="fell-left">
            <div className="fell-tag">▲ VIZA Launchpad · 12-week program</div>
            <h2>
              Twelve weeks. One product team.
              <br />
              <em>One shot to ship something.</em>
            </h2>
            <p>
              Launchpad is our resident program for early-career engineers, PMs,
              and designers — the people who would otherwise need two more years
              of {"“"}experience{"”"} before getting a real swing.
            </p>
            <p>
              You{"’"}ll pair with senior leads, own a real product surface
              from kick-off to release, and walk out with something that
              millions of people will use. Returns full-time offer for ~60% of
              the cohort.
            </p>

            <div className="fell-meta">
              <div className="m">
                <span className="k">Duration</span>
                <span className="v">12 weeks</span>
              </div>
              <div className="m">
                <span className="k">Location</span>
                <span className="v">In-office, any HQ</span>
              </div>
              <div className="m">
                <span className="k">Stipend</span>
                <span className="v">Above-market</span>
              </div>
              <div className="m">
                <span className="k">Next cohort</span>
                <span className="v">Sep 2026</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <a className="btn-hero-primary" href="#">
                Apply to Launchpad
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
              <a className="btn-hero-ghost" href="#">
                Read about the 2025 cohort
              </a>
            </div>
          </div>
          <div className="fell-right">
            <div className="ps-card ps-c1">
              <div className="k">2024 · Engineering</div>
              <h4>OCR pipeline rewrite</h4>
              <div className="progress">
                <div className="bar" style={{ width: "92%" }}></div>
              </div>
              <div className="ps-meta">
                <span>Shipped to prod</span>
                <span>3.2× faster</span>
              </div>
            </div>
            <div className="ps-card ps-c2">
              <div className="k">2025 · Design</div>
              <h4>Schengen flow redesign</h4>
              <div className="progress">
                <div className="bar" style={{ width: "78%" }}></div>
              </div>
              <div className="ps-meta">
                <span>14 countries live</span>
                <span>↑ 22% conv.</span>
              </div>
            </div>
            <div className="ps-card ps-c3">
              <div className="k">2025 · Product</div>
              <h4>Embassy-slot scheduler</h4>
              <div className="progress">
                <div className="bar" style={{ width: "64%" }}></div>
              </div>
              <div className="ps-meta">
                <span>9 embassies</span>
                <span>40k slots/mo</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= BENEFITS ============================= */}
      <section className="section" id="benefits">
        <div className="sec-head">
          <div className="sec-eyebrow">We{"’"}ve got you (for real)</div>
          <h2>
            The boring stuff,
            <br />
            handled properly.
          </h2>
          <p>
            We don{"’"}t think benefits are a perk. They{"’"}re the
            baseline that lets people do their best work. Here{"’"}s what
            every VIZA employee gets, in every office, on day one.
          </p>
        </div>

        <div className="benefits-grid">
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <h4>Comprehensive health, sorted.</h4>
            <p>
              Full medical, dental, and vision from your first day — for you,
              your partner, and your kids. We pay the premium, no deductible
              games.
            </p>
          </div>
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h4>Build wealth, not just salary.</h4>
            <p>
              Above-market base in every market we hire, plus a generous equity
              grant tied to milestones — not just years served. We refresh every
              two years.
            </p>
          </div>
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <h4>Learn what actually matters.</h4>
            <p>
              $2,000/yr learning budget, monthly internal teach-ins, and time on
              the calendar — not just permission — to take that course or attend
              that conference.
            </p>
          </div>
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 3h20" />
                <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
                <path d="m7 21 5-5 5 5" />
              </svg>
            </div>
            <h4>Delight customers like it{"’"}s your money.</h4>
            <p>
              Every applicant gets a $100 budget for goodwill above and beyond.
              No approval, no escalation — fix it, then write up what happened.
            </p>
          </div>
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9 9c.4-1.3 1.6-2 3-2s2.6.7 3 2" />
                <line x1="9" y1="14" x2="9.01" y2="14" />
                <line x1="15" y1="14" x2="15.01" y2="14" />
              </svg>
            </div>
            <h4>Mind &gt; everything.</h4>
            <p>
              Confidential, professional mental-health support, no insurance
              hoops. Plus three {"“"}no-meeting{"”"} days a month,
              company-wide.
            </p>
          </div>
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z" />
              </svg>
            </div>
            <h4>Travel perks (we had to).</h4>
            <p>
              We do visas; our team should travel on the house. $4k/yr travel
              credit, plus VIZA handles every visa you{"’"}d ever need —
              instantly, internally.
            </p>
          </div>
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h4>Generous, real time off.</h4>
            <p>
              30 days PTO, plus your country{"’"}s holidays, plus a paid
              week off between Dec 24 and Jan 1. We track usage and nudge people
              to take more, not less.
            </p>
          </div>
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 11H5a2 2 0 0 0-2 2v7h6v-7a2 2 0 0 0-2-2zM19 7h-4a2 2 0 0 0-2 2v11h6V9a2 2 0 0 0-2-2z" />
                <path d="M9 11V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h4>Equipment, no questions.</h4>
            <p>
              Pick your laptop, monitor, and chair on day one. WFH stipend for
              your setup. We trust you to know what you need to do good work.
            </p>
          </div>
          <div className="benefit">
            <div className="ic">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h4>Parental leave that actually works.</h4>
            <p>
              20 weeks for primary caregivers, 12 for secondary, fully paid.
              Plus a phased return, so you{"’"}re not back at full throttle
              on day one.
            </p>
          </div>
        </div>
      </section>

      {/* ============================= OFFICES ============================= */}
      <section className="offices" id="offices">
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">Where we work</div>
            <h2>Four offices, one product.</h2>
            <p>
              We hire close to embassies, partners, and the markets we serve.
              Every office has both engineers and operations — we don
              {"’"}t separate the teams that build from the ones who run
              the floor.
            </p>
          </div>

          <div className="office-cards">
            <div className="office-card">
              <div className="card-img">
                <div className="ph-stripes"></div>
                <div className="ph-label">photo · singapore HQ</div>
                <div className="card-flag"><CircleFlag countryCode="sg" height={28}/></div>
                <div className="card-roles">
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--brand-500)",
                    }}
                  ></span>
                  12 open
                </div>
              </div>
              <div className="body">
                <h4>Singapore</h4>
                <div className="addr">
                  1 Marina Boulevard, #20-01
                  <br />
                  Singapore 018989
                </div>
                <div className="meta">
                  <span className="tz">GMT+8 · 142 people</span>
                  <span className="since">HQ · since 2021</span>
                </div>
              </div>
            </div>

            <div className="office-card">
              <div className="card-img">
                <div className="ph-stripes"></div>
                <div className="ph-label">photo · san francisco</div>
                <div className="card-flag"><CircleFlag countryCode="us" height={28}/></div>
                <div className="card-roles">
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--brand-500)",
                    }}
                  ></span>
                  8 open
                </div>
              </div>
              <div className="body">
                <h4>San Francisco</h4>
                <div className="addr">
                  301 Mission Street
                  <br />
                  San Francisco, CA 94105
                </div>
                <div className="meta">
                  <span className="tz">PST · 78 people</span>
                  <span className="since">Since 2023</span>
                </div>
              </div>
            </div>

            <div className="office-card">
              <div className="card-img">
                <div className="ph-stripes"></div>
                <div className="ph-label">photo · dubai</div>
                <div className="card-flag"><CircleFlag countryCode="ae" height={28}/></div>
                <div className="card-roles">
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--brand-500)",
                    }}
                  ></span>
                  5 open
                </div>
              </div>
              <div className="body">
                <h4>Dubai</h4>
                <div className="addr">
                  M16 — Al Makateb Building,
                  <br />
                  Al Quoz 3, Sheikh Zayed Rd
                </div>
                <div className="meta">
                  <span className="tz">GMT+4 · 64 people</span>
                  <span className="since">Since 2023</span>
                </div>
              </div>
            </div>

            <div className="office-card">
              <div className="card-img">
                <div className="ph-stripes"></div>
                <div className="ph-label">photo · london</div>
                <div className="card-flag"><CircleFlag countryCode="gb" height={28}/></div>
                <div className="card-roles">
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--brand-500)",
                    }}
                  ></span>
                  3 open
                </div>
              </div>
              <div className="body">
                <h4>London</h4>
                <div className="addr">
                  Suite 203, Davina House,
                  <br />
                  137-149 Goswell Road, EC1V 7ET
                </div>
                <div className="meta">
                  <span className="tz">GMT · 56 people</span>
                  <span className="since">Since 2024</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= CTA STRIP ============================= */}
      <div className="cta-strip">
        <div>
          <h2>
            Don{"’"}t see your role,
            <br />
            but want in?
          </h2>
          <p>
            If you{"’"}ve got an unusual background and you think you
            {"’"}d help us move the world{"’"}s travelers faster, we
            want to hear from you. We{"’"}ve hired bus drivers, ex-embassy
            staff, and lawyers. We don{"’"}t have a type.
          </p>
        </div>
        <div className="right">
          <span className="lead">General application</span>
          <a
            className="btn-hero-primary"
            href="#"
            style={{
              color: "#fff",
              background: "var(--brand-500)",
            }}
          >
            Send us your story
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
          <span style={{ fontSize: "12px", color: "var(--fg-2)" }}>
            We reply within 7 days, even if it{"’"}s a no.
          </span>
        </div>
      </div>

      {/* ============================= FOOTER ============================= */}
      <footer className="site-foot" data-screen-label="Footer">
        <div className="foot-rule"></div>

        <div className="foot-main">
          <div className="foot-brand">
            <a className="foot-logo" href="/">
              <img src="/assets/viza-logo-black.svg" alt="VIZA" />
            </a>
            <p className="foot-tag">
              VIZA helps you plan, apply, and track visas seamlessly across the
              world.
            </p>
          </div>

          <div className="col-company">
            <h4 className="col-head">Company</h4>
            <ul className="col-list">
              <li>
                <a href="/careers">Careers</a>
              </li>
              <li>
                <a href="/contact">Contact</a>
              </li>
              <li>
                <a href="/security">Security</a>
              </li>
              <li>
                <a href="/refunds">Refunds Policy</a>
              </li>
              <li>
                <a href="/legal/privacy">Privacy</a>
              </li>
              <li>
                <a href="/legal/terms">Terms</a>
              </li>
            </ul>
          </div>

          <div className="col-products">
            <h4 className="col-head">Products</h4>
            <ul className="col-list">
              <li>
                <a href="/">Visa Requirements</a>
              </li>
              <li>
                <a href="#">Schengen Appointment Checker</a>
              </li>
              <li>
                <a href="#">Visa Photo Creator</a>
              </li>
              <li>
                <a href="#">VIZA Emergency Helpline</a>
              </li>
              <li>
                <a href="#">Student Visa</a>
              </li>
            </ul>
          </div>

          <div className="col-offices">
            <h4 className="col-head">Offices</h4>
            <ul className="col-list">
              <li>
                <a href="#offices">Singapore — HQ</a>
              </li>
              <li>
                <a href="#offices">San Francisco</a>
              </li>
              <li>
                <a href="#offices">Dubai</a>
              </li>
              <li>
                <a href="#offices">London</a>
              </li>
            </ul>
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
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </div>
        </div>
      </footer>
    </>
  );
}
