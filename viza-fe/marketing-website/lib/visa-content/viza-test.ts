import type { VisaContent } from "./types";

/**
 * VIZA Test checkout — a free, live walkthrough of the real application flow.
 *
 * This is NOT a visa product: it exercises the same rich page template,
 * application wizard, and checkout rails as a real destination so the team
 * (and curious users) can try the end-to-end experience without paying.
 * Keep the copy honest about being a demo — no invented government facts.
 */
export const vizaTest: VisaContent = {
  slug: "viza-test",

  heroTitle: "VIZA Test checkout",
  heroTitleSuffix: "a free live demo of the real flow",
  lede: "Walk through the exact application experience we use for real visas — document upload, consultant review, live status tracking — free, with no visa issued at the end.",
  heroImage: "/assets/heroes/japan.jpg",
  meta: [
    { k: "Type", v: "Demo" },
    { k: "Length", v: "~3 minutes" },
    { k: "Validity", v: "Demo only" },
    { k: "Cost", v: "Free" },
  ],
  tags: [
    { icon: "bolt", label: "Instant · no waiting" },
    { icon: "shield", label: "No charge, ever" },
    { icon: "doc", label: "No real documents needed" },
  ],

  overviewTitle: "The test flow, at a glance",
  overviewSub:
    "Everything behaves like a real application — the forms, the tracking, the notifications — except nothing is filed and nothing is charged.",
  glance: [
    { icon: "globe", k: "What it is", v: "Live product demo", sub: "The same pages real applicants use" },
    { icon: "clock", k: "Time to complete", v: "About 3 minutes", sub: "Start to finish" },
    { icon: "currency", k: "Price", v: "Free", sub: "No card required to explore" },
    { icon: "pin", k: "What you get", v: "A feel for VIZA", sub: "Before applying for a real visa" },
  ],

  processTitle: "How the test run works",
  processSub:
    "The same four steps as a real application — compressed into a few minutes so you can see each stage.",
  steps: [
    {
      title: "Start the test application",
      body: "Fill the same wizard real applicants use. Use sample details — nothing is sent to any government system.",
    },
    {
      title: "See the review stage",
      body: "Watch how a VIZA consultant would verify your documents and flag issues before submission.",
    },
    {
      title: "Follow live tracking",
      body: "The status timeline updates the way a real application would, so you know what to expect on a real order.",
      statusRows: [
        { label: "Test application received", ts: "Just now", onTime: true },
        { label: "Demo review completed", ts: "Moments later", onTime: true },
        { label: "Demo delivery", ts: "In progress" },
      ],
    },
    {
      title: "Finish — nothing issued, nothing charged",
      body: "You reach the same delivery screen as a real order. When you're ready, pick a real destination and apply for the real thing.",
      delivered: true,
    },
  ],

  docsTitle: "What you need",
  docsSub: "Nothing real. The test flow accepts sample uploads so you can try every step.",
  documents: [
    { name: "Any sample photo or PDF", sub: "Stands in for the passport scan" },
    { name: "An email address", sub: "To see the notifications you'd receive" },
  ],

  rejectionTitle: "What the test can't do",
  rejectionSub: "A few honest limits, so there are no surprises.",
  rejectionReasons: [
    { title: "No visa is issued", body: "The demo never files anything with any government — it exists purely to show you the experience." },
    { title: "No consultant is assigned", body: "The review stage is simulated. On a real order, a named VIZA consultant checks every field." },
    { title: "Demo data is discarded", body: "Sample uploads and details from test runs are not kept as part of any application record." },
  ],

  entryTitle: "After the test",
  entrySub:
    "When you've seen the flow, pick a real destination — the application you just tried is exactly what you'll use.",
  entryExit: [
    { icon: "refresh", k: "Repeatable", v: "Unlimited", sub: "Run the demo as often as you like" },
    { icon: "clock", k: "Ready to go real?", v: "2 minutes", sub: "Your details carry into a real application" },
  ],

  extensionTitle: "Trying a real application",
  extensionSub:
    "Real applications add exactly two things to what you just saw: a real consultant, and a real government filing — with our on-time guarantee.",
  extension: [
    { icon: "extend", k: "Real destinations", v: "17 countries", sub: "And growing" },
    { icon: "shield", k: "On-time guarantee", v: "Money back", sub: "If we miss the promised date" },
  ],

  reviews: {
    score: "4.5",
    outOf: "/ 5",
    sub: "Highest rated visa platform in Singapore · 12,841 reviews",
    platforms: [
      { rating: "4.6", name: "Trustpilot" },
      { rating: "4.7", name: "App Store" },
    ],
    items: [
      {
        initials: "PL",
        name: "Priya Lim",
        source: "Trustpilot · 3 days ago",
        title: "Tried the demo, then booked for real",
        body: "Ran the test checkout on my lunch break to see what the fuss was about. Applied for my Bali e-VOA the same evening.",
      },
      {
        initials: "SK",
        name: "Samuel Koh",
        source: "App Store · 1 week ago",
        title: "Good way to see the tracking",
        body: "The live status timeline sold me — you can see every hop instead of refreshing a government portal and hoping.",
      },
    ],
  },

  faqSub:
    "Can't find an answer? Ask the AI assistant at the bottom of this page or message the VIZA team.",
  faq: [
    {
      category: "About the test",
      q: "Is the test checkout really free?",
      a: "Yes — completely free. It exists so you can experience the VIZA application flow end-to-end before trusting us with a real visa.",
    },
    {
      category: "About the test",
      q: "Do I get anything at the end?",
      a: "You reach the same delivery screen a real applicant sees, so you know exactly what to expect. No visa or document is issued — it's a demo.",
    },
    {
      category: "About the test",
      q: "Is my sample data kept?",
      a: "Demo runs are not part of any application record. When you start a real application, you enter your real details fresh.",
    },
    {
      category: "Going real",
      q: "How do I apply for a real visa afterwards?",
      a: "Pick any destination from the explore page — the wizard is the one you just used. Real applications include a named consultant, a real government filing, and our on-time guarantee.",
    },
  ],

  sources: [
    { label: "VIZA destinations", url: "/", display: "viza.it.com" },
    { label: "How VIZA reviews applications", url: "/security", display: "viza.it.com/security" },
  ],

  price: {
    etaLabel: "Start now, finish in",
    etaValue: "About 3 minutes",
    title: "Test checkout · live demo",
    saving: "Free",
    sub: "The full application experience with nothing charged and nothing filed.",
    foot: "The test flow is free. Real applications are charged only at their own checkout, backed by our on-time guarantee.",
  },

  aiPlaceholder: "Ask anything about how VIZA works — flow, tracking, pricing…",
};

export default vizaTest;
