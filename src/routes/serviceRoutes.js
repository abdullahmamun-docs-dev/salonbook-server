import express from "express";
import { ObjectId } from "mongodb";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

let db;

const setDatabase = (database) => {
  db = database;
};

/*
  GET ACTIVE SERVICES
  Public
*/
router.get("/", async (req, res) => {
  try {
    const services = await db
      .collection("services")
      .find({ status: "active" })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(services);
  } catch (error) {
    console.error("Get services error:", error);

    res.status(500).json({
      message: "Failed to fetch services",
    });
  }
});

/*
  GET ALL SERVICES FOR ADMIN
  Admin only
*/
router.get(
  "/admin/all",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const services = await db
        .collection("services")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json(services);
    } catch (error) {
      console.error("Get admin services error:", error);

      res.status(500).json({
        message: "Failed to fetch admin services",
      });
    }
  }
);

/*
  GET SINGLE ACTIVE SERVICE
  Public
*/
router.get("/:id", async (req, res) => {
  try {
    const serviceId = req.params.id;

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID",
      });
    }

    const service = await db.collection("services").findOne({
      _id: new ObjectId(serviceId),
      status: "active",
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    res.status(200).json(service);
  } catch (error) {
    console.error("Get service error:", error);

    res.status(500).json({
      message: "Failed to fetch service",
    });
  }
});

/*
  CREATE SERVICE
  Admin only
*/
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
        serviceName,
        category,
        description,
        price,
        duration,
        image,
      } = req.body;

      if (
        !serviceName ||
        !category ||
        !description ||
        price === undefined ||
        duration === undefined ||
        !image
      ) {
        return res.status(400).json({
          message: "All service fields are required",
        });
      }

      if (Number(price) <= 0 || Number(duration) <= 0) {
        return res.status(400).json({
          message: "Price and duration must be positive",
        });
      }

      const newService = {
        serviceName: serviceName.trim(),
        category: category.trim(),
        description: description.trim(),
        price: Number(price),
        duration: Number(duration),
        image: image.trim(),
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db
        .collection("services")
        .insertOne(newService);

      res.status(201).json({
        message: "Service created successfully",
        serviceId: result.insertedId,
      });
    } catch (error) {
      console.error("Create service error:", error);

      res.status(500).json({
        message: "Failed to create service",
      });
    }
  }
);

/*
  UPDATE SERVICE
  Admin only
*/
router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const serviceId = req.params.id;

      if (!ObjectId.isValid(serviceId)) {
        return res.status(400).json({
          message: "Invalid service ID",
        });
      }

      const {
        serviceName,
        category,
        description,
        price,
        duration,
        image,
        status,
      } = req.body;

      if (
        !serviceName ||
        !category ||
        !description ||
        price === undefined ||
        duration === undefined ||
        !image
      ) {
        return res.status(400).json({
          message: "All service fields are required",
        });
      }

      if (Number(price) <= 0 || Number(duration) <= 0) {
        return res.status(400).json({
          message: "Price and duration must be positive",
        });
      }

      const result = await db
        .collection("services")
        .updateOne(
          {
            _id: new ObjectId(serviceId),
          },
          {
            $set: {
              serviceName: serviceName.trim(),
              category: category.trim(),
              description: description.trim(),
              price: Number(price),
              duration: Number(duration),
              image: image.trim(),
              status:
                status === "inactive"
                  ? "inactive"
                  : "active",
              updatedAt: new Date(),
            },
          }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          message: "Service not found",
        });
      }

      res.status(200).json({
        message: "Service updated successfully",
      });
    } catch (error) {
      console.error("Update service error:", error);

      res.status(500).json({
        message: "Failed to update service",
      });
    }
  }
);

/*
  CHANGE SERVICE STATUS
  Admin only
*/
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const serviceId = req.params.id;
      const { status } = req.body;

      if (!ObjectId.isValid(serviceId)) {
        return res.status(400).json({
          message: "Invalid service ID",
        });
      }

      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({
          message:
            "Status must be active or inactive",
        });
      }

      const result = await db
        .collection("services")
        .updateOne(
          {
            _id: new ObjectId(serviceId),
          },
          {
            $set: {
              status,
              updatedAt: new Date(),
            },
          }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          message: "Service not found",
        });
      }

      res.status(200).json({
        message: `Service ${status} successfully`,
      });
    } catch (error) {
      console.error(
        "Change service status error:",
        error
      );

      res.status(500).json({
        message: "Failed to update service status",
      });
    }
  }
);

/*
  DELETE SERVICE
  Admin only
*/
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const serviceId = req.params.id;

      if (!ObjectId.isValid(serviceId)) {
        return res.status(400).json({
          message: "Invalid service ID",
        });
      }

      const result = await db
        .collection("services")
        .deleteOne({
          _id: new ObjectId(serviceId),
        });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          message: "Service not found",
        });
      }

      res.status(200).json({
        message: "Service deleted successfully",
      });
    } catch (error) {
      console.error("Delete service error:", error);

      res.status(500).json({
        message: "Failed to delete service",
      });
    }
  }
);

export {
  router,
  setDatabase,
};