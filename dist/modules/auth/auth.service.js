"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthServices = void 0;
const user_model_1 = require("./../user/user.model");
const Errors_1 = require("../../utils/Errors");
const generateHTML_1 = require("../../utils/sendEmail/generateHTML");
const jwt_1 = require("../../utils/jwt");
const createOtp_1 = require("../../utils/createOtp");
const successHandler_1 = require("../../utils/successHandler");
const bcrypt_1 = require("../../utils/bcrypt");
const send_email_1 = require("../../utils/sendEmail/send.email");
const decodeToken_1 = require("../../utils/decodeToken");
class AuthServices {
    constructor() { }
    // ============================ register ============================
    register = async (req, res, next) => {
        const { firstName, lastName, email, password } = req.body;
        // step: check user existence
        const isUserExist = await user_model_1.UserModel.findOne({ email });
        if (isUserExist) {
            throw new Errors_1.NotValidEmail("User already exist");
        }
        // step: send email otp
        const otpCode = (0, createOtp_1.createOtp)();
        const { isEmailSended, info } = await (0, send_email_1.sendEmail)({
            to: email,
            subject: "ImaginoApp",
            html: (0, generateHTML_1.template)({
                otpCode,
                receiverName: firstName,
                subject: "Confirm email",
            }),
        });
        if (!isEmailSended) {
            throw new Errors_1.ApplicationException("Error while sending email", 400);
        }
        // step: create new user
        const user = await user_model_1.UserModel.create({
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
            throw new Errors_1.ApplicationException("Creation failed", 500);
        }
        // step: create token
        const accessToken = (0, jwt_1.createJwt)({ userId: user._id, userEmail: user.email }, process.env.ACCESS_SEGNATURE, {
            expiresIn: "1h",
            jwtid: (0, createOtp_1.createOtp)(),
        });
        const refreshToken = (0, jwt_1.createJwt)({ userId: user._id, userEmail: user.email }, process.env.REFRESH_SEGNATURE, {
            expiresIn: "7d",
            jwtid: (0, createOtp_1.createOtp)(),
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "User created successfully",
            result: { accessToken, refreshToken },
        });
    };
    // ============================ login ============================
    login = async (req, res, next) => {
        const { email, password } = req.body;
        // step: check credentials
        const isUserExist = await user_model_1.UserModel.findOne({ email });
        if (!isUserExist) {
            throw new Errors_1.ApplicationException("Invalid credentials", 404);
        }
        const user = isUserExist;
        if (!(await (0, bcrypt_1.compare)(password, user.password))) {
            throw new Errors_1.ApplicationException("Invalid credentials", 401);
        }
        // step: check is 2FA active
        if (user.is2FAActive) {
            // ->step: send email otp
            const otpCode = (0, createOtp_1.createOtp)();
            const { isEmailSended, info } = await (0, send_email_1.sendEmail)({
                to: user.email,
                subject: "ImaginoApp",
                html: (0, generateHTML_1.template)({
                    otpCode,
                    receiverName: user.firstName,
                    subject: "2FA login",
                }),
            });
            if (!isEmailSended) {
                throw new Errors_1.ApplicationException("Error while sending email", 400);
            }
            // ->step: update user
            const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, {
                $set: {
                    otp2FA: {
                        otp: otpCode,
                        expiredAt: new Date(Date.now() + 5 * 60 * 1000),
                    },
                },
            });
            return (0, successHandler_1.successHandler)({
                res,
                message: "OTP sended to your email pleaze confirm it to login",
            });
        }
        // step: create token
        const accessToken = (0, jwt_1.createJwt)({ userId: user._id, userEmail: user.email }, process.env.ACCESS_SEGNATURE, {
            expiresIn: "1h",
            jwtid: (0, createOtp_1.createOtp)(),
        });
        const refreshToken = (0, jwt_1.createJwt)({ userId: user._id, userEmail: user.email }, process.env.REFRESH_SEGNATURE, {
            expiresIn: "7d",
            jwtid: (0, createOtp_1.createOtp)(),
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Loggedin successfully",
            result: { accessToken, refreshToken },
        });
    };
    // ============================ refresh-token ============================
    refreshToken = async (req, res, next) => {
        const authorization = req.headers.authorization;
        // step: check authorization
        if (!authorization) {
            throw new Errors_1.ApplicationException("Authorization undefiend", 400);
        }
        // step: decode authorization
        const { user, payload } = await (0, decodeToken_1.decodeToken)({
            authorization,
            tokenType: decodeToken_1.TokenTypesEnum.refresh,
        });
        // step: create accessToken
        const newPayload = {
            userId: payload.userId,
            userEmail: payload.userEmail,
        };
        const jwtid = (0, createOtp_1.createOtp)();
        // const jwtid = "666";
        const accessToken = (0, jwt_1.createJwt)(newPayload, process.env.ACCESS_SEGNATURE, {
            expiresIn: "1h",
            jwtid,
        });
        return (0, successHandler_1.successHandler)({ res, result: { accessToken } });
    };
    // ============================ confirmEmail ============================
    confirmEmail = async (req, res, next) => {
        const { email, firstOtp, secondOtp } = req.body;
        // step: check user exitance
        const user = await user_model_1.UserModel.findOne({ email });
        if (!user) {
            throw new Errors_1.ApplicationException("User not found", 400);
        }
        // step: check emailOtp
        if (!(await (0, bcrypt_1.compare)(firstOtp, user.emailOtp.otp))) {
            return (0, successHandler_1.successHandler)({ res, message: "Invalid otp", status: 400 });
        }
        if (user.emailOtp.expiredAt < new Date(Date.now())) {
            return (0, successHandler_1.successHandler)({ res, message: "otp expired", status: 400 });
        }
        // step: case 1 email not confrimed (confirm first email)
        if (!user.emailConfirmed) {
            // step: confirm email
            const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ email: user.email }, { $set: { emailConfirmed: new Date() } });
            return (0, successHandler_1.successHandler)({ res, message: "Email confirmed successfully" });
        }
        // step: case 2 email confrimed (confirm first and second email)
        // step: check secondOtp existence
        if (!secondOtp) {
            return (0, successHandler_1.successHandler)({
                res,
                message: "Email already confirmed, if you want to update email please send firstOtp and secondOtp",
                status: 400,
            });
        }
        // step: check newEmailOtp
        if (!(await (0, bcrypt_1.compare)(secondOtp, user.newEmailOtp.otp))) {
            return (0, successHandler_1.successHandler)({
                res,
                message: "Invalid otp for second email",
                status: 400,
            });
        }
        if (user.newEmailOtp.expiredAt < new Date(Date.now())) {
            return (0, successHandler_1.successHandler)({
                res,
                message: "otp expired for second email",
                status: 400,
            });
        }
        // step: confirm email
        const newEmail = user.newEmail;
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ email: user.email }, { $set: { email: newEmail } });
        return (0, successHandler_1.successHandler)({
            res,
            message: "New email confirmed successfully",
        });
    };
    // ============================ updateEmail ============================
    updateEmail = async (req, res, next) => {
        const user = res.locals.user;
        const { newEmail } = req.body;
        // step: check if email confirmed
        if (!user.emailConfirmed) {
            return (0, successHandler_1.successHandler)({
                res,
                message: "Please confirm email to update it",
                status: 400,
            });
        }
        // step: send otp to current email
        const otpCodeForCurrentEmail = (0, createOtp_1.createOtp)();
        const { isEmailSended } = await (0, send_email_1.sendEmail)({
            to: user.email,
            subject: "ImaginoApp",
            html: (0, generateHTML_1.template)({
                otpCode: otpCodeForCurrentEmail,
                receiverName: user.firstName,
                subject: "Some one try to change your email! is that you?",
            }),
        });
        if (!isEmailSended) {
            return (0, successHandler_1.successHandler)({
                res,
                message: "Error while checking email",
                status: 400,
            });
        }
        // step: send otp to new email
        const otpCodeForNewEmail = (0, createOtp_1.createOtp)();
        const resultOfSendEmail = await (0, send_email_1.sendEmail)({
            to: newEmail,
            subject: "ImaginoApp",
            html: (0, generateHTML_1.template)({
                otpCode: otpCodeForNewEmail,
                receiverName: user.firstName,
                subject: "Confirm new email",
            }),
        });
        if (!resultOfSendEmail.isEmailSended) {
            return (0, successHandler_1.successHandler)({
                res,
                message: "Error while checking email",
                status: 400,
            });
        }
        // step: save emailOtp, newEmail and newEmailOtp
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, {
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
        }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "OTP sended for current email and new email, please confirm new email to save updates",
        });
    };
    // ============================ resendEmailOtp ============================
    resendEmailOtp = async (req, res, next) => {
        const { email } = req.body;
        // step: check email existence
        const isUserExist = await user_model_1.UserModel.findOne({ email });
        if (!isUserExist) {
            throw new Errors_1.ApplicationException("User not found", 404);
        }
        const user = isUserExist;
        // step: check if email otp not expired yet
        if (user.emailOtp?.expiredAt > new Date(Date.now())) {
            throw new Errors_1.ApplicationException("Your OTP not expired yet", 400);
        }
        // step: send email otp
        const otpCode = (0, createOtp_1.createOtp)();
        const { isEmailSended, info } = await (0, send_email_1.sendEmail)({
            to: email,
            subject: "ImaginoApp",
            html: (0, generateHTML_1.template)({
                otpCode,
                receiverName: user.firstName,
                subject: "Confirm email",
            }),
        });
        if (!isEmailSended) {
            throw new Errors_1.ApplicationException("Error while sending email", 400);
        }
        // step: update emailOtp
        const updatedUset = await user_model_1.UserModel.findOneAndUpdate({ email: user.email }, {
            $set: {
                emailOtp: {
                    otp: otpCode,
                    expiredAt: new Date(Date.now() + 5 * 60 * 1000),
                },
            },
        }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({ res, message: "OTP sended successfully" });
    };
    // ============================ updatePassword ============================
    updatePassword = async (req, res, next) => {
        const user = res.locals.user;
        const { currentPassword, newPassword } = req.body;
        // step: check password correction
        if (!(await (0, bcrypt_1.compare)(currentPassword, user.password))) {
            throw new Errors_1.ApplicationException("Invalid credentials", 401);
        }
        // step: check newPassword not equal currentPassword
        if (await (0, bcrypt_1.compare)(newPassword, user.password)) {
            throw new Errors_1.ApplicationException("You can not make new password equal to old password", 400);
        }
        // step: update password and credentialsChangedAt
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, {
            $set: {
                password: newPassword,
                credentialsChangedAt: new Date(Date.now()),
            },
        }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Password updated successfully, please login again",
        });
    };
    // ============================ forgetPassword ============================
    forgetPassword = async (req, res, next) => {
        const { email } = req.body;
        // step: check email existence
        const isUserExist = await user_model_1.UserModel.findOne({ email });
        if (!isUserExist) {
            throw new Errors_1.ApplicationException("User not found", 404);
        }
        const user = isUserExist;
        // step: check if password otp not expired yet
        if (user.passwordOtp?.expiredAt > new Date(Date.now())) {
            throw new Errors_1.ApplicationException("Your OTP not expired yet", 400);
        }
        // step: send email otp
        const otpCode = (0, createOtp_1.createOtp)();
        // const otpCode = "555";
        const { isEmailSended, info } = await (0, send_email_1.sendEmail)({
            to: user.email,
            subject: "Reset password OTP",
            html: (0, generateHTML_1.template)({
                otpCode,
                receiverName: user.firstName,
                subject: "Reset password OTP",
            }),
        });
        if (!isEmailSended) {
            throw new Errors_1.ApplicationException("Error while sending email", 400);
        }
        // step: update passwordOtp
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, {
            $set: {
                passwordOtp: {
                    otp: otpCode,
                    expiredAt: new Date(Date.now() + 5 * 60 * 1000),
                },
            },
        }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "OTP sended to email, please use it to restart your password",
        });
    };
    // ============================ changePassword ============================
    changePassword = async (req, res, next) => {
        const { email, otp, newPassword } = req.body;
        // step: check email existence
        const isUserExist = await user_model_1.UserModel.findOne({ email });
        if (!isUserExist) {
            throw new Errors_1.ApplicationException("User not found", 404);
        }
        const user = isUserExist;
        // step: check otp
        if (!(await (0, bcrypt_1.compare)(otp, user.passwordOtp.otp))) {
            throw new Errors_1.ApplicationException("Invalid OTP", 400);
        }
        // step: change password
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ email }, {
            $set: {
                password: newPassword,
            },
        }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Password changed successfully, You have to login",
        });
    };
    // ============================ enable2FA ============================
    enable2FA = async (req, res, next) => {
        const user = res.locals.user;
        // step: send email otp
        const otpCode = (0, createOtp_1.createOtp)();
        const { isEmailSended, info } = await (0, send_email_1.sendEmail)({
            to: user.email,
            subject: "ImaginoApp",
            html: (0, generateHTML_1.template)({
                otpCode,
                receiverName: user.firstName,
                subject: "Enable 2FA",
            }),
        });
        if (!isEmailSended) {
            throw new Errors_1.ApplicationException("Error while sending email", 400);
        }
        // step: save OTP
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, {
            $set: {
                otp2FA: {
                    otp: otpCode,
                    expiredAt: new Date(Date.now() + 5 * 60 * 1000),
                },
            },
        }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "OTP sended to your email plz confirm it to active 2FA",
        });
    };
    // ============================ activeDeactive2FA ============================
    activeDeactive2FA = async (req, res, next) => {
        const user = res.locals.user;
        const otp = req.body?.otp;
        console.log({ otp });
        // step: check otp existence
        if (!otp) {
            const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, { $set: { is2FAActive: false } }, {
                new: true,
                runValidators: true,
                context: "query",
            });
            return (0, successHandler_1.successHandler)({ res, message: "2FA disabled successfully" });
        }
        // step: check otp value
        if (!user?.otp2FA?.otp) {
            throw new Errors_1.ApplicationException("OTP not correct", 400);
        }
        if (!(await (0, bcrypt_1.compare)(otp, user?.otp2FA?.otp))) {
            throw new Errors_1.ApplicationException("OTP not correct", 400);
        }
        if (user?.otp2FA?.expiredAt < new Date(Date.now())) {
            throw new Errors_1.ApplicationException("OTP expired", 400);
        }
        // step: update 2fa
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, { $set: { is2FAActive: true } }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({ res, message: "2FA enabled successfully" });
    };
    // ============================ check2FAOTP ============================
    check2FAOTP = async (req, res, next) => {
        const { userId, otp } = req.body;
        const user = await user_model_1.UserModel.findOne({ _id: userId });
        // step: check OTP
        if (!user?.otp2FA?.otp) {
            throw new Errors_1.ApplicationException("Invalid credentials", 400);
        }
        if (!(await (0, bcrypt_1.compare)(otp, user?.otp2FA?.otp))) {
            throw new Errors_1.ApplicationException("Invalid credentials", 400);
        }
        // step: create token
        const accessToken = (0, jwt_1.createJwt)({ userId: user._id, userEmail: user.email }, process.env.ACCESS_SEGNATURE, {
            expiresIn: "1h",
            jwtid: (0, createOtp_1.createOtp)(),
        });
        const refreshToken = (0, jwt_1.createJwt)({ userId: user._id, userEmail: user.email }, process.env.REFRESH_SEGNATURE, {
            expiresIn: "7d",
            jwtid: (0, createOtp_1.createOtp)(),
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Loggedin successfully",
            result: { accessToken, refreshToken },
        });
    };
    // ============================ logout ============================
    logout = async (req, res, next) => {
        const user = res.locals.user;
        // step: change credentialsChangedAt
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, {
            $set: {
                credentialsChangedAt: new Date(Date.now()),
            },
        }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Logged out successfully",
        });
    };
}
exports.AuthServices = AuthServices;
