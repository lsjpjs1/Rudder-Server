const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");

const jwt = require('jsonwebtoken')
require('dotenv').config({path:'./.env'});
const SECRET_KEY = process.env.JWT_SECRET
const tk = require("./tokenhandle");

async function commentRender(post_id, user_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT * from board_comment_new where post_id = $1 order by group_num,order_in_group",[post_id])
        var comments = new Array()
        for(var i=0;i<results.rows.length;i++){
            var currentComment  = new Object()
            const infoResult = await client.query("SELECT * from user_info where user_id = $1",[results.rows[i].user_id])
            if(infoResult.rows[0].user_nickname==null){
                currentComment.user_id = infoResult.rows[0].user_id
            }else{
                currentComment.user_id = infoResult.rows[0].user_nickname
            }
            currentComment.comment_id = results.rows[i].comment_id
            currentComment.comment_body = results.rows[i].comment_body
            currentComment.post_time = results.rows[i].post_time
            currentComment.like_count =results.rows[i].like_count

            currentComment.status =results.rows[i].status
            currentComment.order_in_group=results.rows[i].order_in_group
            currentComment.group_num=results.rows[i].group_num

            currentComment.isMine=false
           if(user_id==results.rows[i].user_id)currentComment.isMine=true
            comments.push(currentComment)
        }
        return comments;
    }catch(ex){
        console.log("Failed to execute commentRender"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/showComment",async function(req,res){
    console.log("showComment is called")
    const {post_id,token} = req.body; 
    if(tk.decodeToken(token)){
        var decodedToken = jwt.verify(token,SECRET_KEY)
        var comments=await commentRender(post_id,decodedToken.user_id);
        var jsonData=JSON.stringify({results:comments})
        res.send(jsonData);
    }else{
        res.send('error')
    }
})



module.exports = router;