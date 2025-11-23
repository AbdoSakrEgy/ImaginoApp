import multer from "multer";
import { ApplicationExpection } from "../Errors";
import { Request } from "express";
import fs from "fs";

export enum StoreInEnum {
  disk = "disk",
  memory = "memory",
}
export const fileTypes = {
  image: ["image/jpg", "image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/webm"],
};

export const multerUpload = ({
  sendedFileDest = "general",
  sendedFileType = fileTypes.image,
  storeIn = StoreInEnum.memory,
}: {
  sendedFileDest?: string;
  sendedFileType?: string[];
  storeIn?: StoreInEnum;
}): multer.Multer => {
  const storage =
    storeIn == StoreInEnum.memory
      ? multer.memoryStorage()
      : multer.diskStorage({
          // destination: (req: any, file, cb) => {
          //   const fullDest = `uploads/${sendedFileDest}/${req.user._id}`;
          //   if (!fs.existsSync(fullDest)) {
          //     fs.mkdirSync(fullDest, { recursive: true });
          //   }
          //   cb(null, fullDest);
          // },
          // filename: (req: any, file, cb) => {
          //   cb(null, `${file.originalname}`);
          // },
        });

  const fileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: CallableFunction
  ) => {
    if (file.size > 200 * 1024 * 1024 && storeIn == StoreInEnum.memory) {
      return cb(new ApplicationExpection("Use disk not memory", 400), false);
    } else if (!sendedFileType.includes(file.mimetype)) {
      return cb(new ApplicationExpection("Invalid file format", 400), false);
    }
    cb(null, true);
  };
  return multer({ storage, fileFilter });
};
