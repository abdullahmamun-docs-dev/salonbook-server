import express from "express";
import Stripe from "stripe";
import { ObjectId } from "mongodb";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

let db;

const setDatabase = (database) => {
  db = database;
};

/*
  CREATE STRIPE CHECKOUT SESSION
  Customer only
*/
router.post(
  "/create-checkout-session",
  requireAuth,
  requireRole("customer"),
  async (req, res) => {
    try {
      const { appointmentId } = req.body;

      if (!appointmentId) {
        return res.status(400).json({
          message: "Appointment ID is required",
        });
      }

      if (!ObjectId.isValid(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const userId = req.user.id?.toString();

      if (!userId) {
        return res.status(401).json({
          message: "User authentication information is missing",
        });
      }

      const appointment = await db
        .collection("appointments")
        .findOne({
          _id: new ObjectId(appointmentId),
          userId,
        });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status !== "confirmed") {
        return res.status(400).json({
          message:
            "Payment is available only for confirmed appointments",
        });
      }

      if (appointment.paymentStatus === "paid") {
        return res.status(400).json({
          message: "This appointment has already been paid",
        });
      }

      const amount = Number(
        appointment.price ?? appointment.servicePrice
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          message: "Invalid appointment amount",
        });
      }

      let service = null;

      if (
        appointment.serviceId &&
        ObjectId.isValid(appointment.serviceId)
      ) {
        service = await db
          .collection("services")
          .findOne({
            _id: new ObjectId(appointment.serviceId),
          });
      }

      const serviceName =
        service?.serviceName || "Salon Appointment";

      const stripeAmount = Math.round(amount * 100);

      const clientUrl =
        process.env.CLIENT_URL || "http://localhost:3000";

      const session =
        await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: req.user.email,

          line_items: [
            {
              price_data: {
                currency: "bdt",
                product_data: {
                  name: serviceName,
                  description:
                    "SalonBook confirmed appointment",
                },
                unit_amount: stripeAmount,
              },
              quantity: 1,
            },
          ],

          metadata: {
            appointmentId: appointmentId.toString(),
            userId,
          },

          client_reference_id: appointmentId.toString(),

          success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

          cancel_url: `${clientUrl}/payment/cancel?appointment_id=${appointmentId}`,
        });

      res.status(200).json({
        message: "Checkout session created successfully",
        url: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      console.error(
        "Create Stripe checkout session error:",
        error
      );

      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to create payment session",
      });
    }
  }
);
/*
  GET ALL TRANSACTIONS
  Admin only
*/
router.get(
  "/admin/all",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const transactions = await db
        .collection("transactions")
        .aggregate([
          {
            $sort: {
              createdAt: -1,
            },
          },
          {
            $addFields: {
              customerObjectId: {
                $convert: {
                  input: "$customerId",
                  to: "objectId",
                  onError: null,
                  onNull: null,
                },
              },
            },
          },
          {
            $lookup: {
              from: "user",
              localField: "customerObjectId",
              foreignField: "_id",
              as: "customer",
            },
          },
          {
            $unwind: {
              path: "$customer",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              appointmentId: 1,
              customerId: 1,
              amount: 1,
              currency: 1,
              stripeSessionId: 1,
              status: 1,
              createdAt: 1,

              customerName: {
                $ifNull: [
                  "$customer.name",
                  "Unknown Customer",
                ],
              },

              customerEmail: {
                $ifNull: [
                  "$customer.email",
                  "Unknown Email",
                ],
              },
            },
          },
        ])
        .toArray();

      res.status(200).json(transactions);
    } catch (error) {
      console.error(
        "Admin transactions fetch error:",
        error
      );

      res.status(500).json({
        message: "Failed to fetch transactions",
      });
    }
  }
);
/*
  STRIPE WEBHOOK

  IMPORTANT:
  This route receives the raw Stripe request body.
  It must be registered before express.json()
  in server.js.
*/
const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error.message
    );

    return res
      .status(400)
      .send(`Webhook Error: ${error.message}`);
  }

  try {
    /*
      We only need checkout.session.completed
    */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      /*
        Stripe must confirm that the payment is actually paid.
      */
      if (session.payment_status !== "paid") {
        console.log(
          "Checkout completed but payment is not marked as paid:",
          session.id
        );

        return res.json({
          received: true,
        });
      }

      const appointmentId =
        session.metadata?.appointmentId;

      const userId = session.metadata?.userId;

      if (!appointmentId || !userId) {
        console.error(
          "Missing appointmentId or userId in Stripe metadata"
        );

        return res.status(400).json({
          message: "Missing payment metadata",
        });
      }

      if (!ObjectId.isValid(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      /*
        Find the appointment
      */
      const appointment = await db
        .collection("appointments")
        .findOne({
          _id: new ObjectId(appointmentId),
          userId,
        });

      if (!appointment) {
        console.error(
          "Appointment not found for Stripe payment:",
          appointmentId
        );

        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      /*
        Stripe amount is stored in the smallest currency unit.
        Example:
        220000 -> ৳2200
      */
      const amount =
        Number(session.amount_total || 0) / 100;

      const currency =
        session.currency || "bdt";

      /*
        Update appointment payment status
      */
      await db.collection("appointments").updateOne(
        {
          _id: new ObjectId(appointmentId),
          userId,
        },
        {
          $set: {
            paymentStatus: "paid",
            updatedAt: new Date(),
          },
        }
      );

      /*
        Save transaction.

        Using $setOnInsert + upsert prevents
        duplicate transaction records if Stripe
        sends the same webhook more than once.
      */
      await db.collection("transactions").updateOne(
        {
          stripeSessionId: session.id,
        },
        {
          $setOnInsert: {
            appointmentId: appointmentId.toString(),
            customerId: userId,
            amount,
            currency,
            stripeSessionId: session.id,
            status: "paid",
            createdAt: new Date(),
          },
        },
        {
          upsert: true,
        }
      );

      console.log(
        `Stripe payment verified successfully. Appointment ${appointmentId} marked as paid.`
      );
    }

    return res.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Stripe webhook processing error:",
      error
    );

    return res.status(500).json({
      message: "Webhook processing failed",
    });
  }
};

export {
  router,
  setDatabase,
  handleStripeWebhook,
};