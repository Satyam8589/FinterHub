import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { signup, login, logout, refreshToken, getUserProfile } from "../controllers/auth.controller.js";
import User from "../models/user.model.js";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { auth } from "../middleware/auth.js";
import { connect, closeDatabase, clearDatabase } from "./setup/db.js";


// Set test environment for faster bcrypt (1 round instead of 10)
process.env.NODE_ENV = 'test';

dotenv.config();

// Create Express app for testing
const app = express();
app.use(express.json());
app.use(cookieParser());
app.post("/api/auth/signup", signup);
app.post("/api/auth/login", login);
app.post("/api/auth/logout", logout);
app.post("/api/auth/refresh-token", refreshToken);
app.get("/api/auth/profile", auth, getUserProfile);

// Connect to in-memory database
beforeAll(async () => {
    await connect();
});

// Clean up database after tests
afterAll(async () => {
    await closeDatabase();
});

// Clear data between tests (optional but recommended for true isolation)
afterEach(async () => {
    await clearDatabase();
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

    it("should return 401 if user does not exist", async () => {
        const loginData = {
            email: "nonexistent@test.com",
            password: "password123"
        };

        const response = await request(app)
            .post("/api/auth/login")
            .send(loginData)
            .expect(401);

        expect(response.body.message).toBe("Invalid credentials");
    });

    it("should return 401 if password is incorrect", async () => {
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
            .expect(401);

        expect(response.body.message).toBe("Invalid credentials");
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
            .expect(401);

        // Should fail because email is case-sensitive
        expect(response.body.message).toBe("Invalid credentials");
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

describe("Get User Profile Controller Tests", () => {
    
    // Helper function to create a test user and get access token
    const createUserAndGetToken = async () => {
        const userData = {
            name: "Profile Test User",
            email: `profileuser${Date.now()}@test.com`,
            password: "password123"
        };

        await request(app)
            .post("/api/auth/signup")
            .send(userData);

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({ email: userData.email, password: userData.password });

        const accessToken = loginResponse.body.token;
        const user = await User.findOne({ email: userData.email });

        return { user, accessToken, userData };
    };

    it("should get user profile successfully with valid token", async () => {
        const { accessToken, userData } = await createUserAndGetToken();

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(200);

        expect(response.body).toHaveProperty("user");
        expect(response.body.user).toHaveProperty("id");
        expect(response.body.user).toHaveProperty("name");
        expect(response.body.user).toHaveProperty("email");
        expect(response.body.user.name).toBe(userData.name);
        expect(response.body.user.email).toBe(userData.email);
    });

    it("should return 401 if no authorization token is provided", async () => {
        const response = await request(app)
            .get("/api/auth/profile")
            .expect(401);

        expect(response.body.message).toContain("Unauthorized");
    });

    it("should return 401 if authorization header is missing", async () => {
        const response = await request(app)
            .get("/api/auth/profile")
            .expect(401);

        expect(response.body.message).toBe("Unauthorized - No token provided");
    });

    it("should return 401 if token is invalid", async () => {
        const invalidToken = "invalid.token.here";

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${invalidToken}`)
            .expect(401);

        expect(response.body.message).toContain("Unauthorized");
    });

    it("should return 401 if token is malformed", async () => {
        const malformedToken = "malformed-token-without-proper-structure";

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${malformedToken}`)
            .expect(401);

        expect(response.body.message).toContain("Unauthorized");
    });

    it("should return 401 if token is expired", async () => {
        const { user } = await createUserAndGetToken();

        // Create an expired token (expired 1 second ago)
        const expiredToken = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: "-1s" }
        );

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${expiredToken}`)
            .expect(401);

        expect(response.body.message).toContain("Unauthorized");
    });

    it("should NOT include password in response", async () => {
        const { accessToken } = await createUserAndGetToken();

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(200);

        expect(response.body.user).not.toHaveProperty("password");
        
        // Verify password is not in any form
        const responseString = JSON.stringify(response.body);
        expect(responseString).not.toContain("password");
        expect(responseString).not.toContain("$2b$"); // bcrypt hash prefix
    });

    it("should return 404 if user no longer exists", async () => {
        const { user, accessToken } = await createUserAndGetToken();

        // Delete the user from database
        await User.findByIdAndDelete(user._id);

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(404);

        expect(response.body.message).toBe("User not found");
    });

    it("should accept token without 'Bearer' prefix", async () => {
        const { accessToken, userData } = await createUserAndGetToken();

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", accessToken)
            .expect(200);

        expect(response.body.user.email).toBe(userData.email);
    });

    it("should return correct user data for different users", async () => {
        // Create first user
        const user1 = await createUserAndGetToken();
        
        // Wait a moment to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Create second user
        const user2 = await createUserAndGetToken();

        // Get profile for user 1
        const response1 = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${user1.accessToken}`)
            .expect(200);

        // Get profile for user 2
        const response2 = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${user2.accessToken}`)
            .expect(200);

        // Verify different users get their own data
        expect(response1.body.user.email).toBe(user1.userData.email);
        expect(response2.body.user.email).toBe(user2.userData.email);
        expect(response1.body.user.email).not.toBe(response2.body.user.email);
    });

    it("should return proper JSON response format", async () => {
        const { accessToken } = await createUserAndGetToken();

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(200)
            .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty("user");
        expect(typeof response.body.user).toBe("object");
    });

    it("should handle token with wrong secret gracefully", async () => {
        const { user } = await createUserAndGetToken();

        // Create token with wrong secret
        const wrongSecretToken = jwt.sign({ id: user._id }, "wrong-secret-key", { expiresIn: "1h" });

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${wrongSecretToken}`)
            .expect(401);

        expect(response.body.message).toContain("Unauthorized");
    });

    it("should handle token with tampered payload", async () => {
        const { accessToken } = await createUserAndGetToken();

        // Tamper with the token by modifying it
        const tamperedToken = accessToken.slice(0, -5) + "XXXXX";

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${tamperedToken}`)
            .expect(401);

        expect(response.body.message).toContain("Unauthorized");
    });

    it("should verify user ID in response matches token", async () => {
        const { user, accessToken } = await createUserAndGetToken();

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(200);

        expect(response.body.user.id).toBe(user._id.toString());
    });

    it("should work after user data is updated", async () => {
        const { user, accessToken } = await createUserAndGetToken();

        // Update user's name
        const newName = "Updated Profile Name";
        await User.findByIdAndUpdate(user._id, { name: newName });

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(200);

        // Should return updated name
        expect(response.body.user.name).toBe(newName);
    });

    it("should handle multiple concurrent profile requests", async () => {
        const { accessToken } = await createUserAndGetToken();

        // Send multiple concurrent requests
        const promises = [
            request(app).get("/api/auth/profile").set("Authorization", `Bearer ${accessToken}`),
            request(app).get("/api/auth/profile").set("Authorization", `Bearer ${accessToken}`),
            request(app).get("/api/auth/profile").set("Authorization", `Bearer ${accessToken}`)
        ];

        const responses = await Promise.all(promises);

        // All should succeed with same data
        responses.forEach(response => {
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("user");
        });

        // All responses should have same user data
        expect(responses[0].body.user.id).toBe(responses[1].body.user.id);
        expect(responses[1].body.user.id).toBe(responses[2].body.user.id);
    });

    it("should return 401 with empty authorization header", async () => {
        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", "")
            .expect(401);

        expect(response.body.message).toContain("Unauthorized");
    });

    it("should return 401 with Bearer but no token", async () => {
        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", "Bearer ")
            .expect(401);

        expect(response.body.message).toContain("Unauthorized");
    });

    it("should only return safe user fields", async () => {
        const { accessToken } = await createUserAndGetToken();

        const response = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(200);

        const userKeys = Object.keys(response.body.user);
        
        // Should only have these safe fields
        expect(userKeys).toContain("id");
        expect(userKeys).toContain("name");
        expect(userKeys).toContain("email");
        
        // Should NOT have sensitive fields
        expect(userKeys).not.toContain("password");
        expect(userKeys).not.toContain("__v");
    });
});
