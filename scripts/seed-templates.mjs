import { existsSync } from "node:fs";
import mongoose from "mongoose";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";
const MONGODB_DB = process.env.MONGODB_DB || "toolnest";

const TemplateSchema = new mongoose.Schema(
  {
    toolSlug: { type: String, required: true, index: true },
    name: { type: String, required: true },
    layoutKey: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    description: { type: String, default: null },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

const RESUME_TEMPLATES = [
  { name: "Classic Serif", layoutKey: "classic", description: "Traditional single-column layout with serif headings." },
  { name: "Modern Blue", layoutKey: "modern-blue", description: "Clean single-column design with a blue banner header." },
  { name: "Minimalist", layoutKey: "minimalist", description: "Lots of whitespace and understated typography." },
  { name: "Sidebar Dark", layoutKey: "sidebar-dark", description: "Two-column layout with a dark sidebar for contact and skills." },
  { name: "Bold Header", layoutKey: "bold-header", description: "Large colored header banner with bold typography." },
  { name: "Elegant Green", layoutKey: "elegant-green", description: "Elegant serif design with green accents." },
];

async function seed() {
  console.log(`Connecting to database "${MONGODB_DB}" ...`);
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  const Template = mongoose.models.Template || mongoose.model("Template", TemplateSchema);

  for (const [index, template] of RESUME_TEMPLATES.entries()) {
    await Template.findOneAndUpdate(
      { toolSlug: "pro-resume-maker", layoutKey: template.layoutKey },
      { $set: { ...template, toolSlug: "pro-resume-maker", order: index, active: true } },
      { upsert: true }
    );
    console.log(`Upserted template: ${template.name}`);
  }

  console.log("Template seeding complete.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Template seed failed:", err);
  process.exit(1);
});
