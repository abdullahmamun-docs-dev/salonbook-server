import express from "express";
import { ObjectId } from "mongodb";
import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

let db;

const setAppointmentDatabase = (database) => {
  db = database;
};

const TIME_SLOTS = [
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
];

/*
  Create Appointment
  Only authenticated customers can create appointments
*/
router.post(
  "/",
  requireAuth,
  requireRole("customer"),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const {
        serviceId,
        date,
        time,
        notes = "",
      } = req.body;

      if (!serviceId || !date || !time) {
        return res.status(400).json({
          message: "Service, date and time are required",
        });
      }

      if (!ObjectId.isValid(serviceId)) {
        return res.status(400).json({
          message: "Invalid service ID",
        });
      }

      if (!TIME_SLOTS.includes(time)) {
        return res.status(400).json({
          message: "Invalid appointment time slot",
        });
      }

      const selectedDate = new Date(`${date}T00:00:00`);

      if (Number.isNaN(selectedDate.getTime())) {
        return res.status(400).json({
          message: "Invalid appointment date",
        });
      }

      const service = await db.collection("services").findOne({
        _id: new ObjectId(serviceId),
        status: "active",
      });

      if (!service) {
        return res.status(404).json({
          message: "Service not found or inactive",
        });
      }

      // Prevent duplicate active appointments
      const existingAppointment = await db
        .collection("appointments")
        .findOne({
          userId,
          serviceId: new ObjectId(serviceId),
          date,
          time,
          status: {
            $in: ["pending", "confirmed"],
          },
        });

      if (existingAppointment) {
        return res.status(409).json({
          message:
            "You already have an active appointment for this service at this time",
        });
      }

      const appointment = {
        userId,

        serviceId: new ObjectId(serviceId),

        serviceName: service.serviceName,
        category: service.category,
        price: service.price,
        duration: service.duration,

        date,
        time,
        notes: notes.trim(),

        status: "pending",
        paymentStatus: "unpaid",

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db
        .collection("appointments")
        .insertOne(appointment);

      res.status(201).json({
        message: "Appointment created successfully",
        appointmentId: result.insertedId,
      });
    } catch (error) {
      console.error("Create appointment error:", error);

      res.status(500).json({
        message: "Failed to create appointment",
      });
    }
  }
);

/*
  Get My Appointments
  Only authenticated customers can access their own appointments
*/
router.get(
  "/my",
  requireAuth,
  requireRole("customer"),
  async (req, res) => {
    try {
      // console.log("========== MY APPOINTMENTS ==========");
      // console.log("User ID:", req.user.id);
      // console.log("User Email:", req.user.email);
      // console.log("User Role:", req.user.role);
      // console.log("======================================");

      const userId = req.user.id;

      const appointments = await db
        .collection("appointments")
        .find({
          userId,
        })
        .sort({
          createdAt: -1,
        })
        .toArray();

      console.log(
        "Appointments found:",
        appointments.length
      );

      res.status(200).json(appointments);
    } catch (error) {
      console.error(
        "Get my appointments error:",
        error
      );

      res.status(500).json({
        message: "Failed to fetch appointments",
      });
    }
  }
);

/*
  Admin - Get All Appointments
  Only authenticated admins can access all appointments
*/
router.get(
  "/admin/all",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const appointments = await db
        .collection("appointments")
        .aggregate([
          {
            $sort: {
              createdAt: -1,
            },
          },
          {
            $lookup: {
              from: "user",
              let: {
                userId: "$userId",
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [
                        {
                          $toString: "$_id",
                        },
                        "$$userId",
                      ],
                    },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    name: 1,
                    email: 1,
                  },
                },
              ],
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
              userId: 1,
              serviceId: 1,
              serviceName: 1,
              category: 1,
              price: 1,
              duration: 1,
              date: 1,
              time: 1,
              notes: 1,
              status: 1,
              paymentStatus: 1,
              createdAt: 1,
              updatedAt: 1,

              customer: {
                name: "$customer.name",
                email: "$customer.email",
              },
            },
          },
        ])
        .toArray();

      res.status(200).json(appointments);
    } catch (error) {
      console.error(
        "Get admin appointments error:",
        error
      );

      res.status(500).json({
        message: "Failed to fetch appointments",
      });
    }
  }
);

/*
  Admin - Confirm Appointment
  Only pending appointments can be confirmed
*/
router.patch(
  "/:id/confirm",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const appointmentId = req.params.id;

      if (!ObjectId.isValid(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const appointment = await db
        .collection("appointments")
        .findOne({
          _id: new ObjectId(appointmentId),
        });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status === "confirmed") {
        return res.status(400).json({
          message: "Appointment is already confirmed",
        });
      }

      if (appointment.status !== "pending") {
        return res.status(400).json({
          message:
            "Only pending appointments can be confirmed",
        });
      }

      const result = await db
        .collection("appointments")
        .updateOne(
          {
            _id: new ObjectId(appointmentId),
            status: "pending",
          },
          {
            $set: {
              status: "confirmed",
              updatedAt: new Date(),
            },
          }
        );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          message: "Appointment could not be confirmed",
        });
      }

      res.status(200).json({
        message: "Appointment confirmed successfully",
      });
    } catch (error) {
      console.error(
        "Confirm appointment error:",
        error
      );

      res.status(500).json({
        message: "Failed to confirm appointment",
      });
    }
  }
);

/*
  Admin - Cancel Appointment
*/
router.patch(
  "/:id/cancel-admin",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const appointmentId = req.params.id;

      if (!ObjectId.isValid(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const appointment = await db
        .collection("appointments")
        .findOne({
          _id: new ObjectId(appointmentId),
        });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status === "cancelled") {
        return res.status(400).json({
          message: "Appointment is already cancelled",
        });
      }

      if (
        appointment.status !== "pending" &&
        appointment.status !== "confirmed"
      ) {
        return res.status(400).json({
          message: "This appointment cannot be cancelled",
        });
      }

      await db.collection("appointments").updateOne(
        {
          _id: new ObjectId(appointmentId),
        },
        {
          $set: {
            status: "cancelled",
            updatedAt: new Date(),
          },
        }
      );

      res.status(200).json({
        message: "Appointment cancelled successfully",
      });
    } catch (error) {
      console.error(
        "Admin cancel appointment error:",
        error
      );

      res.status(500).json({
        message: "Failed to cancel appointment",
      });
    }
  }
);

/*
  Customer - Cancel Appointment
  Only the customer who owns the appointment can cancel it
*/
router.patch(
  "/:id/cancel",
  requireAuth,
  requireRole("customer"),
  async (req, res) => {
    try {
      const appointmentId = req.params.id;
      const userId = req.user.id;

      if (!ObjectId.isValid(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
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

      if (appointment.status === "cancelled") {
        return res.status(400).json({
          message: "Appointment is already cancelled",
        });
      }

      if (
        appointment.status !== "pending" &&
        appointment.status !== "confirmed"
      ) {
        return res.status(400).json({
          message: "This appointment cannot be cancelled",
        });
      }

      await db.collection("appointments").updateOne(
        {
          _id: new ObjectId(appointmentId),
          userId,
        },
        {
          $set: {
            status: "cancelled",
            updatedAt: new Date(),
          },
        }
      );

      res.status(200).json({
        message: "Appointment cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel appointment error:", error);

      res.status(500).json({
        message: "Failed to cancel appointment",
      });
    }
  }
);

export {
  router,
  setAppointmentDatabase,
  TIME_SLOTS,
};