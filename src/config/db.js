import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

async function connectDB() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully!");
    return client.db("salonbook");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

export default connectDB;