import { Router } from "express";

import {
    getLikedVideos,
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike
} from "../controllers/like.controllers.js"

import { verifyJWT } from "../middlewares/auth.middleware.js";
import router from "./user.routes";


const router= Router()
router.use(verifyJWT)

router.route("/toggle/v/:videoId").post(toggleVideoLike)
router.route("/toggle/c/:commentId").post(toggleCommentLike)
router.route("/toggle/t/:tweetId").post(toggleTweetLike)
router.route("/videos").post(getLikedVideos)

export default router

