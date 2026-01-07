import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { signup } from "../controllers/auth.controller.js";
import User from "../models/user.model.js";

dotenv.config();

// Create Express app for testing
const app = express();
app.use(express.json());
app.post("/api/auth/signup", signup);

// Connect to your actual MongoDB database
beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URL);
    }
});

// Clean up test users after tests
afterAll(async () => {
    // Delete test users created during testing
    await User.deleteMany({ email: { $regex: /@test\.com$/ } });
    await mongoose.connection.close();
});

describe("Signup Controller Tests", () => {
    
    it("should create a new user and return a token", async () => {
        const userData = {
            name: "Test User",
            email: `testuser${Date.now()}@test.com`,
            password: "password123"
        };

        const response = await request(app)
            .post("/api/auth/signup")
            .send(userData)
            .expect(201);

        expect(response.body).toHaveProperty("token");
        expect(typeof response.body.token).toBe("string");

        // Verify user was created
        const user = await User.findOne({ email: userData.email });
        expect(user).toBeTruthy();
        expect(user.name).toBe(userData.name);
    });

    it("should return 400 if name is missing", async () => {
        const userData = {
            email: "test@test.com",
            password: "password123"
        };

        const response = await request(app)
            .post("/api/auth/signup")
            .send(userData)
            .expect(400);

        expect(response.body.message).toBe("All fields are required");
    });

    it("should return 400 if email is missing", async () => {
        const userData = {
            name: "Test User",
            password: "password123"
        };

        const response = await request(app)
            .post("/api/auth/signup")
            .send(userData)
            .expect(400);

        expect(response.body.message).toBe("All fields are required");
    });

    it("should return 400 if password is missing", async () => {
        const userData = {
            name: "Test User",
            email: "test@test.com"
        };

        const response = await request(app)
            .post("/api/auth/signup")
            .send(userData)
            .expect(400);

        expect(response.body.message).toBe("All fields are required");
    });

    it("should return 400 if user already exists", async () => {
        const userData = {
            name: "Duplicate User",
            email: `duplicate${Date.now()}@test.com`,
            password: "password123"
        };

        // Create user first time
        await request(app)
            .post("/api/auth/signup")
            .send(userData)
            .expect(201);

        // Try to create same user again
        const response = await request(app)
            .post("/api/auth/signup")
            .send(userData)
            .expect(400);

        expect(response.body.message).toBe("User already exists");
    });
});
