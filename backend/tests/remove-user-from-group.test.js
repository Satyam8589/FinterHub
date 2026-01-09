import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { removeUserFromGroup, createGroup, inviteUserToGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";

process.env.NODE_ENV = 'test';

dotenv.config();

const app = express();
app.use(express.json());
app.post("/api/group/create-group", auth, createGroup);
app.post("/api/group/invite-user-to-group/:groupId", auth, inviteUserToGroup);
app.post("/api/group/remove-user-from-group/:groupId", auth, removeUserFromGroup);

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

describe("Remove User From Group Controller Tests", () => {
    
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
            description: "Test group for remove user tests"
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
        
        it("should successfully remove a user from group as creator", async () => {
            const { token: creatorToken } = await createUserAndGetToken(1);
            const { user: member } = await createUserAndGetToken(2);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            expect(response.body.message).toBe("User removed from group successfully");
            expect(response.body).toHaveProperty("group");
            expect(response.body.group).toHaveProperty("members");
            expect(response.body.group.members).not.toContain(member._id.toString());
        });

        it("should reduce member count after removal", async () => {
            const { token: creatorToken } = await createUserAndGetToken(3);
            const { user: member1 } = await createUserAndGetToken(4);
            const { user: member2 } = await createUserAndGetToken(5);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member1._id.toString() })
                .expect(200);

            expect(response.body.group.members.length).toBe(2); // Creator + member2
            expect(response.body.group.members).not.toContain(member1._id.toString());
        });

        it("should return updated group with correct structure", async () => {
            const { token: creatorToken } = await createUserAndGetToken(6);
            const { user: member } = await createUserAndGetToken(7);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            expect(response.body.group).toHaveProperty("id");
            expect(response.body.group).toHaveProperty("name");
            expect(response.body.group).toHaveProperty("members");
            expect(Array.isArray(response.body.group.members)).toBe(true);
        });

        it("should allow creator to remove multiple users sequentially", async () => {
            const { token: creatorToken } = await createUserAndGetToken(8);
            const { user: member1 } = await createUserAndGetToken(9);
            const { user: member2 } = await createUserAndGetToken(10);
            const { user: member3 } = await createUserAndGetToken(11);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);
            await inviteUserToTestGroup(group.id, member3._id, creatorToken);

            // Remove first member
            await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member1._id.toString() })
                .expect(200);

            // Remove second member
            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member2._id.toString() })
                .expect(200);

            expect(response.body.group.members.length).toBe(2); // Creator + member3
        });
    });

    describe("Authorization - Only Creator Can Remove", () => {
        
        it("should return 403 if non-creator member tries to remove user", async () => {
            const { token: creatorToken } = await createUserAndGetToken(12);
            const { user: member1, token: member1Token } = await createUserAndGetToken(13);
            const { user: member2 } = await createUserAndGetToken(14);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${member1Token}`)
                .send({ userId: member2._id.toString() })
                .expect(403);

            expect(response.body.message).toBe("Only group creator can remove users");
        });

        it("should return 403 if regular member tries to remove themselves", async () => {
            const { token: creatorToken } = await createUserAndGetToken(15);
            const { user: member, token: memberToken } = await createUserAndGetToken(16);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ userId: member._id.toString() })
                .expect(403);

            expect(response.body.message).toBe("Only group creator can remove users");
        });

        it("should return 403 if non-member tries to remove user", async () => {
            const { token: creatorToken } = await createUserAndGetToken(17);
            const { user: member } = await createUserAndGetToken(18);
            const { token: outsiderToken } = await createUserAndGetToken(19);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${outsiderToken}`)
                .send({ userId: member._id.toString() })
                .expect(403);

            expect(response.body.message).toBe("Only group creator can remove users");
        });

        it("should allow creator to remove any member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(20);
            const { user: member } = await createUserAndGetToken(21);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            expect(response.body.message).toBe("User removed from group successfully");
        });
    });

    describe("Authentication", () => {
        
        it("should return 401 if no token is provided", async () => {
            const { token: creatorToken } = await createUserAndGetToken(22);
            const { user: member } = await createUserAndGetToken(23);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .send({ userId: member._id.toString() })
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const { token: creatorToken } = await createUserAndGetToken(24);
            const { user: member } = await createUserAndGetToken(25);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", "Bearer invalid.token.here")
                .send({ userId: member._id.toString() })
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(26);
            const { user: member } = await createUserAndGetToken(27);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const expiredToken = jwt.sign(
                { id: creator._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${expiredToken}`)
                .send({ userId: member._id.toString() })
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 400 if userId is not provided", async () => {
            const { token: creatorToken } = await createUserAndGetToken(28);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({})
                .expect(400);

            expect(response.body.message).toBe("User ID is required");
        });

        it("should return 400 if userId is null", async () => {
            const { token: creatorToken } = await createUserAndGetToken(29);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: null })
                .expect(400);

            expect(response.body.message).toBe("User ID is required");
        });

        it("should return 400 if userId is empty string", async () => {
            const { token: creatorToken } = await createUserAndGetToken(30);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: "" })
                .expect(400);

            expect(response.body.message).toBe("User ID is required");
        });

        it("should return 404 if group does not exist", async () => {
            const { user: member, token: creatorToken } = await createUserAndGetToken(31);
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${fakeGroupId}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 404 if user to remove does not exist", async () => {
            const { token: creatorToken } = await createUserAndGetToken(32);
            const group = await createTestGroup(creatorToken);
            const fakeUserId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: fakeUserId.toString() })
                .expect(404);

            expect(response.body.message).toBe("User not found");
        });

        it("should return 400 if user is not a member of the group", async () => {
            const { token: creatorToken } = await createUserAndGetToken(33);
            const { user: nonMember } = await createUserAndGetToken(34);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: nonMember._id.toString() })
                .expect(400);

            expect(response.body.message).toBe("User is not a member of this group");
        });

        it("should return 500 if groupId is invalid format", async () => {
            const { user: member, token: creatorToken } = await createUserAndGetToken(35);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/invalid-id-format`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(500);

            expect(response.body.message).toBeTruthy();
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle removing the last member (leaving only creator)", async () => {
            const { token: creatorToken } = await createUserAndGetToken(36);
            const { user: member } = await createUserAndGetToken(37);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            expect(response.body.group.members.length).toBe(1); // Only creator
        });

        it("should not allow removing user twice", async () => {
            const { token: creatorToken } = await createUserAndGetToken(38);
            const { user: member } = await createUserAndGetToken(39);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            // First removal
            await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            // Second removal attempt
            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(400);

            expect(response.body.message).toBe("User is not a member of this group");
        });

        it("should handle removing from group with many members", async () => {
            const { token: creatorToken } = await createUserAndGetToken(40);
            const group = await createTestGroup(creatorToken);

            // Add 10 members
            const members = [];
            for (let i = 0; i < 10; i++) {
                const { user } = await createUserAndGetToken(100 + i);
                members.push(user);
                await inviteUserToTestGroup(group.id, user._id, creatorToken);
            }

            // Remove one member
            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: members[5]._id.toString() })
                .expect(200);

            expect(response.body.group.members.length).toBe(10); // Creator + 9 remaining members
            expect(response.body.group.members).not.toContain(members[5]._id.toString());
        });

        it("should handle concurrent removal attempts gracefully", async () => {
            const { token: creatorToken } = await createUserAndGetToken(41);
            const { user: member1 } = await createUserAndGetToken(42);
            const { user: member2 } = await createUserAndGetToken(43);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);

            const [response1, response2] = await Promise.all([
                request(app)
                    .post(`/api/group/remove-user-from-group/${group.id}`)
                    .set("Authorization", `Bearer ${creatorToken}`)
                    .send({ userId: member1._id.toString() }),
                request(app)
                    .post(`/api/group/remove-user-from-group/${group.id}`)
                    .set("Authorization", `Bearer ${creatorToken}`)
                    .send({ userId: member2._id.toString() })
            ]);

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
        });
    });

    describe("Response Format", () => {
        
        it("should return correct response structure", async () => {
            const { token: creatorToken } = await createUserAndGetToken(44);
            const { user: member } = await createUserAndGetToken(45);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("group");
            expect(typeof response.body.message).toBe("string");
            expect(typeof response.body.group).toBe("object");
        });

        it("should return JSON content type", async () => {
            const { token: creatorToken } = await createUserAndGetToken(46);
            const { user: member } = await createUserAndGetToken(47);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should return group with selected fields only", async () => {
            const { token: creatorToken } = await createUserAndGetToken(48);
            const { user: member } = await createUserAndGetToken(49);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            const groupKeys = Object.keys(response.body.group);
            expect(groupKeys).toContain("id");
            expect(groupKeys).toContain("name");
            expect(groupKeys).toContain("members");
        });
    });

    describe("Database Integrity", () => {
        
        it("should actually remove user from database", async () => {
            const { token: creatorToken } = await createUserAndGetToken(50);
            const { user: member } = await createUserAndGetToken(51);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            // Verify in database
            const updatedGroup = await Group.findById(group.id);
            expect(updatedGroup.members).not.toContainEqual(member._id);
        });

        it("should not delete the user account, only remove from group", async () => {
            const { token: creatorToken } = await createUserAndGetToken(52);
            const { user: member } = await createUserAndGetToken(53);
            const group = await createTestGroup(creatorToken);

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            // Verify user still exists
            const userStillExists = await User.findById(member._id);
            expect(userStillExists).toBeTruthy();
        });

        it("should preserve other group data when removing user", async () => {
            const { token: creatorToken } = await createUserAndGetToken(54);
            const { user: member } = await createUserAndGetToken(55);
            const group = await createTestGroup(creatorToken, "Preserve Test Group");

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            await request(app)
                .post(`/api/group/remove-user-from-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            // Verify group data is preserved
            const updatedGroup = await Group.findById(group.id);
            expect(updatedGroup.name).toBe("preserve test group");
            expect(updatedGroup.description).toBe("Test group for remove user tests");
        });
    });
});
