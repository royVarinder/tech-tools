import { existsSync } from "node:fs";
import mongoose from "mongoose";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";
const SOURCE_DB = "test";
const TARGET_DB = "toolnest";
const DROP_SOURCE = process.argv.includes("--drop-source");

async function migrate() {
  console.log(`Connecting to ${MONGODB_URI} ...`);
  await mongoose.connect(MONGODB_URI);
  const client = mongoose.connection.getClient();
  const sourceDb = client.db(SOURCE_DB);
  const targetDb = client.db(TARGET_DB);

  const collections = await sourceDb.listCollections().toArray();
  if (collections.length === 0) {
    console.log(`No collections found in "${SOURCE_DB}". Nothing to migrate.`);
  }

  for (const { name } of collections) {
    const sourceCollection = sourceDb.collection(name);
    const targetCollection = targetDb.collection(name);

    const docs = await sourceCollection.find().toArray();
    let copied = 0;
    let skipped = 0;

    for (const doc of docs) {
      const exists = await targetCollection.findOne({ _id: doc._id });
      if (exists) {
        skipped += 1;
        continue;
      }
      await targetCollection.insertOne(doc);
      copied += 1;
    }

    console.log(`Collection "${name}": copied ${copied}, skipped ${skipped} (already in ${TARGET_DB}).`);
  }

  if (!DROP_SOURCE) {
    console.log(
      `\nDone. Re-run with --drop-source to drop the "${SOURCE_DB}" database once you've verified "${TARGET_DB}" looks correct.`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`\nDropping database "${SOURCE_DB}" ...`);
  await sourceDb.dropDatabase();
  console.log(`Dropped "${SOURCE_DB}".`);

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
