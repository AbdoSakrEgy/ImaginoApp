import mongoose from "mongoose";

export const connectDB = async () => {
  if (!process.env.MONGODB_ATLAS_URL) {
    throw new Error("MONGODB_ATLAS_URL is missing!");
  }

  // Set connection timeout
  mongoose.set("serverSelectionTimeoutMS", 5000);
  mongoose.set("socketTimeoutMS", 45000);

  await mongoose
    .connect(process.env.MONGODB_ATLAS_URL, {
      maxPoolSize: 10,
      minPoolSize: 2,
    })
    .then(() => {
      console.log("DB connected successfully");
    })
    .catch((err) => {
      console.error("DB connection error:", err);
      throw err;
    });
};
