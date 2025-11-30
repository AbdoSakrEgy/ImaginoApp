// config
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true,
});

// uploadSingleFile
export const uploadSingleFile = async ({
  fileLocation,
  storagePathOnCloudinary = "ImaginoApp",
}: {
  fileLocation: string;
  storagePathOnCloudinary: string;
}) => {
  const { public_id, secure_url } = await cloudinary.uploader.upload(
    fileLocation,
    {
      folder: `${process.env.APP_NAME}/${storagePathOnCloudinary}`,
    }
  );
  //* If you used returned secure_url will not work, you have to modify it to be sutiable for browsers
  return { public_id, secure_url };
};

// uploadManyFiles
export const uploadManyFiles = async ({
  fileLocationArr = [],
  storagePathOnCloudinary = "ImaginoApp",
}: {
  fileLocationArr: string[];
  storagePathOnCloudinary: string;
}) => {
  let images = [];
  for (const item of fileLocationArr) {
    const { public_id, secure_url } = await uploadSingleFile({
      fileLocation: item,
      storagePathOnCloudinary,
    });
    images.push({ public_id, secure_url });
  }
  return images;
};

// destroySingleFile
export const destroySingleFile = async ({
  public_id,
}: {
  public_id: string;
}) => {
  await cloudinary.uploader.destroy(public_id);
};

// destroyManyFiles
export const destroyManyFiles = async ({
  public_ids = [],
}: {
  public_ids: string[];
}) => {
  await cloudinary.api.delete_resources(public_ids);
};

// deleteByPrefix
export const deleteByPrefix = async ({
  storagePathOnCloudinary,
}: {
  storagePathOnCloudinary: string;
}) => {
  await cloudinary.api.delete_resources_by_prefix(
    `${process.env.APP_NAME}/${storagePathOnCloudinary}`
  );
};

// deleteFolder
export const deleteFolder = async ({
  storagePathOnCloudinary,
}: {
  storagePathOnCloudinary: string;
}) => {
  await cloudinary.api.delete_folder(
    `${process.env.APP_NAME}/${storagePathOnCloudinary}`
  );
};
