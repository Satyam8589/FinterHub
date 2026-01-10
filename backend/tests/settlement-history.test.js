import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import Settlement from "../models/settlement.model.js";
import settlementRouter from "../routes/settlement.route.js";

dotenv.config();
process.env.NODE_ENV = 'test';

// Create Express app for testing
const app = express();
app.use(express.json());
app.use("/api/settlement", settlementRouter);

// Connect to MongoDB
beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URL);
    }
});

// Clean up after tests
afterAll(async () => {
    await User.deleteMany({ email: { $regex: /@settlementhistorytest\.com$/ } });
    await Group.deleteMany({ name: { $regex: /^Test Settlement History/ } });
    await Settlement.deleteMany({});
    await mongoose.connection.close();
});

describe("Settlement History & Verification Tests", () => {
    let user1, user2, user3, outsider;
    let token1, token2, token3, outsiderToken;
    let group;
    let settlement1, settlement2;

    beforeEach(async () => {
        // Create test users
        user1 = await User.create({
            name: "Alice",
            email: `alice${Date.now()}@settlementhistorytest.com`,
            password: "password123",
            preferredCurrency: "USD"
        });

        user2 = await User.create({
            name: "Bob",
            email: `bob${Date.now()}@settlementhistorytest.com`,
            password: "password123",
            preferredCurrency: "EUR"
        });

        user3 = await User.create({
            name: "Carol",
            email: `carol${Date.now()}@settlementhistorytest.com`,
            password: "password123",
            preferredCurrency: "GBP"
        });

        outsider = await User.create({
            name: "Outsider",
            email: `outsider${Date.now()}@settlementhistorytest.com`,
            password: "password123",
            preferredCurrency: "USD"
        });

        // Generate tokens
        token1 = jwt.sign({ id: user1._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        token2 = jwt.sign({ id: user2._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        token3 = jwt.sign({ id: user3._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        outsiderToken = jwt.sign({ id: outsider._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        // Create a group (user1, user2, user3 are members)
        group = await Group.create({
            name: `Test Settlement History Group ${Date.now()}`,
            description: "Test group",
            createdBy: user1._id,
            members: [user1._id, user2._id, user3._id]
        });

        // Create test settlements
        settlement1 = await Settlement.create({
            group: group._id,
            from: user2._id,  // Bob owes Alice
            to: user1._id,
            amount: 50,
            currency: "USD",
            amountUSD: 50,
            status: "pending"
        });

        settlement2 = await Settlement.create({
            group: group._id,
            from: user3._id,  // Carol owes Alice
            to: user1._id,
            amount: 30,
            currency: "USD",
            amountUSD: 30,
            status: "pending"
        });
    });

    afterEach(async () => {
        await User.deleteMany({ _id: { $in: [user1._id, user2._id, user3._id, outsider._id] } });
        await Group.deleteMany({ _id: group._id });
        await Settlement.deleteMany({ group: group._id });
    });

    // ============================================
    // GET SETTLEMENT HISTORY TESTS
    // ============================================

    describe("GET /api/settlement/:groupId/history", () => {
        
        it("should return 401 if no token provided", async () => {
            const response = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 404 if group not found", async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/settlement/${fakeGroupId}/history`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 403 if user is not group member", async () => {
            const response = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${outsiderToken}`)
                .expect(403);

            expect(response.body.message).toContain("not authorized");
        });

        it("should return settlement history for group members", async () => {
            const response = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            expect(response.body.message).toBe("Settlement history retrieved successfully");
            expect(response.body.groupId).toBe(group._id.toString());
            expect(response.body.groupName).toBe(group.name);
            expect(Array.isArray(response.body.settlements)).toBe(true);
            expect(response.body.settlements.length).toBe(2);
        });

        it("should return empty array if no settlements exist", async () => {
            // Delete all settlements
            await Settlement.deleteMany({ group: group._id });

            const response = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            expect(response.body.settlements).toEqual([]);
        });

        it("should work for any group member", async () => {
            // User1 requests
            const response1 = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            // User2 requests
            const response2 = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${token2}`)
                .expect(200);

            // Both should get same settlements
            expect(response1.body.settlements.length).toBe(response2.body.settlements.length);
        });

        it("should include all settlement fields", async () => {
            const response = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            const settlement = response.body.settlements[0];
            expect(settlement).toHaveProperty("_id");
            expect(settlement).toHaveProperty("group");
            expect(settlement).toHaveProperty("from");
            expect(settlement).toHaveProperty("to");
            expect(settlement).toHaveProperty("amount");
            expect(settlement).toHaveProperty("currency");
            expect(settlement).toHaveProperty("status");
        });
    });

    // ============================================
    // VERIFY SETTLEMENT TESTS
    // ============================================

    describe("PATCH /api/settlement/:groupId/verify/:settlementId", () => {
        
        it("should return 401 if no token provided", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 404 if group not found", async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .patch(`/api/settlement/${fakeGroupId}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 403 if user is not group member", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${outsiderToken}`)
                .expect(403);

            expect(response.body.message).toContain("not authorized");
        });

        it("should return 404 if settlement not found", async () => {
            const fakeSettlementId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${fakeSettlementId}`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(404);

            expect(response.body.message).toBe("Settlement not found");
        });

        it("should return 400 if settlement does not belong to group", async () => {
            // Create another group
            const otherGroup = await Group.create({
                name: `Other Group ${Date.now()}`,
                description: "Other group",
                createdBy: user1._id,
                members: [user1._id]
            });

            const response = await request(app)
                .patch(`/api/settlement/${otherGroup._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(400);

            expect(response.body.message).toContain("does not belong to this group");

            await Group.deleteOne({ _id: otherGroup._id });
        });

        it("should return 403 if user is neither payer nor receiver", async () => {
            // User3 tries to verify settlement between User1 and User2
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token3}`)
                .expect(403);

            expect(response.body.message).toContain("Only the payer or receiver");
        });

        it("should allow payer (from) to verify settlement", async () => {
            // User2 (payer) verifies
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .send({ notes: "Paid via UPI" })
                .expect(200);

            expect(response.body.message).toBe("Settlement verified successfully");
            expect(response.body.settlement.status).toBe("verified");
            expect(response.body.settlement.verifiedBy.toString()).toBe(user2._id.toString());
            expect(response.body.settlement.notes).toBe("Paid via UPI");
            expect(response.body.settlement).toHaveProperty("verifiedAt");
        });

        it("should allow receiver (to) to verify settlement", async () => {
            // User1 (receiver) verifies
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token1}`)
                .send({ notes: "Received payment" })
                .expect(200);

            expect(response.body.message).toBe("Settlement verified successfully");
            expect(response.body.settlement.status).toBe("verified");
            expect(response.body.settlement.verifiedBy.toString()).toBe(user1._id.toString());
            expect(response.body.settlement.notes).toBe("Received payment");
        });

        it("should verify without notes (optional)", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .send({})
                .expect(200);

            expect(response.body.settlement.status).toBe("verified");
            expect(response.body.settlement.notes).toBeUndefined();
        });

        it("should return 400 if settlement is already completed", async () => {
            // Mark settlement as completed
            settlement1.status = "completed";
            await settlement1.save();

            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .expect(400);

            expect(response.body.message).toBe("Settlement is already completed");
        });

        it("should update settlement in database", async () => {
            await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .send({ notes: "Test note" })
                .expect(200);

            // Verify in database
            const updatedSettlement = await Settlement.findById(settlement1._id);
            expect(updatedSettlement.status).toBe("verified");
            expect(updatedSettlement.verifiedBy.toString()).toBe(user2._id.toString());
            expect(updatedSettlement.verifiedAt).toBeDefined();
            expect(updatedSettlement.notes).toBe("Test note");
        });

        it("should return proper response structure", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("settlement");
            expect(response.body.settlement).toHaveProperty("id");
            expect(response.body.settlement).toHaveProperty("from");
            expect(response.body.settlement).toHaveProperty("to");
            expect(response.body.settlement).toHaveProperty("amount");
            expect(response.body.settlement).toHaveProperty("currency");
            expect(response.body.settlement).toHaveProperty("status");
            expect(response.body.settlement).toHaveProperty("verifiedBy");
            expect(response.body.settlement).toHaveProperty("verifiedAt");
        });

        it("should handle multiple settlements independently", async () => {
            // Verify first settlement
            await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .expect(200);

            // Second settlement should still be pending
            const settlement2Data = await Settlement.findById(settlement2._id);
            expect(settlement2Data.status).toBe("pending");

            // Verify second settlement
            await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement2._id}`)
                .set("Authorization", `Bearer ${token3}`)
                .expect(200);

            // Both should now be verified
            const settlement1Data = await Settlement.findById(settlement1._id);
            const settlement2DataUpdated = await Settlement.findById(settlement2._id);
            expect(settlement1Data.status).toBe("verified");
            expect(settlement2DataUpdated.status).toBe("verified");
        });
    });

    // ============================================
    // INTEGRATION TESTS
    // ============================================

    describe("Integration: History + Verification", () => {
        
        it("should show verified settlements in history", async () => {
            // Verify a settlement
            await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .send({ notes: "Paid" })
                .expect(200);

            // Get history
            const response = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            const verifiedSettlement = response.body.settlements.find(
                s => s._id.toString() === settlement1._id.toString()
            );

            expect(verifiedSettlement.status).toBe("verified");
        });

        it("should track verification details in history", async () => {
            // Verify settlement
            await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .send({ notes: "Bank transfer" })
                .expect(200);

            // Get history
            const response = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            const verifiedSettlement = response.body.settlements.find(
                s => s._id.toString() === settlement1._id.toString()
            );

            expect(verifiedSettlement).toHaveProperty("verifiedBy");
            expect(verifiedSettlement).toHaveProperty("verifiedAt");
            expect(verifiedSettlement.notes).toBe("Bank transfer");
        });

        it("should show mix of pending and verified settlements", async () => {
            // Verify only first settlement
            await request(app)
                .patch(`/api/settlement/${group._id}/verify/${settlement1._id}`)
                .set("Authorization", `Bearer ${token2}`)
                .expect(200);

            // Get history
            const response = await request(app)
                .get(`/api/settlement/${group._id}/history`)
                .set("Authorization", `Bearer ${token1}`)
                .expect(200);

            const statuses = response.body.settlements.map(s => s.status);
            expect(statuses).toContain("verified");
            expect(statuses).toContain("pending");
        });
    });
});
