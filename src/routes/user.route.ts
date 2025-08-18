import {
  deleteUser,
  getUser,
  updateAvatar,
  updateCover,
  updatePassword,
  updateUser,
} from "controllers/user.controller";
import express from "express";
import { verifyUserToken } from "middlewares/user.middleware";
import { upload } from "utils/multer";

const router = express.Router();

router
  .route("/")
  .get(verifyUserToken, getUser)
  .delete(verifyUserToken, deleteUser);

router.route("/user-info").patch(verifyUserToken, updateUser);
router.route("/user-password").patch(verifyUserToken, updatePassword);
router
  .route("/user-avatar")
  .patch(upload.single("avatar_url"), verifyUserToken, updateAvatar);
router
  .route("/user-cover")
  .patch(upload.single("cover_url"), verifyUserToken, updateCover);

export { router };
