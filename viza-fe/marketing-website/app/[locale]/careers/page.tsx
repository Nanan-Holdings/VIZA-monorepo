"use client";

import { useState, type ReactNode } from "react";
import { CircleFlag } from "react-circle-flags";
import { useTranslations } from "next-intl";
import SiteNav from "@/components/SiteNav";
import "./careers.css";

// ---------------------------------------------------------------------------
// Structured data (display strings live in the `careers` message namespace)
// ---------------------------------------------------------------------------

const DEP_ORDER = ["eng", "design", "ops", "consult", "data", "gtm"] as const;
type Dep = (typeof DEP_ORDER)[number];
type LocKey = "sg" | "sf" | "ldn" | "dxb";

interface Role {
  id: string;
  dep: Dep;
  loc: LocKey;
}

const ROLES: Role[] = [
  { id: "backendPayments", dep: "eng", loc: "sg" },
  { id: "staffDocPipeline", dep: "eng", loc: "sf" },
  { id: "iosApplicant", dep: "eng", loc: "sg" },
  { id: "platformInfra", dep: "eng", loc: "sf" },
  { id: "frontendConsole", dep: "eng", loc: "sg" },
  { id: "emWeb", dep: "eng", loc: "ldn" },
  { id: "sre", dep: "eng", loc: "sg" },
  { id: "androidSenior", dep: "eng", loc: "sf" },
  { id: "leadEmbassy", dep: "eng", loc: "dxb" },

  { id: "productDesignerApplicant", dep: "design", loc: "sg" },
  { id: "brandDesigner", dep: "design", loc: "sf" },
  { id: "designLeadConsultant", dep: "design", loc: "sg" },

  { id: "headOpsMe", dep: "ops", loc: "dxb" },
  { id: "visaOpsSchengen", dep: "ops", loc: "ldn" },
  { id: "logistics", dep: "ops", loc: "sg" },
  { id: "processDocQa", dep: "ops", loc: "sf" },
  { id: "opsAnalyst", dep: "ops", loc: "sg" },

  { id: "consultSchengen", dep: "consult", loc: "ldn" },
  { id: "consultUs", dep: "consult", loc: "sf" },
  { id: "consultUae", dep: "consult", loc: "dxb" },
  { id: "consultStudent", dep: "consult", loc: "sg" },
  { id: "consultApac", dep: "consult", loc: "sg" },
  { id: "consultUk", dep: "consult", loc: "ldn" },

  { id: "dataScientist", dep: "data", loc: "sg" },
  { id: "mlOcr", dep: "data", loc: "sf" },

  { id: "perfMarketing", dep: "gtm", loc: "sg" },
  { id: "contentLead", dep: "gtm", loc: "sf" },
  { id: "lifecycleCrm", dep: "gtm", loc: "ldn" },
];

const BOARD_ROWS = [
  { code: "VZ·041", loc: "SG", statusClass: "status-board" },
  { code: "VZ·038", loc: "SF", statusClass: "status-open" },
  { code: "VZ·035", loc: "DXB", statusClass: "status-final" },
  { code: "VZ·033", loc: "LDN", statusClass: "status-open" },
] as const;

const VALUE_CARDS: { tone: string; icon: ReactNode }[] = [
  {
    tone: "tone-a",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    tone: "tone-b",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    tone: "tone-c",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15 15 0 0 1 0 20" />
        <path d="M12 2a15 15 0 0 0 0 20" />
      </svg>
    ),
  },
  {
    tone: "tone-d",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    tone: "tone-e",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h4l3-9 4 18 3-9h4" />
      </svg>
    ),
  },
  {
    tone: "",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
];

const BENEFIT_ICONS: ReactNode[] = [
  <svg key="health" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>,
  <svg key="wealth" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>,
  <svg key="learn" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>,
  <svg key="delight" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h20" />
    <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
    <path d="m7 21 5-5 5 5" />
  </svg>,
  <svg key="mind" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9 9c.4-1.3 1.6-2 3-2s2.6.7 3 2" />
    <line x1="9" y1="14" x2="9.01" y2="14" />
    <line x1="15" y1="14" x2="15.01" y2="14" />
  </svg>,
  <svg key="travel" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z" />
  </svg>,
  <svg key="pto" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>,
  <svg key="equipment" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11H5a2 2 0 0 0-2 2v7h6v-7a2 2 0 0 0-2-2zM19 7h-4a2 2 0 0 0-2 2v11h6V9a2 2 0 0 0-2-2z" />
    <path d="M9 11V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>,
  <svg key="parental" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>,
];

