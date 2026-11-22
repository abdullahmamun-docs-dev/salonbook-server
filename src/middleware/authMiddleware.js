import auth from "../lib/auth.js";
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("http://localhost:5000/api/auth/jwks")
);

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // ==========================================
    // 1. JWT Authentication
    // ==========================================

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        const { payload } = await jwtVerify(token, JWKS, {
          algorithms: ["EdDSA"],
        });

        if (!payload.sub) {
          return res.status(401).json({
            message: "Invalid JWT token.",
          });
        }

        const session = await auth.api.getSession({
          headers: req.headers,
        });

        if (!session?.user) {
          return res.status(401).json({
            message: "Unauthorized. Please sign in.",
          });
        }

        if (session.user.isBlocked === true) {
          return res.status(403).json({
            message: "Your account has been blocked.",
          });
        }

        req.user = session.user;

        return next();
      } catch (jwtError) {
        console.error("JWT verification failed:", jwtError);

        return res.status(401).json({
          message: "Invalid or expired JWT token.",
        });
      }
    }

    // ==========================================
    // 2. Existing Better Auth Session
    // ==========================================

    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return res.status(401).json({
        message: "Unauthorized. Please sign in.",
      });
    }

    if (session.user.isBlocked === true) {
      return res.status(403).json({
        message: "Your account has been blocked.",
      });
    }

    req.user = session.user;

    next();
  } catch (error) {
    console.error(
      "Authentication middleware error:",
      error
    );

    return res.status(500).json({
      message: "Authentication check failed",
    });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized. Please sign in.",
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    next();
  };
};

export { requireAuth, requireRole };