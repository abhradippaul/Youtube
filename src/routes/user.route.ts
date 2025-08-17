import { deleteUser, getUser } from "controllers/user.controller";
import express from "express";
import { verifyUserToken } from "middlewares/user.middleware";

const router = express.Router();

router.route("/").get(verifyUserToken, getUser);
router.route("/:id").delete(deleteUser);

export { router };
