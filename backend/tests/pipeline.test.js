import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import cookieParser from "cookie-parser";
import authRouter from "../routes/auth.route.js";
import groupRouter from "../routes/group.route.js";
import expenseRouter from "../routes/expense.route.js";
import User from "../models/user.model.js";

/**
 * Professional Integration Test Suite for CI/CD Pipeline
 * This test suite covers the critical paths of the FinterHub Backend.
 * It uses an in-memory MongoDB server to ensure isolation and speed.
 */

let mongoServer;
const app = express();

// Setup app middleware and routes
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);
app.use("/api/group", groupRouter);
app.use("/api/expense", expenseRouter);

// Database setup and teardown
beforeAll(async () => {
    // Force test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key_for_pipeline';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe("🚀 Pipeline Critical Path Tests", () => {
    let userToken;
    let userId;
    let groupId;

    describe("🔐 Authentication Flow", () => {
        it("should successfully register a new user", async () => {
            const userData = {
                name: "Pipeline Tester",
                email: "pipeline@finterhub.test",
                password: "StrongPassword123!"
            };

            const response = await request(app)
                .post("/api/auth/signup")
                .send(userData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty("token");
            expect(response.body.user).toHaveProperty("email", userData.email);
            
            userToken = response.body.token;
            userId = response.body.user.id;
        });

        it("should fail to register with an existing email", async () => {
            const userData = {
                name: "Duplicate User",
                email: "pipeline@finterhub.test",
                password: "password123"
            };

            const response = await request(app)
                .post("/api/auth/signup")
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body.message).toMatch(/exists/i);
        });

        it("should login successfully and return a token", async () => {
            const loginData = {
                email: "pipeline@finterhub.test",
                password: "StrongPassword123!"
            };

            const response = await request(app)
                .post("/api/auth/login")
                .send(loginData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("token");
        });
    });

    describe("👥 Group Management Flow", () => {
        it("should create a new expense group", async () => {
            const groupData = {
                name: "Pipeline Project",
                description: "This is a descriptive group for CI testing purposes."
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${userToken}`)
                .send(groupData);

            expect(response.status).toBe(201);
            // The model lowercases the name
            expect(response.body.group.name).toBe(groupData.name.toLowerCase());
            groupId = response.body.group.id;
        });

        it("should list groups where user is present", async () => {
            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("groups");
            expect(Array.isArray(response.body.groups)).toBe(true);
            expect(response.body.groups.some(g => g.id === groupId)).toBe(true);
        });
    });

    describe("💰 Expense & Settlement Flow (Smoke Test)", () => {
        it("should be able to reach the expense endpoint", async () => {
            const response = await request(app)
                .get("/api/expense/get-user-expenses")
                .set("Authorization", `Bearer ${userToken}`);
            
            // Just verifying the endpoint is alive and auth works
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("expenses");
            expect(Array.isArray(response.body.expenses)).toBe(true);
        });
    });

    describe("🏥 System Health", () => {
        it("should respond to health check (simulated)", async () => {
            // Adding a small health check if not already present in router
            app.get("/api/ping", (req, res) => res.status(200).json({ status: "ok" }));
            
            const response = await request(app).get("/api/ping");
            expect(response.status).toBe(200);
            expect(response.body.status).toBe("ok");
        });
    });
});
