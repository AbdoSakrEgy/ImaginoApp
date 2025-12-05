import multer from "multer";
import { ApplicationException } from "../Errors";
import { Request } from "express";
import fs from "fs";
import path from "path";

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
  storeIn = StoreInEnum.disk,
}: {
  sendedFileDest?: string;
  sendedFileType?: string[];
  storeIn?: StoreInEnum;
}): multer.Multer => {
  const storage =
    storeIn === StoreInEnum.memory
      ? multer.memoryStorage()
      : multer.diskStorage({
          // destination: (req: any, file, cb) => {
          //   const userId = req.user?._id?.toString() || "anonymous";
          //   const fullDest = path.join("uploads", sendedFileDest, userId);
          //   if (!fs.existsSync(fullDest)) {
          //     fs.mkdirSync(fullDest, { recursive: true });
          //   }
          //   cb(null, fullDest);
          // },
          // filename: (req: any, file, cb) => {
          //   const timestamp = Date.now();
          //   const ext = path.extname(file.originalname);
          //   const name = path.basename(file.originalname, ext);
          //   cb(null, `${name}-${timestamp}${ext}`);
          // },
        });

  const fileFilter = (req: Request, file: Express.Multer.File, cb: CallableFunction) => {
    if (file.size > 200 * 1024 * 1024 && storeIn == StoreInEnum.memory) {
      return cb(new ApplicationException("Use disk not memory", 400), false);
    } else if (!sendedFileType.includes(file.mimetype)) {
      return cb(new ApplicationException("Invalid file format", 400), false);
    }
    cb(null, true);
  };

  return multer({ storage, fileFilter });
};
