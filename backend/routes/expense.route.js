import { Router } from "express";
import { addExpenseInAnyCurrency, deleteExpense } from "../controllers/expense.controller.js";
import { auth } from "../middleware/auth.js";


const router = Router();

router.route("/add-expense-in-any-currency").post(auth, addExpenseInAnyCurrency);
router.route("/delete-expense/:id").delete(auth, deleteExpense);

export default router;