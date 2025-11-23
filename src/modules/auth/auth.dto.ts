import z from "zod";
import {
  activeDeactive2FASchema,
  changePasswordSchema,
  check2FAOTPSchema,
  confirmEmailSchema,
  forgetPasswordSchema,
  loginSchema,
  registerSchema,
  resendEmailOtpSchema,
  updateEmailSchema,
  updatePasswordSchema,
} from "./auth.validation";

export type registerDTO = z.infer<typeof registerSchema>;
export type confirmEmaiDTO = z.infer<typeof confirmEmailSchema>;
export type updateEmaiDTO = z.infer<typeof updateEmailSchema>;
export type resendEmailOtpDTO = z.infer<typeof resendEmailOtpSchema>;
export type loginDTO = z.infer<typeof loginSchema>;
export type updatePasswordDTO = z.infer<typeof updatePasswordSchema>;
export type forgetPasswordDTO = z.infer<typeof forgetPasswordSchema>;
export type changePasswordDTO = z.infer<typeof changePasswordSchema>;
export type activeDeactive2FADTO = z.infer<typeof activeDeactive2FASchema>;
export type check2FAOTPADTO = z.infer<typeof check2FAOTPSchema>;
