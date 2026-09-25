export type ServiceBadge = "NEW" | "HOT" | null;

export interface ServiceSeed {
  slug: string;
  title: string;
  badge: ServiceBadge;
  href: string | null;
  order: number;
}

export interface CategorySeed {
  slug: string;
  title: string;
  note?: string;
  order: number;
  items: ServiceSeed[];
}

function buildItems(
  categorySlug: string,
  items: { title: string; badge?: ServiceBadge; href?: string | null }[]
): ServiceSeed[] {
  return items.map((item, index) => ({
    slug: `${categorySlug}-${index + 1}`,
    title: item.title,
    badge: item.badge ?? null,
    href: item.href ?? null,
    order: index,
  }));
}

export const HOME_CATEGORIES: CategorySeed[] = [
  {
    slug: "essential-services",
    title: "Essential & Services",
    order: 0,
    items: buildItems("essential-services", [
      { title: "Latest Jobs", badge: "NEW", href: "/jobs" },
      { title: "Mock Test", badge: "NEW" },
      { title: "ID Card Print", badge: "NEW", href: "/tools/id-card-print" },
      { title: "PVC Auto Crop", badge: "NEW" },
      { title: "Auto Print", badge: "NEW" },
      { title: "Passport Photo", href: "/tools/passport-photo" },
      { title: "Photo Crop And Resize", href: "/tools/photo-crop-resize" },
      { title: "Resume/CV", href: "/tools/resume-maker" },
      { title: "New Service Post", badge: "NEW" },
      { title: "Payment Lock QR", badge: "HOT" },
      { title: "Document Album", badge: "NEW" },
    ]),
  },
  {
    slug: "creative-design-studio",
    title: "Creative Design Studio",
    order: 1,
    items: buildItems("creative-design-studio", [
      { title: "Pro Resume Maker", badge: "NEW", href: "/tools/pro-resume-maker" },
      { title: "Marriage Biodata", badge: "NEW" },
      { title: "Pro ID Maker", badge: "NEW" },
      { title: "Pro Poster Maker", badge: "NEW" },
      { title: "Application Maker", badge: "NEW" },
      { title: "Shop Promotion Maker", badge: "NEW" },
    ]),
  },
  {
    slug: "smart-pdf-image-tools",
    title: "Smart PDF & Image Tools",
    order: 2,
    items: buildItems("smart-pdf-image-tools", [
      { title: "JPG To PDF", href: "/tools/jpg-to-pdf" },
      { title: "PDF To JPG", href: "/tools/pdf-to-jpg" },
      { title: "PNG To PDF", href: "/tools/png-to-pdf" },
      { title: "PNG To JPG", href: "/tools/png-to-jpg" },
      { title: "Delete PDF Page", href: "/tools/delete-pdf-page" },
      { title: "Merge PDF", href: "/tools/merge-pdf" },
    ]),
  },
  {
    slug: "portal-service",
    title: "Portal Service",
    note: "Government and public utility portals — informational links.",
    order: 3,
    items: buildItems("portal-service", [
      { title: "Census Of India (भारत की जनगणना)" },
      { title: "Aadhar Beta Service" },
      { title: "Aadhaar Information (UIDAI Link)" },
      { title: "PAN Card Service" },
      { title: "Voter ID Correction & Status (NVSP)" },
      { title: "Ayushman Bharat (PM-JAY)" },
      { title: "Driving Licence Service" },
      { title: "RC Service (Registration…" },
      { title: "Vehicle Service" },
      { title: "Birth & Death Cirtificate" },
      { title: "E-Challan" },
      { title: "E-Shram Card" },
      { title: "APAAR ID Card" },
      { title: "ABHA Card (Ayushman Bharat…" },
      { title: "Pradhan Mantri Fasal Bima Yojana (PMFBY)" },
      { title: "PMAY-Gramin (Pradhan Mantri…" },
      { title: "PMAY-Urban/Sehri (Pradhan Mantri…" },
      { title: "EPFO (Employee' Provident Fund)" },
      { title: "LIC Service (Life Insurance…" },
      { title: "E-NAM (National Agriculture Market)" },
      { title: "PM SVANidhi Yojana" },
      { title: "Soil Health Card" },
      { title: "MKisan Portal" },
      { title: "PM Surya Ghar Yojana (Muft Bijli…" },
      { title: "Udyam Aadhaar Service (MSME)" },
      { title: "National Scholarship Portal (NSP)" },
      { title: "Lost/Found Mobile & Internet" },
      { title: "Railway Service" },
      { title: "Passport Seva Service" },
      { title: "PM Kisan (Kisan Samman Nidhi…" },
      { title: "GST Verification" },
      { title: "Chackpost Tax/Road Tax" },
      { title: "Vahan Green Sewa" },
      { title: "PUC (Pollution Under…" },
      { title: "National Payments Corporation Of Indi…" },
      { title: "National Consumer Helpline (NCH)" },
      { title: "National Career Service (NCS)" },
      { title: "Chack Free CIBIL Score" },
      { title: "INDANE GAS" },
      { title: "HP GAS" },
      { title: "BHARAT GAS" },
      { title: "Unique Disability ID Card" },
      { title: "Swachhbharatmission (शौचालय योजना)" },
      { title: "Fancy Mobile Number" },
    ]),
  },
];

export interface FaqSeed {
  question: string;
  answer: string;
  order: number;
}

export const HOME_FAQS: FaqSeed[] = [
  {
    question: "Are these tools free to use?",
    answer: "Yes, all tools on PrintBro are completely free to use, with no hidden charges.",
    order: 0,
  },
  {
    question: "Is my data safe?",
    answer: "Most tools process your files directly in your browser, so your files never leave your device.",
    order: 1,
  },
  {
    question: "Do I need to create an account?",
    answer: "No account is required to use the tools, but signing up lets you save your history and preferences.",
    order: 2,
  },
  {
    question: "Which file formats are supported?",
    answer:
      "We support JPG, PNG and PDF conversions, merging, page deletion, cropping and resizing, with more formats coming soon.",
    order: 3,
  },
  {
    question: "Can I use PrintBro on my phone?",
    answer: "Yes, PrintBro is fully responsive and works great on mobile, tablet and desktop.",
    order: 4,
  },
  {
    question: "How do I get Pro access?",
    answer:
      "Log in to your account, then visit the \"Go Pro\" link in the header and submit a short application explaining why you'd like Pro access. Our admin team reviews every application, and your account is automatically upgraded to Pro as soon as it's approved.",
    order: 5,
  },
];
