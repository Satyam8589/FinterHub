import { Router } from "express";
import { signup, login, logout, refreshToken } from "../controllers/auth.controller.js";


const router = Router();

router.route("/api/auth/signup").post(signup);
router.route("/api/auth/login").post(login);
router.route("/api/auth/logout").post(logout);
router.route("/api/auth/refresh-token").post(refreshToken);

export default router;
