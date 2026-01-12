import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { getUserExpenses, addExpenseInAnyCurrency } from "../controllers/expense.controller.js";
import { createGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import Expense from "../models/expense.model.js";
import { connect, closeDatabase, clearDatabase } from "./setup/db.js";


process.env.NODE_ENV = 'test';

dotenv.config();

const app = express();
app.use(express.json());
app.post("/api/group/create-group", auth, createGroup);
app.post("/api/expense/add-expense-in-any-currency", auth, addExpenseInAnyCurrency);
app.get("/api/expense/get-user-expenses", auth, getUserExpenses);

// Connect to in-memory database
beforeAll(async () => {
    await connect();
});

// Clean up database after all tests
afterAll(async () => {
    await closeDatabase();
});

// Clear database after each test for clean slate
afterEach(async () => {
    await clearDatabase();
});


describe("Get User Expenses Controller Tests", () => {
    
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

    const createTestGroup = async (token, groupData = {}) => {
        const defaultData = {
            name: `Test Group ${Date.now()}`,
            description: "Test group description for testing",
            ...groupData
        };

        const response = await request(app)
            .post("/api/group/create-group")
            .set("Authorization", `Bearer ${token}`)
            .send(defaultData);

        return response.body.group;
    };

    const createTestExpense = async (token, expenseData = {}) => {
        const defaultData = {
            title: "Test Expense",
            amount: 100.00,
            currency: "USD",
            category: "Food & Dining",
            ...expenseData
        };

        const response = await request(app)
            .post("/api/expense/add-expense-in-any-currency")
            .set("Authorization", `Bearer ${token}`)
            .send(defaultData);

        return response.body.expense;
    };



    describe("Success Cases", () => {
        
        it("should successfully retrieve all user expenses", async () => {
            const { token } = await createUserAndGetToken(1);
            
            // Create 3 expenses
            await createTestExpense(token, { title: "Expense 1" });
            await createTestExpense(token, { title: "Expense 2" });
            await createTestExpense(token, { title: "Expense 3" });

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expenses retrieved successfully");
            expect(response.body.expenses).toBeDefined();
            expect(Array.isArray(response.body.expenses)).toBe(true);
            expect(response.body.expenses.length).toBe(3);
            expect(response.body.count).toBe(3);
        });

        it("should return empty array if user has no expenses", async () => {
            const { token } = await createUserAndGetToken(2);

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expenses retrieved successfully");
            expect(response.body.expenses).toEqual([]);
            expect(response.body.count).toBe(0);
        });

        it("should return expenses with correct paidBy details (current user)", async () => {
            const { user, token } = await createUserAndGetToken(3);
            await createTestExpense(token);

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.paidBy).toBeDefined();
            expect(expense.paidBy.id).toBe(user._id.toString());
            expect(expense.paidBy.name).toBe(user.name);
            expect(expense.paidBy.email).toBe(user.email);
        });

        it("should return expenses with populated group details", async () => {
            const { token } = await createUserAndGetToken(4);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.group).toBeDefined();
            expect(expense.group.id).toBe(group.id);
            expect(expense.group.name).toBe(group.name);
            expect(expense.group.description).toBe(group.description);
        });

        it("should return null group for personal expenses", async () => {
            const { token } = await createUserAndGetToken(5);
            await createTestExpense(token); // No group

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.group).toBeNull();
        });

        it("should return all expense fields including optional ones", async () => {
            const { token } = await createUserAndGetToken(6);
            
            await createTestExpense(token, {
                title: "Complete Expense",
                description: "Full description",
                amount: 250.50,
                currency: "EUR",
                category: "Travel",
                paymentMethod: "Credit Card",
                tags: ["business", "travel"],
                isRecurring: true,
                recurringFrequency: "monthly",
                notes: "Important notes",
                attachments: [
                    { filename: "receipt.jpg", url: "http://example.com/receipt.jpg" }
                ]
            });

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.title).toBe("Complete Expense");
            expect(expense.description).toBe("Full description");
            expect(expense.amount).toBe(250.50);
            expect(expense.currency).toBe("EUR");
            expect(expense.category).toBe("Travel");
            expect(expense.paymentMethod).toBe("Credit Card");
            expect(expense.tags).toEqual(["business", "travel"]);
            expect(expense.isRecurring).toBe(true);
            expect(expense.recurringFrequency).toBe("monthly");
            expect(expense.notes).toBe("Important notes");
            expect(expense.attachments.length).toBe(1);
        });

        it("should include timestamps in response", async () => {
            const { token } = await createUserAndGetToken(7);
            await createTestExpense(token);

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.createdAt).toBeDefined();
            expect(expense.updatedAt).toBeDefined();
            expect(new Date(expense.createdAt)).toBeInstanceOf(Date);
            expect(new Date(expense.updatedAt)).toBeInstanceOf(Date);
        });

        it("should include count field in response", async () => {
            const { token } = await createUserAndGetToken(8);
            await createTestExpense(token);
            await createTestExpense(token);

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.count).toBe(2);
            expect(response.body.expenses.length).toBe(2);
        });
    });

    describe("User Isolation", () => {
        
        it("should only return expenses paid by current user", async () => {
            const { token: user1Token } = await createUserAndGetToken(9);
            const { token: user2Token } = await createUserAndGetToken(10);
            
            // User1 creates 2 expenses
            await createTestExpense(user1Token, { title: "User1 Expense 1" });
            await createTestExpense(user1Token, { title: "User1 Expense 2" });
            
            // User2 creates 1 expense
            await createTestExpense(user2Token, { title: "User2 Expense" });

            // User1 should only see their 2 expenses
            const response1 = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${user1Token}`)
                .expect(200);

            expect(response1.body.count).toBe(2);
            expect(response1.body.expenses.length).toBe(2);
            const user1Titles = response1.body.expenses.map(e => e.title);
            expect(user1Titles).toContain("User1 Expense 1");
            expect(user1Titles).toContain("User1 Expense 2");
            expect(user1Titles).not.toContain("User2 Expense");

            // User2 should only see their 1 expense
            const response2 = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${user2Token}`)
                .expect(200);

            expect(response2.body.count).toBe(1);
            expect(response2.body.expenses[0].title).toBe("User2 Expense");
        });

        it("should return both personal and group expenses for user", async () => {
            const { token } = await createUserAndGetToken(11);
            const group = await createTestGroup(token);
            
            // Create personal expense
            await createTestExpense(token, { title: "Personal Expense" });
            
            // Create group expense
            await createTestExpense(token, { title: "Group Expense", group: group.id });

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.count).toBe(2);
            const titles = response.body.expenses.map(e => e.title);
            expect(titles).toContain("Personal Expense");
            expect(titles).toContain("Group Expense");
        });
    });

    describe("Authentication", () => {
        
        it("should return 401 if no token is provided", async () => {
            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", "Bearer invalid.token.here")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user } = await createUserAndGetToken(12);

            const expiredToken = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });
    });

    describe("Response Format", () => {
        
        it("should return JSON content type", async () => {
            const { token } = await createUserAndGetToken(13);

            await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should have correct response structure", async () => {
            const { token } = await createUserAndGetToken(14);
            await createTestExpense(token);

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("expenses");
            expect(response.body).toHaveProperty("count");
            expect(typeof response.body.message).toBe("string");
            expect(Array.isArray(response.body.expenses)).toBe(true);
            expect(typeof response.body.count).toBe("number");
        });

        it("should include all required expense fields in each item", async () => {
            const { token } = await createUserAndGetToken(15);
            await createTestExpense(token);

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense).toHaveProperty("id");
            expect(expense).toHaveProperty("title");
            expect(expense).toHaveProperty("description");
            expect(expense).toHaveProperty("amount");
            expect(expense).toHaveProperty("currency");
            expect(expense).toHaveProperty("category");
            expect(expense).toHaveProperty("date");
            expect(expense).toHaveProperty("paidBy");
            expect(expense).toHaveProperty("group");
            expect(expense).toHaveProperty("splitType");
            expect(expense).toHaveProperty("splitDetails");
            expect(expense).toHaveProperty("paymentMethod");
            expect(expense).toHaveProperty("tags");
            expect(expense).toHaveProperty("isRecurring");
            expect(expense).toHaveProperty("recurringFrequency");
            expect(expense).toHaveProperty("notes");
            expect(expense).toHaveProperty("attachments");
            expect(expense).toHaveProperty("createdAt");
            expect(expense).toHaveProperty("updatedAt");
        });

        it("should have correct paidBy structure", async () => {
            const { token } = await createUserAndGetToken(16);
            await createTestExpense(token);

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const paidBy = response.body.expenses[0].paidBy;
            expect(paidBy).toHaveProperty("id");
            expect(paidBy).toHaveProperty("name");
            expect(paidBy).toHaveProperty("email");
            expect(typeof paidBy.id).toBe("string");
            expect(typeof paidBy.name).toBe("string");
            expect(typeof paidBy.email).toBe("string");
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle user with many expenses (50+)", async () => {
            const { token } = await createUserAndGetToken(17);
            
            // Create 50 expenses
            const expensePromises = [];
            for (let i = 1; i <= 50; i++) {
                expensePromises.push(
                    createTestExpense(token, {
                        title: `Expense ${i}`,
                        amount: i * 10
                    })
                );
            }
            await Promise.all(expensePromises);

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.count).toBe(50);
            expect(response.body.expenses.length).toBe(50);
        });

        it("should handle expenses with different currencies", async () => {
            const { token } = await createUserAndGetToken(18);
            
            await createTestExpense(token, { currency: "USD", amount: 100 });
            await createTestExpense(token, { currency: "EUR", amount: 200 });
            await createTestExpense(token, { currency: "GBP", amount: 300 });
            await createTestExpense(token, { currency: "INR", amount: 400 });

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.count).toBe(4);
            const currencies = response.body.expenses.map(e => e.currency);
            expect(currencies).toContain("USD");
            expect(currencies).toContain("EUR");
            expect(currencies).toContain("GBP");
            expect(currencies).toContain("INR");
        });

        it("should handle expenses with split details", async () => {
            const { user, token } = await createUserAndGetToken(19);
            
            const splitDetails = [
                { userId: user._id.toString(), amount: 50.00, settled: false }
            ];

            await createTestExpense(token, {
                splitType: "custom",
                splitDetails: splitDetails
            });

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.splitType).toBe("custom");
            expect(expense.splitDetails).toBeDefined();
            expect(Array.isArray(expense.splitDetails)).toBe(true);
        });

        it("should handle recurring expenses", async () => {
            const { token } = await createUserAndGetToken(20);
            
            await createTestExpense(token, {
                isRecurring: true,
                recurringFrequency: "monthly"
            });

            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.isRecurring).toBe(true);
            expect(expense.recurringFrequency).toBe("monthly");
        });
    });

    describe("Performance", () => {
        
        it("should retrieve expenses quickly (under 300ms)", async () => {
            const { token } = await createUserAndGetToken(21);
            
            // Create 10 expenses
            for (let i = 0; i < 10; i++) {
                await createTestExpense(token);
            }

            const startTime = Date.now();
            
            await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(300);
        });

        it("should handle rapid successive retrievals", async () => {
            const { token } = await createUserAndGetToken(22);
            await createTestExpense(token);

            // Retrieve 5 times rapidly
            const retrievals = Array(5).fill(null).map(() =>
                request(app)
                    .get("/api/expense/get-user-expenses")
                    .set("Authorization", `Bearer ${token}`)
            );

            const responses = await Promise.all(retrievals);

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.count).toBe(1);
            });
        });
    });

    describe("Data Consistency", () => {
        
        it("should return consistent data across multiple requests", async () => {
            const { token } = await createUserAndGetToken(23);
            await createTestExpense(token, { title: "Consistent Expense" });

            // Retrieve twice
            const response1 = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const response2 = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            // Both responses should be identical
            expect(response1.body.expenses).toEqual(response2.body.expenses);
            expect(response1.body.count).toBe(response2.body.count);
        });

        it("should reflect newly added expenses immediately", async () => {
            const { token } = await createUserAndGetToken(24);

            // Initially no expenses
            let response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);
            expect(response.body.count).toBe(0);

            // Add an expense
            await createTestExpense(token);

            // Should now show 1 expense
            response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);
            expect(response.body.count).toBe(1);

            // Add another expense
            await createTestExpense(token);

            // Should now show 2 expenses
            response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${token}`)
                .expect(200);
            expect(response.body.count).toBe(2);
        });
    });
});
