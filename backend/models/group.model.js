import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, { timestamps: true });

// Indexes for performance optimization
groupSchema.index({ createdBy: 1 });  // Fast authorization checks
groupSchema.index({ members: 1 });     // Fast member lookups
// Note: name index already created by unique: true

const Group = mongoose.model("Group", groupSchema);

export default Group;
