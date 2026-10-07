// Single source of truth for the agency identity shown across the website.
// To launch for another agency, edit this file plus the .env values (icons and logo read from here).

export const brand = {
  name: "Vatican Express",
  legalName: "Vatican Express Co. Ltd",
  monogram: "VE",
  descriptor: "Intercity Bus Travel",
  tagline: "Intercity Travel across Cameroon",
  siteUrl: (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ).replace(/\/+$/, ""),

  seo: {
    title: "Book Intercity Bus Tickets in Cameroon",
    description:
      "Reserve your seat online, pay with MTN Mobile Money or Orange Money and travel with a verified digital ticket. Daily bus departures across Cameroon.",
    keywords: [
      "bus tickets Cameroon",
      "Bamenda to Yaounde bus",
      "Bamenda to Douala bus",
      "intercity bus Cameroon",
      "online bus booking Cameroon",
    ],
  },

  hero: {
    eyebrow: "Intercity bus travel",
    title: "Travel Cameroon in comfort, booked in minutes.",
    subtitle:
      "Choose your seat, pay securely with Mobile Money and board with a verified digital ticket. No queues, no guesswork.",
  },

  support: {
    phone: "(+237) 677 00 00 00",
    phoneHref: "+237677000000",
    whatsapp: "237677000000",
    email: "support@vaticantravels.cm",
    hours: "Daily, 05:00 to 22:00",
  },

  headOffice: "Commercial Avenue, Bamenda, North West Region, Cameroon",
  about:
    "A licensed interurban passenger carrier connecting the North West, West, Littoral, Centre and South West regions with scheduled bus services.",

  payments: "MTN Mobile Money and Orange Money",
  boardingMinutes: 30,
  currency: "XAF",

  // Brand palette; injected as CSS variables by the root layout.
  colors: {
    primary: "#0c1b33",
    primaryDark: "#07122a",
    accent: "#c8942a",
    accentDark: "#8a6417",
    accentSoft: "#fbf4e4",
  },
} as const;
