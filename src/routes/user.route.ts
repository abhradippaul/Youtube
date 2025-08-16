import { createUser, deleteUser } from "controllers/user.controller";
import { pool } from "db";
import express from "express";

const router = express.Router();

router.route("/").get(async (req, res) => {
  const currDb = await pool.query("select current_database();");
  console.log(currDb.rows);
  res.send("Welcome to my website");
});

router.route("/signup").post(createUser);

router.route("/user/:id").delete(deleteUser);

router.route("/login").get(async (req, res) => {
  const result = await pool.query("select * from person;");
  console.log(result.rows);
  res.json({
    msg: "Welcome to login page",
    result: result.rows,
  });
});

export { router };
