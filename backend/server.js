import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRouter from "./routes/auth.route.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser()); // CRITICAL: Required for refresh tokens

// CORS - Allow all origins for development (change when you have frontend)
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // '*' allows all origins
    credentials: true // Allow cookies
}));

app.use("/api/auth", authRouter);

const start = async () => {
    try {
        await connectDB();
        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port http://localhost:${process.env.PORT}`);
        });
    } catch (error) {
        console.log(error);
    }
};

start();
