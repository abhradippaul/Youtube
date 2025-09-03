import {
  getVideo,
  getVideoEngagement,
  getVideos,
  updateThumbnail,
  updateVideoInfo,
  uploadThumbnail,
  uploadVideo,
} from "../controllers/video.controller";
import express from "express";
import { verifyUserToken } from "../middlewares/user.middleware";
import { uploadImage, videoUpload } from "../utils/multer";

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
  .post(uploadImage.single("thumbnail"), verifyUserToken, uploadThumbnail)
  .patch(uploadImage.single("thumbnail"), verifyUserToken, updateThumbnail);

router.route("/:videoId/video-engagement").get(verifyUserToken, getVideoEngagement)

export { router };
