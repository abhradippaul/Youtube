import { loginUser, logoutUser, signupUser } from "controllers/auth.controller";
import express from "express";
import { upload } from "utils/multer";

const router = express.Router();

router.route("/signup").post(upload.single("avatar_url"), signupUser);
router.route("/login").post(loginUser);
router.route("/logout").post(logoutUser);

export { router };
