import { UserModel } from "./../user/user.model";
import { NextFunction, Request, Response } from "express";
import {
  activeDeactive2FADTO,
  changePasswordDTO,
  check2FAOTPADTO,
  confirmEmaiDTO,
  forgetPasswordDTO,
  loginDTO,
  registerDTO,
  resendEmailOtpDTO,
  updateEmaiDTO,
  updatePasswordDTO,
} from "./auth.dto";
import { ApplicationException, NotValidEmail } from "../../utils/Errors";
import { HydratedDocument } from "mongoose";
import { template } from "../../utils/sendEmail/generateHTML";
import { createJwt } from "../../utils/jwt";
import { createOtp } from "../../utils/createOtp";
import { successHandler } from "../../utils/successHandler";
import { compare } from "../../utils/bcrypt";
import { sendEmail } from "../../utils/sendEmail/send.email";
import { decodeToken, TokenTypesEnum } from "../../utils/decodeToken";
import { IAuthServcies } from "../../types/auth.modules.types";
import { IUser } from "../../types/user.module.types";

export class AuthServices implements IAuthServcies {
  constructor() {}

  // ============================ register ============================
  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const { firstName, lastName, email, password }: registerDTO = req.body;
    // step: check user existence
    const isUserExist = await UserModel.findOne({ email });
    if (isUserExist) {
      throw new NotValidEmail("User already exist");
    }
    // step: send email otp
    const otpCode = createOtp();
    const { isEmailSended, info } = await sendEmail({
      to: email,
      subject: "ImaginoApp",
      html: template({
        otpCode,
        receiverName: firstName,
        subject: "Confirm email",
      }),
    });
    if (!isEmailSended) {
      throw new ApplicationException("Error while sending email", 400);
    }
    // step: create new user
    const user: HydratedDocument<IUser> = await UserModel.create({
      firstName,
      lastName,
      email,
      password,
      emailOtp: {
        otp: otpCode,
        expiredAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    if (!user) {
      throw new ApplicationException("Creation failed", 500);
    }
    // step: create token
    const accessToken = createJwt(
      { userId: user._id, userEmail: user.email },
      process.env.ACCESS_SEGNATURE as string,
      {
        expiresIn: "1h",
        jwtid: createOtp(),
      }
    );
    const refreshToken = createJwt(
      { userId: user._id, userEmail: user.email },
      process.env.REFRESH_SEGNATURE as string,
      {
        expiresIn: "7d",
        jwtid: createOtp(),
      }
    );
    return successHandler({
      res,
      message: "User created successfully",
      result: { accessToken, refreshToken },
    });
  };

  // ============================ login ============================
  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const { email, password }: loginDTO = req.body;
    // step: check credentials
    const isUserExist = await UserModel.findOne({ email });
    if (!isUserExist) {
      throw new ApplicationException("Invalid credentials", 404);
    }
    const user = isUserExist;
    if (!(await compare(password, user.password))) {
      throw new ApplicationException("Invalid credentials", 401);
    }
    // step: check is 2FA active
    if (user.is2FAActive) {
      // ->step: send email otp
      const otpCode = createOtp();
      const { isEmailSended, info } = await sendEmail({
        to: user.email,
        subject: "ImaginoApp",
        html: template({
          otpCode,
          receiverName: user.firstName,
          subject: "2FA login",
        }),
      });
      if (!isEmailSended) {
        throw new ApplicationException("Error while sending email", 400);
      }
      // ->step: update user
      const updatedUser = await UserModel.findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            otp2FA: {
              otp: otpCode,
              expiredAt: new Date(Date.now() + 5 * 60 * 1000),
            },
          },
        }
      );
      return successHandler({
        res,
        message: "OTP sended to your email pleaze confirm it to login",
      });
    }
    // step: create token
    const accessToken = createJwt(
      { userId: user._id, userEmail: user.email },
      process.env.ACCESS_SEGNATURE as string,
      {
        expiresIn: "1h",
        jwtid: createOtp(),
      }
    );
    const refreshToken = createJwt(
      { userId: user._id, userEmail: user.email },
      process.env.REFRESH_SEGNATURE as string,
      {
        expiresIn: "7d",
        jwtid: createOtp(),
      }
    );
    return successHandler({
      res,
      message: "Loggedin successfully",
      result: { accessToken, refreshToken },
    });
  };

  // ============================ refresh-token ============================
  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const authorization = req.headers.authorization;
    // step: check authorization
    if (!authorization) {
      throw new ApplicationException("Authorization undefiend", 400);
    }
    // step: decode authorization
    const { user, payload } = await decodeToken({
      authorization,
      tokenType: TokenTypesEnum.refresh,
    });
    // step: create accessToken
    const newPayload = {
      userId: payload.userId,
      userEmail: payload.userEmail,
    };
    const jwtid = createOtp();
    // const jwtid = "666";
    const accessToken = createJwt(
      newPayload,
      process.env.ACCESS_SEGNATURE as string,
      {
        expiresIn: "1h",
        jwtid,
      }
    );
    return successHandler({ res, result: { accessToken } });
  };

  // ============================ confirmEmail ============================
  confirmEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const { email, firstOtp, secondOtp }: confirmEmaiDTO = req.body;
    // step: check user exitance
    const user = await UserModel.findOne({ email });
    if (!user) {
      throw new ApplicationException("User not found", 400);
    }
    // step: check emailOtp
    if (!(await compare(firstOtp, user.emailOtp.otp))) {
      return successHandler({ res, message: "Invalid otp", status: 400 });
    }
    if (user.emailOtp.expiredAt < new Date(Date.now())) {
      return successHandler({ res, message: "otp expired", status: 400 });
    }
    // step: case 1 email not confrimed (confirm first email)
    if (!user.emailConfirmed) {
      // step: confirm email
      const updatedUser = await UserModel.findOneAndUpdate(
        { email: user.email },
        { $set: { emailConfirmed: new Date() } }
      );
      return successHandler({ res, message: "Email confirmed successfully" });
    }
    // step: case 2 email confrimed (confirm first and second email)
    // step: check secondOtp existence
    if (!secondOtp) {
      return successHandler({
        res,
        message:
          "Email already confirmed, if you want to update email please send firstOtp and secondOtp",
        status: 400,
      });
    }
    // step: check newEmailOtp
    if (!(await compare(secondOtp, user.newEmailOtp.otp))) {
      return successHandler({
        res,
        message: "Invalid otp for second email",
        status: 400,
      });
    }
    if (user.newEmailOtp.expiredAt < new Date(Date.now())) {
      return successHandler({
        res,
        message: "otp expired for second email",
        status: 400,
      });
    }
    // step: confirm email
    const newEmail = user.newEmail;
    const updatedUser = await UserModel.findOneAndUpdate(
      { email: user.email },
      { $set: { email: newEmail } }
    );
    return successHandler({
      res,
      message: "New email confirmed successfully",
    });
  };

  // ============================ updateEmail ============================
  updateEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const user = res.locals.user;
    const { newEmail }: updateEmaiDTO = req.body;
    // step: check if email confirmed
    if (!user.emailConfirmed) {
      return successHandler({
        res,
        message: "Please confirm email to update it",
        status: 400,
      });
    }
    // step: send otp to current email
    const otpCodeForCurrentEmail = createOtp();
    const { isEmailSended } = await sendEmail({
      to: user.email,
      subject: "ImaginoApp",
      html: template({
        otpCode: otpCodeForCurrentEmail,
        receiverName: user.firstName,
        subject: "Some one try to change your email! is that you?",
      }),
    });
    if (!isEmailSended) {
      return successHandler({
        res,
        message: "Error while checking email",
        status: 400,
      });
    }
    // step: send otp to new email
    const otpCodeForNewEmail = createOtp();
    const resultOfSendEmail = await sendEmail({
      to: newEmail,
      subject: "ImaginoApp",
      html: template({
        otpCode: otpCodeForNewEmail,
        receiverName: user.firstName,
        subject: "Confirm new email",
      }),
    });
    if (!resultOfSendEmail.isEmailSended) {
      return successHandler({
        res,
        message: "Error while checking email",
        status: 400,
      });
    }
    // step: save emailOtp, newEmail and newEmailOtp
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          emailOtp: {
            otp: otpCodeForCurrentEmail,
            expiredAt: new Date(Date.now() + 5 * 60 * 1000),
          },
          newEmail,
          newEmailOtp: {
            otp: otpCodeForNewEmail,
            expiredAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );

    return successHandler({
      res,
      message:
        "OTP sended for current email and new email, please confirm new email to save updates",
    });
  };

  // ============================ resendEmailOtp ============================
  resendEmailOtp = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const { email }: resendEmailOtpDTO = req.body;
    // step: check email existence
    const isUserExist = await UserModel.findOne({ email });
    if (!isUserExist) {
      throw new ApplicationException("User not found", 404);
    }
    const user = isUserExist;
    // step: check if email otp not expired yet
    if (user.emailOtp?.expiredAt > new Date(Date.now())) {
      throw new ApplicationException("Your OTP not expired yet", 400);
    }
    // step: send email otp
    const otpCode = createOtp();
    const { isEmailSended, info } = await sendEmail({
      to: email,
      subject: "ImaginoApp",
      html: template({
        otpCode,
        receiverName: user.firstName,
        subject: "Confirm email",
      }),
    });
    if (!isEmailSended) {
      throw new ApplicationException("Error while sending email", 400);
    }
    // step: update emailOtp
    const updatedUset = await UserModel.findOneAndUpdate(
      { email: user.email },
      {
        $set: {
          emailOtp: {
            otp: otpCode,
            expiredAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
    return successHandler({ res, message: "OTP sended successfully" });
  };

  // ============================ updatePassword ============================
  updatePassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const user = res.locals.user;
    const { currentPassword, newPassword }: updatePasswordDTO = req.body;
    // step: check password correction
    if (!(await compare(currentPassword, user.password))) {
      throw new ApplicationException("Invalid credentials", 401);
    }
    // step: check newPassword not equal currentPassword
    if (await compare(newPassword, user.password)) {
      throw new ApplicationException(
        "You can not make new password equal to old password",
        400
      );
    }
    // step: update password and credentialsChangedAt
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          password: newPassword,
          credentialsChangedAt: new Date(Date.now()),
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
    return successHandler({
      res,
      message: "Password updated successfully, please login again",
    });
  };

  // ============================ forgetPassword ============================
  forgetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const { email }: forgetPasswordDTO = req.body;
    // step: check email existence
    const isUserExist = await UserModel.findOne({ email });
    if (!isUserExist) {
      throw new ApplicationException("User not found", 404);
    }
    const user = isUserExist;
    // step: check if password otp not expired yet
    if (user.passwordOtp?.expiredAt > new Date(Date.now())) {
      throw new ApplicationException("Your OTP not expired yet", 400);
    }
    // step: send email otp
    const otpCode = createOtp();
    // const otpCode = "555";
    const { isEmailSended, info } = await sendEmail({
      to: user.email,
      subject: "Reset password OTP",
      html: template({
        otpCode,
        receiverName: user.firstName,
        subject: "Reset password OTP",
      }),
    });
    if (!isEmailSended) {
      throw new ApplicationException("Error while sending email", 400);
    }
    // step: update passwordOtp
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          passwordOtp: {
            otp: otpCode,
            expiredAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
    return successHandler({
      res,
      message: "OTP sended to email, please use it to restart your password",
    });
  };

  // ============================ changePassword ============================
  changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const { email, otp, newPassword }: changePasswordDTO = req.body;
    // step: check email existence
    const isUserExist = await UserModel.findOne({ email });
    if (!isUserExist) {
      throw new ApplicationException("User not found", 404);
    }
    const user = isUserExist;
    // step: check otp
    if (!(await compare(otp, user.passwordOtp.otp))) {
      throw new ApplicationException("Invalid OTP", 400);
    }
    // step: change password
    const updatedUser = await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          password: newPassword,
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
    return successHandler({
      res,
      message: "Password changed successfully, You have to login",
    });
  };

  // ============================ enable2FA ============================
  enable2FA = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const user = res.locals.user;
    // step: send email otp
    const otpCode = createOtp();
    const { isEmailSended, info } = await sendEmail({
      to: user.email,
      subject: "ImaginoApp",
      html: template({
        otpCode,
        receiverName: user.firstName,
        subject: "Enable 2FA",
      }),
    });
    if (!isEmailSended) {
      throw new ApplicationException("Error while sending email", 400);
    }
    // step: save OTP
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          otp2FA: {
            otp: otpCode,
            expiredAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
    return successHandler({
      res,
      message: "OTP sended to your email plz confirm it to active 2FA",
    });
  };

  // ============================ activeDeactive2FA ============================
  activeDeactive2FA = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const user = res.locals.user;
    const otp = (req.body as activeDeactive2FADTO)?.otp;
    console.log({ otp });
    // step: check otp existence
    if (!otp) {
      const updatedUser = await UserModel.findOneAndUpdate(
        { _id: user._id },
        { $set: { is2FAActive: false } },
        {
          new: true,
          runValidators: true,
          context: "query",
        }
      );
      return successHandler({ res, message: "2FA disabled successfully" });
    }
    // step: check otp value
    if (!user?.otp2FA?.otp) {
      throw new ApplicationException("OTP not correct", 400);
    }
    if (!(await compare(otp, user?.otp2FA?.otp))) {
      throw new ApplicationException("OTP not correct", 400);
    }
    if (user?.otp2FA?.expiredAt < new Date(Date.now())) {
      throw new ApplicationException("OTP expired", 400);
    }
    // step: update 2fa
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: user._id },
      { $set: { is2FAActive: true } },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
    return successHandler({ res, message: "2FA enabled successfully" });
  };

  // ============================ check2FAOTP ============================
  check2FAOTP = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const { userId, otp } = req.body as check2FAOTPADTO;
    const user = await UserModel.findOne({ _id: userId });
    // step: check OTP
    if (!user?.otp2FA?.otp) {
      throw new ApplicationException("Invalid credentials", 400);
    }
    if (!(await compare(otp, user?.otp2FA?.otp))) {
      throw new ApplicationException("Invalid credentials", 400);
    }
    // step: create token
    const accessToken = createJwt(
      { userId: user._id, userEmail: user.email },
      process.env.ACCESS_SEGNATURE as string,
      {
        expiresIn: "1h",
        jwtid: createOtp(),
      }
    );
    const refreshToken = createJwt(
      { userId: user._id, userEmail: user.email },
      process.env.REFRESH_SEGNATURE as string,
      {
        expiresIn: "7d",
        jwtid: createOtp(),
      }
    );
    return successHandler({
      res,
      message: "Loggedin successfully",
      result: { accessToken, refreshToken },
    });
  };

  // ============================ logout ============================
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const user = res.locals.user;
    // step: change credentialsChangedAt
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          credentialsChangedAt: new Date(Date.now()),
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
    return successHandler({
      res,
      message: "Logged out successfully",
    });
  };
}
