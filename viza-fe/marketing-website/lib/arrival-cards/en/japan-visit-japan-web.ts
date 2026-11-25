import type { GuideContent } from "../types";

const guide: GuideContent = {
  title: "Visit Japan Web: How to Register and Get Your QR Code | VIZA",
  description: "Visit Japan Web guide: what it is, who should use it, how to register, the immigration and customs QR codes, and common mistakes. The service is free.",
  h1: "Visit Japan Web: how to register and get your QR code",
  lead: "Visit Japan Web is the Japanese government's free online service for immigration and customs steps. You register your trip before you fly, answer the customs questions, and show a QR code when you land. This guide explains what it covers, whether you must use it, how to set it up, and what to check.",
  glance: [
    { k: "What it is", v: "A free web service for immigration and customs steps in Japan" },
    { k: "Cost", v: "Free. A site that charges you is not the government service" },
    { k: "Is it required", v: "Recommended, not required. Paper forms are still available" },
    { k: "When", v: "Before you fly. Finish a day or more ahead to be safe" },
    { k: "Output", v: "QR codes for immigration and customs" },
    { k: "Official site", v: "vjw-lp.digital.go.jp" },
  ],
  sections: [
    {
      id: "what",
      heading: "What Visit Japan Web is",
      body: [
        "Visit Japan Web is run by Japan's Digital Agency. It lets you register your personal details and trip, complete the customs declaration online, and in many cases handle the immigration steps in advance. It then produces QR codes you show at the airport. Tax free shopping procedures can also be handled through the same account.",
        "It is a convenience layer, not an entry permit. It does not replace your passport, and it does not replace a visa if your nationality needs one. If you are checking whether you need a visa, read the Japan visa page first.",
      ],
    },
    {
      id: "who",
      heading: "Do you have to use it",
      body: [
        "No. Japan Customs recommends submitting declarations electronically through Visit Japan Web, but electronic submission is not required. Declaring your belongings is required for every passenger entering Japan, and paper declaration forms are available on the plane, on the ship or at customs.",
        "In practice most visitors use it because the QR code shortens the queue at major airports. Customs also runs electronic declaration gates, called e-Gates, at seven international airports, which work with the electronic declaration.",
      ],
    },
    {
      id: "exempt",
      heading: "Who can skip it",
      body: [
        "Because it is optional, anyone can skip Visit Japan Web and use the paper forms on arrival. Japanese citizens and residents can use it too, so it is not limited to visitors.",
        "If you skip it, you still need to declare any goods that must be declared, and you still go through immigration. You will fill in the paper forms in the aisle or at a desk, which takes longer than showing a code.",
      ],
    },
    {
      id: "when",
      heading: "When to register",
      body: [
        "Register before you fly. Some guides suggest finishing at least six hours before you land so the QR code is active, and most travellers do it a week or two before departure, once flights and the first hotel are booked. We could not confirm a fixed official deadline, so treat a day or more ahead as the safe rule.",
        "If your flight or hotel changes, update the trip. One traveller report says an old QR code stopped working after the booking was edited, so save a fresh screenshot after any change.",
      ],
    },
    {
      id: "need",
      heading: "What you need",
      body: ["Gather these before you start. The service asks for them across the registration and the customs declaration."],
      list: [
        "Your passport and its details.",
        "An email address, to create the account and receive a confirmation.",
        "Your arrival date, flight number and the airport you arrive at.",
        "The name and address of your first accommodation in Japan.",
        "Answers to the customs questions about money, goods you carry and prohibited items.",
        "Details of anyone travelling with you, if you register them under your account.",
      ],
    },
  ],
  steps: [
    { name: "Open the official page", text: "Go to vjw-lp.digital.go.jp, the Visit Japan Web landing page, and choose your language. Avoid any page that asks for payment." },
    { name: "Create your account", text: "Sign up with an email address and set a password. Keep the details somewhere safe, since you will log in again at the end." },
    { name: "Register your personal details", text: "Enter your name, date of birth, nationality and passport details. Copy them from the passport photo page." },
    { name: "Register your trip", text: "Add your arrival date, your flight number, the airport and your first night's accommodation in Japan." },
    { name: "Add companions", text: "If you are travelling as a family or group, add the other people to your account so that each person gets their own QR code. One guide reports a limit of ten companions, so check the current number on the site." },
    { name: "Complete the immigration and customs steps", text: "Start the immigration inspection and customs declaration procedures from your trip. Answer the customs questions honestly and check each answer." },
    { name: "Save your QR codes", text: "When you finish, the service shows QR codes for immigration and customs. Take screenshots, because airport networks can be slow. Do not assume the code replaces your passport." },
    { name: "Use them on arrival", text: "At immigration and at the customs area, scan or show the codes. Use an e-Gate if one is available at your airport. Keep your passport in hand throughout." },
  ],
  mistakes: [
    { title: "Paying a lookalike site", body: "Visit Japan Web is a free government service. A site that charges to register you is not it." },
    { title: "Thinking it is mandatory", body: "It is optional. Customs still requires a declaration, but the paper form on the plane works if you have not registered." },
    { title: "Changing the trip and keeping the old code", body: "After you edit a flight or hotel, open the trip again and save the new QR code." },
    { title: "Leaving it to the airport", body: "Registering in the arrivals hall on weak mobile data is slow. Do it at home on Wi Fi." },
    { title: "Forgetting a traveller", body: "Each person needs a record and a QR code. Add companions to your account before you finish." },
    { title: "Mixing up the entry steps and the visa", body: "Visit Japan Web does not apply for a visa. If your nationality needs one, apply for it separately first." },
  ],
  fees: [
    "Visit Japan Web is free. The government does not charge to register or to produce the QR codes, and none of the steps in this guide cost money on the official service.",
    "Unofficial sites sometimes rank for the name and ask for a fee for a free service. If a page asks for payment before you have created an account, leave it.",
    "VIZA is an independent service. We are not the Japanese government or the Digital Agency. If you use VIZA's form below, VIZA's service is free, and Visit Japan Web is free too.",
  ],
  faq: [
    { q: "What is Visit Japan Web?", a: "It is the Japanese government's free web service for immigration and customs steps. You register your trip and show QR codes when you arrive." },
    { q: "Is Visit Japan Web mandatory?", a: "No. Japan Customs recommends it, but electronic submission is not required. Paper forms are available on the plane, on the ship and at customs." },
    { q: "Is it free?", a: "Yes. It is a free government service. A site that charges you is not the official one." },
    { q: "When should I register?", a: "Before you fly. Most travellers register a week or two ahead. A day or more ahead is a safe minimum, and some guides suggest finishing six hours before landing." },
    { q: "Do I still need a visa?", a: "If your nationality needs one, yes. Visit Japan Web does not replace a visa. Singapore passport holders can enter Japan visa free for short visits." },
    { q: "Can I register my family?", a: "Yes. You can add companions to your account so that each person has a QR code. Check the current limit on the site." },
    { q: "What if I do not have a smartphone?", a: "You can use the paper forms on arrival, or have a printed or saved copy of the QR codes." },
    { q: "My flight changed. What now?", a: "Update the trip in your account and save the new QR code. An old code may not work after a change." },
    { q: "What are e-Gates?", a: "Electronic customs declaration gates at seven international airports. They work with the electronic declaration." },
    { q: "Does the QR code replace my passport?", a: "No. Carry your passport at all times." },
  ],
  sources: [
    { label: "Japan Customs, passengers", url: "https://www.customs.go.jp/english/summary/passenger.htm" },
    { label: "Digital Agency, Visit Japan Web landing page", url: "https://vjw-lp.digital.go.jp/en/" },
  ],
  reviewed: "Checked on 25 November 2026 against Japan Customs. The Digital Agency pages did not load for us, so the account steps, the companion limit and the timing advice come from travel guides. Check them on the official site.",
};

export default guide;
