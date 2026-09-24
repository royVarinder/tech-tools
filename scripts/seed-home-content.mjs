import { existsSync } from "node:fs";
import mongoose from "mongoose";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";

const CategorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    note: { type: String },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

const ServiceSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    categorySlug: { type: String, required: true, index: true },
    title: { type: String, required: true },
    badge: { type: String, enum: ["NEW", "HOT", null], default: null },
    href: { type: String, default: null },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

const FaqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

function buildItems(categorySlug, items) {
  return items.map((item, index) => ({
    slug: `${categorySlug}-${index + 1}`,
    categorySlug,
    title: item.title,
    badge: item.badge ?? null,
    href: item.href ?? null,
    order: index,
  }));
}

const CATEGORIES = [
  { slug: "essential-services", title: "Essential & Services", order: 0 },
  { slug: "creative-design-studio", title: "Creative Design Studio", order: 1 },
  { slug: "smart-pdf-image-tools", title: "Smart PDF & Image Tools", order: 2 },
  {
    slug: "portal-service",
    title: "Portal Service",
    note: "Government and public utility portals — informational links.",
    order: 3,
  },
];

const SERVICES = [
  ...buildItems("essential-services", [
    { title: "Latest Jobs", badge: "NEW" },
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
  ...buildItems("creative-design-studio", [
    { title: "Pro Resume Maker", badge: "NEW" },
    { title: "Marriage Biodata", badge: "NEW" },
    { title: "Pro ID Maker", badge: "NEW" },
    { title: "Pro Poster Maker", badge: "NEW" },
    { title: "Application Maker", badge: "NEW" },
    { title: "Shop Promotion Maker", badge: "NEW" },
  ]),
  ...buildItems("smart-pdf-image-tools", [
    { title: "JPG To PDF", href: "/tools/jpg-to-pdf" },
    { title: "PDF To JPG", href: "/tools/pdf-to-jpg" },
    { title: "PNG To PDF", href: "/tools/png-to-pdf" },
    { title: "PNG To JPG", href: "/tools/png-to-jpg" },
    { title: "Delete PDF Page", href: "/tools/delete-pdf-page" },
    { title: "Merge PDF", href: "/tools/merge-pdf" },
  ]),
  ...buildItems("portal-service", [
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
];

const FAQS = [
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

async function seed() {
  console.log(`Connecting to ${MONGODB_URI} ...`);
  await mongoose.connect(MONGODB_URI, { dbName: "toolnest" });

  const Category = mongoose.models.Category || mongoose.model("Category", CategorySchema);
  const Service = mongoose.models.Service || mongoose.model("Service", ServiceSchema);
  const Faq = mongoose.models.Faq || mongoose.model("Faq", FaqSchema);

  for (const category of CATEGORIES) {
    await Category.findOneAndUpdate(
      { slug: category.slug },
      { $set: { ...category, active: true } },
      { upsert: true, returnDocument: "after" }
    );
    console.log(`Upserted category: ${category.slug}`);
  }

  for (const service of SERVICES) {
    await Service.findOneAndUpdate(
      { slug: service.slug },
      { $set: { ...service, active: true } },
      { upsert: true, returnDocument: "after" }
    );
  }
  console.log(`Upserted ${SERVICES.length} services.`);

  await Faq.deleteMany({});
  await Faq.insertMany(FAQS.map((f) => ({ ...f, active: true })));
  console.log(`Inserted ${FAQS.length} FAQs.`);

  console.log("Home content seeding complete.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
