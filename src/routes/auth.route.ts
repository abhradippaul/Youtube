import express from "express";
import {
  loginUser,
  logoutUser,
  signupUser,
} from "../controllers/auth.controller";
import { upload } from "../utils/multer";

const router = express.Router();

router
  .route("/signup")
  .post(
    upload.fields([{ name: "avatar_url" }, { name: "cover_url" }]),
    signupUser
  );
router.route("/login").post(loginUser);
router.route("/logout").post(logoutUser);

export { router };
