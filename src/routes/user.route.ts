import {
  deleteUser,
  getUser,
  totalViewCount,
  updateAvatar,
  updateCover,
  updatePassword,
  updateUser,
} from "../controllers/user.controller";
import express from "express";
import { verifyUserToken } from "../middlewares/user.middleware";
import { uploadImage } from "../utils/multer";

const router = express.Router();

router
  .route("/")
  .get(verifyUserToken, getUser)
  .delete(verifyUserToken, deleteUser);

router.route("/user-info").patch(verifyUserToken, updateUser);
router.route("/user-password").patch(verifyUserToken, updatePassword);
router
  .route("/user-avatar")
  .patch(uploadImage.single("avatar_url"), verifyUserToken, updateAvatar);
router
  .route("/user-cover")
  .patch(uploadImage.single("cover_url"), verifyUserToken, updateCover);

router.route("/:userId/total-view").get(verifyUserToken, totalViewCount);

export { router };
