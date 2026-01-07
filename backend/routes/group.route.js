import { Router } from "express";
import { createGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.route("/create-group").post(auth, createGroup);

export default router;
