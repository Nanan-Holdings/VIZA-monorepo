import type { GuideContent } from "../types";

const guide: GuideContent = {
  title: "All Indonesia Arrival Card: How to Fill It Online | VIZA",
  description: "All Indonesia arrival card guide: what it covers, who fills it in, the 3 day window, step by step instructions and common mistakes. Free, and not a visa.",
  h1: "All Indonesia arrival card: how to fill it in online",
  lead: "All Indonesia is Indonesia's official platform for digital arrival reporting. You fill in one online card before you travel, and it covers immigration, customs and health. It is free, and it is not a visa. This guide explains who uses it, when to submit it, what to prepare and how to avoid the common mistakes.",
  glance: [
    { k: "What it is", v: "Indonesia's online arrival card, a web platform and app" },
    { k: "Cost", v: "Free. Pay nothing to a third party" },
    { k: "When", v: "Up to 3 days before your arrival date" },
    { k: "Covers", v: "Immigration, customs and health declarations" },
    { k: "Not a visa", v: "You still need a visa or visa free entry" },
    { k: "Official site", v: "allindonesia.imigrasi.go.id" },
  ],
  sections: [
    {
      id: "what",
      heading: "What All Indonesia is",
      body: [
        "All Indonesia is a digital arrival card for people entering Indonesia. It brings together the arrival, customs and health information that used to be filled in on paper, and it helps with customs clearance. You complete it on the website or the app, and you receive a QR code to show on arrival.",
        "It is a declaration, not an entry permit. You still need a valid visa, an e-VOA or visa free entry, depending on your nationality. If you are working out which one applies, read the Indonesia visa page first.",
      ],
    },
    {
      id: "who",
      heading: "Who has to fill it in",
      body: [
        "The Indonesia tourism site describes the app as designed for foreign visitors and for Indonesian citizens returning from overseas, for individuals and for groups. Press coverage describes it as mandatory for everyone entering Indonesia since September 2025. We could not read the portal's own rules, so confirm them on the official site.",
        "Each traveller needs a card. Families and groups can complete cards together, and a parent completes it for a child.",
      ],
    },
    {
      id: "exempt",
      heading: "Who is exempt",
      body: [
        "We found no published list of exemptions on the pages we could read. Assume every traveller entering Indonesia needs a card, including visa free visitors.",
        "Some guides say a few airports and seaports may still use the older customs form, known as e-CD, at ecd.beacukai.go.id, instead of or as well as All Indonesia. Check the arrival information for your airport and your airline's advice before you fly.",
      ],
    },
    {
      id: "when",
      heading: "When to submit",
      body: [
        "You can complete the card up to three days before your arrival date. File it once your flight is fixed, ideally the day before you fly, so the details are fresh and the QR code is ready.",
        "Do it at home on a stable connection. Airport networks can drop when you are standing in the immigration hall.",
      ],
    },
    {
      id: "need",
      heading: "What you need",
      body: ["The tourism site says to gather your passport number, flight details, arrival schedule and travel information. In practice have the items below ready."],
      list: [
        "Your passport, with the number, expiry date and your name as printed.",
        "Your flight number, arrival date and the airport or port you arrive at.",
        "Your accommodation name and address in Indonesia, such as a hotel in Bali or Jakarta.",
        "An email address and phone number.",
        "Details of items you carry that need customs declaration, such as large amounts of cash or goods for sale.",
        "Your visa or e-VOA details, if you have one.",
      ],
    },
  ],
  steps: [
    { name: "Open the official site", text: "Go to allindonesia.imigrasi.go.id on your phone or laptop. The site supports Indonesian, English and Mandarin." },
    { name: "Start a new arrival card", text: "Choose to complete an arrival card as a foreign visitor." },
    { name: "Enter passport details", text: "Fill in your name, passport number and dates. Check that they match the passport photo page." },
    { name: "Enter your trip", text: "Add your flight details and arrival date. Make sure the date falls inside the three day window." },
    { name: "Add accommodation and contact details", text: "Enter where you will stay and an email address and phone number." },
    { name: "Complete customs and health questions", text: "Answer the customs and health questions honestly, and declare anything that must be declared." },
    { name: "Review and submit", text: "Check your name, passport number and dates once more, then submit. Keep a stable internet connection while you do." },
    { name: "Save your QR code", text: "Take a screenshot of the QR code and proof of submission. Show it on arrival if you are asked, with your passport and visa documents." },
  ],
  mistakes: [
    { title: "Paying an unofficial site", body: "All Indonesia is free. If a website asks you to pay, it is suspicious." },
    { title: "Thinking it is a visa", body: "It is a declaration. You still need a visa, an e-VOA or visa free entry for your nationality." },
    { title: "Wrong dates or passport number", body: "Check your name, passport number and dates before you submit. A mismatch slows you down." },
    { title: "Filing too early", body: "The window is three days before arrival." },
    { title: "Not saving the QR code", body: "Save a screenshot. Mobile data can be slow at the airport." },
    { title: "Skipping customs questions", body: "Declare cash and goods that must be declared. Wrong answers can lead to penalties." },
  ],
  fees: [
    "All Indonesia is free. Several sources describe the registration as free of charge, and the official site does not ask for money.",
    "Unofficial websites and agents may charge to complete the card for you. You do not need that. Start from allindonesia.imigrasi.go.id.",
    "VIZA is an independent service. We are not the Indonesian government or the Directorate General of Immigration. VIZA does not offer a filling service for this card yet, so this guide links to the official site only.",
  ],
  faq: [
    { q: "What is the All Indonesia arrival card?", a: "It is Indonesia's online arrival card on the All Indonesia platform. It covers immigration, customs and health details." },
    { q: "Is it free?", a: "Yes. It is free on the official site. Treat any site that asks for payment as suspicious." },
    { q: "How early can I submit it?", a: "Up to three days before your arrival date." },
    { q: "Is it a visa?", a: "No. You still need a visa, an e-VOA or visa free entry, depending on your nationality." },
    { q: "Do I need it if I am visa free?", a: "Assume yes. We found no exemption on the pages we read, so complete it for every trip." },
    { q: "Does it replace the customs form?", a: "It covers customs declaration on the platform. Some entry points may still use the older e-CD form, so check your airport's arrival information." },
    { q: "Which languages does it support?", a: "Indonesian, English and Mandarin." },
    { q: "Do I need to print it?", a: "No. Save a screenshot of the QR code and proof of submission on your phone." },
    { q: "Does the Bali tourist levy go through All Indonesia?", a: "The Bali levy is separate. It is not part of the arrival card or the visa." },
    { q: "Can I save my details for later trips?", a: "The platform saves passport and flight details for auto fill on future trips." },
  ],
  sources: [
    { label: "Indonesia Travel, All Indonesia app", url: "https://www.indonesia.travel/kr/en/general-information/all-indonesia-app" },
    { label: "Directorate General of Immigration, All Indonesia", url: "https://allindonesia.imigrasi.go.id" },
  ],
  reviewed: "Checked on 25 November 2026 against the Indonesia tourism site and press. The portal's own rules and exemptions were not readable, so they are unconfirmed. Check allindonesia.imigrasi.go.id before you travel.",
};

export default guide;
