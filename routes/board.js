const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo';
const client = require("./database");

const jwt = require('jsonwebtoken')
require('dotenv').config({path:'./.env'});
const SECRET_KEY = process.env.JWT_SECRET
const tk = require("./tokenhandle");
const NO_CATEGORY_NAME = 'No category'
const POST_NUMBER_IN_ONE_PAGE = 20
const url = require('url')
var fs = require('fs');
var crypto = require('crypto');

const {CreateBucketCommand,DeleteObjectCommand,PutObjectCommand,DeleteBucketCommand} = require("@aws-sdk/client-s3")
const {getSignedUrl} = require('@aws-sdk/s3-request-presigner')
const {S3Client} = require("@aws-sdk/client-s3");
// Set the AWS Region.
const REGION = "ap-northeast-2"; //e.g. "us-east-1"
// Create an Amazon S3 service client object..
const s3Client = new S3Client({ region: REGION,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY} });


async function renderPost(board_type,endPostId,category_id=-1,user_id,school_id){
    try{
        await client.query("BEGIN");
        
        var baseQuery = "SELECT b.*,ui.user_nickname,c.*,string_agg(DISTINCT file_name, ',') as image_names from \
        (select left_join_res.* from \
            (select b.*,bl.user_id as like_user_id from \
                board as b left join \
                (select * from board_like where user_id=$1) as bl \
                on b.post_id = bl.post_id order by b.post_id) as left_join_res) as b \
                left join user_info as ui on b.user_id = ui.user_id \
                left join board_type as bt on b.board_type_id = bt.board_type_id \
                left join category as c on b.category_id = c.category_id \
                left join board_image as b_image on b.post_id = b_image.post_id \
                group by b.post_id,b.user_id,b.post_title,b.post_body,b.post_time,b.comment_count,b.like_count,b.post_view,b.board_type_id,b.category_id,b.school_id,b.is_delete,b.like_user_id,ui.user_nickname,c.category_id,bt.board_type_name,b.is_edit \
                having bt.board_type_name = $2 and b.is_delete = false "
        if(endPostId == -1){
            if(category_id==-1){
                var results = await client.query(baseQuery+"and b.post_id >= (select post_id from (select post_id from board where is_delete = false and school_id=$4 order by post_id desc limit $3  ) as not_delete order by post_id asc limit 1) \
                and b.school_id=$4 order by post_id desc ",[user_id,board_type,POST_NUMBER_IN_ONE_PAGE,school_id])
            }else{
                var results = await client.query(baseQuery+"and b.post_id >= (select post_id from (select post_id from board where is_delete = false and category_id=$4 and school_id=$5 order by post_id desc limit $3  ) as not_delete order by post_id asc limit 1) \
                and b.school_id=$5 and b.category_id=$4 order by post_id desc",[user_id,board_type,POST_NUMBER_IN_ONE_PAGE,category_id,school_id])
            }
            
        }else{
            if(category_id==-1){
                var results = await client.query(baseQuery+"and b.post_id >= (select post_id from (select post_id from board where is_delete = false and post_id<$3 and school_id=$5 order by post_id desc limit $4  ) as not_delete order by post_id asc limit 1) \
                and b.school_id=$5 and b.post_id < $3 order by post_id desc",[user_id,board_type,endPostId,POST_NUMBER_IN_ONE_PAGE,school_id])
            }else{
                var results = await client.query(baseQuery+"and b.post_id >= (select post_id from (select post_id from board where is_delete = false and post_id<$3 and category_id=$4 and school_id=$6 order by post_id desc limit $5  ) as not_delete order by post_id asc limit 1) \
                and b.school_id=$6 and b.post_id < $3 and b.category_id=$4 order by post_id desc",[user_id,board_type,endPostId,category_id,POST_NUMBER_IN_ONE_PAGE,school_id])
            }
            
        }
        

        var post = new Array()
        for(i=0;i<results.rows.length;i++){
            var data = new Object()
            data.post_id = results.rows[i].post_id
            if(results.rows[i].user_nickname==null){
                data.user_id = results.rows[i].user_id.substr(0,1)+'******'
            }else{
                data.user_id = results.rows[i].user_nickname.substr(0,1)+'******'
            }
            
            data.post_body = results.rows[i].post_body
            data.post_title = results.rows[i].post_title
            data.post_time = results.rows[i].post_time
            data.comment_count = results.rows[i].comment_count
            data.like_count = results.rows[i].like_count
            data.post_view = results.rows[i].post_view
            data.category_id = results.rows[i].category_id
            data.category_name = results.rows[i].category_name
            data.is_delete = results.rows[i].is_delete
            data.imageUrls = new Array()
            if(results.rows[i].image_names!=null){
                for(image_name of results.rows[i].image_names.split(',')){
                    data.imageUrls.push(process.env.CLOUDFRONT_URL+image_name)
                }
            }   
            if(results.rows[i].like_user_id==null){
                data.isLiked = false
            }else{
                data.isLiked = true
            }
            data.isMine=false
            if(results.rows[i].user_id==user_id){
                data.isMine=true
            }

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

async function addPost(board_type,post_title,post_body,user_id,imageInfoList=[],videoIdList,school_id,category_name=NO_CATEGORY_NAME){
    try{
        await client.query("BEGIN")
        const result = await client.query("insert into board values (default, $1, $2, $3, default,0,0,0,(select board_type_id from board_type where board_type_name = $4),(select category_id from category where category_name = $5 and school_id = $6),$6) returning *",[user_id,post_title,post_body,board_type,category_name,school_id])
        await client.query("COMMIT")
        return result.rows[0].post_id
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

async function addLike(user_id,post_id,plusValue=1){
    try{
        await client.query("BEGIN")
        if(plusValue==1){
            await client.query("insert into board_like values ($1, $2)",[post_id,user_id])
        }else{
            await client.query("delete from board_like where post_id=$1 and user_id=$2",[post_id,user_id])
        }
        await client.query("update board set like_count = like_count+$1 where post_id=($2)",[plusValue,post_id])
        await client.query("COMMIT")
        const likeCountResult = await client.query("select like_count from board where post_id=$1",[post_id])
        return likeCountResult.rows[0].like_count
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
        await client.query("update board set is_delete=true where post_id = $1",[post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute deletePost"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

// async function addPost(board_type,post_title,post_body,user_id,imageInfoList=[],videoIdList,school_id,category_name=NO_CATEGORY_NAME){
//     try{
//         await client.query("BEGIN")
//         const result = await client.query("insert into board values (default, $1, $2, $3, default,0,0,0,(select board_type_id from board_type where board_type_name = $4),(select category_id from category where category_name = $5),$6) returning *",[user_id,post_title,post_body,board_type,category_name,school_id])
//         for(var i=0;i<imageInfoList.length;i++){
//             await client.query("insert into board_image values (default, $1, $2, $3, $4)",[result.rows[0].post_id,imageInfoList[i].file_link,imageInfoList[i].file_name,imageInfoList[i].file_size])
//         }
//         for(var i=0;i<videoIdList.length;i++){
//             await client.query("insert into board_video_id values ($1, $2)",[result.rows[0].post_id,videoIdList[i]])
//         }
//         await client.query("COMMIT")
//         return result.rows[0].post_id
//     }catch(ex){
//         console.log("Failed to execute addPost"+ex)
//         await client.query("ROLLBACK")
//     }finally{
//        // await client.end()
//         console.log("Cleaned.") 
//     }
// }

async function editPost(post_id,post_title,post_body,category_id){
    try{
        await client.query("BEGIN")
        await client.query("update board set post_title=$1, post_body=$2,is_edit=true, category_id=$4 where post_id=$3",[post_title,post_body,post_id,category_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute editPost"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/editPost",async function(req,res){
    console.log("editPost is called") 
    const {post_title,post_body,post_id,token,category_id}=req.body
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await editPost(post_id,post_title,post_body,category_id).then(res.send(JSON.stringify({results:{isSuccess:true}})))
        
    }else{
        res.send('error')
    }
})


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

async function categoryList(){
    try{
        const results = await client.query("select * from category order by category_id")
        var categoryList = new Array()
        for(result of results.rows){
            var category = new Object()
            category = result
            categoryList.push(category)
        }
        return categoryList
    }catch(ex){
        console.log("Failed to execute categoryList"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function addPostViewCount(post_id){
    try{
        await client.query("BEGIN")
        await client.query("update board set post_view=post_view+1 where post_id = $1",[post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addPostViewCount"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function addPostImage(post_id,fileNameList){
    try{
        await client.query("BEGIN")
        for(fileName of fileNameList){
            await client.query("insert into board_image values (default,$1,default,$2,default)",[post_id,fileName])
        }
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addPostViewCount"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function getUploadSignedUrls(contentTypes,user_info_id,post_id){
    try{
        var urlList = new Array()
        var fileNameList = new Array()
        for(contentType of new Array().concat(contentTypes)){
            var obj = new Object()
            const fileName = user_info_id.toString()+new Date().getTime().toString()
            fileNameList.push(fileName)
            const command = new PutObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: fileName,
                ContentType: contentType,
            })
            obj.url = await getSignedUrl(s3Client, command, {
                expiresIn: 7200
            })
            urlList.push(obj)
        }
        await addPostImage(post_id,fileNameList)
        return urlList
        
    }catch(ex){
        console.log("Failed to execute getUploadSignedUrls"+ex)
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}


async function userSelectCategoryList(user_info_id){
    try{
        const results = await client.query("select * from category where category_id in (select category_id from user_select_category where user_info_id = $1) order by category_id ",[user_info_id])
        var categoryList = new Array()
        for(result of results.rows){
            var category = new Object()
            category = result
            categoryList.push(category)
        }
        return categoryList
    }catch(ex){
        console.log("Failed to execute categoryList"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}




async function addUserSelectCategory(user_info_id,categoryIdList){
    try{
        await client.query("BEGIN")
        for(category_id of categoryIdList){
            await client.query("insert into user_select_category values \
            (default,$1,$2)",[user_info_id,category_id])
        }
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute addUserSelectCategory"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function requestAddCategory(user_info_id,category_name,requestBody){
    try{
        await client.query("BEGIN")
            await client.query("insert into add_category_request values (default,$1,$2,$3)",[user_info_id,category_name,requestBody])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute requestAddCategory"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

router.post("/requestAddCategory",async function(req,res){
    const {token,category_name,requestBody} = req.body
    if(tk.decodeToken){
        const tmp = jwt.verify(token,SECRET_KEY)
        await requestAddCategory(tmp.user_info_id,category_name,requestBody).then(res.send(JSON.stringify({results:{isSuccess:true}})))
    }
    
})

router.post("/userSelectCategoryList",async function(req,res){
    const {token} = req.body
    if(tk.decodeToken){
        const tmp = jwt.verify(token,SECRET_KEY)
        const categories = await userSelectCategoryList(tmp.user_info_id)
        res.send(JSON.stringify({results:categories}))
    }
    
})

router.post("/addUserSelectCategory",async function(req,res){
    const {token,categoryIdList} = req.body
    console.log(categoryIdList)
    if(tk.decodeToken(token)){
        const tmp = jwt.verify(token,SECRET_KEY)
        await addUserSelectCategory(tmp.user_info_id,categoryIdList).then(res.send(JSON.stringify({results:{isSuccess:true}})))
    }
    
    
})

router.post("/getUploadSignedUrls",async function(req,res){
    const {contentTypes,token,post_id} = req.body
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        const urls = await getUploadSignedUrls(contentTypes,temp.user_info_id,post_id)
        res.send(JSON.stringify({results:{urls:urls}}))
    }
    
    
    
})


router.post("/categoryList",async function(req,res){
    const categories = await categoryList()
    res.send(JSON.stringify({results:categories}))
})



router.post("/deletePost",async function(req,res){
    console.log("deletePost is called")
    const {post_id} = req.body
    await deletePost(post_id).then(res.send(JSON.stringify({results:{isSuccess:true}})))
    
})

router.post("/renderPost",async function(req,res){
    console.log("renderPost is called")
    
    const {board_type,endPostId,category_id,token} = req.body; 
    console.log(req.body)
    
    if(tk.decodeToken(token)){
        const tmp = jwt.verify(token,SECRET_KEY)
        var jsonData= await renderPost(board_type,endPostId,category_id,tmp.user_id,tmp.school_id);
        res.send(jsonData);
    }
    
})

router.post("/addPost",async function(req,res){
    console.log("addPost is called")
    const {board_type,post_title,post_body,token,category_name,imageInfoList} = req.body



    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)

        const videoIdList=getVideoIdList(post_body)
        console.log(imageInfoList)
        const post_id = await addPost(board_type,post_title,post_body,temp.user_id,imageInfoList,videoIdList,temp.school_id,category_name)
        res.send(JSON.stringify({results:{isSuccess:true,post_id:post_id}}))
        
    }else{
        var result = JSON.stringify({results:{isSuccess:false}})
        res.send(result)
    }
})



router.post("/addPostViewCount",async function(req,res){
    console.log("addPostViewCount is called")
    const {post_id} = req.body
    await addPostViewCount(post_id).then(res.send(JSON.stringify({results:{isSuccess:true}})))
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
    const {post_id,token,plusValue} = req.body

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        const like_count = await addLike(temp.user_id,post_id,plusValue)
        res.send(JSON.stringify({results:{isSuccess:true,like_count:like_count}}))

    }else{
        res.send(JSON.stringify({results:{isSuccess:false}}))
    }
    
})

router.post("/isLiked",async function(req,res){
    console.log("isLiked is called")
    const {post_id,token} = req.body 

    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        if(await isLiked(temp.user_id,post_id)){
            res.send(JSON.stringify({results:{isSuccess:true}}))
        }else{
            res.send(JSON.stringify({results:{isSuccess:false}}))
        }
        
    }else{
        res.send(JSON.stringify({results:{isSuccess:false}}))
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