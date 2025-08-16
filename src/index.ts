import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import { client } from "./db/index";
import express, { urlencoded } from "express";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Welcome to my website");
});

app.get("/login", async (req, res) => {
  const result = await client.query("select * from person;");
  console.log(result.rows);
  res.json({
    msg: "Welcome to login page",
    result: result.rows,
  });
});

app.get("/signup", (req, res) => {
  res.json({
    msg: "Welcome to signup page",
  });
});

client
  .connect()
  .then(() => {
    console.log("Server connected successfully with postgres");
    app.listen(process.env.PORT, () => {
      console.log("Server connected successfully on port no", PORT);
    });
  })
  .catch((err) => {
    console.log("Error with server connection ", err);
  });
