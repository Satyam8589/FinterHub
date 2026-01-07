import Group from "../models/group.model.js";


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
            user: userId 
        });
        
        return res.status(201).json({
            message: "Group created successfully",
            group: {
                id: group._id,
                name: group.name,
                description: group.description,
                createdBy: userId
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};