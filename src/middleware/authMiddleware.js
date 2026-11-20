import auth from "../lib/auth.js";

const requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return res.status(401).json({
        message: "Unauthorized. Please sign in.",
      });
    }

    if (session.user.blocked === true) {
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