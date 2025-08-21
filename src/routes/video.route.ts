import {
  getVideo,
  getVideos,
  updateThumbnail,
  updateVideoInfo,
  uploadVideo,
} from "../controllers/video.controller";
import express from "express";
import { verifyUserToken } from "../middlewares/user.middleware";
import { upload, videoUpload } from "../utils/multer";

const router = express.Router();

router
  .route("/")
  .get(getVideos)
  .post(
    videoUpload.fields([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ]),
    verifyUserToken,
    uploadVideo
  );

router.route("/:id").get(getVideo);
router.route("/:id/videoinfo").patch(verifyUserToken, updateVideoInfo);
router
  .route("/:id/thumbnail")
  .patch(upload.single("thumbnail"), verifyUserToken, updateThumbnail);

export { router };
