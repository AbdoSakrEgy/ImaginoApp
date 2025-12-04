import z from "zod";

export const deleteImageSchema = z.object({
  profileImage: z.object(),
});