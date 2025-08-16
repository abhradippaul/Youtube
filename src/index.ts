import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { urlencoded } from "express";
import cookieParser from "cookie-parser";
import { router } from "routes/user.route";
import { pool } from "db";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/", router);

pool
  .connect()
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log("Server connected successfully on port no", PORT);
    });
  })
  .catch((err) => {
    console.log("Error while connecting server ", err);
  });
