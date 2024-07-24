import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { Tweet } from "../models/tweet.models.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.models.js";



const healthcheck = asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(
        new ApiResponse(
            200,
            {message:"Everything is pristine"},
            "Over and out"
        )
    )
})

export {healthcheck}