const FELL_PROJECTS = [
  { cls: "ps-c1", width: "92%" },
  { cls: "ps-c2", width: "78%" },
  { cls: "ps-c3", width: "64%" },
] as const;

const OFFICE_FLAGS = ["sg", "us", "ae", "gb"] as const;

// ---------------------------------------------------------------------------
// Copy shapes read via t.raw()
// ---------------------------------------------------------------------------

type BoardRowCopy = { role: string; sub: string; status: string };
type StatCopy = { value: string; suffix: string; label: string };
type BeliefCopy = { title: string; body: string };
type PhotoCopy = { label: string; mark: string };
type WorkCellCopy = { tag: string; title: string; body: string };
type ValueCardCopy = { title: string; body: string; kicker: string };
type MetaCopy = { k: string; v: string };
type ProjectCopy = { k: string; title: string; meta1: string; meta2: string };
type BenefitCopy = { title: string; body: string };
type OfficeCopy = {
  photo: string;
  open: string;
  name: string;
  addr1: string;
  addr2: string;
  tz: string;
  since: string;
};

export default function CareersPage() {
  const t = useTranslations("careers");

  const richTags = {
    br: () => <br />,
    em: (chunks: ReactNode) => <em>{chunks}</em>,
    u: (chunks: ReactNode) => <span className="underline">{chunks}</span>,
  };

  // --- Roles filtering ---
  const [activeDep, setActiveDep] = useState<"all" | Dep>("all");
  const filteredRoles =
    activeDep === "all" ? ROLES : ROLES.filter((r) => r.dep === activeDep);
  const groupOrder: readonly Dep[] =
    activeDep === "all" ? DEP_ORDER : [activeDep];
  const roleGroups = groupOrder
    .map((dep) => ({ dep, roles: filteredRoles.filter((r) => r.dep === dep) }))
    .filter((g) => g.roles.length > 0);

  const cities = t.raw("hero.cities") as string[];
  const boardRows = t.raw("board.rows") as BoardRowCopy[];
  const stats = t.raw("stats") as StatCopy[];
  const beliefs = t.raw("mission.beliefs") as BeliefCopy[];
  const valueCards = t.raw("values.cards") as ValueCardCopy[];
  const photos = t.raw("inside.photos") as PhotoCopy[];
  const workCells = t.raw("how.cells") as WorkCellCopy[];
  const fellMeta = t.raw("fellowship.meta") as MetaCopy[];
  const fellProjects = t.raw("fellowship.projects") as ProjectCopy[];
  const benefits = t.raw("benefits.items") as BenefitCopy[];
  const officeCards = t.raw("offices.cards") as OfficeCopy[];

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
              <span className="label">{t("hero.nowHiring")}</span>
              <span className="cities">
                {cities.map((city) => (
                  <span key={city}>{city}</span>
                ))}
              </span>
              <span className="sep">{t("hero.sep")}</span>
              <span>{t("hero.openRoles")}</span>
            </div>
            <h1>{t.rich("hero.title", richTags)}</h1>
            <p className="lead">{t("hero.lead")}</p>
            <div className="hero-ctas">
              <a className="btn-hero-primary" href="#roles">
                {t("hero.ctaRoles")}
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
                {t("hero.ctaWhy")}
              </a>
            </div>
          </div>

          <div className="board-wrap">
            <div className="board" role="img" aria-label={t("board.ariaLabel")}>
              <div className="board-head">
                <span>{t("board.head")}</span>
                <span className="live">{t("board.live")}</span>
              </div>
              <div className="board-cols">
                <span>{t("board.cols.req")}</span>
                <span>{t("board.cols.role")}</span>
                <span>{t("board.cols.office")}</span>
                <span>{t("board.cols.status")}</span>
              </div>
              {BOARD_ROWS.map((row, i) => (
                <div className="board-row" key={row.code}>
                  <div className="code">{row.code}</div>
                  <div className="role">
                    {boardRows[i].role}
                    <small>{boardRows[i].sub}</small>
                  </div>
                  <div className="loc">{row.loc}</div>
                  <div className={`status ${row.statusClass}`}>
                    {boardRows[i].status}
                  </div>
                </div>
              ))}
              <div className="board-foot">
                <span>{t("board.foot")}</span>
                <a href="#roles">{t("board.browseAll")}</a>
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
                <div className="lab">{t("board.chip1Label")}</div>
                <div>{t("board.chip1Value")}</div>
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
                <div className="lab">{t("board.chip2Label")}</div>
                <div>{t("board.chip2Value")}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-stats">
          {stats.map((s) => (
            <div className="hstat" key={s.label}>
              <div className="v">
                {s.value}
                {s.suffix ? <small>{s.suffix}</small> : null}
              </div>
              <div className="k">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= MISSION ============================= */}
      <section className="mission" id="mission">
        <div className="section">
          <div className="mission-grid">
            <div className="left">
              <div className="sec-eyebrow">{t("mission.eyebrow")}</div>
              <h2>{t.rich("mission.title", richTags)}</h2>
              <p className="kicker">{t("mission.kicker1")}</p>
              <p className="kicker">{t("mission.kicker2")}</p>
              <div className="signature">
                <div className="avatar">{t("mission.founderInitials")}</div>
                <div className="who">
                  {t("mission.founderName")}
                  <small>{t("mission.founderRole")}</small>
                </div>
              </div>
            </div>

            <div className="right">
              {beliefs.map((b, i) => (
                <div className="belief" key={b.title}>
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h4>{b.title}</h4>
                    <p>{b.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================= VALUES ============================= */}
      <section className="section" id="values">
        <div className="sec-head">
          <div className="sec-eyebrow">{t("values.eyebrow")}</div>
          <h2>{t("values.title")}</h2>
          <p>{t("values.lead")}</p>
        </div>

        <div className="values-grid">
          {VALUE_CARDS.map((card, i) => (
            <div
              className={card.tone ? `value-card ${card.tone}` : "value-card"}
              key={valueCards[i].title}
            >
              <div className="value-glyph">{card.icon}</div>
              <h3>{valueCards[i].title}</h3>
              <p>{valueCards[i].body}</p>
              <div className="kicker">{valueCards[i].kicker}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= INSIDE ============================= */}
      <section className="inside" id="inside">
        <div className="section" style={{ paddingBottom: "80px" }}>
          <div className="sec-head">
            <div className="sec-eyebrow">{t("inside.eyebrow")}</div>
            <h2>{t.rich("inside.title", richTags)}</h2>
            <p>{t("inside.lead")}</p>
          </div>

          <div className="photo-row">
            {photos.slice(0, 3).map((p) => (
              <div className="photo" key={p.label}>
                <div className="ph-stripes"></div>
                <div className="ph-label">{p.label}</div>
                <div className="ph-mark">{p.mark}</div>
              </div>
            ))}
          </div>
          <div className="photo-row r2">
            {photos.slice(3).map((p) => (
              <div className="photo" key={p.label}>
                <div className="ph-stripes"></div>
                <div className="ph-label">{p.label}</div>
                <div className="ph-mark">{p.mark}</div>
              </div>
            ))}
          </div>

          <div className="inside-words">
            <div>
              <p className="pull">{t("inside.pull")}</p>
              <p
                style={{
                  marginTop: "20px",
                  color: "var(--fg-2)",
                  fontSize: "14px",
                }}
              >
                {t("inside.pullBy")}
              </p>
            </div>
            <div>
              <p>{t("inside.para1")}</p>
              <p>{t("inside.para2")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= HOW WE WORK ============================= */}
      <section className="section" id="how">
        <div className="sec-head">
          <div className="sec-eyebrow">{t("how.eyebrow")}</div>
          <h2>{t("how.title")}</h2>
          <p>{t("how.lead")}</p>
        </div>

        <div className="work-grid">
          {workCells.map((cell) => (
            <div className="work-cell" key={cell.tag}>
              <span className="tag">{cell.tag}</span>
              <h3>{cell.title}</h3>
              <p>{cell.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= ROLES ============================= */}
      <section className="roles" id="roles">
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">{t("roles.eyebrow")}</div>
            <h2>{t("roles.title")}</h2>
            <p>{t("roles.lead")}</p>
          </div>

          <div className="role-tabs" id="roleTabs">
            <button
              className={activeDep === "all" ? "role-tab active" : "role-tab"}
              data-dep="all"
              onClick={() => setActiveDep("all")}
            >
              {t("roles.allDepartments")}{" "}
              <span className="cnt">{ROLES.length}</span>
            </button>
            {DEP_ORDER.map((dep) => (
              <button
                key={dep}
                className={activeDep === dep ? "role-tab active" : "role-tab"}
                data-dep={dep}
                onClick={() => setActiveDep(dep)}
              >
                {t(`roles.deps.${dep}`)}{" "}
                <span className="cnt">
                  {ROLES.filter((r) => r.dep === dep).length}
                </span>
              </button>
            ))}
          </div>

          <div className="role-toolbar">
            <div className="left">
              {t.rich("roles.showing", {
                count: filteredRoles.length,
                strong: (chunks) => <strong id="roleCount">{chunks}</strong>,
              })}
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
              {t("roles.anyLocation")}
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

          <div id="roleList">
            {roleGroups.map((group) => (
              <div className="role-group" key={group.dep}>
                <h3>
                  {t(`roles.deps.${group.dep}`)}{" "}
                  <span className="grp-cnt">
                    {t("roles.groupCount", { count: group.roles.length })}
                  </span>
                </h3>
                {group.roles.map((role) => (
                  <a className="role-row" href="/apply" key={role.id}>
                    <div className="title-block">
                      <div className="pos">{t(`roles.jobs.${role.id}`)}</div>
                      <div className="pos-sub">
                        {t("roles.posSub", {
                          team: t(`roles.deps.${role.dep}`),
                        })}
                      </div>
                    </div>
                    <div className="role-cell">
                      <small>{t("roles.locationLabel")}</small>
                      <span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            display: "inline-block",
                            verticalAlign: "-2px",
                          }}
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>{" "}
                        {t(`roles.locations.${role.loc}`)}
                      </span>
                    </div>
                    <div className="role-cell">
                      <small>{t("roles.typeLabel")}</small>
                      <span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            display: "inline-block",
                            verticalAlign: "-2px",
                          }}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>{" "}
                        {t("roles.fullTime")}
                      </span>
                    </div>
                    <span className="role-cta">
                      {t("roles.viewRole")}
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
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================= FELLOWSHIP ============================= */}
      <section className="section" id="fellowship" style={{ paddingTop: 0 }}>
        <div className="fellowship">
          <div className="fell-left">
            <div className="fell-tag">{t("fellowship.tag")}</div>
            <h2>{t.rich("fellowship.title", richTags)}</h2>
            <p>{t("fellowship.para1")}</p>
            <p>{t("fellowship.para2")}</p>

            <div className="fell-meta">
              {fellMeta.map((m) => (
                <div className="m" key={m.k}>
                  <span className="k">{m.k}</span>
                  <span className="v">{m.v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <a className="btn-hero-primary" href="#">
                {t("fellowship.apply")}
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
                {t("fellowship.readCohort")}
              </a>
            </div>
          </div>
          <div className="fell-right">
            {FELL_PROJECTS.map((proj, i) => (
              <div className={`ps-card ${proj.cls}`} key={proj.cls}>
                <div className="k">{fellProjects[i].k}</div>
                <h4>{fellProjects[i].title}</h4>
                <div className="progress">
                  <div className="bar" style={{ width: proj.width }}></div>
                </div>
                <div className="ps-meta">
                  <span>{fellProjects[i].meta1}</span>
                  <span>{fellProjects[i].meta2}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================= BENEFITS ============================= */}
      <section className="section" id="benefits">
        <div className="sec-head">
          <div className="sec-eyebrow">{t("benefits.eyebrow")}</div>
          <h2>{t.rich("benefits.title", richTags)}</h2>
          <p>{t("benefits.lead")}</p>
        </div>

        <div className="benefits-grid">
          {benefits.map((benefit, i) => (
            <div className="benefit" key={benefit.title}>
              <div className="ic">{BENEFIT_ICONS[i]}</div>
              <h4>{benefit.title}</h4>
              <p>{benefit.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= OFFICES ============================= */}
      <section className="offices" id="offices">
        <div className="section">
          <div className="sec-head">
            <div className="sec-eyebrow">{t("offices.eyebrow")}</div>
            <h2>{t("offices.title")}</h2>
            <p>{t("offices.lead")}</p>
          </div>

          <div className="office-cards">
            {officeCards.map((office, i) => (
              <div className="office-card" key={office.name}>
                <div className="card-img">
                  <div className="ph-stripes"></div>
                  <div className="ph-label">{office.photo}</div>
                  <div className="card-flag">
                    <CircleFlag countryCode={OFFICE_FLAGS[i]} height={28} />
                  </div>
                  <div className="card-roles">
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "var(--brand-500)",
                      }}
                    ></span>
                    {office.open}
                  </div>
                </div>
                <div className="body">
                  <h4>{office.name}</h4>
                  <div className="addr">
                    {office.addr1}
                    <br />
                    {office.addr2}
                  </div>
                  <div className="meta">
                    <span className="tz">{office.tz}</span>
                    <span className="since">{office.since}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================= CTA STRIP ============================= */}
      <div className="cta-strip">
        <div>
          <h2>{t.rich("ctaStrip.title", richTags)}</h2>
          <p>{t("ctaStrip.body")}</p>
        </div>
        <div className="right">
          <span className="lead">{t("ctaStrip.lead")}</span>
          <a
            className="btn-hero-primary"
            href="#"
            style={{
              color: "#fff",
              background: "var(--brand-500)",
            }}
          >
            {t("ctaStrip.cta")}
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
            {t("ctaStrip.note")}
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
            <p className="foot-tag">{t("footer.tagline")}</p>
          </div>

          <div className="col-company">
            <h4 className="col-head">{t("footer.company")}</h4>
            <ul className="col-list">
              <li>
                <a href="/careers">{t("footer.careers")}</a>
              </li>
              <li>
                <a href="/contact">{t("footer.contact")}</a>
              </li>
              <li>
                <a href="/security">{t("footer.security")}</a>
              </li>
              <li>
                <a href="/refunds">{t("footer.refunds")}</a>
              </li>
              <li>
                <a href="/legal/privacy">{t("footer.privacy")}</a>
              </li>
              <li>
                <a href="/legal/terms">{t("footer.terms")}</a>
              </li>
            </ul>
          </div>

          <div className="col-products">
            <h4 className="col-head">{t("footer.products")}</h4>
            <ul className="col-list">
              <li>
                <a href="/">{t("footer.prodVisaReq")}</a>
              </li>
              <li>
                <a href="#">{t("footer.prodSchengen")}</a>
              </li>
              <li>
                <a href="#">{t("footer.prodPhoto")}</a>
              </li>
              <li>
                <a href="#">{t("footer.prodHelpline")}</a>
              </li>
              <li>
                <a href="#">{t("footer.prodStudent")}</a>
              </li>
            </ul>
          </div>

          <div className="col-offices">
            <h4 className="col-head">{t("footer.offices")}</h4>
            <ul className="col-list">
              <li>
                <a href="#offices">{t("footer.officeSf")}</a>
              </li>
              <li>
                <a href="#offices">{t("footer.officeSg")}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="foot-rule"></div>

        <div className="foot-bottom">
          <div className="legal">
            <span>{t("footer.copyright")}</span>
            <span className="sep"></span>
            <a href="#">{t("footer.privacy")}</a>
            <span className="sep"></span>
            <a href="#">{t("footer.terms")}</a>
          </div>
          <div className="foot-mark">
            <img src="/assets/viza-logo-black.svg" alt="VIZA" />
          </div>
        </div>
      </footer>
    </>
  );
}
