import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";
const MONGODB_DB = process.env.MONGODB_DB;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectToDatabase() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        dbName: MONGODB_DB,
      })
      .then((conn) => {
        console.log("[mongodb] connected:", conn.connection.name);
        return conn;
      })
      .catch((err) => {
        console.error("[mongodb] connection failed:", err.message);
        cache.promise = null;
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
