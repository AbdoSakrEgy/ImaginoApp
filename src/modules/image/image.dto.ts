import z from "zod";
import { deleteImageSchema } from "./image.validation";

export type deleteImageDTO = z.infer<typeof deleteImageSchema>;
