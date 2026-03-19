import { Router, Request, Response, NextFunction } from "express";
import passport from "../services/passport.js";

const router = Router();

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`,
  }),
  (req: Request, res: Response) => {
    res.redirect(process.env.FRONTEND_URL || "/");
  },
);

router.get("/auth/me", (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ user: null });
  res.json({ user: req.user });
});

router.post("/auth/logout", (req: Request, res: Response, next: NextFunction) => {
  // req.logout may require a callback in newer passport versions
  req.logout((err) => {
    if (err) return next(err);
    req.session?.destroy(() => res.sendStatus(200));
  });
});

export default router;
