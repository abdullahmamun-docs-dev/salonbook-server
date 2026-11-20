import "dotenv/config";

import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import uploadRoutes from "./routes/uploadRoutes.js";

import connectDB from "./config/db.js";
import auth from "./lib/auth.js";

import {
  router as userRoutes,
  setDatabase as setUserDatabase,
} from "./routes/userRoutes.js";

import {
  router as paymentRoutes,
  setDatabase as setPaymentDatabase,
  handleStripeWebhook,
} from "./routes/paymentRoutes.js";

// import {
//   router as paymentRoutes,
//   setDatabase as setPaymentDatabase,
// } from "./routes/paymentRoutes.js";



import {
  router as serviceRoutes,
  setDatabase,
} from "./routes/serviceRoutes.js";

import {
  router as appointmentRoutes,
  setAppointmentDatabase,
} from "./routes/appointmentRoutes.js";

import {
  requireAuth,
  requireRole,
} from "./middleware/authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 5000;

const db = await connectDB();

setDatabase(db);
setAppointmentDatabase(db);
setUserDatabase(db);
setPaymentDatabase(db);
// ===============================
// CORS
// ===============================
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// ===============================
// Better Auth
// Must be before express.json()
// ===============================
app.all("/api/auth/*splat", toNodeHandler(auth));

// Stripe Webhook
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
); 

// ===============================
// JSON Body Parser
// ===============================
app.use(express.json());

// ===============================
// Server Test
// ===============================
app.get("/", (req, res) => {
  res.send("SalonBook Server is running!");
});

// ===============================
// Protected Admin Test Route
// ===============================
app.get(
  "/api/admin/test",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    res.status(200).json({
      message: "Admin access granted",
      user: req.user,
    });
  }
);

// ===============================
// Start Server
// ===============================
async function startServer() {
  try {
    // ===============================
    // API Routes
    // ===============================
    app.use("/api/services", serviceRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/appointments", appointmentRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/payments", paymentRoutes);
    // ===============================
    // Start Server
    // ===============================
    app.listen(PORT, () => {
      console.log(
        `SalonBook Server running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start SalonBook Server:", error);
    process.exit(1);
  }
}

startServer();