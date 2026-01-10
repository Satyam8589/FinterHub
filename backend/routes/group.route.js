import { Router } from "express";
import { createGroup, inviteUserToGroup, getGroupMembers, removeUserFromGroup, listAllGroupsUserPresents } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.route("/create-group").post(auth, createGroup);

router.route("/invite-user-to-group/:groupId").post(auth, inviteUserToGroup);

router.route("/get-group-members/:groupId").get(auth, getGroupMembers);

router.route("/remove-user-from-group/:groupId").post(auth, removeUserFromGroup);

router.route("/list-all-groups-user-presents").get(auth, listAllGroupsUserPresents);

export default router;
