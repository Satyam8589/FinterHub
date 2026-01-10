import { Router } from "express";
import { addExpenseInAnyCurrency, deleteExpense, getExpenseById, getGroupExpenses, getUserExpenses, calculateGroupBalance } from "../controllers/expense.controller.js";
import { auth } from "../middleware/auth.js";


const router = Router();

router.route("/add-expense-in-any-currency").post(auth, addExpenseInAnyCurrency);
router.route("/delete-expense/:id").delete(auth, deleteExpense);
router.route("/get-expense/:id").get(auth, getExpenseById);
router.route("/get-group-expenses/:groupId").get(auth, getGroupExpenses);
router.route("/get-user-expenses").get(auth, getUserExpenses);
router.route("/calculate-group-balance/:groupId").get(auth, calculateGroupBalance);

export default router;