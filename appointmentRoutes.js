import express from "express";
import { ObjectId } from "mongodb";
import auth from "../lib/auth.js";

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
  Create appointment
*/
router.post("/", async (req, res) => {
  try {
    // Get current logged-in user from Better Auth session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return res.status(401).json({
        message: "Please sign in before booking an appointment",
      });
    }

    const userId = session.user.id;

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

    /*
      Date validation
    */
    const selectedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        message: "Invalid appointment date",
      });
    }

    /*
      Check active service
    */
    const service = await db.collection("services").findOne({
      _id: new ObjectId(serviceId),
      status: "active",
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found or inactive",
      });
    }

    /*
      Prevent duplicate active appointment
    */
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

    /*
      Create appointment
    */
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
});

/*
  Get current user's appointments
*/
router.get("/my", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return res.status(401).json({
        message: "Please sign in",
      });
    }

    const appointments = await db
      .collection("appointments")
      .find({
        userId: session.user.id,
      })
      .sort({
        createdAt: -1,
      })
      .toArray();

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Get my appointments error:", error);

    res.status(500).json({
      message: "Failed to fetch appointments",
    });
  }
});

export { router, setAppointmentDatabase, TIME_SLOTS };