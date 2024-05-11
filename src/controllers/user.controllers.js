import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";
import mongoose from "mongoose"


const generateAccessAndRefreshTokens = async(userId)=>
{
    try {
        const user=await User.findById(userId);
        const accessToken=user.generateAccessToken();
        const refreshToken=user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false});

        return {accessToken, refreshToken};

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}


const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check is user already exist : username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response else error

    const {fullName, email, username, password }= req.body
    //console.log("email : ", email);

    if(fullName === ""){
        throw new ApiError(400, "Fullname is required")
    }


    if(
        [fullName, email, username, password].some((field)=>
        field?.trim()==="")
    ){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser=await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or userrname already exists")
    }
   // console.log(req.files);
    /**
     * [Object: null prototype] {
  avatar: [
    {
      fieldname: 'avatar',
      originalname: 'dp6.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: './public/temp',
      filename: 'dp6.jpg',
      path: 'public\\temp\\dp6.jpg',
      size: 90075
    }
  ],
  coverImage: [
    {
      fieldname: 'coverImage',
      originalname: 'dp4.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: './public/temp',
      filename: 'dp4.jpg',
      path: 'public\\temp\\dp4.jpg',
      size: 82009
    }
  ]
}
     */
  //  console.log(response);

    /**
     * ServerResponse {
  status: [Function: status],
  links: [Function (anonymous)],
  send: [Function: send],
  json: [Function: json],
  jsonp: [Function: jsonp],
  sendStatus: [Function: sendStatus],
  sendFile: [Function: sendFile],
  sendfile: [Function (anonymous)],
  download: [Function: download],
  type: [Function: contentType],
  contentType: [Function: contentType],
  format: [Function (anonymous)],
  attachment: [Function: attachment],
  append: [Function: append],
  header: [Function: header],
  set: [Function: header],
  get: [Function (anonymous)],
  clearCookie: [Function: clearCookie],
  cookie: [Function (anonymous)],
  location: [Function: location],
  redirect: [Function: redirect],
  vary: [Function (anonymous)],
  render: [Function: render]
}
     */


    const avatarLocalPath=req.files?.avatar[0]?.path;
    //console.log(reg.files);

    //const coverImageLocalPath= req.files?.coverImage[0]?.path;


    //for undefined error of cover Image Local Path being undefined
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required ")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    const coverImage =await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url|| "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser =await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    )

})

const loginUser = asyncHandler( async (req, res) =>{
    // req body -> data
    // username or email 
    // find the user
    // password check
    // access and refresh token
    // send cookies

    const {email, username, password} =req.body
    console.log(email);


    if(!username && !email){
        throw new ApiError(400," username or email is required");
    }

        //for one email or password
        //User.findOne({email})

    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist");
    }

    // for mongoose use User with capital u and for user defined functions use user with small u
    const isPasswordValid=await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials");
    }

    const {accessToken, refreshToken} = 
    await generateAccessAndRefreshTokens(user._id)

    const loggedInUser=await User.findById(user._id).
    select("-password -refreshToken")

    const  options = {
        httpOnly: true,
        secure: true
    }


    return res.
    status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
        )
    )


})


const logoutUser= asyncHandler( async(req,  res) =>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined,
            }
        },
        {
            new: true
        },
    )

    const options={
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
})

const refreshAccessToken =asyncHandler(async (req, res)=>{
    const incomingRefreshToken = 
    req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized Request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expored or used")
        }
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newrefreshToken}=await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newrefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newrefreshToken
                }
            ),
            "Access token refreshed"
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Refresh Token")
    }

})

const changeCurrentPassword=asyncHandler( async(req,res) => {
    const {oldpassword, newpassword} = req.body

    const user=await User.findById(req.user?._id)
    const isPasswordCorrect= await user.
    isPasswordCorrect(oldpassword)

    if(!isPasswordCorrect){
            throw new ApiError(400, "Invalid Password")
    }

    user.password = newpassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        {},
        "Password Changed Successfully"
    ))

})

const getCurrentUser = asyncHandler ( async (req  , res) => {
    return res
    .status(200)
    .json(new  ApiResponse(
        200, 
        req, 
        "Current User fetched Successfully"
    ))
})

const updateAccountDetails = asyncHandler( async ( req, res)=>{
    const {fullName, email}= req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
        
    }

    const user =await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
                //email:email
            }
        },
        {new: true}
    ).select("-password")


        return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "Account details Updated successfully"
        ))


})

const updateUserAvatar = asyncHandler( async (req, res) => {
    const avatarLocalPath = req.files?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar File is Missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    //TODO: delete old image

    const user = await User.findOneAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url,
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Avatar updated Successfully"
        )
    )
})

const updateUserCoverImage = asyncHandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover Image File is Missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on Cover Image")
    }

    const user = await User.findOneAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url,
            }
        },
        {
            new:true
        }
    ).select("-password")


    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Cover Image updated Successfully"
        )
    )
})

const getUserChannelProfile = asyncHandler( async (req,res) =>{
    const{ username }=req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is  Missing");
    }

    //User.find({username})

    const channel = await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as: "subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"//count subscriber
                },
                channelSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false,
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,//1 means selected o
                username:1,
                subscribersCount:1,
                channelSubscribedToCount:1,
                avatar:1,
                coverImage:1,
                email:1,
                
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exists")
    }

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            channel[0],
            "User channel fetched successfully"
        )
    )

})

const getWatchHistory = asyncHandler( async(req, res)=>{
    const user = await User.aggregate([
        {
            $match:{
                //mongoose id is returned as a String in req.user._id 
                //by using the following code it is converted into a mongodb id
                
                _id:mongoose.Types.ObjectId.createFromTime(req.user._id)

            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                           { 
                            $lookup:{
                                from:"users",
                                localField:"owner",
                                foreignField:"_id",
                                as:"owner",
                                pipeline:[
                                    {
                                        $project:{
                                            fullName: 1,
                                            username: 1,
                                            avatar: 1
                                        }
                                    }
                                ]
                            }

                        },
                        {
                            $addFields:{
                                owner:{
                                    $first:"$owner"
                                }
                            }
                        }

                    ]
                }
            }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch History fetched Successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
} 
