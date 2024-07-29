import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { Comment } from "../models/comment.models.js";
import {
    uploadOnCloudinary,
    deleteOnCloudinary
} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js";

const getAllVideos=asyncHandler(async(req,res)=>{
    const {page=1,limit=10,query,sortBy,sortType,userId}=req.query
    console.log(userId);
    const pipeline=[];

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'
    if(query){
        pipeline.push({
            $search:{
                index:"search-videos",
                text:{
                    query:query,
                    path: ["title", "description"] //search only on title, desc
                }
            }
        })
    }

    if(userId){
        if(!isValidObjectId(userId)){
            throw new ApiError(400, "Invalid userId")
        }

        pipeline.push({
            $match:{
                _id:new mongoose.Types.ObjectId(userId)
            }
        })
    }

    pipeline.push({$match:{isPublished:true}});

    if(sortBy && sortType){
        pipeline.push({
            $sort:{
                [sortBy]:sortType === "asc"? 1:-1
            }
        })
    }
    else{
        pipeline.push({$sort:{createdAt:-1}})
    }

    pipeline.push(
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"ownerDetails",
                pipeline:[
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
            $unwind:"$ownerDetails"
        }
    )

    const videoAggregate=await Video.aggregate(pipeline);

    const options={
        page:parseInt(page,10),
        limit:parseInt(limit,10)
    }

    const video=await Video.aggregatePaginate(videoAggregate, options)

    return res.status(200)
    .json(new ApiResponse(
        200,
        video,
        "Videos fetched Successfully"
    )
    )
})

// get video, upload to cloudinary, create video
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if([title,description].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required");
    }

    const videoFilePath=req.files?.videoFile[0].path;
    const thumbnailLocalPath=req.files?.thumbnail[0].path;

    if(!videoFilePath){
        throw new ApiError(400, "Video File Path is required")
    }

    if(!thumbnailLocalPath){
        throw new ApiError(400, "Thumbnail file path is required")
    }

    const videoFile= await uploadOnCloudinary(videoFilePath);
    const thumbnail= await uploadOnCloudinary(thumbnailLocalPath)

    if(!videoFile){
        throw new ApiError(400, "Video file not found")
    }

    if(!thumbnail){
        throw new ApiError(400, "Thumbnail not found")
    }

    const video = await Video.create({
        title,
        description,
        duration:videoFile.duration,
        videoFile:{
            url:videoFile.url,
            public_id:videoFile.public_id,
        },
        thumbnail:{
            url:thumbnail.url,
            public_id:thumbnail.public_id,
        },
        owner:req.user?._id,
        isPublished:false
    })

    const videoUploaded = await Video.findById(video._id)

    if(!videoUploaded){
        throw new ApiError(500, "Video upload failed! Try again")
    }

    return res.status(200).json(new ApiResponse
        (200,
        video,
        "Video uploaded successfully")
    )
    
})

// get video by id
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    // let userId = req.body;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Video id id Invalid")
    }

    if(!isValidObjectId(req.user?._id)){
        throw new ApiResponse(400, "User id Invalid")
    }

    const objectId=new mongoose.Types.ObjectId(videoId)

    const video= await Video.aggregate([

        {
            $match:{
                _id:objectId
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
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner",
                pipeline:[
                    {
                        $lookup:{
                            from:"subscriptions",
                            localField:"_id",
                            foreignField:"channel",
                            as:"subscribers"
                        }
                    },
                    {
                        $addFields:{
                            subscribersCount:{
                                $size:"$subscribers"
                            },
                            isSubscribed:{
                                $cond:{
                                    if:{
                                        $in:[
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then:true,
                                    else:false,
                                }
                            }
                        }
                    },
                    {
                        $project:{
                            username:1,
                            "avatar.url":1,
                            subscribersCount:1,
                            isSubscribed:1,
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                likesCount:{
                    $size:"$likes"
                },
                owner:{
                    $first:"$owner",
                },
                isLiked:{
                    $cond:{
                        if:{$in:[req.user?._id,"$likes.likedBy"]},
                        then:true,
                        else:false,
                    }
                }
            }
        },
        {
            $project:{
                "videoFile.url":1,
                title:1,
                description:1,
                views:1,
                createdAt:1,
                duration:1,
                comments:1,
                owner:1,
                likesCount:1,
                isLiked:1
            }
        }
    ])

    if(!video){
        throw new ApiError(400, "Failed to fetch Video")
    }

    await Video.findByIdAndUpdate(videoId,{
        $inc:{
            views:1,
        }
    })

    await User.findByIdAndUpdate(req.user?._id,{
        $addToSet:{
            watchHistory:videoId
        }
    })

    return res.status(200)
    .json(new ApiResponse(
        200,
        video[0],
        "Video details successfully fetched"
    ))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const { videoId } = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid VideoId")
    }

    if(!(title && description)){
        throw new ApiError(400,"Both fields required")
    }

    const video =await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    if(video?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(
            400, 
            "Invalid Authentication"
        )
    }

    const thumbnailOld= await video.thumbnail.public_id;

    const thumbnailLocalPath= await req.file?.path

    if(!thumbnailLocalPath){
        throw new ApiError(400, "Thumbanail required")
    }
    const thumbnail= await uploadOnCloudinary(thumbnailLocalPath)

    if(!thumbnail){
        throw new ApiError(400, "Thumbnail not found")
    }

    const updatedVideo= await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                title,
                description,
                thumbnail:{
                    public_id:thumbnail.public_id,
                    url:thumbnail.url
                }
            }
        },
        {
            new:true
        }
    )

    if(!updatedVideo){
        throw new ApiError(500, "Failed to update")
    }

    if(updatedVideo){
        await deleteOnCloudinary(thumbnailOld)
    }

    return res.status(200)
    .json(new ApiResponse(
        200, 
        updateVideo,
        "Video Successfully updated"
    ))
})

// delete video
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid VideoId")
    }

    const video=await Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "Video not found")
    }

    if(video?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(
            400, 
            "Invalid Authentication"
        )
    }

    const videoDel= await Video.findByIdAndDelete(video?._id)

    if(!videoDel){
        throw new ApiError("Failed to Delete Video")
    }

    await deleteOnCloudinary(video.thumbnail.public_id)
    await deleteOnCloudinary(video.videoFile.public_id, "Video")

    await Like.deleteMany({
        video:videoId
    })

    await Comment.deleteMany({
        video:videoId
    })

    return res.status(200).json(new ApiResponse(
        200,
        {},
        "Video Deleted Successfully"
    ))
})

// toggle publish status of a video
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid Video Id")
    }

    const video=await Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "Video not found")
    }

    if(video?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(400, "Invalid Authentication")
    }

    const toggleVideoPublish= await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                isPublished:!video?.isPublished
            }
        },
        {new:true}
    )

    if(!toggleVideoPublish){
        throw new ApiError(500, "Failed to toggle status")
    }

    return res
    .status(200).json(new ApiResponse(200,
        {isPublished:toggleVideoPublish.isPublished},
        "Video publish toggled successfully")
    )
})

export{
    publishAVideo,
    updateVideo,
    deleteVideo,getAllVideos,getVideoById,togglePublishStatus
}