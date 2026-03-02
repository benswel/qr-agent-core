import Stripe from "stripe";
import { config } from "../../config/index.js";
import {
  getApiKeyById,
  getApiKeyByStripeCustomerId,
  setApiKeyPlan,
  setStripeCustomerId,
  setStripeSubscriptionId,
} from "../auth/auth.service.js";
import {
  sendProUpgradeEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
} from "../email/email.service.js";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    if (!config.stripe.secretKey) {
      throw new Error("STRIPE_NOT_CONFIGURED");
    }
    stripeClient = new Stripe(config.stripe.secretKey);
  }
  return stripeClient;
}

export async function createCheckoutSession(
  apiKeyId: number
): Promise<{ checkout_url: string } | { error: string }> {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "STRIPE_NOT_CONFIGURED" };
  }

  const apiKey = getApiKeyById(apiKeyId);
  if (!apiKey) return { error: "KEY_NOT_FOUND" };
  if (!apiKey.email) return { error: "EMAIL_REQUIRED" };
  if (apiKey.plan === "pro") return { error: "ALREADY_PRO" };

  // Reuse existing Stripe customer or create one
  let customerId = apiKey.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: apiKey.email,
      metadata: { api_key_id: String(apiKeyId) },
    });
    customerId = customer.id;
    setStripeCustomerId(apiKeyId, customerId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: config.stripe.priceId, quantity: 1 }],
    success_url: "https://qrforagent.com/checkout/success",
    cancel_url: "https://qrforagent.com/checkout/cancel",
    metadata: { api_key_id: String(apiKeyId) },
    subscription_data: {
      metadata: { api_key_id: String(apiKeyId) },
    },
  });

  return { checkout_url: session.url! };
}

export async function createPortalSession(
  apiKeyId: number
): Promise<{ portal_url: string } | { error: string }> {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "STRIPE_NOT_CONFIGURED" };
  }

  const apiKey = getApiKeyById(apiKeyId);
  if (!apiKey?.stripeCustomerId) return { error: "NO_SUBSCRIPTION" };

  const session = await stripe.billingPortal.sessions.create({
    customer: apiKey.stripeCustomerId,
    return_url: "https://qrforagent.com/pricing",
  });

  return { portal_url: session.url };
}

export async function handleWebhookEvent(
  rawBody: Buffer,
  signature: string
): Promise<{ received: true }> {
  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.stripe.webhookSecret
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const apiKeyId = Number(session.metadata?.api_key_id);
      if (apiKeyId) {
        setApiKeyPlan(apiKeyId, "pro");
        if (session.customer) {
          setStripeCustomerId(apiKeyId, session.customer as string);
        }
        if (session.subscription) {
          setStripeSubscriptionId(apiKeyId, session.subscription as string);
        }
        const apiKeyRecord = getApiKeyById(apiKeyId);
        if (apiKeyRecord?.email) {
          sendProUpgradeEmail(apiKeyRecord.email);
        }
      }
      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const apiKeyId = Number(subscription.metadata?.api_key_id);
      if (subscription.status === "active") {
        // Try metadata first (set during checkout), fallback to customer lookup
        if (apiKeyId) {
          setApiKeyPlan(apiKeyId, "pro");
          setStripeSubscriptionId(apiKeyId, subscription.id);
        } else {
          const apiKey = getApiKeyByStripeCustomerId(customerId);
          if (apiKey) {
            setApiKeyPlan(apiKey.id, "pro");
            setStripeSubscriptionId(apiKey.id, subscription.id);
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const apiKey = getApiKeyByStripeCustomerId(customerId);
      if (apiKey) {
        setApiKeyPlan(apiKey.id, "free");
        setStripeSubscriptionId(apiKey.id, null);
        if (apiKey.email) {
          sendCancellationEmail(apiKey.email);
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const apiKey = getApiKeyByStripeCustomerId(customerId);
      if (apiKey) {
        if (subscription.status === "active") {
          setApiKeyPlan(apiKey.id, "pro");
        } else if (
          subscription.status === "canceled" ||
          subscription.status === "unpaid"
        ) {
          setApiKeyPlan(apiKey.id, "free");
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      console.warn("Stripe invoice.payment_failed for customer:", customerId);
      const failedApiKey = getApiKeyByStripeCustomerId(customerId);
      if (failedApiKey?.email) {
        sendPaymentFailedEmail(failedApiKey.email);
      }
      break;
    }
  }

  return { received: true };
}
