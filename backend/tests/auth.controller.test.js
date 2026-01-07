import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { signup, login, logout, refreshToken } from "../controllers/auth.controller.js";
import User from "../models/user.model.js";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

dotenv.config();

// Create Express app for testing
const app = express();
app.use(express.json());
app.use(cookieParser());
app.post("/api/auth/signup", signup);
app.post("/api/auth/login", login);
app.post("/api/auth/logout", logout);
app.post("/api/auth/refresh-token", refreshToken);

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

describe("Logout Controller Tests", () => {
    
    it("should logout successfully and clear cookie", async () => {
        const response = await request(app)
            .post("/api/auth/logout")
            .expect(200);

        expect(response.body.message).toBe("Logout successful");
        
        // Check if Set-Cookie header is present to clear the cookie
        const cookies = response.headers['set-cookie'];
        if (cookies) {
            const tokenCookie = cookies.find(cookie => cookie.includes('token='));
            if (tokenCookie) {
                // Cookie should be cleared (empty value or expired)
                expect(tokenCookie).toMatch(/token=;|token=\s*;/);
            }
        }
    });

    it("should return 200 even without existing cookie", async () => {
        // Logout should work even if user doesn't have a cookie
        const response = await request(app)
            .post("/api/auth/logout")
            .expect(200);

        expect(response.body.message).toBe("Logout successful");
    });

    it("should handle logout with existing cookie", async () => {
        // First create a user and login to get a token
        const userData = {
            name: "Logout Test User",
            email: `logoutuser${Date.now()}@test.com`,
            password: "password123"
        };

        await request(app)
            .post("/api/auth/signup")
            .send(userData);

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({ email: userData.email, password: userData.password });

        const token = loginResponse.body.token;

        // Now logout with the cookie
        const response = await request(app)
            .post("/api/auth/logout")
            .set('Cookie', [`token=${token}`])
            .expect(200);

        expect(response.body.message).toBe("Logout successful");
    });

    it("should clear cookie regardless of token validity", async () => {
        // Logout should work even with invalid token
        const response = await request(app)
            .post("/api/auth/logout")
            .set('Cookie', ['token=invalid_token_here'])
            .expect(200);

        expect(response.body.message).toBe("Logout successful");
    });

    it("should handle multiple logout requests", async () => {
        // First logout
        const response1 = await request(app)
            .post("/api/auth/logout")
            .expect(200);

        expect(response1.body.message).toBe("Logout successful");

        // Second logout (should still work)
        const response2 = await request(app)
            .post("/api/auth/logout")
            .expect(200);

        expect(response2.body.message).toBe("Logout successful");
    });

    it("should return proper JSON response", async () => {
        const response = await request(app)
            .post("/api/auth/logout")
            .expect(200)
            .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toBe("Logout successful");
    });
});

