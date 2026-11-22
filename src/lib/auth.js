import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { jwt } from "better-auth/plugins";

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db("salonbook");

const auth = betterAuth({
  database: mongodbAdapter(db),

  baseURL: process.env.BETTER_AUTH_URL,

  basePath: "/api/auth",

  secret: process.env.BETTER_AUTH_SECRET,

  // ===============================
  // User Fields
  // ===============================

  user: {
    additionalFields: {
      role: {
        type: ["customer", "admin"],
        required: false,
        defaultValue: "customer",
        input: false,
      },

      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },

  // ===============================
  // Trusted Origins
  // ===============================

  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:5000",
    "https://salonbook-client-ten.vercel.app",
    "https://*.vercel.app",
  ],

  // ===============================
  // Cross-Origin Cookie Settings
  // ===============================

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",

    defaultCookieAttributes: {
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",

      secure:
        process.env.NODE_ENV === "production",

      httpOnly: true,

      path: "/",
    },
  },

  // ===============================
  // Email & Password
  // ===============================

  emailAndPassword: {
    enabled: true,
  },

  // ===============================
  // Google OAuth
  // ===============================

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  // ===============================
  // JWT
  // ===============================

  plugins: [
    jwt(),
  ],
});

export default auth;