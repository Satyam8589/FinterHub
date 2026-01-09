import { Router } from "express";
import { addExpenseInAnyCurrency } from "../controllers/expense.controller.js";
import { auth } from "../middleware/auth.js";


const router = Router();

router.route("/add-expense-in-any-currency").post(auth, addExpenseInAnyCurrency);

export default router;