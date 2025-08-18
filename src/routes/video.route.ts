import { uploadVideo } from "controllers/video.controller";
import express from "express";
import { verifyUserToken } from "middlewares/user.middleware";
import { videoUpload } from "utils/multer";

const router = express.Router();

router
  .route("/")
  .post(videoUpload.single("video"), verifyUserToken, uploadVideo);

export { router };
