import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/user.model.js";

dotenv.config();

const insertSampleUsers = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URL);
        console.log("✅ Connected to MongoDB");

        // Sample users to insert
        const sampleUsers = [
            {
                name: "John Doe",
                email: "john@example.com",
                password: "password123"
            },
            {
                name: "Jane Smith",
                email: "jane@example.com",
                password: "password123"
            },
            {
                name: "Bob Wilson",
                email: "bob@example.com",
                password: "password123"
            }
        ];

        console.log(`\n📝 Inserting ${sampleUsers.length} sample users...\n`);

        for (const userData of sampleUsers) {
            // Check if user already exists
            const existingUser = await User.findOne({ email: userData.email });
            
            if (existingUser) {
                console.log(`⏭️  Skipped: ${userData.email} (already exists)`);
                continue;
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Create new user
            const newUser = await User.create({
                name: userData.name,
                email: userData.email,
                password: hashedPassword
            });

            console.log(`✅ Created: ${newUser.name} (${newUser.email})`);
        }

        console.log("\n✅ Sample users insertion completed!");

        // Close connection
        await mongoose.connection.close();
        console.log("✅ Database connection closed");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error inserting users:", error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

// Run the script
insertSampleUsers();
