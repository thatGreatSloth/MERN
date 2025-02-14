import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";

import connectDB from "./config/mongoDB.js";
import authRouter from './routes/authRoutes.js';
import userRouter from "./routes/userRoutes.js";

const app = express();
const port = process.env.PORT || 5000;

connectDB();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use(express.json()); //request passed using json
app.use(cookieParser()); //used to parse cookies
app.use(cors({ credentials: true })); //send cookies in the response

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
