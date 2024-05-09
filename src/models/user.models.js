import mongoose,{ Schema } from "mongoose";
import jwt from "jsonwebtoken";//jwt is a bearer token
import bcrypt from "bcrypt";

const userSchema= new Schema(
    {
        username:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        email:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullName:{
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        avatar:{
            type:String,//cloudinary
            required: true,
        },
        coverImage:{
            type:String,
        },
        watchHistory:[
            {
                type:Schema.Types.ObjectId,
                ref:"Video"
            }
        ],
        password:{
            type:String,
            required:[true,"Password id required"]
        },
        refreshToken:{
            type:String
        }
    },
    {
        timestamps:true,
    }
)
//before saving in user profile
userSchema.pre("save", async function (next) {
    if(this.isModified("password")) return next;

    this.password=bcrypt.hash(this.password, 10)
    next()
})

//custom methods using mongoose
//to check if password isi correct
userSchema.methods.isPasswordCorrect= async function(password){
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken=function(){
    //to generate token
    jwt.sign(
        {
            _id:this._is,
            email:this.email,
            username:this.username,
            fullName:this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken=function(){jwt.sign(
    {
        _id:this._is,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn:REFRESH_TOKEN_EXPIRY
    }
)
}
export const User = mongoose.model("User",userSchema)