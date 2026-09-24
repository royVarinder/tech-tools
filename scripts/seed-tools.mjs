import { existsSync } from "node:fs";
import mongoose from "mongoose";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";

const ToolSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    category: { type: String, required: true, default: "pdf" },
    icon: { type: String, required: true, default: "file" },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

const TOOL_DEFINITIONS = [
  { slug: "jpg-to-pdf", category: "pdf", icon: "image-plus", order: 1 },
  { slug: "pdf-to-jpg", category: "image", icon: "file-image", order: 2 },
  { slug: "png-to-pdf", category: "pdf", icon: "image-plus", order: 3 },
  { slug: "png-to-jpg", category: "image", icon: "image", order: 4 },
  { slug: "delete-pdf-page", category: "pdf", icon: "file-x", order: 5 },
  { slug: "merge-pdf", category: "pdf", icon: "files", order: 6 },
  { slug: "photo-crop-resize", category: "image", icon: "crop", order: 7 },
  { slug: "resume-maker", category: "document", icon: "file-text", order: 8 },
];

async function seed() {
  console.log(`Connecting to ${MONGODB_URI} ...`);
  await mongoose.connect(MONGODB_URI, { dbName: "toolnest" });
  const Tool = mongoose.models.Tool || mongoose.model("Tool", ToolSchema);

  for (const def of TOOL_DEFINITIONS) {
    await Tool.findOneAndUpdate(
      { slug: def.slug },
      { $set: { ...def, active: true } },
      { upsert: true, returnDocument: "after" }
    );
    console.log(`Upserted tool: ${def.slug}`);
  }

  console.log("Seeding complete.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
