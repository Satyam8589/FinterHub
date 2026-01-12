import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { getExpenseById, addExpenseInAnyCurrency } from "../controllers/expense.controller.js";
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
app.get("/api/expense/get-expense/:id", auth, getExpenseById);

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


describe("Get Expense By ID Controller Tests", () => {
    
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



    describe("Success Cases", () => {
        
        it("should successfully retrieve own expense by ID", async () => {
            const { token } = await createUserAndGetToken(1);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense retrieved successfully");
            expect(response.body.expense).toBeDefined();
            expect(response.body.expense.id).toBe(expense.id);
            expect(response.body.expense.title).toBe("Test Expense");
        });

        it("should return complete expense details with all fields", async () => {
            const { token } = await createUserAndGetToken(2);
            const expense = await createTestExpense(token, {
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
                    { filename: "receipt1.jpg", url: "http://example.com/receipt1.jpg" },
                    { filename: "receipt2.pdf", url: "http://example.com/receipt2.pdf" }
                ]
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const retrieved = response.body.expense;
            expect(retrieved.title).toBe("Complete Expense");
            expect(retrieved.description).toBe("Full description");
            expect(retrieved.amount).toBe(250.50);
            expect(retrieved.currency).toBe("EUR");
            expect(retrieved.category).toBe("Travel");
            expect(retrieved.paymentMethod).toBe("Credit Card");
            expect(retrieved.tags).toEqual(["business", "travel"]);
            expect(retrieved.isRecurring).toBe(true);
            expect(retrieved.recurringFrequency).toBe("monthly");
            expect(retrieved.notes).toBe("Important notes");
            expect(retrieved.attachments.length).toBe(2);
            expect(retrieved.attachments[0].filename).toBe("receipt1.jpg");
            expect(retrieved.attachments[1].filename).toBe("receipt2.pdf");
        });

        it("should return populated paidBy user details", async () => {
            const { user, token } = await createUserAndGetToken(3);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const retrieved = response.body.expense;
            expect(retrieved.paidBy).toBeDefined();
            expect(retrieved.paidBy.id).toBe(user._id.toString());
            expect(retrieved.paidBy.name).toBe(user.name);
            expect(retrieved.paidBy.email).toBe(user.email);
        });

        it("should return populated group details for group expense", async () => {
            const { token } = await createUserAndGetToken(4);
            const group = await createTestGroup(token);
            const expense = await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const retrieved = response.body.expense;
            expect(retrieved.group).toBeDefined();
            expect(retrieved.group.id).toBe(group.id);
            expect(retrieved.group.name).toBe(group.name);
            expect(retrieved.group.description).toBe(group.description);
        });

        it("should return null group for personal expense", async () => {
            const { token } = await createUserAndGetToken(5);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expense.group).toBeNull();
        });

        it("should include timestamps (createdAt, updatedAt)", async () => {
            const { token } = await createUserAndGetToken(6);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const retrieved = response.body.expense;
            expect(retrieved.createdAt).toBeDefined();
            expect(retrieved.updatedAt).toBeDefined();
            expect(new Date(retrieved.createdAt)).toBeInstanceOf(Date);
            expect(new Date(retrieved.updatedAt)).toBeInstanceOf(Date);
        });

        it("should return splitDetails if present", async () => {
            const { user, token } = await createUserAndGetToken(7);
            const splitDetails = [
                { userId: user._id.toString(), amount: 50.00, settled: false },
                { userId: user._id.toString(), amount: 50.00, settled: true }
            ];
            
            const expense = await createTestExpense(token, {
                splitType: "custom",
                splitDetails: splitDetails
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const retrieved = response.body.expense;
            expect(retrieved.splitType).toBe("custom");
            expect(retrieved.splitDetails).toBeDefined();
            expect(Array.isArray(retrieved.splitDetails)).toBe(true);
        });
    });

    describe("Authorization - Payer Access", () => {
        
        it("should allow payer to view their own expense", async () => {
            const { token } = await createUserAndGetToken(8);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.message).toBe("Expense retrieved successfully");
        });

        it("should allow viewing expense paid by current user in a group", async () => {
            const { token } = await createUserAndGetToken(9);
            const group = await createTestGroup(token);
            const expense = await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expense.id).toBe(expense.id);
        });
    });

    describe("Authorization - Group Member Access", () => {
        
        it("should allow group member to view group expense", async () => {
            const { token: creatorToken } = await createUserAndGetToken(10);
            const { user: member, token: memberToken } = await createUserAndGetToken(11);
            
            const group = await createTestGroup(creatorToken);
            
            // Invite member to group
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() });

            const expense = await createTestExpense(creatorToken, { group: group.id });

            // Member should be able to view
            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);

            expect(response.body.expense.id).toBe(expense.id);
        });

        it("should allow any group member to view expense paid by another member", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(12);
            const { user: member1, token: member1Token } = await createUserAndGetToken(13);
            const { user: member2, token: member2Token } = await createUserAndGetToken(14);
            
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

            // Member1 creates expense
            const expense = await createTestExpense(member1Token, { 
                group: group.id,
                paidBy: member1._id.toString()
            });

            // Member2 should be able to view
            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${member2Token}`)
                .expect(200);

            expect(response.body.expense.id).toBe(expense.id);
            expect(response.body.expense.paidBy.id).toBe(member1._id.toString());
        });
    });

    describe("Authorization - Denied Access", () => {
        
        it("should return 403 if user is not the payer and not a group member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(15);
            const { token: otherUserToken } = await createUserAndGetToken(16);
            
            const expense = await createTestExpense(creatorToken);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${otherUserToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not authorized to view this expense");
        });

        it("should return 403 if user is not a member of the expense's group", async () => {
            const { token: creatorToken } = await createUserAndGetToken(17);
            const { token: outsiderToken } = await createUserAndGetToken(18);
            
            const group = await createTestGroup(creatorToken);
            const expense = await createTestExpense(creatorToken, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${outsiderToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not authorized to view this expense");
        });

        it("should return 403 for removed group member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(19);
            const { user: member, token: memberToken } = await createUserAndGetToken(20);
            
            const group = await createTestGroup(creatorToken);
            
            // Invite member
            await request(app)
                .post(`/api/group/${group.id}/invite`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() });

            const expense = await createTestExpense(creatorToken, { group: group.id });

            // Remove member from group
            await Group.findByIdAndUpdate(
                group.id,
                { $pull: { members: member._id } }
            );

            // Member should no longer be able to view
            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not authorized to view this expense");
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 400 if expense ID is invalid format", async () => {
            const { token } = await createUserAndGetToken(21);

            const response = await request(app)
                .get("/api/expense/get-expense/invalid-id")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid expense ID");
        });

        it("should return 400 if expense ID is too short", async () => {
            const { token } = await createUserAndGetToken(22);

            const response = await request(app)
                .get("/api/expense/get-expense/123")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid expense ID");
        });

        it("should return 400 if expense ID contains invalid characters", async () => {
            const { token } = await createUserAndGetToken(23);

            const response = await request(app)
                .get("/api/expense/get-expense/123456789012345678901xyz")
                .set("Authorization", `Bearer ${token}`)
                .expect(400);

            expect(response.body.message).toBe("Invalid expense ID");
        });

        it("should return 404 if expense does not exist", async () => {
            const { token } = await createUserAndGetToken(24);
            const fakeExpenseId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/expense/get-expense/${fakeExpenseId}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toBe("Expense not found");
        });

        it("should return 404 if expense was deleted", async () => {
            const { token } = await createUserAndGetToken(25);
            const expense = await createTestExpense(token);

            // Delete the expense
            await Expense.findByIdAndDelete(expense.id);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toBe("Expense not found");
        });
    });

    describe("Authentication", () => {
        
        it("should return 401 if no token is provided", async () => {
            const { token } = await createUserAndGetToken(26);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const { token } = await createUserAndGetToken(27);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", "Bearer invalid.token.here")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user, token } = await createUserAndGetToken(28);
            const expense = await createTestExpense(token);

            const expiredToken = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });
    });

    describe("Response Format", () => {
        
        it("should return JSON content type", async () => {
            const { token } = await createUserAndGetToken(29);
            const expense = await createTestExpense(token);

            await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should have correct response structure", async () => {
            const { token } = await createUserAndGetToken(30);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("expense");
            expect(typeof response.body.message).toBe("string");
            expect(typeof response.body.expense).toBe("object");
        });

        it("should include all required expense fields", async () => {
            const { token } = await createUserAndGetToken(31);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const retrieved = response.body.expense;
            expect(retrieved).toHaveProperty("id");
            expect(retrieved).toHaveProperty("title");
            expect(retrieved).toHaveProperty("description");
            expect(retrieved).toHaveProperty("amount");
            expect(retrieved).toHaveProperty("currency");
            expect(retrieved).toHaveProperty("category");
            expect(retrieved).toHaveProperty("date");
            expect(retrieved).toHaveProperty("paidBy");
            expect(retrieved).toHaveProperty("group");
            expect(retrieved).toHaveProperty("splitType");
            expect(retrieved).toHaveProperty("splitDetails");
            expect(retrieved).toHaveProperty("paymentMethod");
            expect(retrieved).toHaveProperty("tags");
            expect(retrieved).toHaveProperty("isRecurring");
            expect(retrieved).toHaveProperty("recurringFrequency");
            expect(retrieved).toHaveProperty("notes");
            expect(retrieved).toHaveProperty("attachments");
            expect(retrieved).toHaveProperty("createdAt");
            expect(retrieved).toHaveProperty("updatedAt");
        });

        it("should have correct paidBy structure", async () => {
            const { token } = await createUserAndGetToken(32);
            const expense = await createTestExpense(token);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const paidBy = response.body.expense.paidBy;
            expect(paidBy).toHaveProperty("id");
            expect(paidBy).toHaveProperty("name");
            expect(paidBy).toHaveProperty("email");
            expect(typeof paidBy.id).toBe("string");
            expect(typeof paidBy.name).toBe("string");
            expect(typeof paidBy.email).toBe("string");
        });

        it("should have correct group structure when group exists", async () => {
            const { token } = await createUserAndGetToken(33);
            const group = await createTestGroup(token);
            const expense = await createTestExpense(token, { group: group.id });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const groupData = response.body.expense.group;
            expect(groupData).toHaveProperty("id");
            expect(groupData).toHaveProperty("name");
            expect(groupData).toHaveProperty("description");
            expect(typeof groupData.id).toBe("string");
            expect(typeof groupData.name).toBe("string");
            expect(typeof groupData.description).toBe("string");
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle expense with very long title", async () => {
            const { token } = await createUserAndGetToken(34);
            const longTitle = "A".repeat(200);
            
            const expense = await createTestExpense(token, {
                title: longTitle
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expense.title).toBe(longTitle);
        });

        it("should handle expense with maximum amount", async () => {
            const { token } = await createUserAndGetToken(35);
            
            const expense = await createTestExpense(token, {
                amount: 999999999.99
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expense.amount).toBe(999999999.99);
        });

        it("should handle expense with empty optional fields", async () => {
            const { token } = await createUserAndGetToken(36);
            
            const expense = await createTestExpense(token, {
                description: "",
                notes: "",
                tags: [],
                attachments: []
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const retrieved = response.body.expense;
            expect(retrieved.description).toBe("");
            expect(retrieved.notes).toBe("");
            expect(retrieved.tags).toEqual([]);
            expect(retrieved.attachments).toEqual([]);
        });

        it("should handle recurring expense", async () => {
            const { token } = await createUserAndGetToken(37);
            
            const expense = await createTestExpense(token, {
                isRecurring: true,
                recurringFrequency: "weekly"
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expense.isRecurring).toBe(true);
            expect(response.body.expense.recurringFrequency).toBe("weekly");
        });

        it("should handle expense with multiple attachments", async () => {
            const { token } = await createUserAndGetToken(38);
            const attachments = [
                { filename: "receipt1.jpg", url: "http://example.com/receipt1.jpg" },
                { filename: "receipt2.pdf", url: "http://example.com/receipt2.pdf" },
                { filename: "invoice.png", url: "http://example.com/invoice.png" },
                { filename: "document.docx", url: "http://example.com/document.docx" }
            ];
            
            const expense = await createTestExpense(token, {
                attachments: attachments
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            // Check attachments (ignore _id and uploadedAt which are auto-generated)
            expect(response.body.expense.attachments.length).toBe(4);
            expect(response.body.expense.attachments[0].filename).toBe("receipt1.jpg");
            expect(response.body.expense.attachments[0].url).toBe("http://example.com/receipt1.jpg");
            expect(response.body.expense.attachments[1].filename).toBe("receipt2.pdf");
            expect(response.body.expense.attachments[2].filename).toBe("invoice.png");
            expect(response.body.expense.attachments[3].filename).toBe("document.docx");
        });

        it("should handle expense with multiple tags", async () => {
            const { token } = await createUserAndGetToken(39);
            const tags = ["business", "travel", "urgent", "reimbursable"];
            
            const expense = await createTestExpense(token, {
                tags: tags
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expense.tags).toEqual(tags);
        });

        it("should handle expense with complex split details", async () => {
            const { user, token } = await createUserAndGetToken(40);
            const splitDetails = [
                { userId: user._id.toString(), amount: 33.33, settled: false },
                { userId: user._id.toString(), amount: 33.33, settled: false },
                { userId: user._id.toString(), amount: 33.34, settled: true }
            ];
            
            const expense = await createTestExpense(token, {
                amount: 100.00,
                splitType: "custom",
                splitDetails: splitDetails
            });

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            expect(response.body.expense.splitDetails).toBeDefined();
            expect(response.body.expense.splitDetails.length).toBe(3);
        });

        it("should handle different currency codes", async () => {
            const { token } = await createUserAndGetToken(41);
            const currencies = ["USD", "EUR", "GBP", "INR", "CAD"];
            
            for (const currency of currencies) {
                const expense = await createTestExpense(token, {
                    currency: currency,
                    title: `Expense in ${currency}`
                });

                const response = await request(app)
                    .get(`/api/expense/get-expense/${expense.id}`)
                    .set("Authorization", `Bearer ${token}`)
                    .expect(200);

                expect(response.body.expense.currency).toBe(currency);
            }
        });
    });

    describe("Performance", () => {
        
        it("should retrieve expense quickly (under 200ms)", async () => {
            const { token } = await createUserAndGetToken(42);
            const expense = await createTestExpense(token);

            const startTime = Date.now();
            
            await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(200);
        });

        it("should handle rapid successive retrievals", async () => {
            const { token } = await createUserAndGetToken(43);
            const expense = await createTestExpense(token);

            // Retrieve same expense 10 times rapidly
            const retrievals = Array(10).fill(null).map(() =>
                request(app)
                    .get(`/api/expense/get-expense/${expense.id}`)
                    .set("Authorization", `Bearer ${token}`)
            );

            const responses = await Promise.all(retrievals);

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.expense.id).toBe(expense.id);
            });
        });
    });

    describe("Data Consistency", () => {
        
        it("should return exact data that was stored", async () => {
            const { token } = await createUserAndGetToken(44);
            const originalData = {
                title: "Exact Data Test",
                description: "Testing data consistency",
                amount: 123.45,
                currency: "USD",
                category: "Other",  // Valid category from enum
                paymentMethod: "Debit Card",
                tags: ["test", "consistency"],
                notes: "Important test notes"
            };
            
            const expense = await createTestExpense(token, originalData);

            const response = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const retrieved = response.body.expense;
            expect(retrieved.title).toBe(originalData.title);
            expect(retrieved.description).toBe(originalData.description);
            expect(retrieved.amount).toBe(originalData.amount);
            expect(retrieved.currency).toBe(originalData.currency);
            expect(retrieved.category).toBe(originalData.category);
            expect(retrieved.paymentMethod).toBe(originalData.paymentMethod);
            expect(retrieved.tags).toEqual(originalData.tags);
            expect(retrieved.notes).toBe(originalData.notes);
        });

        it("should not modify data during retrieval", async () => {
            const { token } = await createUserAndGetToken(45);
            const expense = await createTestExpense(token);

            // Retrieve twice
            const response1 = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            const response2 = await request(app)
                .get(`/api/expense/get-expense/${expense.id}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(200);

            // Both responses should be identical
            expect(response1.body.expense).toEqual(response2.body.expense);
        });
    });
});
