import express from "express";
import {
  forgotPassword,
  loginUser,
  logoutUser,
  signupUser,
  validateEmailCode,
} from "../controllers/auth.controller";
import { uploadImage } from "../utils/multer";

const router = express.Router();

router
  .route("/signup")
  .post(
    uploadImage.fields([{ name: "avatar_url" }, { name: "cover_url" }]),
    signupUser
  );
router.route("/login").post(loginUser);
router.route("/logout").post(logoutUser);
router.route("/forgot-password").post(forgotPassword);
router.route("/validate-emailcode").post(validateEmailCode);

export { router };
