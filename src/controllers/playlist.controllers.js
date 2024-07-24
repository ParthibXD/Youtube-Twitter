import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose, { isValidObjectId } from "mongoose";

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if(!name||description){
        throw new ApiError(400, "Name and Description both and required")
    }


    const playlist= await Playlist.create({
        name,
        description,
        owner:req.user?._id,
    })

    if(!playlist){
        throw new ApiError(500, "Failed to create Playlist")
    }

    return res.status(200)
    .json(new ApiResponse(
        200, 
        playlist,
        "Playlist created Successfully"
    ))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const { playlistId } = req.params;

    if(!name || !description){
        throw new ApiError(400, "Name and Description both are required")
    }

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid Id")
    }

    const playlist= await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(400, "playlist not found")
    }

    if(playlist.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "Invalid Authentication")
    }

    const updatedPlaylist= await Playlist.findByIdAndUpdate(
        playlist?._id,
        {
            $set:{
                name,
                description,
            },
        },
        {
            new : true
        }
    )

    return res.status(200).json(
        new ApiResponse(
            200,
            updatedPlaylist,
            "Playlist updated Successfully"
        )
    )

})


const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid Playlist Id")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(400, "Playlist not found")
    }

    if(playlist.owner.toString() !== req.body?._id.toString()){
        throw new ApiError(400, "Invalid Authentication")
    }

    await Playlist.findByIdAndDelete(playlist?._id)

    return res.status(200).json(new ApiResponse(
        200,
        {playlistId},
        "Playlist successfully deleted"
    ))
})


const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid playlist id or video id")
    }

    const playlist= await Playlist.findById(playlistId)
    const video= await Video.findById(videoId)

    if(!playlist){
        throw new ApiError(400, "Playlist not found")
    }

    if(!video){
        throw new ApiError(400, "Video not found")
    }

    if((
        playlist.owner?.toString() && video.owner?.toString()) !==
        req.user?._id.toString()){
            throw new ApiError(400, "INvalid Authentication")
        }

    const updatedPlaylist= await Playlist.findByIdAndUpdate(
        playlist?._id,
        {
            $addtoSet:{
                videos:videoId
            }
        },
        {
            new : true
        }
    )


    if(!updatedPlaylist){
        throw new ApiError(500, "Failed to add Video in Playlist!! Try again")
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            updatePlaylist,
            "Video Added to Playlist successfully"
        )
    )
})


const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid playlist id or video id")
    }

    const playlist= await Playlist.findById(playlistId)
    const video= await Video.findById(videoId)

    if(!playlist){
        throw new ApiError(400, "Playlist not found")
    }

    if(!video){
        throw new ApiError(400, "Video not found")
    }
    if((
        playlist.owner?.toString() && video.owner?.toString()) !==
        req.user?._id.toString()){
            throw new ApiError(400, "INvalid Authentication")
        }

    const updatedPlaylist= await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull:{
                videos:videoId,
            }
        },
        {
            new : true,
        }
    )

    return res.status(200)
    .json(new ApiResponse(
        200, 
        updatedPlaylist,
        "Video Removed from Playlist successfully"
    ))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");

    }

    const playlist= await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(400, "Playlist not found")
    }

    const playlistVideos = await Playlist.aggregate([
        {
            $match:{
                $expr:{
                    $eq:[
                        "$_id",
                        mongoose.Types.ObjectId(playlistId)
                    ]
                }
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"videos",
                foreignField:"_id",
                as:"videos"
            }
        },
        {
            $match:{
                "videos.isPublished":true
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner"
            }
        },
        {
            $addFields:{
                totalVideos:{
                    $size:"$videos"
                },
                totalViews:{
                    $size:"$videos.views"
                },
                owner:{
                    $first:"$owner"
                }
            }
        },
        {
            $project:{
                name:1,
                description:1,
                createdAt:1,
                updatedAt:1,
                totalVideos:1,
                totalViews:1,
                videos:{
                    _id:1,
                    "videoFile.url":1,
                    "thumbnail.url":1,
                    title:1,
                    description:1,
                    duration:1,
                    createdAt:1,
                    views:1,
                },
                owner:{
                    username:1,
                    fullName:1,
                    "avatar.url":1,
                }
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(
        200, playlistVideos[0], "Playlist Fetched successfully"
    ))
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid userId");
    }

    const playlists= await Playlist.aggragate([
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
                from:"videos",
                localField:"videos",
                foreignField:"_id",
                as:"videos"
            }
        },
        {
            $addFields:{
                totalVideos:{
                    $size:"$videos"
                },
                totalViews:{
                    $size:"$videos.views"
                }
            }
        },
        {
            $project:{
                _id:1,
                name:1,
                description:1,
                totalVideos:1,
                totalViews:1,
                updatedAt:1,
            }
        }
    ])

    return res.status(200).json(new ApiResponse(
        200, 
        playlists,
        "User Playlist successfully fetched"
    ))

})

export{
    createPlaylist,updatePlaylist,deletePlaylist,addVideoToPlaylist,
    getPlaylistById,getUserPlaylists,removeVideoFromPlaylist
}