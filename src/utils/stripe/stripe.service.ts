import Stripe from "stripe";
import { ApplicationException } from "../Errors";

const secretKey = process.env.STRIPE_SECRET_KEY as string;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}
const stripe = new Stripe(secretKey);
// createCheckoutSession
export async function createCheckoutSession({
  success_url = process.env.SUCCESS_URL as string,
  cancel_url = process.env.CANCEL_URL as string,
  mode = "payment",
  discounts = [],
  metadata = {},
  line_items,
  customer_email,
}: Stripe.Checkout.SessionCreateParams) {
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
export async function createCoupon(data: Stripe.CouponCreateParams) {
  const coupon = await stripe.coupons.create(data);
  return coupon;
}

// createRefund
export async function createRefund(id: string) {
  const paymentIntent = await retrievePaymentIntent(id);
  if (!paymentIntent)
    throw new ApplicationException("Invalid paymentIntent id", 404);
  const refund = await stripe.refunds.create({
    payment_intent: id,
  });
  return refund;
}
// retrievePaymentIntent
export async function retrievePaymentIntent(id: string) {
  const paymentIntent = await stripe.paymentIntents.retrieve(id);
  return paymentIntent;
}
