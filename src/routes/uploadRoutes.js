import express from "express";
import multer from "multer";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post(
  "/image",
  requireAuth,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Image file is required",
        });
      }

      const formData = new FormData();

      formData.append(
        "key",
        process.env.IMGBB_API_KEY
      );

      const imageBase64 = req.file.buffer.toString(
        "base64"
      );

      formData.append("image", imageBase64);

      const response = await fetch(
        "https://api.imgbb.com/1/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error("ImgBB upload error:", data);

        return res.status(500).json({
          message: "Failed to upload image",
        });
      }

      res.status(200).json({
        message: "Image uploaded successfully",
        imageUrl: data.data.url,
        displayUrl: data.data.display_url,
        deleteUrl: data.data.delete_url,
      });
    } catch (error) {
      console.error("Image upload error:", error);

      res.status(500).json({
        message: "Image upload failed",
      });
    }
  }
);

export default router;