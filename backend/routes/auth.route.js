import { Router } from "express";
import { signup, login, logout } from "../controllers/auth.controller.js";


const router = Router();

router.route("/api/auth/signup").post(signup);
router.route("/api/auth/login").post(login);
router.route("/api/auth/logout").post(logout);

export default router;
