import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import Settlement from "../models/settlement.model.js";
import settlementRouter from "../routes/settlement.route.js";
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


describe("Record Settlement Tests", () => {
    let payer, receiver, otherMember, outsider;
    let payerToken, receiverToken, otherMemberToken, outsiderToken;
    let group;
    let pendingSettlement, verifiedSettlement, completedSettlement;

    // Create test data before each test for fresh state
    beforeEach(async () => {
        // Create test users
        payer = await User.create({
            name: "Bob (Payer)",
            email: `bob${Date.now()}@recordsettlementtest.com`,
            password: "password123",
            preferredCurrency: "USD"
        });

        receiver = await User.create({
            name: "Alice (Receiver)",
            email: `alice${Date.now()}@recordsettlementtest.com`,
            password: "password123",
            preferredCurrency: "USD"
        });

        otherMember = await User.create({
            name: "Carol (Other)",
            email: `carol${Date.now()}@recordsettlementtest.com`,
            password: "password123",
            preferredCurrency: "USD"
        });

        outsider = await User.create({
            name: "Dave (Outsider)",
            email: `dave${Date.now()}@recordsettlementtest.com`,
            password: "password123",
            preferredCurrency: "USD"
        });

        // Generate tokens
        payerToken = jwt.sign({ id: payer._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        receiverToken = jwt.sign({ id: receiver._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        otherMemberToken = jwt.sign({ id: otherMember._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        outsiderToken = jwt.sign({ id: outsider._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        // Create a group
        group = await Group.create({
            name: `Test Record Settlement Group ${Date.now()}`,
            description: "Test group",
            createdBy: receiver._id,
            members: [payer._id, receiver._id, otherMember._id]
        });

        // Create test settlements with different statuses
        pendingSettlement = await Settlement.create({
            group: group._id,
            from: payer._id,
            to: receiver._id,
            amount: 100,
            currency: "USD",
            amountUSD: 100,
            status: "pending"
        });

        verifiedSettlement = await Settlement.create({
            group: group._id,
            from: payer._id,
            to: receiver._id,
            amount: 50,
            currency: "USD",
            amountUSD: 50,
            status: "verified",
            verifiedBy: payer._id,
            verifiedAt: new Date()
        });

        completedSettlement = await Settlement.create({
            group: group._id,
            from: payer._id,
            to: receiver._id,
            amount: 25,
            currency: "USD",
            amountUSD: 25,
            status: "completed",
            verifiedBy: payer._id,
            verifiedAt: new Date(),
            completedAt: new Date()
        });
    });




    describe("PATCH /api/settlement/:groupId/complete/:settlementId", () => {
        
        // ============================================
        // AUTHENTICATION TESTS
        // ============================================

        it("should return 401 if no token provided", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if invalid token provided", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", "Bearer invalid_token")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        // ============================================
        // VALIDATION TESTS
        // ============================================

        it("should return 404 if group not found", async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .patch(`/api/settlement/${fakeGroupId}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 404 if settlement not found", async () => {
            const fakeSettlementId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${fakeSettlementId}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(404);

            expect(response.body.message).toBe("Settlement not found");
        });

        it("should return 400 if settlement does not belong to group", async () => {
            // Create another group
            const otherGroup = await Group.create({
                name: `Other Group ${Date.now()}`,
                description: "Other group",
                createdBy: receiver._id,
                members: [receiver._id]
            });

            const response = await request(app)
                .patch(`/api/settlement/${otherGroup._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(400);

            expect(response.body.message).toContain("does not belong to this group");

            await Group.deleteOne({ _id: otherGroup._id });
        });

        // ============================================
        // AUTHORIZATION TESTS
        // ============================================

        it("should return 403 if user is not group member", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${outsiderToken}`)
                .expect(403);

            expect(response.body.message).toContain("not authorized");
        });

        it("should return 403 if user is not the receiver", async () => {
            // Payer tries to complete (only receiver should be able to)
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${payerToken}`)
                .expect(403);

            expect(response.body.message).toContain("Only the receiver can mark");
        });

        it("should return 403 if user is other group member (not receiver)", async () => {
            // Other member tries to complete
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${otherMemberToken}`)
                .expect(403);

            expect(response.body.message).toContain("Only the receiver can mark");
        });

        // ============================================
        // STATUS VALIDATION TESTS
        // ============================================

        it("should return 400 if settlement status is pending (not verified)", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${pendingSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(400);

            expect(response.body.message).toContain("must be verified before");
        });

        it("should return 400 if settlement is already completed", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${completedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(400);

            expect(response.body.message).toContain("must be verified before");
        });

        // ============================================
        // SUCCESS TESTS
        // ============================================

        it("should successfully complete settlement when receiver requests", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            expect(response.body.message).toBe("Settlement recorded successfully");
            expect(response.body.settlement).toHaveProperty("id");
            expect(response.body.settlement.status).toBe("completed");
            expect(response.body.settlement).toHaveProperty("completedAt");
            expect(response.body.settlement.from.toString()).toBe(payer._id.toString());
            expect(response.body.settlement.to.toString()).toBe(receiver._id.toString());
        });

        it("should update settlement status to completed in database", async () => {
            await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            // Verify in database
            const updatedSettlement = await Settlement.findById(verifiedSettlement._id);
            expect(updatedSettlement.status).toBe("completed");
            expect(updatedSettlement.completedAt).toBeDefined();
            expect(updatedSettlement.completedAt).toBeInstanceOf(Date);
        });

        it("should set completedAt timestamp", async () => {
            const beforeTime = new Date();

            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            const afterTime = new Date();
            const completedAt = new Date(response.body.settlement.completedAt);

            expect(completedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(completedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });

        it("should return proper response structure", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
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
            expect(response.body.settlement).toHaveProperty("completedAt");
        });

        it("should include all settlement details in response", async () => {
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            const { settlement } = response.body;
            expect(settlement.id).toBe(verifiedSettlement._id.toString());
            expect(settlement.amount).toBe(50);
            expect(settlement.currency).toBe("USD");
            expect(settlement.status).toBe("completed");
        });

        // ============================================
        // EDGE CASES
        // ============================================

        it("should handle multiple settlements independently", async () => {
            // Create another verified settlement
            const anotherSettlement = await Settlement.create({
                group: group._id,
                from: payer._id,
                to: receiver._id,
                amount: 75,
                currency: "USD",
                amountUSD: 75,
                status: "verified",
                verifiedBy: payer._id,
                verifiedAt: new Date()
            });

            // Complete first settlement
            await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            // Second settlement should still be verified
            const secondSettlementData = await Settlement.findById(anotherSettlement._id);
            expect(secondSettlementData.status).toBe("verified");

            // Complete second settlement
            await request(app)
                .patch(`/api/settlement/${group._id}/complete/${anotherSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            // Both should now be completed
            const firstSettlementData = await Settlement.findById(verifiedSettlement._id);
            const secondSettlementDataUpdated = await Settlement.findById(anotherSettlement._id);
            expect(firstSettlementData.status).toBe("completed");
            expect(secondSettlementDataUpdated.status).toBe("completed");

            await Settlement.deleteOne({ _id: anotherSettlement._id });
        });

        it("should not allow completing same settlement twice", async () => {
            // Complete settlement first time
            await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            // Try to complete again
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(400);

            expect(response.body.message).toContain("must be verified before");
        });

        it("should preserve existing settlement data", async () => {
            const originalSettlement = await Settlement.findById(verifiedSettlement._id);
            const originalAmount = originalSettlement.amount;
            const originalCurrency = originalSettlement.currency;
            const originalFrom = originalSettlement.from;
            const originalTo = originalSettlement.to;

            await request(app)
                .patch(`/api/settlement/${group._id}/complete/${verifiedSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            const updatedSettlement = await Settlement.findById(verifiedSettlement._id);
            expect(updatedSettlement.amount).toBe(originalAmount);
            expect(updatedSettlement.currency).toBe(originalCurrency);
            expect(updatedSettlement.from.toString()).toBe(originalFrom.toString());
            expect(updatedSettlement.to.toString()).toBe(originalTo.toString());
        });

        // ============================================
        // WORKFLOW TESTS
        // ============================================

        it("should follow correct workflow: pending → verified → completed", async () => {
            // Create new settlement
            const newSettlement = await Settlement.create({
                group: group._id,
                from: payer._id,
                to: receiver._id,
                amount: 200,
                currency: "USD",
                amountUSD: 200,
                status: "pending"
            });

            // Try to complete pending settlement (should fail)
            await request(app)
                .patch(`/api/settlement/${group._id}/complete/${newSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(400);

            // Verify settlement first
            newSettlement.status = "verified";
            newSettlement.verifiedBy = payer._id;
            newSettlement.verifiedAt = new Date();
            await newSettlement.save();

            // Now complete should work
            const response = await request(app)
                .patch(`/api/settlement/${group._id}/complete/${newSettlement._id}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .expect(200);

            expect(response.body.settlement.status).toBe("completed");

            await Settlement.deleteOne({ _id: newSettlement._id });
        });
    });
});
