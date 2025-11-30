import z from "zod";
import {
  deleteMultiFilesSchema,
  createPresignedUrlToGetFileSchema,
  updateBasicInfoSchema,
  uploadAvatarImageSchema,
  sendFriendRequestSchema,
  acceptFriendRequestSchema,
  blockUserSchema,
  deleteFriendRequestSchema,
} from "./user.validation";

export type updateBasicInfoDTO = z.infer<typeof updateBasicInfoSchema>;
export type uploadAvatarImageDTO = z.infer<typeof uploadAvatarImageSchema>;
export type createPresignedUrlToGetFileDTO = z.infer<typeof createPresignedUrlToGetFileSchema>;
export type deleteMultiFilesDTO = z.infer<typeof deleteMultiFilesSchema>;
export type sendFriendRequestDTO = z.infer<typeof sendFriendRequestSchema>;
export type acceptFriendRequestDTO = z.infer<typeof acceptFriendRequestSchema>;
export type blockUserDTO = z.infer<typeof blockUserSchema>;
export type deleteFriendRequestDTO = z.infer<typeof deleteFriendRequestSchema>;
