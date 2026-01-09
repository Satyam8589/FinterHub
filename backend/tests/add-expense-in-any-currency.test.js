import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { addExpenseInAnyCurrency } from "../controllers/expense.controller.js";
import { createGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import Expense from "../models/expense.model.js";

process.env.NODE_ENV = 'test';

dotenv.config();

const app = express();
app.use(express.json());
app.post("/api/group/create-group", auth, createGroup);
app.post("/api/expense/add-expense-in-any-currency", auth, addExpenseInAnyCurrency);

beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URL);
    }
});

afterAll(async () => {
    await Group.deleteMany({});
    await User.deleteMany({ email: { $regex: /@test\.com$/ } });
    await Expense.deleteMany({});
    await mongoose.connection.close();
});

describe("Add Expense In Any Currency Controller Tests", () => {
    
    const createUserAndGetToken = async (emailSuffix = Date.now()) => {
        const userData = {
            name: `Test User ${emailSuffix}`,
            email: `testuser${emailSuffix}@test.com`,
            password: "password123"
        };

        const user = await User.create({
            name: userData.name,
            email: userData.email,
            password: userData.password
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        return { user, token };
    };

    const createTestGroup = async (token, groupName = `Test Group ${Date.now()}`) => {
        const groupData = {
            name: groupName,
            description: "Test group for expense tests"
        };

        const response = await request(app)
            .post("/api/group/create-group")
            .set("Authorization", `Bearer ${token}`)
            .send(groupData);

        return response.body.group;
    };

    afterEach(async () => {
        await Group.deleteMany({});
        await Expense.deleteMany({});
    });

    describe("Success Cases", () => {
        
        it("should successfully create a personal expense (no group)", async () => {
            const { token } = await createUserAndGetToken(1);

            const expenseData = {
                title: "Lunch at Restaurant",
                description: "Team lunch",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.message).toBe("Expense created successfully");
            expect(response.body.expense).toHaveProperty("id");
            expect(response.body.expense.title).toBe("Lunch at Restaurant");
            expect(response.body.expense.amount).toBe(50.00);
            expect(response.body.expense.currency).toBe("USD");
            expect(response.body.expense.category).toBe("Food & Dining");
            expect(response.body.expense.group).toBeNull();
        });

        it("should successfully create a group expense", async () => {
            const { token } = await createUserAndGetToken(2);
            const group = await createTestGroup(token, "Expense Group");

            const expenseData = {
                title: "Dinner Party",
                amount: 100.00,
                currency: "EUR",
                category: "Food & Dining",
                group: group.id
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.group).toBe(group.id);
            expect(response.body.expense.title).toBe("Dinner Party");
        });

        it("should create expense with all optional fields", async () => {
            const { user, token } = await createUserAndGetToken(3);
            const group = await createTestGroup(token, "Full Fields Group");

            const expenseData = {
                title: "Complete Expense",
                description: "Expense with all fields",
                amount: 250.50,
                currency: "GBP",
                category: "Travel",
                date: new Date("2026-01-01"),
                paidBy: user._id.toString(),
                group: group.id,
                splitType: "equal",
                splitDetails: [
                    { user: user._id.toString(), amount: 125.25, settled: false }
                ],
                paymentMethod: "Credit Card",
                tags: ["business", "travel"],
                isRecurring: true,
                recurringFrequency: "monthly",
                notes: "Important expense",
                attachments: [{ filename: "receipt.pdf", url: "http://example.com/receipt.pdf" }]
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.title).toBe("Complete Expense");
            expect(response.body.expense.amount).toBe(250.50);
            expect(response.body.expense.paymentMethod).toBe("Credit Card");
        });

        it("should convert currency to uppercase", async () => {
            const { token } = await createUserAndGetToken(4);

            const expenseData = {
                title: "Currency Test",
                amount: 75.00,
                currency: "inr",
                category: "Shopping"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.currency).toBe("INR");
        });

        it("should use default values for optional fields", async () => {
            const { token } = await createUserAndGetToken(5);

            const expenseData = {
                title: "Minimal Expense",
                amount: 20.00,
                currency: "USD",
                category: "Other"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.splitType).toBe("none");
            expect(response.body.expense.paymentMethod).toBe("Cash");
        });

        it("should create expense with different categories", async () => {
            const { token } = await createUserAndGetToken(6);

            const categories = ["Food & Dining", "Transportation", "Shopping", "Entertainment", 
                               "Bills & Utilities", "Healthcare", "Travel", "Education", 
                               "Groceries", "Rent", "Other"];

            for (let i = 0; i < categories.length; i++) {
                const expenseData = {
                    title: `${categories[i]} Expense`,
                    amount: 10.00 + i,
                    currency: "USD",
                    category: categories[i]
                };

                const response = await request(app)
                    .post("/api/expense/add-expense-in-any-currency")
                    .set("Authorization", `Bearer ${token}`)
                    .send(expenseData)
                    .expect(201);

                expect(response.body.expense.category).toBe(categories[i]);
            }
        });

        it("should create expense with split type equal", async () => {
            const { user, token } = await createUserAndGetToken(7);

            const expenseData = {
                title: "Split Expense",
                amount: 100.00,
                currency: "USD",
                category: "Food & Dining",
                splitType: "equal",
                splitDetails: [
                    { user: user._id.toString(), amount: 50.00, settled: false }
                ]
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.splitType).toBe("equal");
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 400 if title is missing", async () => {
            const { token } = await createUserAndGetToken(8);

            const expenseData = {
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            expect(response.body.message).toBe("Title, amount, currency, and category are required");
        });

        it("should return 400 if amount is missing", async () => {
            const { token } = await createUserAndGetToken(9);

            const expenseData = {
                title: "Test Expense",
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            expect(response.body.message).toBe("Title, amount, currency, and category are required");
        });

        it("should return 400 if currency is missing", async () => {
            const { token } = await createUserAndGetToken(10);

            const expenseData = {
                title: "Test Expense",
                amount: 50.00,
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            expect(response.body.message).toBe("Title, amount, currency, and category are required");
        });

        it("should return 400 if category is missing", async () => {
            const { token } = await createUserAndGetToken(11);

            const expenseData = {
                title: "Test Expense",
                amount: 50.00,
                currency: "USD"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            expect(response.body.message).toBe("Title, amount, currency, and category are required");
        });

        it("should return 400 if title is less than 3 characters", async () => {
            const { token } = await createUserAndGetToken(12);

            const expenseData = {
                title: "AB",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            expect(response.body.message).toBe("Title must be at least 3 characters");
        });

        it("should return 400 if amount is zero (treated as falsy)", async () => {
            const { token } = await createUserAndGetToken(13);

            const expenseData = {
                title: "Zero Amount",
                amount: 0,
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            // Amount of 0 is falsy, so it triggers the required fields check
            expect(response.body.message).toBe("Title, amount, currency, and category are required");
        });

        it("should return 400 if amount is negative", async () => {
            const { token } = await createUserAndGetToken(14);

            const expenseData = {
                title: "Negative Amount",
                amount: -50.00,
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            expect(response.body.message).toBe("Amount must be greater than 0");
        });

        it("should return 400 if splitType is not 'none' but splitDetails is missing", async () => {
            const { token } = await createUserAndGetToken(15);

            const expenseData = {
                title: "Split Without Details",
                amount: 100.00,
                currency: "USD",
                category: "Food & Dining",
                splitType: "equal"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            expect(response.body.message).toBe("Split details are required when split type is not 'none'");
        });

        it("should return 400 if splitType is not 'none' but splitDetails is empty array", async () => {
            const { token } = await createUserAndGetToken(16);

            const expenseData = {
                title: "Split Empty Array",
                amount: 100.00,
                currency: "USD",
                category: "Food & Dining",
                splitType: "percentage",
                splitDetails: []
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(400);

            expect(response.body.message).toBe("Split details are required when split type is not 'none'");
        });

        it("should return 404 if group does not exist", async () => {
            const { token } = await createUserAndGetToken(17);
            const fakeGroupId = new mongoose.Types.ObjectId();

            const expenseData = {
                title: "Group Expense",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining",
                group: fakeGroupId.toString()
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 403 if user is not a member of the group", async () => {
            const { token: creatorToken } = await createUserAndGetToken(18);
            const { token: nonMemberToken } = await createUserAndGetToken(19);
            const group = await createTestGroup(creatorToken, "Private Group");

            const expenseData = {
                title: "Unauthorized Expense",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining",
                group: group.id
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${nonMemberToken}`)
                .send(expenseData)
                .expect(403);

            expect(response.body.message).toBe("You are not a member of this group");
        });

        it("should return 404 if paidBy user does not exist", async () => {
            const { token } = await createUserAndGetToken(20);
            const fakeUserId = new mongoose.Types.ObjectId();

            const expenseData = {
                title: "Invalid PaidBy",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining",
                paidBy: fakeUserId.toString()
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(404);

            expect(response.body.message).toBe("User specified in paidBy not found");
        });
    });

    describe("Authentication", () => {
        
        it("should return 401 if no token is provided", async () => {
            const expenseData = {
                title: "No Auth Expense",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .send(expenseData)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const expenseData = {
                title: "Invalid Token Expense",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", "Bearer invalid.token.here")
                .send(expenseData)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user } = await createUserAndGetToken(21);

            const expiredToken = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const expenseData = {
                title: "Expired Token Expense",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${expiredToken}`)
                .send(expenseData)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle very large amounts", async () => {
            const { token } = await createUserAndGetToken(22);

            const expenseData = {
                title: "Large Amount",
                amount: 999999999.99,
                currency: "USD",
                category: "Other"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.amount).toBe(999999999.99);
        });

        it("should handle very small amounts", async () => {
            const { token } = await createUserAndGetToken(23);

            const expenseData = {
                title: "Small Amount",
                amount: 0.01,
                currency: "USD",
                category: "Other"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.amount).toBe(0.01);
        });

        it("should handle different payment methods", async () => {
            const { token } = await createUserAndGetToken(24);

            const paymentMethods = ["Cash", "Credit Card", "Debit Card", "UPI", "Bank Transfer", "Other"];

            for (const method of paymentMethods) {
                const expenseData = {
                    title: `${method} Payment`,
                    amount: 50.00,
                    currency: "USD",
                    category: "Other",
                    paymentMethod: method
                };

                const response = await request(app)
                    .post("/api/expense/add-expense-in-any-currency")
                    .set("Authorization", `Bearer ${token}`)
                    .send(expenseData)
                    .expect(201);

                expect(response.body.expense.paymentMethod).toBe(method);
            }
        });

        it("should handle recurring expenses", async () => {
            const { token } = await createUserAndGetToken(25);

            const frequencies = ["daily", "weekly", "monthly", "yearly"];

            for (const freq of frequencies) {
                const expenseData = {
                    title: `${freq} Recurring`,
                    amount: 50.00,
                    currency: "USD",
                    category: "Bills & Utilities",
                    isRecurring: true,
                    recurringFrequency: freq
                };

                const response = await request(app)
                    .post("/api/expense/add-expense-in-any-currency")
                    .set("Authorization", `Bearer ${token}`)
                    .send(expenseData)
                    .expect(201);

                expect(response.body.expense.title).toBe(`${freq} Recurring`);
            }
        });

        it("should handle multiple tags", async () => {
            const { token } = await createUserAndGetToken(26);

            const expenseData = {
                title: "Tagged Expense",
                amount: 50.00,
                currency: "USD",
                category: "Other",
                tags: ["urgent", "business", "reimbursable", "tax-deductible"]
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.title).toBe("Tagged Expense");
        });

        it("should handle expense with current user as paidBy", async () => {
            const { user, token } = await createUserAndGetToken(27);

            const expenseData = {
                title: "Self Paid",
                amount: 50.00,
                currency: "USD",
                category: "Food & Dining",
                paidBy: user._id.toString()
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body.expense.paidBy).toBe(user._id.toString());
        });
    });

    describe("Response Format", () => {
        
        it("should return correct response structure", async () => {
            const { token } = await createUserAndGetToken(28);

            const expenseData = {
                title: "Structure Test",
                amount: 50.00,
                currency: "USD",
                category: "Other"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("expense");
            expect(response.body.expense).toHaveProperty("id");
            expect(response.body.expense).toHaveProperty("title");
            expect(response.body.expense).toHaveProperty("amount");
            expect(response.body.expense).toHaveProperty("currency");
            expect(response.body.expense).toHaveProperty("category");
            expect(response.body.expense).toHaveProperty("date");
            expect(response.body.expense).toHaveProperty("paidBy");
            expect(response.body.expense).toHaveProperty("splitType");
            expect(response.body.expense).toHaveProperty("paymentMethod");
        });

        it("should return JSON content type", async () => {
            const { token } = await createUserAndGetToken(29);

            const expenseData = {
                title: "JSON Test",
                amount: 50.00,
                currency: "USD",
                category: "Other"
            };

            await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201)
                .expect("Content-Type", /json/);
        });
    });

    describe("Database Integrity", () => {
        
        it("should actually save expense to database", async () => {
            const { token } = await createUserAndGetToken(30);

            const expenseData = {
                title: "DB Save Test",
                amount: 50.00,
                currency: "USD",
                category: "Other"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            const savedExpense = await Expense.findById(response.body.expense.id);
            expect(savedExpense).toBeTruthy();
            expect(savedExpense.title).toBe("DB Save Test");
            expect(savedExpense.amount).toBe(50.00);
        });

        it("should save expense with correct timestamps", async () => {
            const { token } = await createUserAndGetToken(31);

            const expenseData = {
                title: "Timestamp Test",
                amount: 50.00,
                currency: "USD",
                category: "Other"
            };

            const response = await request(app)
                .post("/api/expense/add-expense-in-any-currency")
                .set("Authorization", `Bearer ${token}`)
                .send(expenseData)
                .expect(201);

            const savedExpense = await Expense.findById(response.body.expense.id);
            expect(savedExpense.createdAt).toBeInstanceOf(Date);
            expect(savedExpense.updatedAt).toBeInstanceOf(Date);
        });
    });
});
