// Use dynamic import to avoid compile-time type resolution issues with the mongodb package
const uri = process.env.MONGODB_URI!;
if (!uri) {
  throw new Error("Missing MONGODB_URI env var");
}

let clientPromise: Promise<any>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<any> | undefined;
}

async function connectMongo() {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri, { maxPoolSize: 10 });
  return client.connect();
}

if (process.env.NODE_ENV !== "production") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = connectMongo();
  }
  clientPromise = global._mongoClientPromise!;
} else {
  clientPromise = connectMongo();
}

export default clientPromise;

// Optional helper to get a DB instance
export async function getDb(dbName = process.env.MONGODB_DB) {
  const c = await clientPromise;
  return c.db(dbName);
}
