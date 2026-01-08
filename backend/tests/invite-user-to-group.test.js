import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { inviteUserToGroup, createGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";

process.env.NODE_ENV = 'test';

dotenv.config();

const app = express();
app.use(express.json());
app.post("/api/group/create-group", auth, createGroup);
app.post("/api/group/invite-user-to-group/:groupId", auth, inviteUserToGroup);

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

describe("Invite User to Group Controller Tests", () => {
    
    const createUserAndGetToken = async (emailSuffix = Date.now()) => {
        const userData = {
            name: "Test User",
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
            description: "Test group for invitation tests"
        };

        const response = await request(app)
            .post("/api/group/create-group")
            .set("Authorization", `Bearer ${token}`)
            .send(groupData);

        return response.body.group;
    };

    afterEach(async () => {
        await Group.deleteMany({});
    });

    describe("Success Cases", () => {
        
        it("should successfully invite a user to a group", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(1);
            const { user: invitee } = await createUserAndGetToken(2);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            expect(response.body.message).toBe("User invited to group successfully");
            expect(response.body.group).toHaveProperty("id");
            expect(response.body.group).toHaveProperty("name");
            expect(response.body.group).toHaveProperty("members");
            expect(response.body.group.members).toContain(invitee._id.toString());
            expect(response.body.group.members.length).toBe(2); // Creator + invitee
        });

        it("should verify user is added to database", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(3);
            const { user: invitee } = await createUserAndGetToken(4);
            const group = await createTestGroup(creatorToken);

            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            const updatedGroup = await Group.findById(group.id);
            expect(updatedGroup.members).toHaveLength(2);
            expect(updatedGroup.members.map(m => m.toString())).toContain(invitee._id.toString());
        });

        it("should allow inviting multiple users to the same group", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(5);
            const { user: invitee1 } = await createUserAndGetToken(6);
            const { user: invitee2 } = await createUserAndGetToken(7);
            const { user: invitee3 } = await createUserAndGetToken(8);
            const group = await createTestGroup(creatorToken);

            // Invite first user
            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee1._id.toString() })
                .expect(200);

            // Invite second user
            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee2._id.toString() })
                .expect(200);

            // Invite third user
            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee3._id.toString() })
                .expect(200);

            expect(response.body.group.members.length).toBe(4); // Creator + 3 invitees
        });

        it("should return updated group information", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(9);
            const { user: invitee } = await createUserAndGetToken(10);
            const group = await createTestGroup(creatorToken, "Response Test Group");

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            expect(response.body.group.id).toBe(group.id);
            expect(response.body.group.name).toBe("response test group");
            expect(Array.isArray(response.body.group.members)).toBe(true);
        });
    });

    describe("Authentication & Authorization", () => {
        
        it("should return 401 if no token is provided", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(11);
            const { user: invitee } = await createUserAndGetToken(12);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .send({ userId: invitee._id.toString() })
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(13);
            const { user: invitee } = await createUserAndGetToken(14);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", "Bearer invalid.token.here")
                .send({ userId: invitee._id.toString() })
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 403 if user is not the group creator", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(15);
            const { user: nonCreator, token: nonCreatorToken } = await createUserAndGetToken(16);
            const { user: invitee } = await createUserAndGetToken(17);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${nonCreatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(403);

            expect(response.body.message).toBe("Only group creator can invite users");
        });

        it("should allow only the creator to invite users", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(18);
            const { user: member, token: memberToken } = await createUserAndGetToken(19);
            const { user: invitee } = await createUserAndGetToken(20);
            const group = await createTestGroup(creatorToken);

            // Add member to group first
            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: member._id.toString() })
                .expect(200);

            // Member tries to invite another user (should fail)
            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(403);

            expect(response.body.message).toBe("Only group creator can invite users");
        });

        it("should return 401 if token is expired", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(21);
            const { user: invitee } = await createUserAndGetToken(22);
            const group = await createTestGroup(creatorToken);

            const expiredToken = jwt.sign(
                { id: creator._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${expiredToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });
    });

    describe("Validation Errors", () => {
        
        it("should return 400 if userId is missing", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(23);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({})
                .expect(400);

            expect(response.body.message).toBe("User ID is required");
        });

        it("should return 400 if userId is empty string", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(24);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: "" })
                .expect(400);

            expect(response.body.message).toBe("User ID is required");
        });

        it("should return 400 if userId is null", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(25);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: null })
                .expect(400);

            expect(response.body.message).toBe("User ID is required");
        });

        it("should return 404 if group does not exist", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(26);
            const { user: invitee } = await createUserAndGetToken(27);
            const fakeGroupId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${fakeGroupId}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(404);

            expect(response.body.message).toBe("Group not found");
        });

        it("should return 404 if user to invite does not exist", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(28);
            const group = await createTestGroup(creatorToken);
            const fakeUserId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: fakeUserId.toString() })
                .expect(404);

            expect(response.body.message).toBe("User not found");
        });

        it("should return 500 if groupId is invalid format", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(29);
            const { user: invitee } = await createUserAndGetToken(30);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/invalid-id-format`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(500);

            expect(response.body.message).toBeTruthy();
        });

        it("should return 500 if userId is invalid ObjectId format", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(31);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: "invalid-user-id" })
                .expect(500);

            expect(response.body.message).toBeTruthy();
        });
    });

    describe("Duplicate Member Handling", () => {
        
        it("should return 400 if user is already a member", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(32);
            const { user: invitee } = await createUserAndGetToken(33);
            const group = await createTestGroup(creatorToken);

            // Invite user first time
            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            // Try to invite same user again
            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(400);

            expect(response.body.message).toBe("User is already a member of this group");
        });

        it("should prevent creator from being invited again", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(34);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: creator._id.toString() })
                .expect(400);

            expect(response.body.message).toBe("User is already a member of this group");
        });

        it("should not add duplicate members to database", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(35);
            const { user: invitee } = await createUserAndGetToken(36);
            const group = await createTestGroup(creatorToken);

            // Invite user
            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            // Try to invite again
            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(400);

            // Verify only 2 members in database
            const updatedGroup = await Group.findById(group.id);
            expect(updatedGroup.members.length).toBe(2); // Creator + invitee (no duplicates)
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle inviting user immediately after group creation", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(37);
            const { user: invitee } = await createUserAndGetToken(38);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            expect(response.body.message).toBe("User invited to group successfully");
        });

        it("should handle rapid successive invitations", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(39);
            const { user: invitee1 } = await createUserAndGetToken(40);
            const { user: invitee2 } = await createUserAndGetToken(41);
            const group = await createTestGroup(creatorToken);

            // Send two invitations rapidly
            const [response1, response2] = await Promise.all([
                request(app)
                    .post(`/api/group/invite-user-to-group/${group.id}`)
                    .set("Authorization", `Bearer ${creatorToken}`)
                    .send({ userId: invitee1._id.toString() }),
                request(app)
                    .post(`/api/group/invite-user-to-group/${group.id}`)
                    .set("Authorization", `Bearer ${creatorToken}`)
                    .send({ userId: invitee2._id.toString() })
            ]);

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);

            const updatedGroup = await Group.findById(group.id);
            expect(updatedGroup.members.length).toBe(3); // Creator + 2 invitees
        });

        it("should handle inviting user with extra whitespace in userId", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(42);
            const { user: invitee } = await createUserAndGetToken(43);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: `  ${invitee._id.toString()}  ` })
                .expect(500); // MongoDB will reject trimmed invalid ObjectId

            expect(response.body.message).toBeTruthy();
        });

        it("should maintain member order in array", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(44);
            const { user: invitee1 } = await createUserAndGetToken(45);
            const { user: invitee2 } = await createUserAndGetToken(46);
            const group = await createTestGroup(creatorToken);

            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee1._id.toString() })
                .expect(200);

            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee2._id.toString() })
                .expect(200);

            const updatedGroup = await Group.findById(group.id);
            expect(updatedGroup.members[0].toString()).toBe(creator._id.toString());
            expect(updatedGroup.members[1].toString()).toBe(invitee1._id.toString());
            expect(updatedGroup.members[2].toString()).toBe(invitee2._id.toString());
        });
    });

    describe("Response Format", () => {
        
        it("should return correct response structure", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(47);
            const { user: invitee } = await createUserAndGetToken(48);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("group");
            expect(response.body.group).toHaveProperty("id");
            expect(response.body.group).toHaveProperty("name");
            expect(response.body.group).toHaveProperty("members");
        });

        it("should return JSON content type", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(49);
            const { user: invitee } = await createUserAndGetToken(50);
            const group = await createTestGroup(creatorToken);

            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should return members as array of ObjectIds", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(51);
            const { user: invitee } = await createUserAndGetToken(52);
            const group = await createTestGroup(creatorToken);

            const response = await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            expect(Array.isArray(response.body.group.members)).toBe(true);
            expect(response.body.group.members.length).toBeGreaterThan(0);
        });
    });

    describe("Database Integrity", () => {
        
        it("should persist invitation in database", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(53);
            const { user: invitee } = await createUserAndGetToken(54);
            const group = await createTestGroup(creatorToken);

            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            const dbGroup = await Group.findById(group.id);
            expect(dbGroup.members.map(m => m.toString())).toContain(invitee._id.toString());
        });

        it("should update updatedAt timestamp", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(55);
            const { user: invitee } = await createUserAndGetToken(56);
            const group = await createTestGroup(creatorToken);

            const groupBefore = await Group.findById(group.id);
            const updatedAtBefore = groupBefore.updatedAt;

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 100));

            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            const groupAfter = await Group.findById(group.id);
            expect(groupAfter.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore.getTime());
        });

        it("should not modify createdAt timestamp", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(57);
            const { user: invitee } = await createUserAndGetToken(58);
            const group = await createTestGroup(creatorToken);

            const groupBefore = await Group.findById(group.id);
            const createdAtBefore = groupBefore.createdAt;

            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            const groupAfter = await Group.findById(group.id);
            expect(groupAfter.createdAt.getTime()).toBe(createdAtBefore.getTime());
        });

        it("should not modify group name or description", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(59);
            const { user: invitee } = await createUserAndGetToken(60);
            const group = await createTestGroup(creatorToken, "Immutable Group");

            const groupBefore = await Group.findById(group.id);

            await request(app)
                .post(`/api/group/invite-user-to-group/${group.id}`)
                .set("Authorization", `Bearer ${creatorToken}`)
                .send({ userId: invitee._id.toString() })
                .expect(200);

            const groupAfter = await Group.findById(group.id);
            expect(groupAfter.name).toBe(groupBefore.name);
            expect(groupAfter.description).toBe(groupBefore.description);
        });
    });
});
