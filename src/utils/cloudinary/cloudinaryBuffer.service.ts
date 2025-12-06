import { v2 as cloudinary } from "cloudinary";

let isCloudinaryInitialized = false;

const initCloudinary = () => {
  if (isCloudinaryInitialized) return;

  cloudinary.config({
    cloud_name: process.env.CLOUD_NAME as string,
    api_key: process.env.API_KEY as string,
    api_secret: process.env.API_SECRET as string,
    secure: true,
  });

  isCloudinaryInitialized = true;
};


export const uploadBufferFile = async ({
  fileBuffer,
  storagePathOnCloudinary = "ImaginoApp",
}: {
  fileBuffer: Buffer;
  storagePathOnCloudinary: string;
}): Promise<{ public_id: string; secure_url: string }> => {
  initCloudinary();

  const folder = `${process.env.APP_NAME}/${storagePathOnCloudinary}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        format: "png",
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({
          public_id: result!.public_id,
          secure_url: result!.secure_url,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};
