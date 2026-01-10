import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";

dotenv.config();

const listAllUsers = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URL);
        console.log("✅ Connected to MongoDB\n");

        // Get all users (excluding password)
        const users = await User.find({}).select('-password');

        if (users.length === 0) {
            console.log("📭 No users found in the database.");
        } else {
            console.log(`📋 Found ${users.length} user(s):\n`);
            console.log("─".repeat(80));
            
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.name}`);
                console.log(`   📧 Email: ${user.email}`);
                console.log(`   🆔 ID: ${user._id}`);
                console.log("─".repeat(80));
            });
        }

        // Close connection
        await mongoose.connection.close();
        console.log("\n✅ Database connection closed");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error listing users:", error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

// Run the script
listAllUsers();
