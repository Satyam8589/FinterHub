import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { calculateGroupBalance, addExpenseInAnyCurrency } from "../controllers/expense.controller.js";
import { createGroup, inviteUserToGroup } from "../controllers/group.controller.js";
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
app.post("/api/group/:groupId/invite", auth, inviteUserToGroup);
app.post("/api/expense/add-expense-in-any-currency", auth, addExpenseInAnyCurrency);
app.get("/api/expense/calculate-group-balance/:groupId", auth, calculateGroupBalance);

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


describe("Calculate Group Balance Controller Tests", () => {
    
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
        
        it("should successfully calculate balance for group with expenses", async () => {
            const { user, token } = await createUserAndGetToken(1);
            const group = await createTestGroup(token);
            
            // Create 2 expenses
            await createTestExpense(token, { group: group.id, amount: 300 });
            await createTestExpense(token, { group: group.id, amount: 200 });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Group balance calculated successfully");
            expect(response.body.group).toBeDefined();
            expect(response.body.summary).toBeDefined();
            expect(response.body.balances).toBeDefined();
        });

        it("should return zero balance for group with no expenses", async () => {
            const { token } = await createUserAndGetToken(2);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.summary.totalExpenses).toBe(0);
            expect(response.body.summary.totalAmount).toBe(0);
            expect(response.body.summary.perPersonShare).toBe(0);
            expect(response.body.balances.length).toBe(1);
            expect(response.body.balances[0].balance).toBe(0);
        });

        it("should correctly calculate balance for equal split", async () => {
            const { user: user1, token: token1 } = await createUserAndGetToken(3);
            const { user: user2, token: token2 } = await createUserAndGetToken(4);
            
            const group = await createTestGroup(token1);
            
            // Invite user2
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${token1}`)
                .send({ userId: user2._id.toString() });

            // User1 pays 600
            await createTestExpense(token1, { group: group.id, amount: 600 });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            expect(response.body.summary.totalAmount).toBe(600);
            expect(response.body.summary.perPersonShare).toBe(300); // 600 / 2
            
            // User1 paid 600, owes 300, balance = +300 (owed to them)
            const user1Balance = response.body.balances.find(b => b.userId === user1._id.toString());
            expect(user1Balance.totalPaid).toBe(600);
            expect(user1Balance.totalOwed).toBe(300);
            expect(user1Balance.balance).toBe(300);
            
            // User2 paid 0, owes 300, balance = -300 (they owe)
            const user2Balance = response.body.balances.find(b => b.userId === user2._id.toString());
            expect(user2Balance.totalPaid).toBe(0);
            expect(user2Balance.totalOwed).toBe(300);
            expect(user2Balance.balance).toBe(-300);
        });

        it("should handle multiple members with different payments", async () => {
            const { user: user1, token: token1 } = await createUserAndGetToken(5);
            const { user: user2, token: token2 } = await createUserAndGetToken(6);
            const { user: user3, token: token3 } = await createUserAndGetToken(7);
            
            const group = await createTestGroup(token1);
            
            // Invite users
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${token1}`)
                .send({ userId: user2._id.toString() });
            
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${token1}`)
                .send({ userId: user3._id.toString() });

            // User1 pays 300, User2 pays 600, User3 pays 0
            await createTestExpense(token1, { group: group.id, amount: 300 });
            await createTestExpense(token2, { group: group.id, amount: 600, paidBy: user2._id.toString() });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            expect(response.body.summary.totalAmount).toBe(900);
            expect(response.body.summary.perPersonShare).toBe(300); // 900 / 3
            
            const user1Balance = response.body.balances.find(b => b.userId === user1._id.toString());
            expect(user1Balance.balance).toBe(0); // Paid 300, owes 300
            
            const user2Balance = response.body.balances.find(b => b.userId === user2._id.toString());
            expect(user2Balance.balance).toBe(300); // Paid 600, owes 300
            
            const user3Balance = response.body.balances.find(b => b.userId === user3._id.toString());
            expect(user3Balance.balance).toBe(-300); // Paid 0, owes 300
        });

        it("should include all member details in balances", async () => {
            const { user, token } = await createUserAndGetToken(8);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id, amount: 100 });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const balance = response.body.balances[0];
            expect(balance).toHaveProperty("userId");
            expect(balance).toHaveProperty("name");
            expect(balance).toHaveProperty("email");
            expect(balance).toHaveProperty("totalPaid");
            expect(balance).toHaveProperty("totalOwed");
            expect(balance).toHaveProperty("balance");
            expect(balance.name).toBe(user.name);
            expect(balance.email).toBe(user.email);
        });

        it("should include group details in response", async () => {
            const { token } = await createUserAndGetToken(9);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.group.id).toBe(group.id);
            expect(response.body.group.name).toBe(group.name);
            expect(response.body.group.description).toBe(group.description);
            expect(response.body.group.members).toBeDefined();
            expect(Array.isArray(response.body.group.members)).toBe(true);
        });

        it("should include summary with correct totals", async () => {
            const { token } = await createUserAndGetToken(10);
            const group = await createTestGroup(token);
            
            await createTestExpense(token, { group: group.id, amount: 100 });
            await createTestExpense(token, { group: group.id, amount: 200 });
            await createTestExpense(token, { group: group.id, amount: 300 });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.summary.totalExpenses).toBe(3);
            expect(response.body.summary.totalAmount).toBe(600);
            expect(response.body.summary.perPersonShare).toBe(600);
        });
    });

    describe("Authorization - Group Member Access", () => {
        
        it("should allow group creator to view balance", async () => {
            const { token } = await createUserAndGetToken(11);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Group balance calculated successfully");
        });

        it("should allow group member to view balance", async () => {
            const { token: creatorToken } = await createUserAndGetToken(12);
            const { user: member, token: memberToken } = await createUserAndGetToken(13);
            
            const group = await createTestGroup(creatorToken);
            
            // Invite member
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() });

            await createTestExpense(creatorToken, { group: group.id });

            // Member should be able to view
            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);

            expect(response.body.balances.length).toBe(2);
        });
    });

    describe("Authorization - Denied Access", () => {
        
        it("should return 403 if user is not a group member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(14);
            const { token: outsiderToken } = await createUserAndGetToken(15);
            
            const group = await createTestGroup(creatorToken);
            await createTestExpense(creatorToken, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
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
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not a member of this group");
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 400 if group ID is invalid format", async () => {
            const { token } = await createUserAndGetToken(18);

            const response = await request(app)
                .get("/api/expense/calculate-group-balance/invalid-id")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid group ID");
        });

        it("should return 400 if group ID is too short", async () => {
            const { token } = await createUserAndGetToken(19);

            const response = await request(app)
                .get("/api/expense/calculate-group-balance/123")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid group ID");
        });

        it("should return 400 if group ID contains invalid characters", async () => {
            const { token } = await createUserAndGetToken(20);

            const response = await request(app)
                .get("/api/expense/calculate-group-balance/123456789012345678901xyz")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid group ID");
        });

        it("should return 404 if group does not exist", async () => {
            const { token } = await createUserAndGetToken(21);
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${fakeGroupId}`)
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
                .get(`/api/expense/calculate-group-balance/${group.id}`)
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
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const { token } = await createUserAndGetToken(24);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
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
                .get(`/api/expense/calculate-group-balance/${group.id}`)
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
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should have correct response structure", async () => {
            const { token } = await createUserAndGetToken(27);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("group");
            expect(response.body).toHaveProperty("summary");
            expect(response.body).toHaveProperty("balances");
        });

        it("should have correct summary structure", async () => {
            const { token } = await createUserAndGetToken(28);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.summary).toHaveProperty("totalExpenses");
            expect(response.body.summary).toHaveProperty("totalAmount");
            expect(response.body.summary).toHaveProperty("perPersonShare");
            expect(typeof response.body.summary.totalExpenses).toBe("number");
            expect(typeof response.body.summary.totalAmount).toBe("number");
            expect(typeof response.body.summary.perPersonShare).toBe("number");
        });

        it("should have correct balance structure for each member", async () => {
            const { token } = await createUserAndGetToken(29);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const balance = response.body.balances[0];
            expect(balance).toHaveProperty("userId");
            expect(balance).toHaveProperty("name");
            expect(balance).toHaveProperty("email");
            expect(balance).toHaveProperty("totalPaid");
            expect(balance).toHaveProperty("totalOwed");
            expect(balance).toHaveProperty("balance");
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle large group with many members", async () => {
            const { token: creatorToken } = await createUserAndGetToken(30);
            const group = await createTestGroup(creatorToken);
            
            // Create 5 members
            const members = [];
            for (let i = 0; i < 5; i++) {
                const { user } = await createUserAndGetToken(31 + i);
                members.push(user);
                await request(app)
                    .post(`/api/group/${group.id}/invite`)
                    .set("Authorization", `Bearer ${creatorToken}`)
                    .send({ userId: user._id.toString() });
            }

            await createTestExpense(creatorToken, { group: group.id, amount: 600 });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.balances.length).toBe(6); // Creator + 5 members
            expect(response.body.summary.perPersonShare).toBe(100); // 600 / 6
        });

        it("should handle expenses with decimal amounts", async () => {
            const { token } = await createUserAndGetToken(36);
            const group = await createTestGroup(token);
            
            await createTestExpense(token, { group: group.id, amount: 33.33 });
            await createTestExpense(token, { group: group.id, amount: 66.67 });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.summary.totalAmount).toBe(100);
        });

        it("should handle group with no expenses", async () => {
            const { token } = await createUserAndGetToken(37);
            const group = await createTestGroup(token);

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.summary.totalExpenses).toBe(0);
            expect(response.body.summary.totalAmount).toBe(0);
            expect(response.body.balances[0].balance).toBe(0);
        });

        it("should handle expenses in different currencies (sum all)", async () => {
            const { token } = await createUserAndGetToken(38);
            const group = await createTestGroup(token);
            
            await createTestExpense(token, { group: group.id, amount: 100, currency: "USD" });
            await createTestExpense(token, { group: group.id, amount: 200, currency: "EUR" });

            const response = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            // Note: Currently sums all amounts regardless of currency
            expect(response.body.summary.totalAmount).toBe(300);
        });
    });

    describe("Performance", () => {
        
        it("should calculate balance quickly (under 300ms)", async () => {
            const { token } = await createUserAndGetToken(39);
            const group = await createTestGroup(token);
            
            // Create 10 expenses
            for (let i = 0; i < 10; i++) {
                await createTestExpense(token, { group: group.id, amount: 100 });
            }

            const startTime = Date.now();
            
            await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(300);
        });
    });

    describe("Data Consistency", () => {
        
        it("should return consistent balance across multiple requests", async () => {
            const { token } = await createUserAndGetToken(40);
            const group = await createTestGroup(token);
            await createTestExpense(token, { group: group.id, amount: 500 });

            const response1 = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const response2 = await request(app)
                .get(`/api/expense/calculate-group-balance/${group.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response1.body.summary).toEqual(response2.body.summary);
            expect(response1.body.balances).toEqual(response2.body.balances);
        });
    });
});
