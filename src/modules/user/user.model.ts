import mongoose, { HydratedDocument, model, Schema, Types } from "mongoose";
import { hash } from "../../utils/bcrypt";
import { decrypt, encrypt } from "../../utils/crypto";
import { ApplicationException } from "../../utils/Errors";
import { Gender, IUser, Role } from "../../types/user.module.types";

const userSchema = new Schema<IUser>(
  {
    // personal info
    firstName: {
      type: String,
      trim: true,
      minlength: 3,
      maxlength: 20,
      required: true,
    },
    lastName: {
      type: String,
      trim: true,
      minlength: 3,
      maxlength: 20,
      required: true,
    },
    age: { type: Number, min: 18, max: 200 },
    gender: { type: String, enum: Object.values(Gender), default: Gender.MALE },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => /^\+?[1-9]\d{7,14}$/.test(v.replace(/[\s-]/g, "")),
        message: (props) => `${props.value} is not a valid phone number!`,
      },
      set: (value: string) => (value ? encrypt(value) : undefined),
      get: (value: string) => (value ? decrypt(value) : undefined),
    },
    role: { type: String, enum: Object.values(Role), default: Role.USER },
    // auth and OTP
    email: { type: String, required: true, unique: true },
    emailOtp: { otp: { type: String }, expiredAt: Date },
    newEmail: { type: String },
    newEmailOtp: { otp: { type: String }, expiredAt: Date },
    emailConfirmed: { type: Date },
    password: { type: String, min: 3, max: 20, required: true },
    passwordOtp: { otp: { type: String }, expiredAt: Date },
    credentialsChangedAt: Date,
    isActive: { type: Boolean, default: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    // others
    profileImage: { type: String },
    is2FAActive: { type: Boolean, default: false },
    otp2FA: { otp: { type: String }, expiredAt: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
// virtuals
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});
userSchema.virtual("fullName").set(function (value) {
  const [firstName, lastName] = value.split(" ") || [];
  this.set({ firstName, lastName });
});

// hooks

// pre save
userSchema.pre(
  "save",
  async function (
    this: HydratedDocument<IUser> & { isFirstCreation: boolean },
    next
  ) {
    this.isFirstCreation = this.isNew;
    if (this.emailOtp && this.isModified("emailOtp")) {
      this.emailOtp = {
        otp: await hash(this.emailOtp?.otp),
        expiredAt: this.emailOtp?.expiredAt,
      };
    }
    if (this.newEmailOtp && this.isModified("newEmailOtp")) {
      this.newEmailOtp = {
        otp: await hash(this.newEmailOtp?.otp),
        expiredAt: this.newEmailOtp?.expiredAt,
      };
    }
    if (this.password && this.isModified("password")) {
      this.password = await hash(this.password);
    }
    if (this.passwordOtp && this.isModified("passwordOtp")) {
      this.passwordOtp = {
        otp: await hash(this.passwordOtp?.otp),
        expiredAt: this.passwordOtp?.expiredAt,
      };
    }
    if (this.otp2FA && this.isModified("otp2FA")) {
      this.otp2FA = {
        otp: await hash(this.otp2FA?.otp),
        expiredAt: this.otp2FA?.expiredAt,
      };
    }
  }
);

userSchema.pre("findOneAndUpdate", async function () {
  const update: any = this.getUpdate();
  if (!update) return;
  const $set = update.$set || update;
  if ($set.emailOtp?.otp) {
    $set.emailOtp.otp = await hash($set.emailOtp.otp);
  }
  if ($set.newEmailOtp?.otp) {
    $set.newEmailOtp.otp = await hash($set.newEmailOtp.otp);
  }
  if ($set.password) {
    $set.password = await hash($set.password);
  }
  if ($set.passwordOtp?.otp) {
    $set.passwordOtp.otp = await hash($set.passwordOtp.otp);
  }
  if ($set.otp2FA?.otp) {
    $set.otp2FA.otp = await hash($set.otp2FA.otp);
  }
  if (!update.$set && $set !== update) {
    update.$set = $set;
  }
});

// model
export const UserModel = model<IUser>("user", userSchema);
