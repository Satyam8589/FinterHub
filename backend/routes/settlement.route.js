import { Router } from "express";
import { generateSettlementPlan, getSettlementHistory, verifySettlement, recordSettlement } from "../controllers/settlement.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/:groupId/plan", auth, generateSettlementPlan);

router.get("/:groupId/history", auth, getSettlementHistory);

router.patch("/:groupId/verify/:settlementId", auth, verifySettlement);

router.patch("/:groupId/complete/:settlementId", auth, recordSettlement);

export default router;
