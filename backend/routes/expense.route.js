import { Router } from "express";
import { addExpenseInAnyCurrency, deleteExpense, getExpenseById, getGroupExpenses } from "../controllers/expense.controller.js";
import { auth } from "../middleware/auth.js";


const router = Router();

router.route("/add-expense-in-any-currency").post(auth, addExpenseInAnyCurrency);
router.route("/delete-expense/:id").delete(auth, deleteExpense);
router.route("/get-expense/:id").get(auth, getExpenseById);
router.route("/get-group-expenses/:groupId").get(auth, getGroupExpenses);

export default router;