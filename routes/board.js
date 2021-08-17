const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo'
const client = require("./database");

const jwt = require('jsonwebtoken')
require('dotenv').config({path:'./.env'});
const SECRET_KEY = process.env.JWT_SECRET
const tk = require("./tokenhandle");


const POST_NUMBER_IN_ONE_PAGE = 20
async function renderPost(board_type,pagingIndex,endPostId){
    try{
        await client.query("BEGIN")
        
        var offset = pagingIndex * POST_NUMBER_IN_ONE_PAGE
        
        if(offset == 0){
            var results = await client.query("SELECT b.*,ui.user_nickname from board as b left join user_info as ui on b.user_id = ui.user_id left join board_type as bt on b.board_type_id = bt.board_type_id where bt.board_type_name = $1 order by post_id desc limit 20 offset 0",[board_type])
        }else{
            var results = await client.query("SELECT b.*,ui.user_nickname from board as b left join user_info as ui on b.user_id = ui.user_id left join board_type as bt on b.board_type_id = bt.board_type_id where bt.board_type_name = $1 and post_id <= $2 order by post_id desc limit 20 offset $3",[board_type,endPostId,offset])
        }
        

        var post = new Array()
        for(i=0;i<results.rows.length;i++){
            var data = new Object()
            data.post_id = results.rows[i].post_id
            if(results.rows[i].user_nickname==null){
                data.user_id = results.rows[i].user_id
            }else{
                data.user_id = results.rows[i].user_nickname
            }
            
            data.post_body = results.rows[i].post_body
            data.post_title = results.rows[i].post_title
            data.post_time = results.rows[i].post_time
            data.comment_count = results.rows[i].comment_count
            data.like_count = results.rows[i].like_count
            data.post_view = results.rows[i].post_view
            post.push(data)
        }
        var jsonData = JSON.stringify(post)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute board"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function addPost(board_type,post_title,post_body,user_id,imageInfoList,videoIdList,school_id,category_id){
    try{
        await client.query("BEGIN")
        const result = await client.query("insert into board values (default, $1, $2, $3, default,0,0,0,(select board_type_id from board_type where board_type_name = $4),$5,$6) returning *",[user_id,post_title,post_body,board_type,category_id,school_id])
        for(var i=0;i<imageInfoList.length;i++){
            await client.query("insert into board_image values (default, $1, $2, $3, $4)",[result.rows[0].post_id,imageInfoList[i].file_link,imageInfoList[i].file_name,imageInfoList[i].file_size])
        }
        for(var i=0;i<videoIdList.length;i++){
            await client.query("insert into board_video_id values ($1, $2)",[result.rows[0].post_id,videoIdList[i]])
        }
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addPost"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function showPost(user_id, post_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT * from board where post_id = $1",[post_id])
        const resultsImage = await client.query("SELECT * from board_image where post_id = $1",[post_id])
        const resultsVideoId = await client.query("SELECT * from board_video_id where post_id = $1",[post_id])
        const infoResult = await client.query("SELECT * from user_info where user_id = $1",[results.rows[0].user_id])
        console.log(resultsVideoId)
        var currentDiscussion  = new Object()
        currentDiscussion.post_id = results.rows[0].post_id
        if(infoResult.rows[0].user_nickname==null){
            currentDiscussion.user_id = infoResult.rows[0].user_id
        }else{
            currentDiscussion.user_id = infoResult.rows[0].user_nickname
        }
        currentDiscussion.post_body = results.rows[0].post_body
        currentDiscussion.post_title = results.rows[0].post_title
        currentDiscussion.post_time = results.rows[0].post_time
        currentDiscussion.comment_count = results.rows[0].comment_count
        currentDiscussion.like_count = results.rows[0].like_count
        currentDiscussion.isMine=false
        var imageLinkList = []
        for(var i=0;i<resultsImage.rows.length;i++){
            imageLinkList.push(resultsImage.rows[i].file_link)
        }
        currentDiscussion.file_link_list = imageLinkList
        var videoIdList = []
        for(var i=0;i<resultsVideoId.rows.length;i++){
            videoIdList.push(resultsVideoId.rows[i].video_id)
        }
        currentDiscussion.video_id_list = videoIdList
        if(user_id==results.rows[0].user_id)currentDiscussion.isMine=true
        var CommentJsonData = await commentRender(post_id,user_id)
        var tmpData = new Array()
        tmpData.push(currentDiscussion)
        tmpData.push(CommentJsonData)

        var jsonData = JSON.stringify(tmpData)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute showPost"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function showComment(user_id, post_id){
    try{
        await client.query("BEGIN")
       
        var CommentJsonData = await commentRender(post_id,user_id)

        var jsonData = JSON.stringify({results:CommentJsonData})
        return jsonData;
    }catch(ex){
        console.log("Failed to execute showComment"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function commentRender(post_id, user_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT * from board_comment where post_id = $1",[post_id])
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

async function addLike(user_id,post_id){
    try{
        await client.query("BEGIN")
        await client.query("update board set like_count = like_count+1 where post_id=($1)",[post_id])
        await client.query("insert into board_like values ($1, $2)",[post_id,user_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addLike"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function isLiked(user_id,post_id){
    try{
        //console.log(tk.testint)
        await client.query("BEGIN")
        const result = await client.query("select * from board_like where user_id = $1 and post_id = $2",[user_id,post_id])
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

async function addComment(user_id,post_id, comment_body){
    try{
        await client.query("BEGIN")
        await client.query("insert into board_comment values (default, $1, $2, $3, default, 0)",[post_id,user_id,comment_body])
        await client.query("update board set comment_count = comment_count+1 where post_id=($1)",[post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addLike"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function deletePost(post_id){
    try{
        await client.query("BEGIN")
        await client.query("delete from board_like where post_id = $1",[post_id])
        await client.query("delete from board_comment where post_id = $1",[post_id])
        await client.query("delete from board where post_id = $1",[post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute deletePost"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function deleteComment(comment_id, post_id){
    try{
        await client.query("BEGIN")
        await client.query("delete from board_comment where comment_id = $1",[comment_id])
        await client.query("update board set comment_count = comment_count-1 where post_id=($1)",[post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute deleteComment"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function editPost(post_id,post_title,post_body){
    try{
        await client.query("BEGIN")
        await client.query("update board set post_title=$1, post_body=$2 where post_id=$3",[post_title,post_body,post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute editPost"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

function getVideoIdList(post_body){
    try{
        var reg = /(.*?)(^|\/|v=)([a-z0-9_-]{11})(\s*)?/gim
        var videoId
        var videoIdList = new Array()
        while(1){
            videoId=reg.exec(post_body)
          if(videoId==null){
            break
          }else{
            console.log(videoId[3])
            videoIdList.push(videoId[3])
          }
            
        }
        
        return videoIdList
    }catch(ex){
        console.log("Failed to execute getVideoIdList"+ex)
    }
}




router.post("/editPost",async function(req,res){
    console.log("editPost is called") 
    const {post_title,post_body,post_id,token}=req.body
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await editPost(post_id,post_title,post_body).then(res.send("finish"))
        
    }else{
        res.send('error')
    }
})

router.post("/deleteComment",async function(req,res){
    console.log("deleteComment is called")
    const {comment_id,post_id} = req.body
    await deleteComment(comment_id,post_id).then(res.send("finish"));
})

router.post("/deletePost",async function(req,res){
    console.log("deletePost is called")
    const {post_id} = req.body
    await deletePost(post_id)
    res.send("finish")
})

router.post("/renderPost",async function(req,res){
    console.log("renderPost is called")
    
    const {board_type,pagingIndex,endPostId} = req.body; 
    console.log(board_type,pagingIndex,endPostId)
    var jsonData= await renderPost(board_type,pagingIndex,endPostId);
    res.send(jsonData);
})

router.post("/addPost",async function(req,res){
    console.log("addPost is called")
    const {board_type,post_title,post_body,token} = req.body
    if(typeof req.body.category_id=="undefined"){
        var category_id = 1
    }else{
        var category_id = req.body.category_id
    }
    if(typeof req.body.imageInfoList=="undefined"){
        var imageInfoList = []
    }else{
        var imageInfoList = req.body.imageInfoList
    }
    
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)

        const videoIdList=getVideoIdList(post_body)
        console.log(imageInfoList)
        await addPost(board_type,post_title,post_body,temp.user_id,imageInfoList,videoIdList,temp.school_id,category_id).then(res.send(JSON.stringify({results:{isSuccess:true}})))
        
    }else{
        var result = JSON.stringify({results:{isSuccess:false}})
        res.send(result)
    }
})

router.post("/showPost",async function(req,res){
    console.log("showPost is called")
    const {post_id,token} = req.body; 
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        var jsonData=await showPost(temp.user_id,post_id);

        res.send(jsonData);
    }else{
        res.send('error')
    }
})

router.post("/showComment",async function(req,res){
    console.log("showComment is called")
    const {post_id,token} = req.body; 
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        var jsonData=await showComment(temp.user_id,post_id);

        res.send(jsonData);
    }else{
        res.send('error')
    }
})

router.post("/addlike",async function(req,res){
    console.log("addlike is called")
    const {post_id,token} = req.body

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await addLike(temp.user_id,post_id).then(res.send("like_count is increased"));
        
    }else{
        res.send('error')
    }
    
})

router.post("/isLiked",async function(req,res){
    console.log("isLiked is called")
    const {post_id,token} = req.body 

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        if(await isLiked(temp.user_id,post_id)){
            res.send('true')
        }else{
            res.send('false')
        }
        
    }else{
        res.send('error')
    }
})

router.post("/addComment",async function(req,res){
    console.log("addComment is called")
    const {post_id,comment_body,token} = req.body

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await addComment(temp.user_id,post_id, comment_body).then(res.send("finish"))
        
    }else{
        res.send('error')
    }
})

router.get("/seeAllReview",async function(req,res){
    

    const result = await client.query("select * from review order by post_time desc")
    var text = result.rows.length.toString()+'<br/>'
    for(var i =0;i<result.rows.length;i++){
        var user_id=await (await client.query("select * from user_info where user_info_id = $1",[result.rows[i].user_id])).rows[0].user_id
        text = text+'<b>'+user_id+'</b>'+' : '+ String(result.rows[i].review_content)+' '+result.rows[i].post_time+'<br/>'+'<br/>'
        
    }
    res.send(text)
})

router.get("/seeAllUser",async function(req,res){
    

    const result = await client.query("select * from user_info where user_info_id>=68 order by user_info_id desc")
    var text = result.rows.length.toString()+'<br/>'
    for(var i =0;i<result.rows.length;i++){
        text = text+'<b>'+result.rows[i].user_id+'</b>'+' : '+ result.rows[i].user_email+'<br/>'+'<br/>'
        
    }
    res.send(text)
})

router.get("/seeRecoCode",async function(req,res){
    

    const result = await client.query("select ui.user_nickname, rc.code from recommendation_code as rc left outer join user_info as ui on rc.user_info_id = ui.user_info_id order by code")
    var text = '<table border="1">\
                <th>nickname</th>\
                <th>code</th>'
    for(var i =0;i<result.rows.length;i++){
        text = text+'<tr>'+'<td>'+result.rows[i].user_nickname+'</td>'+'<td>'+ result.rows[i].code+'</td>'+'</tr>'
    }
    text=text+'</table>'
    res.send(text)
})

module.exports = router;