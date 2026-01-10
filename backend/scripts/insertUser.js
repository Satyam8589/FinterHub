import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/user.model.js";

dotenv.config();

const insertUser = async (name, email, password) => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URL);
        console.log("✅ Connected to MongoDB");

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("❌ User with this email already exists!");
            process.exit(1);
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        });

        console.log("✅ User created successfully!");
        console.log("📋 User Details:");
        console.log(`   ID: ${newUser._id}`);
        console.log(`   Name: ${newUser.name}`);
        console.log(`   Email: ${newUser.email}`);

        // Close connection
        await mongoose.connection.close();
        console.log("✅ Database connection closed");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error inserting user:", error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 3) {
    const [name, email, password] = args;
    insertUser(name, email, password);
} else {
    console.log("📝 Usage: node insertUser.js <name> <email> <password>");
    console.log("📝 Example: node insertUser.js \"John Doe\" john@example.com password123");
    process.exit(1);
}
