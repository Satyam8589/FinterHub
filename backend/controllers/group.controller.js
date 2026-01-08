import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

export const createGroup = async (req, res) => {
    try {

        const { name, description } = req.body;
        const userId = req.user._id;
        
        if (!name || !description) {
            return res.status(400).json({ message: "All fields are required" });
        }
        
        if (name.length < 3) {
            return res.status(400).json({ message: "Name must be at least 3 characters" });
        }
        
        if (description.length < 10) {
            return res.status(400).json({ message: "Description must be at least 10 characters" });
        }
        
        const groupExists = await Group.findOne({ name: name.toLowerCase() });
        if (groupExists) {
            return res.status(400).json({ message: "Group already exists" });
        }
        
        const group = await Group.create({ 
            name, 
            description, 
            createdBy: userId,
            members: [userId]
        });
        
        return res.status(201).json({
            message: "Group created successfully",
            group: {
                id: group._id,
                name: group.name,
                description: group.description,
                createdBy: userId,
                members: group.members
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const inviteUserToGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        const requestingUserId = req.user._id;
        
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        
        const [group, user] = await Promise.all([
            Group.findById(groupId).lean(),
            User.findById(userId).select('_id').lean()
        ]);
        
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }
        
        if (group.createdBy.toString() !== requestingUserId.toString()) {
            return res.status(403).json({ message: "Only group creator can invite users" });
        }
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        if (group.members.some(memberId => memberId.toString() === userId)) {
            return res.status(400).json({ message: "User is already a member of this group" });
        }
        
        const updatedGroup = await Group.findByIdAndUpdate(
            groupId,
            { $addToSet: { members: userId } },
            { new: true, select: '_id name members' }
        ).lean();
        
        return res.status(200).json({ 
            message: "User invited to group successfully",
            group: {
                id: updatedGroup._id,
                name: updatedGroup.name,
                members: updatedGroup.members
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const requestingUserId = req.user._id;
        
        const group = await Group.findById(groupId).select('members').lean();
        
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const isMember = group.members.some(memberId => memberId.toString() === requestingUserId.toString());
        if (!isMember) {
            return res.status(403).json({ message: "You are not authorized to view this group" });
        }
        
        const members = await User.find({ _id: { $in: group.members } })
            .select('_id name email')
            .lean();
        
        if (members.length === 0) {
            return res.status(404).json({ message: "No members found in this group" });
        }
        
        return res.status(200).json({ 
            message: "Group members retrieved successfully",
            count: members.length,
            members: members
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};