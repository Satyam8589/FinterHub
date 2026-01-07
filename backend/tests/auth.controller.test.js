import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { signup, login } from "../controllers/auth.controller.js";
import User from "../models/user.model.js";

dotenv.config();

// Create Express app for testing
const app = express();
app.use(express.json());
app.post("/api/auth/signup", signup);
app.post("/api/auth/login", login);

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

describe("Login Controller Tests", () => {
    
    // Helper function to create a test user
    const createTestUser = async () => {
        const userData = {
            name: "Login Test User",
            email: `loginuser${Date.now()}@test.com`,
            password: "password123"
        };

        await request(app)
            .post("/api/auth/signup")
            .send(userData);

        return userData;
    };

    it("should login successfully with valid credentials", async () => {
        // First create a user
        const userData = await createTestUser();

        // Then try to login
        const loginData = {
            email: userData.email,
            password: userData.password
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(200);

        expect(response.body).toHaveProperty("token");
        expect(typeof response.body.token).toBe("string");
    });

    it("should return 400 if email is missing", async () => {
        const loginData = {
            password: "password123"
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(400);

        expect(response.body.message).toBe("All fields are required");
    });

    it("should return 400 if password is missing", async () => {
        const loginData = {
            email: "test@test.com"
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(400);

        expect(response.body.message).toBe("All fields are required");
    });

    it("should return 400 if both fields are missing", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({})
            .expect(400);

        expect(response.body.message).toBe("All fields are required");
    });

    it("should return 400 if user does not exist", async () => {
        const loginData = {
            email: "nonexistent@test.com",
            password: "password123"
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(400);

        expect(response.body.message).toBe("User not found");
    });

    it("should return 400 if password is incorrect", async () => {
        // Create a user first
        const userData = await createTestUser();

        // Try to login with wrong password
        const loginData = {
            email: userData.email,
            password: "wrongpassword"
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(400);

        expect(response.body.message).toBe("Invalid password");
    });

    it("should verify password is hashed and compared correctly", async () => {
        // Create a user
        const userData = await createTestUser();

        // Verify user's password is hashed in database
        const user = await User.findOne({ email: userData.email });
        expect(user.password).not.toBe(userData.password);
        expect(user.password.length).toBeGreaterThan(20); // Bcrypt hash is long

        // Login should still work with plain password
        const loginData = {
            email: userData.email,
            password: userData.password
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(200);

        expect(response.body).toHaveProperty("token");
    });

    it("should return different tokens for different login sessions", async () => {
        // Create a user
        const userData = await createTestUser();

        const loginData = {
            email: userData.email,
            password: userData.password
        };

        // First login
        const response1 = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(200);

        // Wait a moment to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Second login
        const response2 = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(200);

        // Tokens should be different (different iat timestamp)
        expect(response1.body.token).not.toBe(response2.body.token);
    });

    it("should handle case-sensitive email correctly", async () => {
        // Create a user with lowercase email
        const userData = await createTestUser();

        // Try to login with uppercase email
        const loginData = {
            email: userData.email.toUpperCase(),
            password: userData.password
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(400);

        // Should fail because email is case-sensitive
        expect(response.body.message).toBe("User not found");
    });

    it("should not allow login with empty string credentials", async () => {
        const loginData = {
            email: "",
            password: ""
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(400);

        expect(response.body.message).toBe("All fields are required");
    });
});
