//after getting local file path of the file upload it on cloudinary

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";//managing file system 



    // Configuration
cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET  
});

const uploadOnCloudinary= async (localFilePath) => {
    try {
        if (!localFilePath) {
            return null
        }

            //upload file on cloudinary
            const response = await cloudinary.uploader.upload(localFilePath,{
                resource_type:"auto"
            })
            console.log("File is Uploaded on Cloudinary ",response.url); 
            return response; 
    } catch (error) {
        fs.unlinkSync(localFilePath)//to remove the locally saved temp file if not uploaded
        return null;
    }
}
    

export {uploadOnCloudinary}