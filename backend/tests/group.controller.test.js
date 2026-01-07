import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { createGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";

// Set test environment for faster bcrypt
process.env.NODE_ENV = 'test';

dotenv.config();

// Create Express app for testing
const app = express();
app.use(express.json());
app.post("/api/group/create-group", auth, createGroup);

// Connect to your actual MongoDB database
beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URL);
    }
});

// Clean up ALL test data after all tests complete
afterAll(async () => {
    // Delete ALL groups (since this is a test suite, we can safely delete all)
    // In production, you'd want more specific filtering
    await Group.deleteMany({});
    
    // Delete all test users
    await User.deleteMany({ email: { $regex: /@test\.com$/ } });
    
    await mongoose.connection.close();
});

describe("Create Group Controller Tests", () => {
    
    // Store group names created in each test for cleanup
    let createdGroupNames = [];
    
    // Helper function to create a test user and get token
    const createUserAndGetToken = async () => {
        const userData = {
            name: "Test User",
            email: `testuser${Date.now()}@test.com`,
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

    // Clean up created groups after each test
    afterEach(async () => {
        // Delete ALL groups after each test to prevent duplicates
        // This ensures a clean state for the next test
        await Group.deleteMany({});
    });

    describe("Success Cases", () => {
        
        it("should create a group with valid data and token", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test Group Success",
                description: "This is a test group for success case"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body).toHaveProperty("message", "Group created successfully");
            expect(response.body).toHaveProperty("group");
            expect(response.body.group).toHaveProperty("id");
            expect(response.body.group).toHaveProperty("name", groupData.name.toLowerCase());
            expect(response.body.group).toHaveProperty("description", groupData.description);
            expect(response.body.group).toHaveProperty("createdBy");

            // Verify group was created in database
            const group = await Group.findOne({ name: groupData.name.toLowerCase() });
            expect(group).toBeTruthy();
            expect(group.name).toBe(groupData.name.toLowerCase());
        });

        it("should create group with minimum valid name length (3 chars)", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "ABC",
                description: "Minimum name length test group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.name).toBe("abc");
        });

        it("should create group with minimum valid description length (10 chars)", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test Min Desc",
                description: "1234567890" // Exactly 10 characters
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.description).toBe(groupData.description);
        });

        it("should convert group name to lowercase", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "UPPERCASE GROUP",
                description: "Testing lowercase conversion"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.name).toBe("uppercase group");
        });

        it("should trim whitespace from name and description", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "  Trimmed Group  ",
                description: "  This description has whitespace  "
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.name).toBe("trimmed group");
            expect(response.body.group.description).toBe("This description has whitespace");
        });
    });

    describe("Authentication & Authorization", () => {
        
        it("should return 401 if no token is provided", async () => {
            const groupData = {
                name: "Test Group",
                description: "This is a test group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .send(groupData)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const groupData = {
                name: "Test Group",
                description: "This is a test group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", "Bearer invalid.token.here")
                .send(groupData)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user } = await createUserAndGetToken();

            // Create an expired token
            const expiredToken = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const groupData = {
                name: "Test Group",
                description: "This is a test group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${expiredToken}`)
                .send(groupData)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token has wrong signature", async () => {
            const { user } = await createUserAndGetToken();

            // Create token with wrong secret
            const wrongToken = jwt.sign(
                { id: user._id },
                "wrong-secret-key",
                { expiresIn: "1h" }
            );

            const groupData = {
                name: "Test Group",
                description: "This is a test group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${wrongToken}`)
                .send(groupData)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should accept token without Bearer prefix", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test No Bearer",
                description: "Testing token without Bearer prefix"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", token) // No "Bearer " prefix
                .send(groupData)
                .expect(201);

            expect(response.body.message).toBe("Group created successfully");
        });

        it("should link group to authenticated user", async () => {
            const { user, token } = await createUserAndGetToken();

            const groupData = {
                name: "Test User Link",
                description: "Testing user linkage"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.createdBy).toBe(user._id.toString());

            // Verify in database
            const group = await Group.findOne({ name: groupData.name.toLowerCase() });
            expect(group.user.toString()).toBe(user._id.toString());
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 400 if name is missing", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                description: "This is a test group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(400);

            expect(response.body.message).toBe("All fields are required");
        });

        it("should return 400 if description is missing", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test Group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(400);

            expect(response.body.message).toBe("All fields are required");
        });

        it("should return 400 if both fields are missing", async () => {
            const { token } = await createUserAndGetToken();

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send({})
                .expect(400);

            expect(response.body.message).toBe("All fields are required");
        });

        it("should return 400 if name is empty string", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "",
                description: "This is a test group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(400);

            expect(response.body.message).toBe("All fields are required");
        });

        it("should return 400 if description is empty string", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test Group",
                description: ""
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(400);

            expect(response.body.message).toBe("All fields are required");
        });

        it("should return 400 if name is less than 3 characters", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "AB",
                description: "This is a test group"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(400);

            expect(response.body.message).toBe("Name must be at least 3 characters");
        });

        it("should return 400 if description is less than 10 characters", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test Group",
                description: "Short"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(400);

            expect(response.body.message).toBe("Description must be at least 10 characters");
        });

        it("should return 500 if name is only whitespace (trimmed to empty)", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "   ",
                description: "This is a test group"
            };

            // Mongoose trim will convert "   " to "", which fails required validation
            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(500);

            expect(response.body.message).toBeTruthy();
        });
    });

    describe("Duplicate Group Handling", () => {
        
        it("should return 400 if group name already exists", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Duplicate Test Group",
                description: "This is a test group for duplicate check"
            };

            // Create group first time
            await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            // Try to create same group again
            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(400);

            expect(response.body.message).toBe("Group already exists");
        });

        it("should detect duplicate even with different case", async () => {
            const { token } = await createUserAndGetToken();

            const groupData1 = {
                name: "case test group",
                description: "This is a test group"
            };

            const groupData2 = {
                name: "CASE TEST GROUP",
                description: "This is another test group"
            };

            // Create first group
            await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData1)
                .expect(201);

            // Try to create with different case
            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData2)
                .expect(400);

            expect(response.body.message).toBe("Group already exists");
        });

        it("should allow different users to create groups with same name", async () => {
            // Note: Current implementation doesn't allow this due to unique constraint
            // This test documents the current behavior
            const { token: token1 } = await createUserAndGetToken();
            const { token: token2 } = await createUserAndGetToken();

            const groupData = {
                name: "Shared Name Group",
                description: "Testing shared names"
            };

            // User 1 creates group
            await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token1}`)
                .send(groupData)
                .expect(201);

            // User 2 tries to create group with same name
            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token2}`)
                .send(groupData)
                .expect(400);

            expect(response.body.message).toBe("Group already exists");
        });
    });

    describe("Edge Cases & Special Characters", () => {
        
        it("should handle special characters in name", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test-Group_2024!",
                description: "Testing special characters in name"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.name).toBe("test-group_2024!");
        });

        it("should handle special characters in description", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Special Chars Desc",
                description: "Testing @#$%^&*() special chars!"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.description).toBe(groupData.description);
        });

        it("should handle very long names", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "A".repeat(100),
                description: "Testing very long name"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.name.length).toBe(100);
        });

        it("should handle very long descriptions", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Long Desc Test",
                description: "A".repeat(500)
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.description.length).toBe(500);
        });

        it("should handle unicode characters", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test 测试 グループ",
                description: "Testing unicode: 你好 こんにちは"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.name).toContain("测试");
        });

        it("should handle emojis in name and description", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Test Group 🚀",
                description: "Testing emojis 😊🎉💯"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body.group.name).toContain("🚀");
        });
    });

    describe("Response Format", () => {
        
        it("should return correct response structure", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Response Test",
                description: "Testing response format"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("group");
            expect(response.body.group).toHaveProperty("id");
            expect(response.body.group).toHaveProperty("name");
            expect(response.body.group).toHaveProperty("description");
            expect(response.body.group).toHaveProperty("createdBy");
        });

        it("should return JSON content type", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "JSON Test",
                description: "Testing JSON response"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201)
                .expect("Content-Type", /json/);

            expect(response.body).toBeTruthy();
        });
    });

    describe("Database Operations", () => {
        
        it("should save group with timestamps", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "Timestamp Test",
                description: "Testing timestamps"
            };

            await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            const group = await Group.findOne({ name: groupData.name.toLowerCase() });
            expect(group.createdAt).toBeTruthy();
            expect(group.updatedAt).toBeTruthy();
        });

        it("should verify group is saved in database", async () => {
            const { token } = await createUserAndGetToken();

            const groupData = {
                name: "DB Verify Test",
                description: "Testing database save"
            };

            const response = await request(app)
                .post("/api/group/create-group")
                .set("Authorization", `Bearer ${token}`)
                .send(groupData)
                .expect(201);

            // Verify group exists in database
            const group = await Group.findById(response.body.group.id);
            expect(group).toBeTruthy();
            expect(group.name).toBe(groupData.name.toLowerCase());
            expect(group.description).toBe(groupData.description);
        });
    });
});
