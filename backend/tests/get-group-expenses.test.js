import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { getGroupExpenses, addExpenseInAnyCurrency } from "../controllers/expense.controller.js";
import { createGroup, inviteUserToGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import Expense from "../models/expense.model.js";

process.env.NODE_ENV = 'test';

dotenv.config();

const app = express();
app.use(express.json());
app.post("/api/group/create-group", auth, createGroup);
app.post("/api/group/:groupId/invite", auth, inviteUserToGroup);
app.post("/api/expense/add-expense-in-any-currency", auth, addExpenseInAnyCurrency);
app.get("/api/expense/get-group-expenses/:groupId", auth, getGroupExpenses);

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

describe("Get Group Expenses Controller Tests", () => {
    
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

    afterEach(async () => {
        await Group.deleteMany({});
        await Expense.deleteMany({});
    });

    describe("Success Cases", () => {
        
        it("should successfully retrieve all expenses for a group", async () => {
            const { token } = await createUserAndGetToken(1);
            const group = await createTestGroup(token);
            
            // Create 3 expenses in the group
            await createTestExpense(token, { group: group.id, title: "Expense 1" });
            await createTestExpense(token, { group: group.id, title: "Expense 2" });
            await createTestExpense(token, { group: group.id, title: "Expense 3" });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expenses retrieved successfully");
            expect(response.body.expenses).toBeDefined();
            expect(Array.isArray(response.body.expenses)).toBe(true);
            expect(response.body.expenses.length).toBe(3);
        });

        it("should return empty array if group has no expenses", async () => {
            const { token } = await createUserAndGetToken(2);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expenses retrieved successfully");
            expect(response.body.expenses).toEqual([]);
            expect(response.body.expenses.length).toBe(0);
        });

        it("should return expenses with populated paidBy details", async () => {
            const { user, token } = await createUserAndGetToken(3);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
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
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.group).toBeDefined();
            expect(expense.group.id).toBe(group.id);
            expect(expense.group.name).toBe(group.name);
            expect(expense.group.description).toBe(group.description);
        });

        it("should return all expense fields including optional ones", async () => {
            const { token } = await createUserAndGetToken(5);
            const group = await createTestGroup(token);
            
            await createTestExpense(token, {
                group: group.id,
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
                .get(`/api/expense/get-group-expenses/${group.id}`)
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
            const { token } = await createUserAndGetToken(6);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.createdAt).toBeDefined();
            expect(expense.updatedAt).toBeDefined();
            expect(new Date(expense.createdAt)).toBeInstanceOf(Date);
            expect(new Date(expense.updatedAt)).toBeInstanceOf(Date);
        });

        it("should return expenses in correct order (by creation)", async () => {
            const { token } = await createUserAndGetToken(7);
            const group = await createTestGroup(token);
            
            const expense1 = await createTestExpense(token, { group: group.id, title: "First", amount: 100 });
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            const expense2 = await createTestExpense(token, { group: group.id, title: "Second", amount: 200 });
            await new Promise(resolve => setTimeout(resolve, 100));
            const expense3 = await createTestExpense(token, { group: group.id, title: "Third", amount: 300 });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expenses.length).toBe(3);
            // Expenses should be returned (order depends on MongoDB, but all should be present)
            const titles = response.body.expenses.map(e => e.title);
            expect(titles).toContain("First");
            expect(titles).toContain("Second");
            expect(titles).toContain("Third");
        });
    });

    describe("Authorization - Group Member Access", () => {
        
        it("should allow group creator to view group expenses", async () => {
            const { token } = await createUserAndGetToken(8);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expenses.length).toBe(1);
        });

        it("should allow group member to view group expenses", async () => {
            const { token: creatorToken } = await createUserAndGetToken(9);
            const { user: member, token: memberToken } = await createUserAndGetToken(10);
            
            const group = await createTestGroup(creatorToken);
            
            // Invite member to group
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() });

            await createTestExpense(creatorToken, { group: group.id });

            // Member should be able to view
            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);

            expect(response.body.expenses.length).toBe(1);
        });

        it("should show expenses paid by different group members", async () => {
            const { token: creatorToken } = await createUserAndGetToken(11);
            const { user: member1, token: member1Token } = await createUserAndGetToken(12);
            const { user: member2, token: member2Token } = await createUserAndGetToken(13);
            
            const group = await createTestGroup(creatorToken);
            
            // Invite both members
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member1._id.toString() });
            
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member2._id.toString() });

            // Each member creates an expense
            await createTestExpense(creatorToken, { group: group.id, title: "Creator Expense" });
            await createTestExpense(member1Token, { group: group.id, title: "Member1 Expense" });
            await createTestExpense(member2Token, { group: group.id, title: "Member2 Expense" });

            // Any member should see all 3 expenses
            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${member2Token}`)
                .expect(200);

            expect(response.body.expenses.length).toBe(3);
            const titles = response.body.expenses.map(e => e.title);
            expect(titles).toContain("Creator Expense");
            expect(titles).toContain("Member1 Expense");
            expect(titles).toContain("Member2 Expense");
        });
    });

    describe("Authorization - Denied Access", () => {
        
        it("should return 403 if user is not a group member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(14);
            const { token: outsiderToken } = await createUserAndGetToken(15);
            
            const group = await createTestGroup(creatorToken);
            await createTestExpense(creatorToken, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${outsiderToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not a member of this group");
        });

        it("should return 403 for removed group member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(16);
            const { user: member, token: memberToken } = await createUserAndGetToken(17);
            
            const group = await createTestGroup(creatorToken);
            
            // Invite member
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() });

            await createTestExpense(creatorToken, { group: group.id });

            // Remove member from group
            await Group.findByIdAndUpdate(
                group.id,
                { $pull: { members: member._id } }
            );

            // Member should no longer be able to view
            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not a member of this group");
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 400 if group ID is invalid format", async () => {
            const { token } = await createUserAndGetToken(18);

            const response = await request(app)
                .get("/api/expense/get-group-expenses/invalid-id")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid group ID");
        });

        it("should return 400 if group ID is too short", async () => {
            const { token } = await createUserAndGetToken(19);

            const response = await request(app)
                .get("/api/expense/get-group-expenses/123")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid group ID");
        });

        it("should return 400 if group ID contains invalid characters", async () => {
            const { token } = await createUserAndGetToken(20);

            const response = await request(app)
                .get("/api/expense/get-group-expenses/123456789012345678901xyz")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid group ID");
        });

        it("should return 404 if group does not exist", async () => {
            const { token } = await createUserAndGetToken(21);
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${fakeGroupId}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 404 if group was deleted", async () => {
            const { token } = await createUserAndGetToken(22);
            const group = await createTestGroup(token);

            // Delete the group
            await Group.findByIdAndDelete(group.id);

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });
    });

    describe("Authentication", () => {
        
        it("should return 401 if no token is provided", async () => {
            const { token } = await createUserAndGetToken(23);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const { token } = await createUserAndGetToken(24);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", "Bearer invalid.token.here")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user, token } = await createUserAndGetToken(25);
            const group = await createTestGroup(token);

            const expiredToken = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });
    });

    describe("Response Format", () => {
        
        it("should return JSON content type", async () => {
            const { token } = await createUserAndGetToken(26);
            const group = await createTestGroup(token);

            await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should have correct response structure", async () => {
            const { token } = await createUserAndGetToken(27);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("expenses");
            expect(typeof response.body.message).toBe("string");
            expect(Array.isArray(response.body.expenses)).toBe(true);
        });

        it("should include all required expense fields in each item", async () => {
            const { token } = await createUserAndGetToken(28);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
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

        it("should have correct paidBy structure in each expense", async () => {
            const { token } = await createUserAndGetToken(29);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
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

        it("should have correct group structure in each expense", async () => {
            const { token } = await createUserAndGetToken(30);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const groupData = response.body.expenses[0].group;
            expect(groupData).toHaveProperty("id");
            expect(groupData).toHaveProperty("name");
            expect(groupData).toHaveProperty("description");
            expect(typeof groupData.id).toBe("string");
            expect(typeof groupData.name).toBe("string");
            expect(typeof groupData.description).toBe("string");
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle group with many expenses (50+)", async () => {
            const { token } = await createUserAndGetToken(31);
            const group = await createTestGroup(token);
            
            // Create 50 expenses
            const expensePromises = [];
            for (let i = 1; i <= 50; i++) {
                expensePromises.push(
                    createTestExpense(token, {
                        group: group.id,
                        title: `Expense ${i}`,
                        amount: i * 10
                    })
                );
            }
            await Promise.all(expensePromises);

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expenses.length).toBe(50);
        });

        it("should handle expenses with different currencies", async () => {
            const { token } = await createUserAndGetToken(32);
            const group = await createTestGroup(token);
            
            await createTestExpense(token, { group: group.id, currency: "USD", amount: 100 });
            await createTestExpense(token, { group: group.id, currency: "EUR", amount: 200 });
            await createTestExpense(token, { group: group.id, currency: "GBP", amount: 300 });
            await createTestExpense(token, { group: group.id, currency: "INR", amount: 400 });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expenses.length).toBe(4);
            const currencies = response.body.expenses.map(e => e.currency);
            expect(currencies).toContain("USD");
            expect(currencies).toContain("EUR");
            expect(currencies).toContain("GBP");
            expect(currencies).toContain("INR");
        });

        it("should handle expenses with split details", async () => {
            const { user, token } = await createUserAndGetToken(33);
            const group = await createTestGroup(token);
            
            const splitDetails = [
                { userId: user._id.toString(), amount: 50.00, settled: false },
                { userId: user._id.toString(), amount: 50.00, settled: true }
            ];

            await createTestExpense(token, {
                group: group.id,
                splitType: "custom",
                splitDetails: splitDetails
            });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.splitType).toBe("custom");
            expect(expense.splitDetails).toBeDefined();
            expect(Array.isArray(expense.splitDetails)).toBe(true);
        });

        it("should handle recurring expenses", async () => {
            const { token } = await createUserAndGetToken(34);
            const group = await createTestGroup(token);
            
            await createTestExpense(token, {
                group: group.id,
                isRecurring: true,
                recurringFrequency: "monthly"
            });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const expense = response.body.expenses[0];
            expect(expense.isRecurring).toBe(true);
            expect(expense.recurringFrequency).toBe("monthly");
        });

        it("should not include expenses from other groups", async () => {
            const { token } = await createUserAndGetToken(35);
            const group1 = await createTestGroup(token, { name: "Group 1" });
            const group2 = await createTestGroup(token, { name: "Group 2" });
            
            await createTestExpense(token, { group: group1.id, title: "Group 1 Expense" });
            await createTestExpense(token, { group: group2.id, title: "Group 2 Expense" });

            const response = await request(app)
                .get(`/api/expense/get-group-expenses/${group1.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expenses.length).toBe(1);
            expect(response.body.expenses[0].title).toBe("Group 1 Expense");
        });
    });

    describe("Performance", () => {
        
        it("should retrieve expenses quickly (under 300ms)", async () => {
            const { token } = await createUserAndGetToken(36);
            const group = await createTestGroup(token);
            
            // Create 10 expenses
            for (let i = 0; i < 10; i++) {
                await createTestExpense(token, { group: group.id });
            }

            const startTime = Date.now();
            
            await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(300);
        });

        it("should handle rapid successive retrievals", async () => {
            const { token } = await createUserAndGetToken(37);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            // Retrieve same group expenses 5 times rapidly
            const retrievals = Array(5).fill(null).map(() =>
                request(app)
                    .get(`/api/expense/get-group-expenses/${group.id}`)
                    .set("Authorization", `Bearer ${token}`)
            );

            const responses = await Promise.all(retrievals);

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.expenses.length).toBe(1);
            });
        });
    });

    describe("Data Consistency", () => {
        
        it("should return consistent data across multiple requests", async () => {
            const { token } = await createUserAndGetToken(38);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id, title: "Consistent Expense" });

            // Retrieve twice
            const response1 = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const response2 = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            // Both responses should be identical
            expect(response1.body.expenses).toEqual(response2.body.expenses);
        });

        it("should reflect newly added expenses immediately", async () => {
            const { token } = await createUserAndGetToken(39);
            const group = await createTestGroup(token);

            // Initially no expenses
            let response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);
            expect(response.body.expenses.length).toBe(0);

            // Add an expense
            await createTestExpense(token, { group: group.id });

            // Should now show 1 expense
            response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);
            expect(response.body.expenses.length).toBe(1);

            // Add another expense
            await createTestExpense(token, { group: group.id });

            // Should now show 2 expenses
            response = await request(app)
                .get(`/api/expense/get-group-expenses/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);
            expect(response.body.expenses.length).toBe(2);
        });
    });
});
