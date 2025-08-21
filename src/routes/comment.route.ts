import express from "express";
import {
  createComment,
  updateComment,
} from "../controllers/comment.controller";
import { verifyUserToken } from "../middlewares/user.middleware";

const router = express.Router();

router
  .route("/:id")
  .post(verifyUserToken, createComment)
  .patch(verifyUserToken, updateComment);

export { router };
