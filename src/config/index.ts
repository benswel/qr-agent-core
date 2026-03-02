import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3100", 10),
  host: process.env.HOST || "0.0.0.0",
  baseUrl: process.env.BASE_URL || "http://localhost:3100",
  db: {
    url: process.env.DATABASE_URL || "./data/qr-agent.db",
  },
  shortId: {
    length: parseInt(process.env.SHORT_ID_LENGTH || "8", 10),
  },
  adminSecret: process.env.ADMIN_SECRET || "",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    priceId: process.env.STRIPE_PRICE_ID || "",
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.RESEND_FROM || "QR for Agent <hi@qrforagent.com>",
  },
} as const;
