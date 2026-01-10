import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        uppercase: true,
        default: "USD"
    },
    amountUSD: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ["pending", "verified", "completed"],
        default: "pending"
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    verifiedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    notes: {
        type: String,
        trim: true
    }
}, { timestamps: true });

settlementSchema.index({ group: 1 });
settlementSchema.index({ from: 1 });
settlementSchema.index({ to: 1 });
settlementSchema.index({ status: 1 });
settlementSchema.index({ createdAt: -1 });

const Settlement = mongoose.model("Settlement", settlementSchema);

export default Settlement;
