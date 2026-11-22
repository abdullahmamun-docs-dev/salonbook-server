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
  GET ALL USERS
  Admin only
*/
router.get(
  "/admin/all",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const users = await db
        .collection("user")
        .find({})
        .sort({ createdAt: -1 })
        .project({
          name: 1,
          email: 1,
          role: 1,
          isBlocked: 1,
          emailVerified: 1,
          createdAt: 1,
        })
        .toArray();

      res.status(200).json(users);
    } catch (error) {
      console.error("Get admin users error:", error);

      res.status(500).json({
        message: "Failed to fetch users",
      });
    }
  }
);

/*
  BLOCK USER
  Admin only
*/
router.patch(
  "/:id/block",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const userId = req.params.id;

      if (!ObjectId.isValid(userId)) {
        return res.status(400).json({
          message: "Invalid user ID",
        });
      }

      if (req.user._id?.toString() === userId) {
        return res.status(400).json({
          message: "You cannot block your own admin account",
        });
      }

      const result = await db.collection("user").updateOne(
        {
          _id: new ObjectId(userId),
        },
        {
          $set: {
            isBlocked: true,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      res.status(200).json({
        message: "User blocked successfully",
      });
    } catch (error) {
      console.error("Block user error:", error);

      res.status(500).json({
        message: "Failed to block user",
      });
    }
  }
);

/*
  UNBLOCK USER
  Admin only
*/
router.patch(
  "/:id/unblock",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const userId = req.params.id;

      if (!ObjectId.isValid(userId)) {
        return res.status(400).json({
          message: "Invalid user ID",
        });
      }

      const result = await db.collection("user").updateOne(
        {
          _id: new ObjectId(userId),
        },
        {
          $set: {
            isBlocked: false,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      res.status(200).json({
        message: "User unblocked successfully",
      });
    } catch (error) {
      console.error("Unblock user error:", error);

      res.status(500).json({
        message: "Failed to unblock user",
      });
    }
  }
);

export {
  router,
  setDatabase,
};