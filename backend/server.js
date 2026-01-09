import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRouter from "./routes/auth.route.js";
import groupRouter from "./routes/group.route.js";
import expenseRouter from "./routes/expense.route.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

app.use("/api/auth", authRouter);
app.use("/api/group", groupRouter);
app.use("/api/expense", expenseRouter);

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
