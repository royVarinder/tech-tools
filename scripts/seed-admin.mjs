import { existsSync } from "node:fs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";
const MONGODB_DB = process.env.MONGODB_DB || "toolnest";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
  process.exit(1);
}

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

async function seed() {
  console.log(`Connecting to database "${MONGODB_DB}" ...`);
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  const AdminModel = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await AdminModel.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase() },
    { $set: { name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase(), passwordHash } },
    { upsert: true }
  );

  console.log(`Admin account ready: ${ADMIN_EMAIL}`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Admin seed failed:", err);
  process.exit(1);
});
