import mongoose from "mongoose";

export const connectDB = async () => {
  if (!process.env.MONGODB_COMPASS_URI) {
    throw new Error("MONGODB_COMPASS_URI is missing!");
  }
  await mongoose
    .connect(process.env.MONGODB_COMPASS_URI)
    .then(() => {
      console.log("DB connected successfully");
    })
    .catch((err) => {
      console.log(err);
    });
};
