import { Router } from "express";
import { signup, login, logout, refreshToken } from "../controllers/auth.controller.js";


const router = Router();

router.route("/signup").post(signup);
router.route("/login").post(login);
router.route("/logout").post(logout);
router.route("/refresh-token").post(refreshToken);

export default router;
