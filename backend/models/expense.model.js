import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        uppercase: true,
        default: "USD"
    },
    category: {
        type: String,
        required: true,
        enum: [
            "Food & Dining",
            "Transportation",
            "Shopping",
            "Entertainment",
            "Bills & Utilities",
            "Healthcare",
            "Travel",
            "Education",
            "Groceries",
            "Rent",
            "Other"
        ],
        default: "Other"
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        default: null
    },
    splitType: {
        type: String,
        enum: ["equal", "percentage", "custom", "none"],
        default: "none"
    },
    splitDetails: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        amount: {
            type: Number,
            min: 0
        },
        percentage: {
            type: Number,
            min: 0,
            max: 100
        },
        settled: {
            type: Boolean,
            default: false
        }
    }],
    paymentMethod: {
        type: String,
        enum: ["Cash", "Credit Card", "Debit Card", "UPI", "Bank Transfer", "Other"],
        default: "Cash"
    },
    attachments: [{
        filename: String,
        url: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    tags: [{
        type: String,
        trim: true
    }],
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringFrequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly"],
        default: null
    },
    notes: {
        type: String,
        trim: true,
        default: ""
    }
}, { timestamps: true });

// Indexes for better query performance
expenseSchema.index({ paidBy: 1 });
expenseSchema.index({ group: 1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ "splitDetails.user": 1 });
expenseSchema.index({ createdAt: -1 });

// Compound indexes
expenseSchema.index({ paidBy: 1, date: -1 });
expenseSchema.index({ group: 1, date: -1 });

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;