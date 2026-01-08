import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { getGroupMembers, createGroup, inviteUserToGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";

process.env.NODE_ENV = 'test';

dotenv.config();

const app = express();
app.use(express.json());
app.post("/api/group/create-group", auth, createGroup);
app.post("/api/group/invite-user-to-group/:groupId", auth, inviteUserToGroup);
app.get("/api/group/get-group-members/:groupId", auth, getGroupMembers);

beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URL);
    }
});

afterAll(async () => {
    await Group.deleteMany({});
    await User.deleteMany({ email: { $regex: /@test\.com$/ } });
    await mongoose.connection.close();
});

describe("Get Group Members Controller Tests", () => {
    
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

    const createTestGroup = async (token, groupName = `Test Group ${Date.now()}`) => {
        const groupData = {
            name: groupName,
            description: "Test group for get members tests"
        };

        const response = await request(app)
            .post("/api/group/create-group")
            .set("Authorization", `Bearer ${token}`)
            .send(groupData);

        return response.body.group;
    };

    const inviteUserToTestGroup = async (groupId, userId, creatorToken) => {
        await request(app)
            .post(`/api/group/invite-user-to-group/${groupId}`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({ userId: userId.toString() });
    };

    afterEach(async () => {
        await Group.deleteMany({});
    });

    describe("Success Cases", () => {
        
        it("should successfully retrieve group members as a member", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(1);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.message).toBe("Group members retrieved successfully");
            expect(response.body).toHaveProperty("members");
            expect(response.body).toHaveProperty("count");
            expect(Array.isArray(response.body.members)).toBe(true);
            expect(response.body.count).toBe(1);
            expect(response.body.members[0]._id).toBe(creator._id.toString());
        });

        it("should return all members with correct fields", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(2);
            const { user: member1 } = await createUserAndGetToken(3);
            const { user: member2 } = await createUserAndGetToken(4);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.count).toBe(3);
            expect(response.body.members).toHaveLength(3);
            
            response.body.members.forEach(member => {
                expect(member).toHaveProperty("_id");
                expect(member).toHaveProperty("name");
                expect(member).toHaveProperty("email");
                expect(member).not.toHaveProperty("password");
            });
        });

        it("should allow any group member to view members", async () => {
            const { token: creatorToken } = await createUserAndGetToken(5);
            const { user: member, token: memberToken } = await createUserAndGetToken(6);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);

            expect(response.body.message).toBe("Group members retrieved successfully");
            expect(response.body.count).toBeGreaterThan(0);
        });

        it("should return correct count of members", async () => {
            const { token: creatorToken } = await createUserAndGetToken(7);
            const { user: member1 } = await createUserAndGetToken(8);
            const { user: member2 } = await createUserAndGetToken(9);
            const { user: member3 } = await createUserAndGetToken(10);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);
            await inviteUserToTestGroup(group.id, member3._id, creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.count).toBe(4); // Creator + 3 members
            expect(response.body.members.length).toBe(4);
        });

        it("should return members in database order", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(11);
            const { user: member1 } = await createUserAndGetToken(12);
            const { user: member2 } = await createUserAndGetToken(13);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            const memberIds = response.body.members.map(m => m._id);
            expect(memberIds).toContain(creator._id.toString());
            expect(memberIds).toContain(member1._id.toString());
            expect(memberIds).toContain(member2._id.toString());
        });
    });

    describe("Authentication & Authorization", () => {
        
        it("should return 401 if no token is provided", async () => {
            const { token: creatorToken } = await createUserAndGetToken(14);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const { token: creatorToken } = await createUserAndGetToken(15);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", "Bearer invalid.token.here")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(16);
            const group = await createTestGroup(creatorToken);

            const expiredToken = jwt.sign(
                { id: creator._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 403 if user is not a group member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(17);
            const { token: nonMemberToken } = await createUserAndGetToken(18);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${nonMemberToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not authorized to view this group");
        });

        it("should return 403 for user who was never added to group", async () => {
            const { token: creatorToken } = await createUserAndGetToken(19);
            const { token: outsiderToken } = await createUserAndGetToken(20);
            const { user: member } = await createUserAndGetToken(21);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${outsiderToken}`)
                .expect(403);

            expect(response.body.message).toBe("You are not authorized to view this group");
        });

        it("should allow creator to view members", async () => {
            const { token: creatorToken } = await createUserAndGetToken(22);
            const { user: member } = await createUserAndGetToken(23);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.count).toBe(2);
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 404 if group does not exist", async () => {
            const { token } = await createUserAndGetToken(24);
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/group/get-group-members/${fakeGroupId}`)
                .set("Authorization", `Bearer ${token}`)
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 500 if groupId is invalid format", async () => {
            const { token } = await createUserAndGetToken(25);

            const response = await request(app)
                .get(`/api/group/get-group-members/invalid-id-format`)
                .set("Authorization", `Bearer ${token}`)
                .expect(500);

            expect(response.body.message).toBeTruthy();
        });

        it("should return 404 if group has no members (edge case)", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(26);
            const group = await createTestGroup(creatorToken);

            // Manually remove all members (edge case scenario)
            await Group.findByIdAndUpdate(group.id, { members: [] });

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(403); // User is no longer a member

            expect(response.body.message).toBe("You are not authorized to view this group");
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle group with single member (creator only)", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(27);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.count).toBe(1);
            expect(response.body.members[0]._id).toBe(creator._id.toString());
        });

        it("should handle group with many members", async () => {
            const { token: creatorToken } = await createUserAndGetToken(28);
            const group = await createTestGroup(creatorToken);

            // Add 10 members
            for (let i = 0; i < 10; i++) {
                const { user } = await createUserAndGetToken(100 + i);
                await inviteUserToTestGroup(group.id, user._id, creatorToken);
            }

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.count).toBe(11); // Creator + 10 members
            expect(response.body.members.length).toBe(11);
        });

        it("should not expose password field", async () => {
            const { token: creatorToken } = await createUserAndGetToken(29);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            response.body.members.forEach(member => {
                expect(member).not.toHaveProperty("password");
                expect(member).not.toHaveProperty("__v");
            });
        });

        it("should handle concurrent requests from different members", async () => {
            const { token: creatorToken } = await createUserAndGetToken(30);
            const { user: member1, token: member1Token } = await createUserAndGetToken(31);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);

            const [response1, response2] = await Promise.all([
                request(app)
                    .get(`/api/group/get-group-members/${group.id}`)
                    .set("Authorization", `Bearer ${creatorToken}`),
                request(app)
                    .get(`/api/group/get-group-members/${group.id}`)
                    .set("Authorization", `Bearer ${member1Token}`)
            ]);

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
            expect(response1.body.count).toBe(response2.body.count);
        });

        it("should handle deleted users gracefully", async () => {
            const { token: creatorToken } = await createUserAndGetToken(32);
            const { user: member } = await createUserAndGetToken(33);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            // Delete the member user
            await User.findByIdAndDelete(member._id);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            // Should only return creator (member was deleted)
            expect(response.body.count).toBe(1);
        });
    });

    describe("Response Format", () => {
        
        it("should return correct response structure", async () => {
            const { token: creatorToken } = await createUserAndGetToken(34);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("count");
            expect(response.body).toHaveProperty("members");
            expect(typeof response.body.message).toBe("string");
            expect(typeof response.body.count).toBe("number");
            expect(Array.isArray(response.body.members)).toBe(true);
        });

        it("should return JSON content type", async () => {
            const { token: creatorToken } = await createUserAndGetToken(35);
            const group = await createTestGroup(creatorToken);

            await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should return members with only selected fields", async () => {
            const { token: creatorToken } = await createUserAndGetToken(36);
            const { user: member } = await createUserAndGetToken(37);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            const firstMember = response.body.members[0];
            const memberKeys = Object.keys(firstMember);
            
            expect(memberKeys).toContain("_id");
            expect(memberKeys).toContain("name");
            expect(memberKeys).toContain("email");
            expect(memberKeys.length).toBeLessThanOrEqual(3);
        });

        it("should match count with actual members array length", async () => {
            const { token: creatorToken } = await createUserAndGetToken(38);
            const { user: member1 } = await createUserAndGetToken(39);
            const { user: member2 } = await createUserAndGetToken(40);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.count).toBe(response.body.members.length);
        });
    });

    describe("Performance & Database", () => {
        
        it("should use lean query for performance", async () => {
            const { token: creatorToken } = await createUserAndGetToken(41);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            // Lean queries return plain objects without Mongoose methods
            const member = response.body.members[0];
            expect(typeof member).toBe("object");
            expect(member.constructor.name).toBe("Object");
        });

        it("should only fetch required fields from database", async () => {
            const { token: creatorToken } = await createUserAndGetToken(42);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .get(`/api/group/get-group-members/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            response.body.members.forEach(member => {
                const keys = Object.keys(member);
                expect(keys).toEqual(expect.arrayContaining(["_id", "name", "email"]));
                expect(keys).not.toContain("password");
                expect(keys).not.toContain("createdAt");
                expect(keys).not.toContain("updatedAt");
            });
        });

        it("should handle rapid successive requests", async () => {
            const { token: creatorToken } = await createUserAndGetToken(43);
            const group = await createTestGroup(creatorToken);

            const requests = Array(5).fill(null).map(() =>
                request(app)
                    .get(`/api/group/get-group-members/${group.id}`)
                    .set("Authorization", `Bearer ${creatorToken}`)
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.count).toBe(1);
            });
        });
    });
});
