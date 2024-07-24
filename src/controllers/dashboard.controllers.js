import mongoose from "mongoose";
import { Video } from "../models/video.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Like } from "../models/like.models.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {asyncHandler} from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const userId = req.user?._id;

    const totalSubscribers = await Subscription.aggregate([
        {
            $match:{
                $expr:{
                    $eq:[
                        "$channel",
                        mongoose.Types.ObjectId(userId)
                    ]
                }
            }
        },
        {
            $group:{
                _id:null,
                subscribersCount:{
                    $sum:1
                }
            }
        }
    ])

    const video= await Video.aggregate([
        {
            $match:{
                $expr:{
                    $eq:[
                        "$owner",
                        mongoose.Types.ObjectId(userId)
                    ]
                }
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"video",
                as:"likes"
            }
        },
        {
            $project:{
                totalLikes:{
                    $size:"$likes"
                },
                totalViews:"$views",
                totalVideos:1
            }
        },
        {
            $group:{
                _id:null,
                totalLikes:{
                    $sum:"$totalLikes"
                },
                totalViews:{
                    $sum:"$totalViews"
                },
                totalVideos:{
                    $sum:1
                }
            }
        }
    ])

    const channelStats={
        totalSubscribers:totalSubscribers[0]?.subscribersCount || 0,
        totalLikes:video[0]?.totalLikes || 0,
        totalViews:video[0]?.totalViews || 0,
        totalVideos:video[0]?.totalVideos || 0
    }

    return res.status
    (200).json(
        new ApiResponse(
            200,
            channelStats,
            "Channel Stats Fetched Successfully"
        )
    )

})


const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel

    const userId=req.user?._id;

    const videos=await Video.aggregate([
        {
            $match:{
                $expr:{
                    $eq:[
                        "$owner",mongoose.Types.ObjectId(userId)
                    ]
                }
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"videos",
                as:"likes"
            }
        },
        {
            $addFields:{
                createdAt:{
                    $dateToParts:{
                        date:"$createdAt"
                    },
                },
                likesCount:{
                    $size:"$likes"
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
                _id:1,
                "videoFile.url":1,
                "thumnail.url":1,
                title,
                description,
                createdAt:{
                    year:1,
                    month:1,
                    day:1,
                },
                isPublished:1,
                likesCount:1
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            videos,
            "Channel Videos fetched Successfully"
        )
    )

})

export{
    getChannelStats,
    getChannelVideos
}