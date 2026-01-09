import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import Expense from "../models/expense.model.js";
import dotenv from "dotenv";

dotenv.config();

export const addExpenseInAnyCurrency = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            amount, 
            currency, 
            category, 
            date,
            paidBy, 
            group, 
            splitType, 
            splitDetails, 
            paymentMethod,
            tags,
            isRecurring,
            recurringFrequency,
            notes,
            attachments
        } = req.body;
        
        const userId = req.user._id;
        
        if (!title || !amount || !currency || !category) {
            return res.status(400).json({ message: "Title, amount, currency, and category are required" });
        }
        
        if (title.length < 3) {
            return res.status(400).json({ message: "Title must be at least 3 characters" });
        }
        
        if (amount <= 0) {
            return res.status(400).json({ message: "Amount must be greater than 0" });
        }
        
        if (splitType && splitType !== "none" && (!splitDetails || !Array.isArray(splitDetails) || splitDetails.length === 0)) {
            return res.status(400).json({ message: "Split details are required when split type is not 'none'" });
        }
        
        const queries = [];
        
        if (group) {
            queries.push(Group.findById(group).select('_id members').lean());
        }
        
        if (paidBy && paidBy !== userId.toString()) {
            queries.push(User.findById(paidBy).select('_id').lean());
        }
        
        const results = await Promise.all(queries);
        
        if (group) {
            const groupExists = results[0];
            if (!groupExists) {
                return res.status(404).json({ message: "Group not found" });
            }
            
            const isMember = groupExists.members.some(memberId => memberId.toString() === userId.toString());
            if (!isMember) {
                return res.status(403).json({ message: "You are not a member of this group" });
            }
        }
        
        if (paidBy && paidBy !== userId.toString()) {
            const userExists = results[group ? 1 : 0];
            if (!userExists) {
                return res.status(404).json({ message: "User specified in paidBy not found" });
            }
        }
        
        const expense = await Expense.create({ 
            title, 
            description: description || "", 
            amount,
            currency: currency.toUpperCase(),
            category,
            date: date || Date.now(),
            paidBy: paidBy || userId,
            group: group || null,
            splitType: splitType || "none",
            splitDetails: splitDetails || [],
            paymentMethod: paymentMethod || "Cash",
            tags: tags || [],
            isRecurring: isRecurring || false,
            recurringFrequency: recurringFrequency || null,
            notes: notes || "",
            attachments: attachments || []
        });
        
        return res.status(201).json({
            message: "Expense created successfully",
            expense: {
                id: expense._id,
                title: expense.title,
                description: expense.description,
                amount: expense.amount,
                currency: expense.currency,
                category: expense.category,
                date: expense.date,
                paidBy: expense.paidBy,
                group: expense.group,
                splitType: expense.splitType,
                paymentMethod: expense.paymentMethod
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const deleteExpense = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;
        
        if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: "Invalid expense ID" });
        }
        
        const expense = await Expense.findById(id).select('paidBy').lean();
        
        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }
        
        if (expense.paidBy.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You are not authorized to delete this expense" });
        }
        
        await Expense.findByIdAndDelete(id);
        
        return res.status(200).json({ 
            message: "Expense deleted successfully",
            deletedExpenseId: id
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};