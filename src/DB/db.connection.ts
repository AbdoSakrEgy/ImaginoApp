import mongoose from "mongoose";

export const connectDB = async () => {
  if (!process.env.MONGODB_ATLAS_URL) {
    throw new Error("MONGODB_ATLAS_URL is missing!");
  }
  await mongoose
    .connect(process.env.MONGODB_ATLAS_URL as string)
    .then(() => {
      console.log("DB connected successfully");
    })

    
    .catch((err) => {
      console.log(err);
    });
};
