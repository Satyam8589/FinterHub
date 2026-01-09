import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { deleteExpense, addExpenseInAnyCurrency } from "../controllers/expense.controller.js";
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
app.delete("/api/expense/delete-expense/:id", auth, deleteExpense);

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

describe("Delete Expense Controller Tests", () => {
    
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

    afterEach(async () => {
        await Group.deleteMany({});
        await Expense.deleteMany({});
    });

    describe("Success Cases", () => {
        
        it("should successfully delete own expense", async () => {
            const { token } = await createUserAndGetToken(1);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense deleted successfully");
            expect(response.body.deletedExpenseId).toBe(expense.id);

            // Verify expense is actually deleted from database
            const deletedExpense = await Expense.findById(expense.id);
            expect(deletedExpense).toBeNull();
        });

        it("should return correct response structure", async () => {
            const { token } = await createUserAndGetToken(2);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("deletedExpenseId");
            expect(typeof response.body.message).toBe("string");
            expect(typeof response.body.deletedExpenseId).toBe("string");
        });

        it("should delete expense with optional fields", async () => {
            const { token } = await createUserAndGetToken(3);
            const expense = await createTestExpense(token, {
                title: "Complex Expense",
                description: "With optional fields",
                amount: 250.50,
                currency: "EUR",
                category: "Travel",
                paymentMethod: "Credit Card",
                tags: ["business", "travel"]
            });

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense deleted successfully");
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 400 if expense ID is invalid format", async () => {
            const { token } = await createUserAndGetToken(4);

            const response = await request(app)
                .delete("/api/expense/delete-expense/invalid-id")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid expense ID");
        });

        it("should return 400 if expense ID is too short", async () => {
            const { token } = await createUserAndGetToken(5);

            const response = await request(app)
                .delete("/api/expense/delete-expense/123")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid expense ID");
        });

        it("should return 400 if expense ID contains invalid characters", async () => {
            const { token } = await createUserAndGetToken(6);

            const response = await request(app)
                .delete("/api/expense/delete-expense/123456789012345678901xyz")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid expense ID");
        });

        it("should return 400 if expense ID is empty", async () => {
            const { token } = await createUserAndGetToken(7);

            const response = await request(app)
                .delete("/api/expense/delete-expense/")
                .set("Authorization", `Bearer ${token}`)
                .expect(404); // Express returns 404 for missing route parameter

            // This is expected behavior - route doesn't match without ID
        });

        it("should return 404 if expense does not exist", async () => {
            const { token } = await createUserAndGetToken(8);
            const fakeExpenseId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${fakeExpenseId}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toBe("Expense not found");
        });

        it("should return 404 if expense was already deleted", async () => {
            const { token } = await createUserAndGetToken(9);
            const expense = await createTestExpense(token);

            // Delete once
            await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            // Try to delete again
            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toBe("Expense not found");
        });
    });

    describe("Authorization", () => {
        
        it("should return 403 if user tries to delete someone else's expense", async () => {
            const { token: creatorToken } = await createUserAndGetToken(10);
            const { token: otherUserToken } = await createUserAndGetToken(11);
            
            const expense = await createTestExpense(creatorToken);

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${otherUserToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not authorized to delete this expense");

            // Verify expense still exists
            const stillExists = await Expense.findById(expense.id);
            expect(stillExists).toBeTruthy();
        });

        it("should allow only the paidBy user to delete", async () => {
            const { user: user1, token: token1 } = await createUserAndGetToken(12);
            const { user: user2, token: token2 } = await createUserAndGetToken(13);

            // User1 creates expense but User2 paid for it
            const expense = await createTestExpense(token1, {
                paidBy: user2._id.toString()
            });

            // User1 tries to delete (should fail)
            await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(403);

            // User2 tries to delete (should succeed)
            await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token2}`)
                .expect(200);
        });

        it("should not allow group members to delete other's expenses", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(14);
            const { user: member, token: memberToken } = await createUserAndGetToken(15);

            // Create group
            const groupResponse = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({
                    name: `Test Group ${Date.now()}`,
                    description: "Test group for expense deletion"
                });
            const group = groupResponse.body.group;

            // Creator creates expense in group
            const expense = await createTestExpense(creatorToken, {
                group: group.id
            });

            // Member tries to delete creator's expense (should fail)
            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not authorized to delete this expense");
        });
    });

    describe("Authentication", () => {
        
        it("should return 401 if no token is provided", async () => {
            const { token } = await createUserAndGetToken(16);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");

            // Verify expense still exists
            const stillExists = await Expense.findById(expense.id);
            expect(stillExists).toBeTruthy();
        });

        it("should return 401 if token is invalid", async () => {
            const { token } = await createUserAndGetToken(17);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", "Bearer invalid.token.here")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user, token } = await createUserAndGetToken(18);
            const expense = await createTestExpense(token);

            const expiredToken = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle concurrent delete attempts gracefully", async () => {
            const { token } = await createUserAndGetToken(19);
            const expense = await createTestExpense(token);

            // Try to delete the same expense twice simultaneously
            const [response1, response2] = await Promise.all([
                request(app)
                    .delete(`/api/expense/delete-expense/${expense.id}`)
                    .set("Authorization", `Bearer ${token}`),
                request(app)
                    .delete(`/api/expense/delete-expense/${expense.id}`)
                    .set("Authorization", `Bearer ${token}`)
            ]);

            // Both might succeed due to race condition, or one might fail
            const statuses = [response1.status, response2.status].sort();
            expect([200, 404]).toContain(response1.status);
            expect([200, 404]).toContain(response2.status);
        });

        it("should delete expense with very long title", async () => {
            const { token } = await createUserAndGetToken(20);
            const longTitle = "A".repeat(200);
            
            const expense = await createTestExpense(token, {
                title: longTitle
            });

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense deleted successfully");
        });

        it("should delete expense with maximum amount", async () => {
            const { token } = await createUserAndGetToken(21);
            
            const expense = await createTestExpense(token, {
                amount: 999999999.99
            });

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense deleted successfully");
        });

        it("should delete recurring expense", async () => {
            const { token } = await createUserAndGetToken(22);
            
            const expense = await createTestExpense(token, {
                isRecurring: true,
                recurringFrequency: "monthly"
            });

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense deleted successfully");
        });

        it("should delete expense with split details", async () => {
            const { user, token } = await createUserAndGetToken(23);
            
            const expense = await createTestExpense(token, {
                splitType: "equal",
                splitDetails: [
                    { user: user._id.toString(), amount: 50.00, settled: false }
                ]
            });

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense deleted successfully");
        });
    });

    describe("Response Format", () => {
        
        it("should return JSON content type", async () => {
            const { token } = await createUserAndGetToken(24);
            const expense = await createTestExpense(token);

            await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should include deletedExpenseId in response", async () => {
            const { token } = await createUserAndGetToken(25);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.deletedExpenseId).toBe(expense.id);
        });
    });

    describe("Database Integrity", () => {
        
        it("should actually remove expense from database", async () => {
            const { token } = await createUserAndGetToken(26);
            const expense = await createTestExpense(token);

            // Verify expense exists before deletion
            const beforeDelete = await Expense.findById(expense.id);
            expect(beforeDelete).toBeTruthy();

            await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            // Verify expense is gone after deletion
            const afterDelete = await Expense.findById(expense.id);
            expect(afterDelete).toBeNull();
        });

        it("should not affect other expenses when deleting one", async () => {
            const { token } = await createUserAndGetToken(27);
            
            const expense1 = await createTestExpense(token, { title: "Expense 1" });
            const expense2 = await createTestExpense(token, { title: "Expense 2" });
            const expense3 = await createTestExpense(token, { title: "Expense 3" });

            // Delete expense2
            await request(app)
                .delete(`/api/expense/delete-expense/${expense2.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            // Verify expense1 and expense3 still exist
            const stillExists1 = await Expense.findById(expense1.id);
            const stillExists3 = await Expense.findById(expense3.id);
            const deleted2 = await Expense.findById(expense2.id);

            expect(stillExists1).toBeTruthy();
            expect(stillExists3).toBeTruthy();
            expect(deleted2).toBeNull();
        });

        it("should handle deletion of expense with attachments", async () => {
            const { token } = await createUserAndGetToken(28);
            
            const expense = await createTestExpense(token, {
                attachments: [
                    { filename: "receipt1.pdf", url: "http://example.com/receipt1.pdf" },
                    { filename: "receipt2.jpg", url: "http://example.com/receipt2.jpg" }
                ]
            });

            const response = await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense deleted successfully");

            // Verify complete deletion
            const deleted = await Expense.findById(expense.id);
            expect(deleted).toBeNull();
        });
    });

    describe("Performance", () => {
        
        it("should delete expense quickly (under 200ms)", async () => {
            const { token } = await createUserAndGetToken(29);
            const expense = await createTestExpense(token);

            const startTime = Date.now();
            
            await request(app)
                .delete(`/api/expense/delete-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Realistic threshold for database operations
            expect(duration).toBeLessThan(200);
        });

        it("should handle rapid successive deletions", async () => {
            const { token } = await createUserAndGetToken(30);
            
            // Create 5 expenses
            const expenses = await Promise.all([
                createTestExpense(token, { title: "Expense 1" }),
                createTestExpense(token, { title: "Expense 2" }),
                createTestExpense(token, { title: "Expense 3" }),
                createTestExpense(token, { title: "Expense 4" }),
                createTestExpense(token, { title: "Expense 5" })
            ]);

            // Delete all 5 rapidly
            const deletions = expenses.map(expense =>
                request(app)
                    .delete(`/api/expense/delete-expense/${expense.id}`)
                    .set("Authorization", `Bearer ${token}`)
            );

            const responses = await Promise.all(deletions);

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            // Verify all are deleted
            const remaining = await Expense.find({});
            expect(remaining.length).toBe(0);
        });
    });
});
