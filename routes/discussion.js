const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");

const jwt = require('jsonwebtoken')
require('dotenv').config({path:'./.env'});
const SECRET_KEY = process.env.JWT_SECRET
const tk = require("./tokenhandle")
async function adddiscusion(user_info_id,course_id,discussion_title,discussion_body,user_id){
    try{
        await client.query("BEGIN")
        await client.query("insert into discussion values (default, $1, $2, $3, $4, default, 0, 0,$5)",[course_id,user_info_id,discussion_title,discussion_body,user_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute adddiscussion"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function deleteDiscussion(discussion_id){
    try{
        await client.query("BEGIN")
        await client.query("delete from like_user where discussion_id = $1",[discussion_id])
        await client.query("delete from comment where discussion_id = $1",[discussion_id])
        await client.query("delete from discussion where discussion_id = $1",[discussion_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute deleteDiscussion"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function deleteComment(comment_id, discussion_id){
    try{
        await client.query("BEGIN")
        await client.query("delete from comment where comment_id = $1",[comment_id])
        await client.query("update discussion set comment_count = comment_count-1 where discussion_id=($1)",[discussion_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute deleteComment"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function editDiscussion(discussion_id,discussion_title,discussion_body){
    try{
        await client.query("BEGIN")
        await client.query("update discussion set discussion_title=$1, discussion_body=$2 where discussion_id=$3",[discussion_title,discussion_body,discussion_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute discussion"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function discussionrender(course_id){
    try{
        await client.query("BEGIN")

        const results = await client.query("SELECT * from discussion where course_id = $1 order by post_time desc",[course_id])
        
        var reviews = new Array()
        for(i=0;i<results.rows.length;i++){
            var data = new Object()
            data.discussion_id = results.rows[i].discussion_id
            const infoResult = await client.query("SELECT * from user_info where user_info_id = $1",[results.rows[i].user_info_id])
            if(infoResult.rows[0].user_nickname==null){
                data.user_id = infoResult.rows[0].user_id
            }else{
                data.user_id = infoResult.rows[0].user_nickname
            }
            
            data.discussion_body = results.rows[i].discussion_body
            data.discussion_title = results.rows[i].discussion_title
            data.post_time = results.rows[i].post_time
            data.comment_count = results.rows[i].comment_count
            data.like_count = results.rows[i].like_count
            reviews.push(data)
        }
        var jsonData = JSON.stringify(reviews)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute discussion"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function commentRender(discussion_id, user_info_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT * from comment where discussion_id = $1",[discussion_id])
        var comments = new Array()
        for(var i=0;i<results.rows.length;i++){
            var currentComment  = new Object()
            const infoResult = await client.query("SELECT * from user_info where user_info_id = $1",[results.rows[i].user_info_id])
            if(infoResult.rows[0].user_nickname==null){
                currentComment.user_id = infoResult.rows[0].user_id
            }else{
                currentComment.user_id = infoResult.rows[0].user_nickname
            }
            
            currentComment.comment_id = results.rows[i].comment_id
            currentComment.comment_body = results.rows[i].comment_body
            currentComment.post_time = results.rows[i].post_time
            currentComment.isMine=false
            if(user_info_id==results.rows[i].user_info_id)currentComment.isMine=true
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

async function showdiscussion(user_info_id, discussion_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT * from discussion where discussion_id = $1",[discussion_id])
        const infoResult = await client.query("SELECT * from user_info where user_info_id = $1",[results.rows[0].user_info_id])
        var currentDiscussion  = new Object()
        currentDiscussion.discussion_id = results.rows[0].discussion_id
        if(infoResult.rows[0].user_nickname==null){
            currentDiscussion.user_id = infoResult.rows[0].user_id
        }else{
            currentDiscussion.user_id = infoResult.rows[0].user_nickname
        }
        
        currentDiscussion.discussion_body = results.rows[0].discussion_body
        currentDiscussion.discussion_title = results.rows[0].discussion_title
        currentDiscussion.post_time = results.rows[0].post_time
        currentDiscussion.comment_count = results.rows[0].comment_count
        currentDiscussion.like_count = results.rows[0].like_count
        currentDiscussion.isMine=false
        if(user_info_id==results.rows[0].user_info_id)currentDiscussion.isMine=true
        var CommentJsonData = await commentRender(discussion_id,user_info_id)
        var tmpData = new Array()
        tmpData.push(currentDiscussion)
        tmpData.push(CommentJsonData)

        var jsonData = JSON.stringify(tmpData)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute showdiscussion"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function addLike(user_info_id,discussion_id){
    try{
        await client.query("BEGIN")
        await client.query("update discussion set like_count = like_count+1 where discussion_id=($1)",[discussion_id])
        await client.query("insert into like_user values ($1, $2)",[discussion_id,user_info_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addLike"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}



async function addComment(user_info_id,discussion_id,comment_body,user_id){
    try{
        await client.query("BEGIN")
        await client.query("insert into comment values (default, $1, $2, default, $3, $4)",[user_info_id,comment_body,user_id,discussion_id])
        await client.query("update discussion set comment_count = comment_count+1 where discussion_id=($1)",[discussion_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addLike"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function isLiked(user_info_id,discussion_id){
    try{
        //console.log(tk.testint)
        await client.query("BEGIN")
        const result = await client.query("select * from like_user where user_info_id = $1 and discussion_id = $2",[user_info_id,discussion_id])
        if(result.rows.length==0){
            return false
        }else{
            return true

        }
    }catch(ex){
        console.log("Failed to execute isLiked "+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/addComment",async function(req,res){
    console.log("addComment is called")
    const discussion_id = req.body.discussion_id;
    const comment_body = req.body.comment_body; 
    const token = req.body.token;

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await addComment(temp.user_info_id,discussion_id, comment_body, temp.user_id).then(res.send("finish"))
        
    }else{
        res.send('error')
    }
})

router.post("/deleteDiscussion",async function(req,res){
    console.log("deleteDiscussion is called")
    const discussion_id = req.body.discussion_id; 
    await deleteDiscussion(discussion_id)
    res.send("finish")
})

router.post("/deleteComment",async function(req,res){
    console.log("deleteComment is called")
    const comment_id = req.body.comment_id; 
    const discussion_id = req.body.discussion_id;
    await deleteComment(comment_id,discussion_id).then(res.send("finish"));
})

router.post("/discussionrender",async function(req,res){
    console.log("discussionrender is called")
    const course_id = req.body.course_id; 
    var jsonData= await discussionrender(course_id);
    res.send(jsonData);
})

router.post("/adddiscussion",async function(req,res){
    console.log("adddiscussion is called")
    const course_id = req.body.course_id;     
    const discussion_title=req.body.discussion_title;
    const discussion_body=req.body.discussion_body;
    const token=req.body.token;
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await adddiscusion(temp.user_info_id,course_id,discussion_title,discussion_body,temp.user_id).then(res.send("finish"))
        
    }else{
        res.send('error')
    }
})

router.post("/editDiscussion",async function(req,res){
    console.log("editDiscussion is called") 
    const discussion_title=req.body.discussion_title;
    const discussion_body=req.body.discussion_body;
    const discussion_id=req.body.discussion_id;
    const token=req.body.token;
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await editDiscussion(discussion_id,discussion_title,discussion_body).then(res.send("finish"))
        
    }else{
        res.send('error')
    }
})

router.post("/showdiscussion",async function(req,res){
    console.log("showdiscussion is called")
    const discussion_id = req.body.discussion_id; 
    const token = req.body.token;
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        var jsonData=await showdiscussion(temp.user_info_id,discussion_id);

        res.send(jsonData);
    }else{
        res.send('error')
    }
})


router.post("/addlike",async function(req,res){
    console.log("addlike is called")
    const discussion_id = req.body.discussion_id; 
    const token = req.body.token;
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await addLike(temp.user_info_id,discussion_id).then(res.send("like_count is increased"));
        
    }else{
        res.send('error')
    }
    
})

router.post("/isLiked",async function(req,res){
    console.log("isLiked is called")
    const discussion_id = req.body.discussion_id; 
    const token = req.body.token;
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        if(await isLiked(temp.user_info_id,discussion_id)){
            res.send('true')
        }else{
            res.send('false')
        }
        
    }else{
        res.send('error')
    }
})


module.exports = router;