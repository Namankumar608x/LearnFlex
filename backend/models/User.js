const mongoose = require("mongoose");

const userSchema=new mongoose.Schema({
  username:{type:String,required:true,unique:true},
  password:{type:String,required:true},
  leetcode:{type:String},
  gfg:{type:String},
   profilePicture: { type: String }
})

module.exports=mongoose.model("User",userSchema);
