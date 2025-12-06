// cloudinary.service.ts
import cloudinaryModule from "cloudinary";

let isCloudinaryInitialized = false;
const cloudinary = cloudinaryModule.v2;

// Lazy initialization function
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

// ------------------------------------------------------------------
// SINGLE FILE UPLOAD
// ------------------------------------------------------------------
export const uploadSingleFile = async ({
  
  fileLocation,
  storagePathOnCloudinary = "ImaginoApp",
}: {
  fileLocation: string;
  storagePathOnCloudinary: string;
}) => {
  initCloudinary();

  const { public_id, secure_url } = await cloudinary.uploader.upload(fileLocation, {
    folder: `${process.env.APP_NAME}/${storagePathOnCloudinary}`,
  });

  return { public_id, secure_url };
};

// ------------------------------------------------------------------
// MULTIPLE FILE UPLOAD
// ------------------------------------------------------------------
export const uploadManyFiles = async ({
  fileLocationArr = [],
  storagePathOnCloudinary = "ImaginoApp",
}: {
  fileLocationArr: string[];
  storagePathOnCloudinary: string;
}) => {
  initCloudinary();

  const images = [];
  for (const item of fileLocationArr) {
    const { public_id, secure_url } = await uploadSingleFile({
      fileLocation: item,
      storagePathOnCloudinary,
    });
    images.push({ public_id, secure_url });
  }
  return images;
};

// ------------------------------------------------------------------
// DESTROY SINGLE FILE
// ------------------------------------------------------------------
export const destroySingleFile = async ({ public_id }: { public_id: string }) => {
  initCloudinary();
  await cloudinary.uploader.destroy(public_id);
};

// ------------------------------------------------------------------
// DESTROY MULTIPLE FILES
// ------------------------------------------------------------------
export const destroyManyFiles = async ({ public_ids = [] }: { public_ids: string[] }) => {
  initCloudinary();
  await cloudinary.api.delete_resources(public_ids);
};

// ------------------------------------------------------------------
// DELETE BY PREFIX
// ------------------------------------------------------------------
export const deleteByPrefix = async ({
  storagePathOnCloudinary,
}: {
  storagePathOnCloudinary: string;
}) => {
  initCloudinary();
  await cloudinary.api.delete_resources_by_prefix(
    `${process.env.APP_NAME}/${storagePathOnCloudinary}`,
  );
};

// ------------------------------------------------------------------
// DELETE FOLDER
// ------------------------------------------------------------------
export const deleteFolder = async ({
  storagePathOnCloudinary,
}: {
  storagePathOnCloudinary: string;
}) => {
  initCloudinary();
  await cloudinary.api.delete_folder(`${process.env.APP_NAME}/${storagePathOnCloudinary}`);
};
