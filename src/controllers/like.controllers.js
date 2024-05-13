import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid Video Id")
    }

    const likedAlready = await Like.findOne({
        video:videoId,
        likedBy:req.user?._id
    })

    if(likedAlready){
        await Like.findByIdAndDelete(likedAlready?._id);

        return res.status(200)
        .json(new ApiResponse(200,{isLiked:false},"Like Status Changed"))
    }

    await Like.create({
        video:videoId,
        likedBy:req.user?._id
    });

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            {
                isLiked:true
            },
            "Like Status Changed"
        )
    )

})

const toggleCommentLike= asyncHandler(async(req,res)=>{
    const {commentId}= req.params;

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Comment id invalid")
    }

    const likedAlready= await Like.findOne({
        comment:commentId,
        likedBy:req.user?._id
    })

    if(likedAlready){
        await Like.findByIdAndDelete(likedAlready?._id)

        return res.status(200)
            .json(
            new ApiResponse(200, {isLiked:false}, "Status Changed")
        )
    }

    await Like.create({
        comment:commentId,
        likedBy:req.user?._id
    })

    return res.status(200)
    .json(
        new ApiResponse(200, {isLiked:true}, "Status Changed")
    )

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;


    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Tweet Id is invalid")
    }

    const likedAlready= await Like.findOne(tweetId)

    if(likedAlready){
        await Like.findByIdAndDelete(likedAlready?._id)

        return res.
        status(200)
        .json(
            new ApiResponse(
                200,
                {
                    isLiked:false
                },
                "Like Status Changed"
            )
        )
    }

    await Like.create({
        tweet:tweetId,
        likedBy:req.user?._id
    })


    return res.status(200)
    .json(new ApiResponse(
            200,
            {
                isLiked:true
            },
            "Status Changed"
        )
    )
})

const getLikedVideos= asyncHandler(async(req,res)=>{
    const likedVideosAggregate= await Like.aggregate([
        {
            $match:{
                $expr:{
                    $eq:[
                        "$likedBy", mongoose.Types.ObjectId(req.user?._id)
                    ]
                }
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"video",
                foreignField:"_id",
                as:"likedVideo",
                pipeLine:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"ownerDetails"
                        }
                    },
                    {
                        //The $unwind operator in MongoDB's aggregation pipeline 
                        // is used to deconstruct an array field from input documents 
                        // into multiple documents. This is particularly useful when 
                        // you have documents with arrays and you want to perform 
                        // operations or aggregations on each element of the array 
                        // separately.
                        $unwind:"$ownerDetails"
                    }
                ]
            }
        },
        {
            $unwind:"likedVideo"
        },
        {
            $sort:{
                createdAt:-1,
            }
        },
        {
            project:{
                _id:0,
                likedVideo:{
                    _id:1,
                    videoFile:1,
                    thumbnail:1,
                    owner:1,
                    title:1,
                    decription:1,
                    views:1,
                    duration:1,
                    createdAt:1,
                    isPublished:1,
                    ownerDetails:1,
                    ownerDetails:{
                        username:1,
                        fullName:1,
                        avatar:1,
                    }

                }
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            likedVideosAggregate,
            "Liked Videos Fetched Successfully"
        )
    )
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}