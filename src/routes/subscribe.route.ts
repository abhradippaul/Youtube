import express from "express";
import { verifyUserToken } from "../middlewares/user.middleware";
import {
  addToSubscriberList,
  removeFromSubscriberList,
} from "../controllers/subscribe.controller";

const router = express.Router();

router.route("/:userId").post(verifyUserToken, addToSubscriberList);

router.route("/:userId").delete(verifyUserToken, removeFromSubscriberList);

export { router };
