import { Router } from "express";
import { signup } from "../controllers/auth.controller.js";


const router = Router();

router.route("/").post(signup);

export default router;
