import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { Tweet } from "../models/tweet.models.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.models.js";

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    if(!content){
        throw new ApiError(400, "Content not found")
    }

    const tweet = await Tweet.create({
        content,
        owner:req.user?._id,
    })

    if(!tweet){
        throw new ApiError(500, "Tweet failed to create!! Try again")
    }

    return res.status(200)
    .json(new ApiResponse(
        200,
        tweet,
        "Tweet created Successfully"
    ))

})

const updateTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const { tweetId } = req.params;

    if(!content){
        throw new ApiError(400, "content required")
    }

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"TweetId is invalid")
    }

    const tweet =await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(400,"Tweet not found")
    }

    if(tweet?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(400, "Invalid Authentication")
    }

    const newTweet= await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set:{
                content,
            }
        },
        {new:true}
    );

    if(!newTweet){
        throw new ApiError(500, "Failed to Edit comment!! try Again")
    }

    return res.status(200).json(new ApiResponse(200,newTweet,"Tweet updated successfully"))

})



const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid id")
    }

    const tweet=await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(400, "Tweet not found")
    }

    if(tweet?.owner.toString()!==req.body?._id.toString()){
        throw new ApiError(400, "Invalid Authentication")
    }

    await Tweet.findByIdAndDelete(tweetId)

    return res.status(200)
    .json(new ApiResponse(200,{tweetId}, "tweet deleted successfully"))
})


const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "User id invalid")
    }

    const tweets= await Tweet.aggregate([
        {
            $match:{
                $expr:{
                    $eq:["$owner",mongoose.Types.ObjectId(userId)]
                }
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"ownerDetails",
                pipeLine:[
                    {
                        $project:{
                            username:1,
                            "avatar.url":1,
                        }
                    }
                ]
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"tweet",
                as:"likesDetails",
                pipeLine:[
                    {
                        $project:{
                            likedBy:1,
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                likesCount:{
                    $size:"$likesDetails",
                },
                ownerDetails:{
                    $first:"$ownerDetails"
                },
                isLiked:{
                    $cond:{
                        if:{$in:[req.user?._id,"$likesDetails.likedBy"]},
                        then:true,
                        else:false,
                    }
                }
            }
        },
        {
            $sort:{
                createdAt:-1
            }
        },
        {
            $project:{
                content:1,
                ownerDetails:1,
                likesCount:1,
                createdAt:1,
                isLiked:1,
            }
        }
    ])

    return res.status(200).json(200,tweets,"Tweet fetched Succesfully")
})

export { createTweet, updateTweet, deleteTweet, getUserTweets}