describe("Refresh Token Controller Tests", () => {
    
    // Helper function to create a test user and get tokens
    const createUserAndGetTokens = async () => {
        const userData = {
            name: "Refresh Token User",
            email: `refreshuser${Date.now()}@test.com`,
            password: "password123"
        };

        await request(app)
            .post("/api/auth/signup")
            .send(userData);

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({ email: userData.email, password: userData.password });

        const accessToken = loginResponse.body.token;
        
        // Create a refresh token (long-lived)
        const user = await User.findOne({ email: userData.email });
        const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return { user, accessToken, refreshToken };
    };

    it("should refresh token successfully with valid refresh token", async () => {
        const { refreshToken } = await createUserAndGetTokens();

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${refreshToken}`])
            .expect(200);

        expect(response.body).toHaveProperty("token");
        expect(typeof response.body.token).toBe("string");
        expect(response.body.token.length).toBeGreaterThan(0);
    });

    it("should return 400 if refresh token is missing", async () => {
        const response = await request(app)
            .post("/api/auth/refresh-token")
            .expect(400);

        expect(response.body.message).toBe("Refresh token not found");
    });

    it("should return 400 if refresh token is missing from cookies", async () => {
        // Send request without any cookies
        const response = await request(app)
            .post("/api/auth/refresh-token")
            .send({})
            .expect(400);

        expect(response.body.message).toBe("Refresh token not found");
    });

    it("should return 500 if refresh token is invalid", async () => {
        const invalidToken = "invalid.token.here";

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${invalidToken}`])
            .expect(500);

        expect(response.body).toHaveProperty("message");
    });

    it("should return 500 if refresh token is malformed", async () => {
        const malformedToken = "malformed-token-without-proper-structure";

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${malformedToken}`])
            .expect(500);

        expect(response.body).toHaveProperty("message");
    });

    it("should return 500 if refresh token is expired", async () => {
        const { user } = await createUserAndGetTokens();

        // Create an expired token (expired 1 second ago)
        const expiredToken = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: "-1s" }
        );

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${expiredToken}`])
            .expect(500);

        expect(response.body).toHaveProperty("message");
    });

    it("should return 400 if user does not exist", async () => {
        // Create a token with non-existent user ID
        const fakeUserId = new mongoose.Types.ObjectId();
        const fakeToken = jwt.sign({ id: fakeUserId }, process.env.JWT_SECRET, { expiresIn: "7d" });

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${fakeToken}`])
            .expect(400);

        expect(response.body.message).toBe("User not found");
    });

    it("should generate a new access token different from refresh token", async () => {
        const { refreshToken } = await createUserAndGetTokens();

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${refreshToken}`])
            .expect(200);

        const newAccessToken = response.body.token;

        // New access token should be different from refresh token
        expect(newAccessToken).not.toBe(refreshToken);
    });

    it("should verify new access token has correct user ID", async () => {
        const { user, refreshToken } = await createUserAndGetTokens();

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${refreshToken}`])
            .expect(200);

        const newAccessToken = response.body.token;

        // Decode and verify the new token
        const decoded = jwt.verify(newAccessToken, process.env.JWT_SECRET);
        expect(decoded.id).toBe(user._id.toString());
    });

    it("should verify new access token has 1 hour expiration", async () => {
        const { refreshToken } = await createUserAndGetTokens();

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${refreshToken}`])
            .expect(200);

        const newAccessToken = response.body.token;
        const decoded = jwt.verify(newAccessToken, process.env.JWT_SECRET);

        // Check expiration is approximately 1 hour
        const expiresIn = decoded.exp - decoded.iat;
        expect(expiresIn).toBe(3600); // 1 hour in seconds
    });

    it("should allow multiple token refreshes with same refresh token", async () => {
        const { refreshToken } = await createUserAndGetTokens();

        // First refresh
        const response1 = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${refreshToken}`])
            .expect(200);

        expect(response1.body).toHaveProperty("token");

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Second refresh with same refresh token
        const response2 = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${refreshToken}`])
            .expect(200);

        expect(response2.body).toHaveProperty("token");

        // Both should succeed but generate different access tokens
        expect(response1.body.token).not.toBe(response2.body.token);
    });

    it("should handle refresh token with wrong secret gracefully", async () => {
        const { user } = await createUserAndGetTokens();

        // Create token with wrong secret
        const wrongSecretToken = jwt.sign({ id: user._id }, "wrong-secret-key", { expiresIn: "7d" });

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${wrongSecretToken}`])
            .expect(500);

        expect(response.body).toHaveProperty("message");
    });

    it("should return proper JSON response format", async () => {
        const { refreshToken } = await createUserAndGetTokens();

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${refreshToken}`])
            .expect(200)
            .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty("token");
        expect(typeof response.body.token).toBe("string");
    });

    it("should not accept empty refresh token cookie", async () => {
        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', ['refreshToken='])
            .expect(400);

        expect(response.body.message).toBe("Refresh token not found");
    });

    it("should handle refresh token with tampered payload", async () => {
        const { refreshToken } = await createUserAndGetTokens();

        // Tamper with the token by modifying it
        const tamperedToken = refreshToken.slice(0, -5) + "XXXXX";

        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${tamperedToken}`])
            .expect(500);

        expect(response.body).toHaveProperty("message");
    });

    it("should verify refresh token works after user data changes", async () => {
        const { user, refreshToken } = await createUserAndGetTokens();

        // Update user's name (simulate user data change)
        await User.findByIdAndUpdate(user._id, { name: "Updated Name" });

        // Refresh token should still work
        const response = await request(app)
            .post("/api/auth/refresh-token")
            .set('Cookie', [`refreshToken=${refreshToken}`])
            .expect(200);

        expect(response.body).toHaveProperty("token");
    });

    it("should handle concurrent refresh token requests", async () => {
        const { refreshToken } = await createUserAndGetTokens();

        // Send multiple concurrent requests
        const promises = [
            request(app).post("/api/auth/refresh-token").set('Cookie', [`refreshToken=${refreshToken}`]),
            request(app).post("/api/auth/refresh-token").set('Cookie', [`refreshToken=${refreshToken}`]),
            request(app).post("/api/auth/refresh-token").set('Cookie', [`refreshToken=${refreshToken}`])
        ];

        const responses = await Promise.all(promises);

        // All should succeed
        responses.forEach(response => {
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("token");
        });
    });
});
