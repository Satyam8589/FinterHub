import { Router } from "express";
import { createGroup, inviteUserToGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.route("/create-group").post(auth, createGroup);
router.route("/invite-user-to-group/:groupId").post(auth, inviteUserToGroup);

export default router;
