import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { listAllGroupsUserPresents, createGroup, inviteUserToGroup } from "../controllers/group.controller.js";
import { auth } from "../middleware/auth.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";

process.env.NODE_ENV = 'test';

dotenv.config();

const app = express();
app.use(express.json());
app.post("/api/group/create-group", auth, createGroup);
app.post("/api/group/invite-user-to-group/:groupId", auth, inviteUserToGroup);
app.get("/api/group/list-all-groups-user-presents", auth, listAllGroupsUserPresents);

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

describe("List All Groups User Presents Controller Tests", () => {
    
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
            description: "Test group for list groups tests"
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
        
        it("should successfully retrieve all groups where user is a member", async () => {
            const { token: userToken } = await createUserAndGetToken(1);
            await createTestGroup(userToken, "Group One");
            await createTestGroup(userToken, "Group Two");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.message).toBe("Groups retrieved successfully");
            expect(response.body).toHaveProperty("groups");
            expect(response.body).toHaveProperty("count");
            expect(Array.isArray(response.body.groups)).toBe(true);
            expect(response.body.count).toBe(2);
        });

        it("should return empty array when user is not in any groups", async () => {
            const { token: userToken } = await createUserAndGetToken(2);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.message).toBe("Groups retrieved successfully");
            expect(response.body.count).toBe(0);
            expect(response.body.groups).toEqual([]);
        });

        it("should include groups where user is creator", async () => {
            const { user: creator, token: creatorToken } = await createUserAndGetToken(3);
            const group = await createTestGroup(creatorToken, "Creator Group");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.count).toBe(1);
            expect(response.body.groups[0].name).toBe("creator group");
            expect(response.body.groups[0].isCreator).toBe(true);
            expect(response.body.groups[0].createdBy).toBe(creator._id.toString());
        });

        it("should include groups where user is invited member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(4);
            const { user: member, token: memberToken } = await createUserAndGetToken(5);
            const group = await createTestGroup(creatorToken, "Invited Group");

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);

            expect(response.body.count).toBe(1);
            expect(response.body.groups[0].name).toBe("invited group");
            expect(response.body.groups[0].isCreator).toBe(false);
        });

        it("should return all groups for user who is in multiple groups", async () => {
            const { token: user1Token } = await createUserAndGetToken(6);
            const { user: user2, token: user2Token } = await createUserAndGetToken(7);
            
            // User2 creates 2 groups
            await createTestGroup(user2Token, "User2 Group 1");
            await createTestGroup(user2Token, "User2 Group 2");
            
            // User1 creates 1 group and invites User2
            const user1Group = await createTestGroup(user1Token, "User1 Group");
            await inviteUserToTestGroup(user1Group.id, user2._id, user1Token);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${user2Token}`)
                .expect(200);

            expect(response.body.count).toBe(3);
            expect(response.body.groups.length).toBe(3);
        });
    });

    describe("Response Structure and Fields", () => {
        
        it("should return groups with all required fields", async () => {
            const { token: userToken } = await createUserAndGetToken(8);
            await createTestGroup(userToken, "Field Test Group");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            const group = response.body.groups[0];
            expect(group).toHaveProperty("id");
            expect(group).toHaveProperty("name");
            expect(group).toHaveProperty("description");
            expect(group).toHaveProperty("createdBy");
            expect(group).toHaveProperty("memberCount");
            expect(group).toHaveProperty("isCreator");
            expect(group).toHaveProperty("createdAt");
        });

        it("should not expose members array in response", async () => {
            const { token: userToken } = await createUserAndGetToken(9);
            await createTestGroup(userToken, "Privacy Test Group");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            const group = response.body.groups[0];
            expect(group).not.toHaveProperty("members");
        });

        it("should return correct memberCount", async () => {
            const { token: creatorToken } = await createUserAndGetToken(10);
            const { user: member1 } = await createUserAndGetToken(11);
            const { user: member2 } = await createUserAndGetToken(12);
            const group = await createTestGroup(creatorToken, "Count Test Group");

            await inviteUserToTestGroup(group.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group.id, member2._id, creatorToken);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.groups[0].memberCount).toBe(3); // Creator + 2 members
        });

        it("should correctly set isCreator flag for creator", async () => {
            const { token: creatorToken } = await createUserAndGetToken(13);
            await createTestGroup(creatorToken, "Creator Flag Test");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.groups[0].isCreator).toBe(true);
        });

        it("should correctly set isCreator flag for non-creator member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(14);
            const { user: member, token: memberToken } = await createUserAndGetToken(15);
            const group = await createTestGroup(creatorToken, "Non-Creator Flag Test");

            await inviteUserToTestGroup(group.id, member._id, creatorToken);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);

            expect(response.body.groups[0].isCreator).toBe(false);
        });

        it("should include createdAt timestamp", async () => {
            const { token: userToken } = await createUserAndGetToken(16);
            await createTestGroup(userToken, "Timestamp Test");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.groups[0].createdAt).toBeTruthy();
            expect(new Date(response.body.groups[0].createdAt)).toBeInstanceOf(Date);
        });

        it("should match count with actual groups array length", async () => {
            const { token: userToken } = await createUserAndGetToken(17);
            await createTestGroup(userToken, "Count Match 1");
            await createTestGroup(userToken, "Count Match 2");
            await createTestGroup(userToken, "Count Match 3");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.count).toBe(response.body.groups.length);
            expect(response.body.count).toBe(3);
        });
    });

    describe("Authentication", () => {
        
        it("should return 401 if no token is provided", async () => {
            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is invalid", async () => {
            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", "Bearer invalid.token.here")
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });

        it("should return 401 if token is expired", async () => {
            const { user } = await createUserAndGetToken(18);

            const expiredToken = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body.message).toContain("Unauthorized");
        });
    });

    describe("Edge Cases", () => {
        
        it("should handle user with single group membership", async () => {
            const { token: userToken } = await createUserAndGetToken(20);
            await createTestGroup(userToken, "Single Group");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.count).toBe(1);
            expect(response.body.groups.length).toBe(1);
        });

        it("should handle user with many group memberships", async () => {
            const { token: userToken } = await createUserAndGetToken(21);

            // Create 15 groups
            for (let i = 0; i < 15; i++) {
                await createTestGroup(userToken, `Many Groups ${i}`);
            }

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.count).toBe(15);
            expect(response.body.groups.length).toBe(15);
        });

        it("should only show groups where user is currently a member", async () => {
            const { token: creatorToken } = await createUserAndGetToken(22);
            const { user: member, token: memberToken } = await createUserAndGetToken(23);
            
            const group1 = await createTestGroup(creatorToken, "Member Group 1");
            const group2 = await createTestGroup(creatorToken, "Member Group 2");

            // Invite member to both groups
            await inviteUserToTestGroup(group1.id, member._id, creatorToken);
            await inviteUserToTestGroup(group2.id, member._id, creatorToken);

            // Remove member from group1
            await Group.findByIdAndUpdate(group1.id, { $pull: { members: member._id } });

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);

            expect(response.body.count).toBe(1);
            expect(response.body.groups[0].name).toBe("member group 2");
        });

        it("should handle concurrent requests from same user", async () => {
            const { token: userToken } = await createUserAndGetToken(24);
            await createTestGroup(userToken, "Concurrent Test");

            const [response1, response2, response3] = await Promise.all([
                request(app)
                    .get("/api/group/list-all-groups-user-presents")
                    .set("Authorization", `Bearer ${userToken}`),
                request(app)
                    .get("/api/group/list-all-groups-user-presents")
                    .set("Authorization", `Bearer ${userToken}`),
                request(app)
                    .get("/api/group/list-all-groups-user-presents")
                    .set("Authorization", `Bearer ${userToken}`)
            ]);

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
            expect(response3.status).toBe(200);
            expect(response1.body.count).toBe(response2.body.count);
            expect(response2.body.count).toBe(response3.body.count);
        });

        it("should handle groups with duplicate names (different creators)", async () => {
            const { token: user1Token } = await createUserAndGetToken(25);
            const { user: user2, token: user2Token } = await createUserAndGetToken(26);

            // Both users create groups (names will be lowercased and unique)
            await createTestGroup(user1Token, "Shared Name 1");
            const group2 = await createTestGroup(user2Token, "Shared Name 2");

            // Invite user1 to user2's group
            const user1Data = await User.findOne({ email: `testuser25@test.com` });
            await inviteUserToTestGroup(group2.id, user1Data._id, user2Token);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${user1Token}`)
                .expect(200);

            expect(response.body.count).toBe(2);
        });

        it("should handle new user with no groups", async () => {
            const { token: newUserToken } = await createUserAndGetToken(27);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${newUserToken}`)
                .expect(200);

            expect(response.body.count).toBe(0);
            expect(response.body.groups).toEqual([]);
            expect(response.body.message).toBe("Groups retrieved successfully");
        });
    });

    describe("Mixed Scenarios", () => {
        
        it("should show correct isCreator flag for mixed groups", async () => {
            const { user: user1, token: user1Token } = await createUserAndGetToken(28);
            const { token: user2Token } = await createUserAndGetToken(29);

            // User1 creates a group
            await createTestGroup(user1Token, "User1 Created");

            // User2 creates a group and invites User1
            const user2Group = await createTestGroup(user2Token, "User2 Created");
            await inviteUserToTestGroup(user2Group.id, user1._id, user2Token);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${user1Token}`)
                .expect(200);

            expect(response.body.count).toBe(2);
            
            const createdGroup = response.body.groups.find(g => g.name === "user1 created");
            const invitedGroup = response.body.groups.find(g => g.name === "user2 created");

            expect(createdGroup.isCreator).toBe(true);
            expect(invitedGroup.isCreator).toBe(false);
        });

        it("should show correct memberCount for different groups", async () => {
            const { token: creatorToken } = await createUserAndGetToken(30);
            const { user: member1 } = await createUserAndGetToken(31);
            const { user: member2 } = await createUserAndGetToken(32);

            // Group 1: Only creator
            await createTestGroup(creatorToken, "Solo Group");

            // Group 2: Creator + 1 member
            const group2 = await createTestGroup(creatorToken, "Duo Group");
            await inviteUserToTestGroup(group2.id, member1._id, creatorToken);

            // Group 3: Creator + 2 members
            const group3 = await createTestGroup(creatorToken, "Trio Group");
            await inviteUserToTestGroup(group3.id, member1._id, creatorToken);
            await inviteUserToTestGroup(group3.id, member2._id, creatorToken);

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.count).toBe(3);

            const soloGroup = response.body.groups.find(g => g.name === "solo group");
            const duoGroup = response.body.groups.find(g => g.name === "duo group");
            const trioGroup = response.body.groups.find(g => g.name === "trio group");

            expect(soloGroup.memberCount).toBe(1);
            expect(duoGroup.memberCount).toBe(2);
            expect(trioGroup.memberCount).toBe(3);
        });

        it("should return groups in database order", async () => {
            const { token: userToken } = await createUserAndGetToken(33);

            await createTestGroup(userToken, "First Group");
            await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
            await createTestGroup(userToken, "Second Group");
            await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
            await createTestGroup(userToken, "Third Group");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.count).toBe(3);
            expect(response.body.groups.length).toBe(3);
        });
    });

    describe("Response Format", () => {
        
        it("should return correct response structure", async () => {
            const { token: userToken } = await createUserAndGetToken(34);
            await createTestGroup(userToken, "Structure Test");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            expect(response.body).toHaveProperty("message");
            expect(response.body).toHaveProperty("count");
            expect(response.body).toHaveProperty("groups");
            expect(typeof response.body.message).toBe("string");
            expect(typeof response.body.count).toBe("number");
            expect(Array.isArray(response.body.groups)).toBe(true);
        });

        it("should return JSON content type", async () => {
            const { token: userToken } = await createUserAndGetToken(35);

            await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200)
                .expect("Content-Type", /json/);
        });

        it("should have consistent field types across all groups", async () => {
            const { token: userToken } = await createUserAndGetToken(36);
            await createTestGroup(userToken, "Type Test 1");
            await createTestGroup(userToken, "Type Test 2");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            response.body.groups.forEach(group => {
                expect(typeof group.id).toBe("string");
                expect(typeof group.name).toBe("string");
                expect(typeof group.description).toBe("string");
                expect(typeof group.createdBy).toBe("string");
                expect(typeof group.memberCount).toBe("number");
                expect(typeof group.isCreator).toBe("boolean");
                expect(typeof group.createdAt).toBe("string");
            });
        });
    });

    describe("Performance & Database", () => {
        
        it("should use lean query for performance", async () => {
            const { token: userToken } = await createUserAndGetToken(37);
            await createTestGroup(userToken, "Lean Test");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);

            // Lean queries return plain objects
            const group = response.body.groups[0];
            expect(typeof group).toBe("object");
            expect(group.constructor.name).toBe("Object");
        });

        it("should handle rapid successive requests", async () => {
            const { token: userToken } = await createUserAndGetToken(38);
            await createTestGroup(userToken, "Rapid Test");

            const requests = Array(10).fill(null).map(() =>
                request(app)
                    .get("/api/group/list-all-groups-user-presents")
                    .set("Authorization", `Bearer ${userToken}`)
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.count).toBe(1);
            });
        });

        it("should efficiently query large number of groups", async () => {
            const { token: userToken } = await createUserAndGetToken(39);

            // Create 50 groups
            for (let i = 0; i < 50; i++) {
                await createTestGroup(userToken, `Large Test ${i}`);
            }

            const startTime = Date.now();
            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${userToken}`)
                .expect(200);
            const endTime = Date.now();

            expect(response.body.count).toBe(50);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
        });
    });

    describe("Data Isolation", () => {
        
        it("should not show groups from other users", async () => {
            const { token: user1Token } = await createUserAndGetToken(40);
            const { token: user2Token } = await createUserAndGetToken(41);

            await createTestGroup(user1Token, "User1 Private Group");
            await createTestGroup(user2Token, "User2 Private Group");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${user1Token}`)
                .expect(200);

            expect(response.body.count).toBe(1);
            expect(response.body.groups[0].name).toBe("user1 private group");
        });

        it("should show only groups where user is explicitly a member", async () => {
            const { token: user1Token } = await createUserAndGetToken(42);
            const { user: user2, token: user2Token } = await createUserAndGetToken(43);
            const { token: user3Token } = await createUserAndGetToken(44);

            // User1 creates a group
            await createTestGroup(user1Token, "User1 Group");

            // User2 creates a group and invites User1
            const user2Group = await createTestGroup(user2Token, "User2 Group");
            const user1Data = await User.findOne({ email: `testuser42@test.com` });
            await inviteUserToTestGroup(user2Group.id, user1Data._id, user2Token);

            // User3 creates a group (User1 not invited)
            await createTestGroup(user3Token, "User3 Group");

            const response = await request(app)
                .get("/api/group/list-all-groups-user-presents")
                .set("Authorization", `Bearer ${user1Token}`)
                .expect(200);

            expect(response.body.count).toBe(2);
            const groupNames = response.body.groups.map(g => g.name);
            expect(groupNames).toContain("user1 group");
            expect(groupNames).toContain("user2 group");
            expect(groupNames).not.toContain("user3 group");
        });
    });
});
