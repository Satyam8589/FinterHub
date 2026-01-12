import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { deleteGroup } from '../controllers/group.controller.js';
import { auth } from '../middleware/auth.js';
import User from '../models/user.model.js';
import Group from '../models/group.model.js';
import { connect, closeDatabase, clearDatabase } from './setup/db.js';


// Set test environment for faster bcrypt
process.env.NODE_ENV = 'test';

dotenv.config();

// Create Express app for testing
const app = express();
app.use(express.json());
app.delete("/api/groups/:groupId", auth, deleteGroup);

// Connect to in-memory database
beforeAll(async () => {
    await connect();
});

// Clean up database after all tests
afterAll(async () => {
    await closeDatabase();
});

// Note: We don't clearDatabase afterEach here because the inner describe 
// block depends on users created in a separate beforeAll.
// Alternatively, we could move user creation into a beforeAll that runs after connect.


describe('DELETE /api/groups/:groupId - Delete Group', () => {
    let creatorToken, memberToken, nonMemberToken;
    let creatorUser, memberUser, nonMemberUser;

    // Helper function to create a test user and get token
    const createUserAndGetToken = async (name, email) => {
        const user = await User.create({
            name,
            email,
            password: 'Password123!',
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return { user, token };
    };

    beforeAll(async () => {
        // Create test users
        const creator = await createUserAndGetToken('Group Creator', 'creator@test.com');
        const member = await createUserAndGetToken('Group Member', 'member@test.com');
        const nonMember = await createUserAndGetToken('Non Member', 'nonmember@test.com');

        creatorUser = creator.user;
        memberUser = member.user;
        nonMemberUser = nonMember.user;

        creatorToken = creator.token;
        memberToken = member.token;
        nonMemberToken = nonMember.token;
    });

    describe('Success Cases', () => {
        it('should successfully delete a group when creator is the only member', async () => {
            const group = await Group.create({
                name: 'delete test group 1',
                description: 'A test group for deletion',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Group deleted successfully');

            // Verify group is deleted
            const deletedGroup = await Group.findById(group._id);
            expect(deletedGroup).toBeNull();
        });

        it('should return proper success message structure', async () => {
            const group = await Group.create({
                name: 'delete test group 2',
                description: 'Temporary group',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(typeof response.body.message).toBe('string');
        });
    });

    describe('Authentication & Authorization', () => {
        it('should return 401 if user is not authenticated', async () => {
            const group = await Group.create({
                name: 'delete test group auth 1',
                description: 'Test group',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .expect(401);

            expect(response.body).toHaveProperty('message');
            
            // Cleanup
            await Group.findByIdAndDelete(group._id);
        });

        it('should return 403 if user is not the group creator', async () => {
            const group = await Group.create({
                name: 'delete test group auth 2',
                description: 'Test group',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id, memberUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${memberToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('message', 'Only group creator can delete groups');
            
            // Cleanup
            await Group.findByIdAndDelete(group._id);
        });

        it('should return 403 if non-member tries to delete group', async () => {
            const group = await Group.create({
                name: 'delete test group auth 3',
                description: 'Test group',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${nonMemberToken}`)
                .expect(403);

            expect(response.body).toHaveProperty('message', 'Only group creator can delete groups');
            
            // Cleanup
            await Group.findByIdAndDelete(group._id);
        });

        it('should verify token is valid before processing', async () => {
            const group = await Group.create({
                name: 'delete test group auth 4',
                description: 'Test group',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            const invalidToken = 'invalid.token.here';
            
            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${invalidToken}`)
                .expect(401);

            expect(response.body).toHaveProperty('message');
            
            // Cleanup
            await Group.findByIdAndDelete(group._id);
        });
    });

    describe('Validation Errors', () => {
        it('should return 404 if group does not exist', async () => {
            const fakeGroupId = new mongoose.Types.ObjectId();
            
            const response = await request(app)
                .delete(`/api/groups/${fakeGroupId}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('message', 'Group not found');
        });

        it('should return 500 if groupId is invalid format', async () => {
            const response = await request(app)
                .delete('/api/groups/invalid-id')
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(500);

            expect(response.body).toHaveProperty('message');
        });

        it('should return 400 if group has multiple members', async () => {
            const group = await Group.create({
                name: 'delete test group validation 1',
                description: 'Group with multiple members',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id, memberUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('message', 'Group cannot be deleted as it has members');

            // Verify group still exists
            const stillExists = await Group.findById(group._id);
            expect(stillExists).not.toBeNull();
            
            // Cleanup
            await Group.findByIdAndDelete(group._id);
        });

        it('should not delete group if it has 3+ members', async () => {
            const group = await Group.create({
                name: 'delete test group validation 2',
                description: 'Group with three members',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id, memberUser._id, nonMemberUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(400);

            expect(response.body.message).toBe('Group cannot be deleted as it has members');

            // Cleanup
            await Group.findByIdAndDelete(group._id);
        });
    });

    describe('Edge Cases', () => {
        it('should handle deletion of group with exactly 1 member (creator)', async () => {
            const group = await Group.create({
                name: 'delete test group edge 1',
                description: 'Group with only creator',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.message).toBe('Group deleted successfully');

            const deleted = await Group.findById(group._id);
            expect(deleted).toBeNull();
        });

        it('should handle concurrent deletion attempts gracefully', async () => {
            const group = await Group.create({
                name: 'delete test group edge 2',
                description: 'Group for concurrent test',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            // First deletion should succeed
            await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            // Second deletion should fail (404)
            const response2 = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(404);

            expect(response2.body.message).toBe('Group not found');
        });

        it('should not affect other groups when deleting one group', async () => {
            const group1 = await Group.create({
                name: 'delete test group edge 3a',
                description: 'First group',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            const group2 = await Group.create({
                name: 'delete test group edge 3b',
                description: 'Second group',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            // Delete group1
            await request(app)
                .delete(`/api/groups/${group1._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            // Verify group2 still exists
            const group2Exists = await Group.findById(group2._id);
            expect(group2Exists).not.toBeNull();

            // Cleanup
            await Group.findByIdAndDelete(group2._id);
        });
    });

    describe('Database Integrity', () => {
        it('should completely remove group from database', async () => {
            const group = await Group.create({
                name: 'delete test group integrity 1',
                description: 'Group to test deletion',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            // Verify complete deletion
            const deletedGroup = await Group.findById(group._id);
            expect(deletedGroup).toBeNull();

            // Verify cannot be found with any query
            const searchResult = await Group.find({ name: 'delete test group integrity 1' });
            expect(searchResult).toHaveLength(0);
        });
    });

    describe('Response Format', () => {
        it('should return JSON response', async () => {
            const group = await Group.create({
                name: 'delete test group format 1',
                description: 'Group for JSON test',
                user: creatorUser._id,
                createdBy: creatorUser._id,
                members: [creatorUser._id],
            });

            const response = await request(app)
                .delete(`/api/groups/${group._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('message');
        });
    });
});
