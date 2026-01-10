import { Router } from "express";
import { signup, login, logout, refreshToken, getUserProfile } from "../controllers/auth.controller.js";
import { auth } from "../middleware/auth.js";


const router = Router();

router.route("/signup").post(signup);

router.route("/login").post(login);

router.route("/logout").post(logout);

router.route("/refresh-token").post(refreshToken);

router.route("/profile").get(auth, getUserProfile);

export default router;
