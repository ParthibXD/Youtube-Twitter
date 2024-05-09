//dotenv has to be imported at beginning of the program
import dotenv from "dotenv"
// import mongoose from "mongoose";
// import { DB_NAME } from "./constants";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path:'./.env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, () =>{
        console.log(`Server is running at port: 
        ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("MONGO db connection failed !!!",err);
})









// import express from "express"
// const app=express()



// ;( async () => {
//     try {
//         await mongoose.connect(`${process.env.
//             MONGODB_URI}/${DB_NAME}`)
//             app.mountpath("error",() => {
//                 console.log("ERR: ",error);
//             })

//             app.listen(process.env.PORT,()=>{
//                 console.log(`App is listening on PORT 
//                 ${process.env.PORT}`);
//             })

//     } catch (error) {
//         console.error("ERROR: ",error);
//         throw err
//     }
// } )()
