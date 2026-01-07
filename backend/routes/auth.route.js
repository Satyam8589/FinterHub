import { Router } from "express";
import { signup, login } from "../controllers/auth.controller.js";


const router = Router();

router.route("/api/auth/signup").post(signup);
router.route("/api/auth/login").post(login);

export default router;
