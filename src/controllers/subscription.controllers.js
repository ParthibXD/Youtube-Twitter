import mongoose, { isValidObjectId } from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";


const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    // TODO: toggle subscription

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Channel id in invalid")
    }

    const isSubscribed= await Subscription.findOne({
        subscriber:req.user?._id,
        channel:channelId,
    })

    if(isSubscribed){
        await Subscription.findByIdAndDelete(isSubscribed?._id)

        return res.status(200)
        .json(new ApiResponse(
            200, 
            {subscribed:false},
            "Unsuscribed Successfully"
        ))
    }

    await Subscription.create({
        subscriber:req.user?._id,
        channel:channelId,
    })

    return res.status(200).json(new ApiResponse(
        200,
        {subscribed:true},
        "Successfully Subscribed!!"
    ))

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    let { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channelId");
    }
    
    const subscribers=await Subscription.aggregate([
        {
            $match:{
                $expr:{
                    $eq:["$channel",mongoose.Types.ObjectId(channelId)]
                }
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"subscriber",
                foreignField:"_id",
                as:"subscriber",
                pipeline:[
                    {
                        $lookup:{
                            from:"subscriptions",
                            localField:"_id",
                            foreignField:"channel",
                            as:"subscribedToSubscriber"
                        }
                    },
                    {
                        $addFields:{
                            "c":1,
                            $cond:{
                                $if:{
                                    $in:[
                                        channelId,
                                        "$subscribedToSubscriber.subscriber"
                                    ]
                                },
                                then:true,
                                else:false,
                            }
                        },
                        subscriberCount:{
                            $size:"$subscribedToSubscriber"
                        }
                    }
                ]

            }
        },
        {
            $unwind:"$subscriber"
        },
        {
            $project:{
                _id:0,
                subscriber:{
                    _id:1,
                    username:1,
                    fullName:1,
                    "avatar.url":1,
                    subscribedToSubscriber:1,
                    subscriberCount:1,
                }
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(
        200,subscribers,"Subscribers fetched Successfully"
    ))
})



// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    const subscribedChannels= await Subscription.aggregate([
        {
            $match:{
                $expr:{
                    $eq:["$subscriber",mongoose.Types.ObjectId(subscriberId)]
                }
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"channel",
                foreignField:"_id",
                as:"subscribedChannel",
                pipeline:[
                    {
                        $lookup:{
                            from:"videos",
                            localField:"_id",
                            foreignField:"owner",
                            as:"videos"
                        }
                    },
                    {
                        $addFields:{
                            latestVideos:{
                                $last:"$videos"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind:"$subscribedChannel"
        },
        {
            $project:{
                _id:0,
                subscribedChannel:{
                    _id:1,
                    username:1,
                    fullName:1,
                    "avatar.url":1,
                    latestVideo:{
                        _id:1,
                        "videoFile.url":1,
                        "thumbanail.url":1,
                        owner:1,
                        title:1,
                        description:1,
                        duration:1,
                        createdAt:1,
                        views:1,
                    }
                }
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200, 
            subscribedChannels,
            "subscribed Channels successfully fetched!"
        )
    )

})


export {toggleSubscription, getSubscribedChannels, getUserChannelSubscribers}