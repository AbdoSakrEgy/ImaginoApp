import mongoose from "mongoose";

export const connectDB = async () => {
  // if (!process.env.MONGODB_ATLAS_URL) {
  //   throw new Error("MONGODB_ATLAS_URL is missing!");
  // }
  await mongoose
    .connect("mongodb+srv://abdosakr:abdo.sakr@cluster0.1taiy.mongodb.net/ImaginoApp")
    .then(() => {
      console.log("DB connected successfully");
    })
    .catch((err) => {
      console.log(err);
    });
};
