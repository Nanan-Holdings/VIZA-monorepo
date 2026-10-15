export type Locale = "en" | "zh-CN";

export type Word = { text: string; start: number; end: number };
export type Caption = { text: string; start: number; end: number; words: Word[] };

export type HookProps = { kicker: string; lines: string[]; turn: string };
export type AcronymProps = { acronym: string; words: string[]; note?: string };
export type NotAProps = { struck: string; stamp: string; is: string; like?: string };
export type StatItem = { value: string; countTo?: number; prefix?: string; suffix?: string; label: string; struck?: string };
export type StatsProps = { title?: string; items: StatItem[] };
export type TimelinePoint = { label: string; note?: string; state: "slipped" | "target" };
export type TimelineProps = { title: string; points: TimelinePoint[]; caveat: string };
export type VerdictProps = { badge: string; headline: string; note: string };
export type CtaProps = { question: string; url: string; pill: string; disclaimer: string };

export type SceneSpec =
  | { kind: "hook"; start: number; end: number; beats: number[]; props: HookProps }
  | { kind: "acronym"; start: number; end: number; beats: number[]; props: AcronymProps }
  | { kind: "notA"; start: number; end: number; beats: number[]; props: NotAProps }
  | { kind: "stats"; start: number; end: number; beats: number[]; props: StatsProps }
  | { kind: "timeline"; start: number; end: number; beats: number[]; props: TimelineProps }
  | { kind: "verdict"; start: number; end: number; beats: number[]; props: VerdictProps }
  | { kind: "cta"; start: number; end: number; beats: number[]; props: CtaProps };

export type VideoSpec = {
  slug: string;
  locale: Locale;
  durationSec: number;
  voice: string; // path under public/
  music?: string;
  musicVolume?: number;
  topic: string; // small label in the brand bug, e.g. "EU · ETIAS"
  scenes: SceneSpec[];
  captions: Caption[];
};
