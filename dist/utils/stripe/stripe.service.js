"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = createCheckoutSession;
exports.createCoupon = createCoupon;
exports.createRefund = createRefund;
exports.retrievePaymentIntent = retrievePaymentIntent;
const stripe_1 = __importDefault(require("stripe"));
const Errors_1 = require("../Errors");
const stripe = new stripe_1.default(process.env.STIPE_SECRET_KEY);
// createCheckoutSession
async function createCheckoutSession({ success_url = process.env.SUCCESS_URL, cancel_url = process.env.CANCEL_URL, mode = "payment", discounts = [], metadata = {}, line_items, customer_email, }) {
    const session = await stripe.checkout.sessions.create({
        success_url,
        cancel_url,
        mode,
        discounts,
        metadata,
        ...(customer_email && { customer_email }),
        ...(line_items && { line_items }),
    });
    return session;
}
// createCoupon
async function createCoupon(data) {
    const coupon = await stripe.coupons.create(data);
    return coupon;
}
// createRefund
async function createRefund(id) {
    const paymentIntent = await retrievePaymentIntent(id);
    if (!paymentIntent)
        throw new Errors_1.ApplicationException("Invalid paymentIntent id", 404);
    const refund = await stripe.refunds.create({
        payment_intent: id,
    });
    return refund;
}
// retrievePaymentIntent
async function retrievePaymentIntent(id) {
    const paymentIntent = await stripe.paymentIntents.retrieve(id);
    return paymentIntent;
}
