import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    preferredCurrency: {
        type: String,
        enum: ["USD", "INR", "EUR", "CAD", "GBP"],
        default: "USD"
    }
});

export default mongoose.model("User", userSchema);