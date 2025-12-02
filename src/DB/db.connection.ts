import mongoose from "mongoose";

export const connectDB = async () => {
  if (!process.env.MONGODB_ATLAS_URL) {
    throw new Error("MONGODB_COMPASS_URI is missing!");
  }
  await mongoose
    .connect(process.env.MONGODB_ATLAS_URL)
    .then(() => {
      console.log("DB connected successfully");
    })
    .catch((err) => {
      console.log(err);
    });
};
