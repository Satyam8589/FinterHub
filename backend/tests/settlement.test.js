import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import Expense from "../models/expense.model.js";
import settlementRouter from "../routes/settlement.route.js";
import { auth } from "../middleware/auth.js";
import { connect, closeDatabase, clearDatabase } from "./setup/db.js";


dotenv.config();
process.env.NODE_ENV = 'test';

// Create Express app for testing
const app = express();
app.use(express.json());
app.use("/api/settlement", settlementRouter);

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


describe("Settlement Controller Tests", () => {
    let user1, user2, user3;
    let token1, token2, token3;
    let group;

    beforeEach(async () => {
        // Create test users with different preferred currencies
        user1 = await User.create({
            name: "Raj",
            email: `raj${Date.now()}@settlementtest.com`,
            password: "password123",
            preferredCurrency: "INR"
        });

        user2 = await User.create({
            name: "Emma",
            email: `emma${Date.now()}@settlementtest.com`,
            password: "password123",
            preferredCurrency: "GBP"
        });

        user3 = await User.create({
            name: "Mike",
            email: `mike${Date.now()}@settlementtest.com`,
            password: "password123",
            preferredCurrency: "USD"
        });

        // Generate tokens
        token1 = jwt.sign({ id: user1._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        token2 = jwt.sign({ id: user2._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        token3 = jwt.sign({ id: user3._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        // Create a group
        group = await Group.create({
            name: `Test Settlement Group ${Date.now()}`,
            description: "Test group for settlement",
            createdBy: user1._id,
            members: [user1._id, user2._id, user3._id]
        });
    });



    describe("GET /api/settlement/:groupId/plan", () => {
        
        it("should return 401 if no token provided", async () => {
            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 404 if group not found", async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/settlement/${fakeGroupId}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 403 if user is not group member", async () => {
            // Create a user not in the group
            const outsider = await User.create({
                name: "Outsider",
                email: `outsider${Date.now()}@settlementtest.com`,
                password: "password123"
            });

            const outsiderToken = jwt.sign({ id: outsider._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${outsiderToken}`)
                .expect(403);

            expect(response.body.message).toContain("not authorized");

            await User.deleteOne({ _id: outsider._id });
        });

        it("should return empty settlement if no expenses", async () => {
            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            expect(response.body.message).toBe("No expenses to settle");
            expect(response.body.totalExpenses).toBe(0);
            expect(response.body.settlements).toEqual([]);
        });

        it("should generate settlement plan with expenses", async () => {
            // Create expenses
            // User1 (Raj) pays ₹16,600 INR
            await Expense.create({
                title: "Hotel",
                amount: 16600,
                currency: "INR",
                category: "Travel",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 5533.33 },
                    { user: user2._id, amount: 5533.33 },
                    { user: user3._id, amount: 5533.34 }
                ]
            });

            // User2 (Emma) pays £80 GBP
            await Expense.create({
                title: "Dinner",
                amount: 80,
                currency: "GBP",
                category: "Food & Dining",
                paidBy: user2._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 26.67 },
                    { user: user2._id, amount: 26.67 },
                    { user: user3._id, amount: 26.66 }
                ]
            });

            // User3 (Mike) pays $150 USD
            await Expense.create({
                title: "Car Rental",
                amount: 150,
                currency: "USD",
                category: "Transportation",
                paidBy: user3._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 50 },
                    { user: user2._id, amount: 50 },
                    { user: user3._id, amount: 50 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            expect(response.body.message).toBe("Settlement plan generated successfully");
            expect(response.body.totalExpenses).toBe(3);
            expect(response.body.baseCurrency).toBe("USD");
            expect(response.body).toHaveProperty("totalAmountUSD");
            expect(response.body).toHaveProperty("balances");
            expect(response.body).toHaveProperty("settlements");
            expect(response.body).toHaveProperty("transactionCount");
        });

        it("should show balances in each user's preferred currency", async () => {
            // Create simple expense
            await Expense.create({
                title: "Test Expense",
                amount: 100,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 33.33 },
                    { user: user2._id, amount: 33.33 },
                    { user: user3._id, amount: 33.34 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            const balances = response.body.balances;

            // Check each user's balance is in their preferred currency
            Object.values(balances).forEach(balance => {
                expect(balance).toHaveProperty("balanceUSD");
                expect(balance).toHaveProperty("balance");
                expect(balance).toHaveProperty("currency");
                expect(balance).toHaveProperty("status");
                expect(balance).toHaveProperty("user");
            });
        });

        it("should show settlements in dual currency", async () => {
            // Create expense where user2 owes user1
            await Expense.create({
                title: "Test",
                amount: 100,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 50 },
                    { user: user2._id, amount: 50 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            const settlements = response.body.settlements;

            if (settlements.length > 0) {
                const settlement = settlements[0];
                
                expect(settlement).toHaveProperty("from");
                expect(settlement).toHaveProperty("to");
                expect(settlement).toHaveProperty("amountUSD");
                expect(settlement).toHaveProperty("description");

                // Check from user has amount in their currency
                expect(settlement.from).toHaveProperty("user");
                expect(settlement.from).toHaveProperty("amount");
                expect(settlement.from).toHaveProperty("currency");

                // Check to user has amount in their currency
                expect(settlement.to).toHaveProperty("user");
                expect(settlement.to).toHaveProperty("amount");
                expect(settlement.to).toHaveProperty("currency");
            }
        });

        it("should minimize number of transactions", async () => {
            // Create multiple expenses
            await Expense.create({
                title: "Expense 1",
                amount: 100,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 33.33 },
                    { user: user2._id, amount: 33.33 },
                    { user: user3._id, amount: 33.34 }
                ]
            });

            await Expense.create({
                title: "Expense 2",
                amount: 50,
                currency: "USD",
                category: "Other",
                paidBy: user2._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 16.67 },
                    { user: user2._id, amount: 16.67 },
                    { user: user3._id, amount: 16.66 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            // Should have fewer transactions than total possible
            expect(response.body.transactionCount).toBeLessThanOrEqual(2);
        });

        it("should handle expenses with no split (splitType: none)", async () => {
            // Create expense with no split
            await Expense.create({
                title: "Personal Expense",
                amount: 100,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "none",
                splitDetails: []
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            // Should return empty settlement (no split expenses)
            expect(response.body.message).toBe("No expenses to settle");
        });

        it("should calculate balances correctly in USD", async () => {
            // User1 pays $100, owes $50 -> balance +$50
            await Expense.create({
                title: "Test",
                amount: 100,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 50 },
                    { user: user2._id, amount: 50 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            const user1Balance = Object.values(response.body.balances).find(
                b => b.user.id.toString() === user1._id.toString()
            );

            const user2Balance = Object.values(response.body.balances).find(
                b => b.user.id.toString() === user2._id.toString()
            );

            expect(user1Balance.balanceUSD).toBe(50);
            expect(user1Balance.status).toBe("owed");
            expect(user2Balance.balanceUSD).toBe(-50);
            expect(user2Balance.status).toBe("owes");
        });

        it("should convert multi-currency expenses to USD correctly", async () => {
            // ₹8,300 INR = $99.60 USD (8300 * 0.012)
            await Expense.create({
                title: "INR Expense",
                amount: 8300,
                currency: "INR",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 4150 },
                    { user: user2._id, amount: 4150 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            // Total should be approximately $99.60 USD
            expect(response.body.totalAmountUSD).toBeCloseTo(99.60, 1);
        });

        it("should return proper response structure", async () => {
            await Expense.create({
                title: "Test",
                amount: 100,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 50 },
                    { user: user2._id, amount: 50 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("groupId");
            expect(response.body).toHaveProperty("groupName");
            expect(response.body).toHaveProperty("totalExpenses");
            expect(response.body).toHaveProperty("totalAmountUSD");
            expect(response.body).toHaveProperty("baseCurrency");
            expect(response.body).toHaveProperty("balances");
            expect(response.body).toHaveProperty("settlements");
            expect(response.body).toHaveProperty("transactionCount");
        });

        it("should work for any group member", async () => {
            await Expense.create({
                title: "Test",
                amount: 100,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 50 },
                    { user: user2._id, amount: 50 }
                ]
            });

            // User1 requests
            const response1 = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            // User2 requests
            const response2 = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token2}`)
                .expect(200);

            // Both should get same settlement plan
            expect(response1.body.totalAmountUSD).toBe(response2.body.totalAmountUSD);
            expect(response1.body.transactionCount).toBe(response2.body.transactionCount);
        });
    });

    describe("Settlement Calculation Edge Cases", () => {
        
        it("should handle very small amounts", async () => {
            await Expense.create({
                title: "Small Expense",
                amount: 0.10,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 0.05 },
                    { user: user2._id, amount: 0.05 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            expect(response.status).toBe(200);
        });

        it("should ignore amounts less than $0.01", async () => {
            await Expense.create({
                title: "Tiny Expense",
                amount: 0.01,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 0.005 },
                    { user: user2._id, amount: 0.005 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            // Should have no settlements (amounts too small)
            expect(response.body.settlements.length).toBe(0);
        });

        it("should handle large amounts", async () => {
            await Expense.create({
                title: "Large Expense",
                amount: 1000000,
                currency: "USD",
                category: "Other",
                paidBy: user1._id,
                group: group._id,
                splitType: "equal",
                splitDetails: [
                    { user: user1._id, amount: 500000 },
                    { user: user2._id, amount: 500000 }
                ]
            });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/plan`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            expect(response.body.totalAmountUSD).toBe(1000000);
        });
    });
});
