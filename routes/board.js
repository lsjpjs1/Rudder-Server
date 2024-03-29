const express = require('express')
const router = express.Router()
process.env.TZ='Asia/Tokyo';
const client = require("./database");
const userRecord = require("./userrecord")
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
const REGION = process.env.REGION; //e.g. "us-east-1"
// Create an Amazon S3 service client object..
const s3Client = new S3Client({ region: REGION,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY} });

const apn = require('apn');
const { profile } = require('console');

const path = require('path');
const { strictEqual } = require('assert');

router.post("/approveJoinClub",async function(req,res){
    var {category_id,user_info_id} = req.body
    const results = await approveJoinClub(category_id,user_info_id)
    res.send(JSON.stringify({results:results}))
})

async function approveJoinClub(category_id,user_info_id){
    try{
        await client.query("delete from category_join_request where category_id = $1 and user_info_id = $2",[category_id,user_info_id]) 
        await client.query("insert into category_member values (default,$1,$2)",[category_id,user_info_id]) 
        return {isSuccess:true}
    }catch(ex){
        console.log("Failed to execute approveJoinClub"+ex)
        await client.query("ROLLBACK")
        return {isSuccess:false}
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

//완료
router.post("/requestJoinClub",async function(req,res){
    var {token,category_id,request_body} = req.body
    const tmp = jwt.verify(token,SECRET_KEY)
    const results = await requestJoinClub(category_id,tmp.user_info_id,request_body)
    res.send(JSON.stringify({results:results}))
})

async function requestJoinClub(category_id,user_info_id,request_body){
    try{
        await client.query("insert into category_join_request values (default,$1,$2,$3)",[category_id,user_info_id,request_body]) 
        return {isSuccess:true}
    }catch(ex){
        console.log("Failed to execute requestJoinClub"+ex)
        await client.query("ROLLBACK")
        return {isSuccess:false}
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

//완료
router.post("/clubCategoryList",async function(req,res){
    var {school_id,token} = req.body
    var user_info_id
    console.log('schoolid',req.body.school_id)
    console.log('token',req.body.token)
    if(typeof token != 'undefined'){
        const tmp = jwt.verify(token,SECRET_KEY)
        school_id=tmp.school_id
        user_info_id = tmp.user_info_id
    }
    const categories = await clubCategoryList(school_id,user_info_id)
    res.send(JSON.stringify({results:categories}))
})



async function clubCategoryList(school_id=1,user_info_id=-1){
    try{
        if(typeof user_info_id != 'undefined'){
            const results = await client.query("select c.*,cm.user_info_id as category_member_user_info_id,cjr.user_info_id as category_join_request_user_info_id, \
            (select user_info_id from user_select_category where category_id = c.category_id and user_info_id = $2) \
            from category as c \
            left join \
            (select * from category_member where user_info_id=$2) as cm \
            on  \
            c.category_id = cm.category_id \
            left join \
            (select * from category_join_request where user_info_id=$2) as cjr \
            on  \
            c.category_id = cjr.category_id \
                        where school_id = $1 and category_type = 'club' and category_enable = true \
                        order by c.category_id",[school_id,user_info_id]) 
            var categoryList = new Array()
            for(result of results.rows){
                var category = new Object()
                category.category_id = result.category_id
                category.category_name = result.category_name
                category.school_id = result.school_id
                category.category_type = result.category_type
                category.category_abbreviation = result.category_abbreviation
                if(result.category_member_user_info_id!=null){
                    category.isMember='t'
                }else if(result.category_join_request_user_info_id!=null){
                    category.isMember='r'
                }else{
                    category.isMember='f'
                }
                if(result.user_info_id==null){
                    category.isSelect = false
                }else{
                    category.isSelect = true
                }
                categoryList.push(category)
            }
            return categoryList
        }else{
            const results = await client.query("select * from category \
        where school_id = $1 and category_type = 'club' \
        order by category_id",[school_id]) 
        var categoryList = new Array()
        for(result of results.rows){
            var category = new Object()
            category.category_id = result.category_id
            category.category_name = result.category_name
            category.school_id = result.school_id
            category.category_type = result.category_type
            category.isMember = 'f'
            categoryList.push(category)
        }
        return categoryList
        }
        
    }catch(ex){
        console.log("Failed to execute categoryList"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

//완료
router.post("/categoryList",async function(req,res){
    var {school_id,token} = req.body
    console.log('schoolid',req.body.school_id)
    console.log('token',req.body.token)
    var user_info_id
    if(typeof token != 'undefined'){
        console.log(SECRET_KEY)
        const tmp = jwt.verify(token,SECRET_KEY)
        school_id=tmp.school_id
        user_info_id = tmp.user_info_id
    }
    const categories = await categoryList(school_id,user_info_id)
    res.send(JSON.stringify({results:categories}))
})



async function categoryList(school_id=1,user_info_id=-1){
    try{
        const results = await client.query("\
        select * from \
            (select distinct on (c.category_id) c.*,usc.user_info_id from category as c \
            left join (select user_info_id,category_id from user_select_category where  user_info_id = $2) as usc \
            on usc.category_id = c.category_id \
            where school_id = $1 and (category_type = 'common' or category_type = 'department') and category_enable = true  \
            order by c.category_id) as res order by category_order",[school_id,user_info_id]) 
        var categoryList = new Array()
        for(result of results.rows){
            var category = new Object()
            category.category_id = result.category_id
            category.category_name = result.category_name
            category.category_abbreviation = result.category_abbreviation
            if(result.user_info_id==null){
                category.isSelect = false
            }else{
                category.isSelect = true
            }
            category.category_type = result.category_type
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




//완료
router.post("/renderPost",async function(req,res){
    
    const {board_type,endPostId,category_id,token,searchBody} = req.body; 

    if(tk.decodeToken(token)){
        const tmp = jwt.verify(token,SECRET_KEY)
        var jsonData = await renderPost(board_type,endPostId,category_id,tmp.user_id,tmp.school_id,searchBody,tmp.user_info_id);
        try {
            res.send(jsonData);
        } catch (error) {

            var jsonData = JSON.stringify(new Array())
        }
        
    }
    
})

async function renderPost(board_type='bulletin',endPostId=-1,category_id=-1,user_id,school_id,searchBody="",user_info_id){
    try{
        await client.query("BEGIN");
        

        if(searchBody!=""){
            if(endPostId==-1){
                var results = await client.query("select string_agg(distinct file_name,',') as image_names,ui.*,bl.user_id as like_user_id,b.* from \
                (select board.*, c.category_type, c.category_name, c.category_abbreviation \
                  from board \
                  left join category c on board.category_id = c.category_id \
                  where is_delete = false and board.school_id = $3 and board.post_body like $5 and (c.category_type != 'club' or c.category_id in (select category_id from category_member where user_info_id=$4)) \
                  order by post_time desc \
                  limit $2) as b \
        left join (select post_id,user_id from board_like where user_id = $1) as bl on bl.post_id = b.post_id \
        left join (select aa.user_info_id,aa.user_nickname,bb.user_profile_image_id,aa.user_id from user_info as aa left join user_profile bb on aa.profile_id = bb.profile_id) as ui on b.user_id = ui.user_id \
        left join board_image b_image on b.post_id = b_image.post_id \
        left join user_block ub on (ub.user_info_id=$4 and ub.blocked_user_info_id = ui.user_info_id) \
        where ub.user_info_id is null \
        group by b.post_body_search,b.is_image_uploading,b.category_abbreviation, b.post_id, bl.user_id, user_nickname, user_profile_image_id, b.user_id, post_title, post_body, post_time, comment_count, like_count, post_view, board_type_id, b.category_id, b.school_id, is_delete, is_edit, b.category_id, category_name, b.school_id, category_type, ui.user_info_id, user_nickname, user_profile_image_id, ui.user_id, category_type, category_name \
        order by b.post_time desc",[user_id,POST_NUMBER_IN_ONE_PAGE,school_id,user_info_id,'%'+searchBody+'%'])
            }else{
var results = await client.query("select string_agg(distinct file_name,',') as image_names,ui.*,bl.user_id as like_user_id,b.* from \
                    (select board.*, c.category_type, c.category_name, c.category_abbreviation \
                      from board \
                      left join category c on board.category_id = c.category_id \
                      where is_delete = false and board.school_id = $3 and post_id < $5 and board.post_body like $6 and (c.category_type != 'club' or c.category_id in (select category_id from category_member where user_info_id=$4)) \
                      order by post_time desc \
                      limit $2) as b \
            left join (select post_id,user_id from board_like where user_id = $1) as bl on bl.post_id = b.post_id \
            left join (select aa.user_info_id,aa.user_nickname,bb.user_profile_image_id,aa.user_id from user_info as aa left join user_profile bb on aa.profile_id = bb.profile_id) as ui on b.user_id = ui.user_id \
            left join board_image b_image on b.post_id = b_image.post_id \
            left join user_block ub on (ub.user_info_id=$4 and ub.blocked_user_info_id = ui.user_info_id) \
            where ub.user_info_id is null \
            group by b.post_body_search,b.is_image_uploading,b.category_abbreviation, b.post_id, bl.user_id, user_nickname, user_profile_image_id, b.user_id, post_title, post_body, post_time, comment_count, like_count, post_view, board_type_id, b.category_id, b.school_id, is_delete, is_edit, b.category_id, category_name, b.school_id, category_type, ui.user_info_id, user_nickname, user_profile_image_id, ui.user_id, category_type, category_name \
            order by b.post_time desc",[user_id,POST_NUMBER_IN_ONE_PAGE,school_id,user_info_id,endPostId,'%'+searchBody+'%'])
            }
        }else{
            if(endPostId==-1){
                if(category_id==-1){
                    var results = await client.query("select string_agg(distinct file_name,',') as image_names,ui.*,bl.user_id as like_user_id,b.* from \
                    (select board.*, c.category_type, c.category_name, c.category_abbreviation \
                      from board \
                      left join category c on board.category_id = c.category_id \
                      where is_delete = false and board.school_id = $3 and (c.category_type = 'common' or (c.category_type='department' and c.category_id in (select category_id from user_select_category where user_info_id=$4)) or c.category_id in (select category_id from category_member where user_info_id=$4)) \
                      order by post_time desc \
                      limit $2) as b \
            left join (select post_id,user_id from board_like where user_id = $1) as bl on bl.post_id = b.post_id \
            left join (select aa.user_info_id,aa.user_nickname,bb.user_profile_image_id,aa.user_id from user_info as aa left join user_profile bb on aa.profile_id = bb.profile_id) as ui on b.user_id = ui.user_id \
            left join board_image b_image on b.post_id = b_image.post_id \
            left join user_block ub on (ub.user_info_id=$4 and ub.blocked_user_info_id = ui.user_info_id) \
            where ub.user_info_id is null \
            group by b.post_body_search,b.is_image_uploading,b.category_abbreviation, b.post_id, bl.user_id, user_nickname, user_profile_image_id, b.user_id, post_title, post_body, post_time, comment_count, like_count, post_view, board_type_id, b.category_id, b.school_id, is_delete, is_edit, b.category_id, category_name, b.school_id, category_type, ui.user_info_id, user_nickname, user_profile_image_id, ui.user_id, category_type, category_name \
            order by b.post_time desc",[user_id,POST_NUMBER_IN_ONE_PAGE,school_id,user_info_id])
                }else{
                    var results = await client.query("select string_agg(distinct file_name,',') as image_names,ui.*,bl.user_id as like_user_id,b.* from \
                    (select board.*, c.category_type, c.category_name, c.category_abbreviation \
                      from board \
                      left join category c on board.category_id = c.category_id \
                      where is_delete = false and board.school_id = $3 and board.category_id = $5 \
                      order by post_time desc \
                      limit $2) as b \
            left join (select post_id,user_id from board_like where user_id = $1) as bl on bl.post_id = b.post_id \
            left join (select aa.user_info_id,aa.user_nickname,bb.user_profile_image_id,aa.user_id from user_info as aa left join user_profile bb on aa.profile_id = bb.profile_id) as ui on b.user_id = ui.user_id \
            left join board_image b_image on b.post_id = b_image.post_id \
            left join user_block ub on (ub.user_info_id=$4 and ub.blocked_user_info_id = ui.user_info_id) \
            where ub.user_info_id is null \
            group by b.post_body_search,b.is_image_uploading,b.category_abbreviation, b.post_id, bl.user_id, user_nickname, user_profile_image_id, b.user_id, post_title, post_body, post_time, comment_count, like_count, post_view, board_type_id, b.category_id, b.school_id, is_delete, is_edit, b.category_id, category_name, b.school_id, category_type, ui.user_info_id, user_nickname, user_profile_image_id, ui.user_id, category_type, category_name \
            order by b.post_time desc",[user_id,POST_NUMBER_IN_ONE_PAGE,school_id,user_info_id,category_id])
                }
            }else{
                if(category_id==-1){
                    var results = await client.query("select string_agg(distinct file_name,',') as image_names,ui.*,bl.user_id as like_user_id,b.* from \
                    (select board.*, c.category_type, c.category_name, c.category_abbreviation \
                      from board \
                      left join category c on board.category_id = c.category_id \
                      where is_delete = false and board.school_id = $3 and post_id < $5 and (c.category_type = 'common' or (c.category_type='department' and c.category_id in (select category_id from user_select_category where user_info_id=$4)) or c.category_id in (select category_id from category_member where user_info_id=$4)) \
                      order by post_time desc \
                      limit $2) as b \
            left join (select post_id,user_id from board_like where user_id = $1) as bl on bl.post_id = b.post_id \
            left join (select aa.user_info_id,aa.user_nickname,bb.user_profile_image_id,aa.user_id from user_info as aa left join user_profile bb on aa.profile_id = bb.profile_id) as ui on b.user_id = ui.user_id \
            left join board_image b_image on b.post_id = b_image.post_id \
            left join user_block ub on (ub.user_info_id=$4 and ub.blocked_user_info_id = ui.user_info_id) \
            where ub.user_info_id is null \
            group by b.post_body_search,b.is_image_uploading,b.category_abbreviation, b.post_id, bl.user_id, user_nickname, user_profile_image_id, b.user_id, post_title, post_body, post_time, comment_count, like_count, post_view, board_type_id, b.category_id, b.school_id, is_delete, is_edit, b.category_id, category_name, b.school_id, category_type, ui.user_info_id, user_nickname, user_profile_image_id, ui.user_id, category_type, category_name \
            order by b.post_time desc",[user_id,POST_NUMBER_IN_ONE_PAGE,school_id,user_info_id,endPostId])
                }else{
                    var results = await client.query("select string_agg(distinct file_name,',') as image_names,ui.*,bl.user_id as like_user_id,b.* from \
                    (select board.*, c.category_type, c.category_name, c.category_abbreviation \
                      from board \
                      left join category c on board.category_id = c.category_id \
                      where is_delete = false and board.school_id = $3 and post_id < $5 and board.category_id = $6 \
                      order by post_time desc \
                      limit $2) as b \
            left join (select post_id,user_id from board_like where user_id = $1) as bl on bl.post_id = b.post_id \
            left join (select aa.user_info_id,aa.user_nickname,bb.user_profile_image_id,aa.user_id from user_info as aa left join user_profile bb on aa.profile_id = bb.profile_id) as ui on b.user_id = ui.user_id \
            left join board_image b_image on b.post_id = b_image.post_id \
            left join user_block ub on (ub.user_info_id=$4 and ub.blocked_user_info_id = ui.user_info_id) \
            where ub.user_info_id is null \
            group by b.post_body_search,b.is_image_uploading,b.category_abbreviation, b.post_id, bl.user_id, user_nickname, user_profile_image_id, b.user_id, post_title, post_body, post_time, comment_count, like_count, post_view, board_type_id, b.category_id, b.school_id, is_delete, is_edit, b.category_id, category_name, b.school_id, category_type, ui.user_info_id, user_nickname, user_profile_image_id, ui.user_id, category_type, category_name \
            order by b.post_time desc",[user_id,POST_NUMBER_IN_ONE_PAGE,school_id,user_info_id,endPostId,category_id])
                }
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
                if (results.rows[i].user_nickname == "Rudder"){
                    data.user_id = "Rudder"
                }
            }
            data.user_info_id = results.rows[i].user_info_id
            data.post_body = results.rows[i].post_body
            data.post_title = results.rows[i].post_title
            data.post_time = results.rows[i].post_time
            data.comment_count = results.rows[i].comment_count
            data.like_count = results.rows[i].like_count
            data.post_view = results.rows[i].post_view
            data.category_id = results.rows[i].category_id
            data.category_abbreviation = results.rows[i].category_abbreviation
            if (data.category_id == null || typeof data.category_id=='undefined'){
                data.category_id = 1
            }
            data.category_name = results.rows[i].category_name
            if (data.category_name == null || typeof data.category_name=='undefined'){
                data.category_name = "Random"
            }
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

            data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+'1'
            if (results.rows[i].user_profile_image_id != null){
                data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+results.rows[i].user_profile_image_id
            }

            if (data.user_id == "Rudder"){
                data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/rudder_admin_profile_image'
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

//완료
router.post("/postFromPostId",async function(req,res){
    
    const {token,postId} = req.body; 
    
    if(tk.decodeToken(token)){
        const tmp = jwt.verify(token,SECRET_KEY)
        var jsonData = await postFromPostId(postId,tmp.user_info_id,tmp.user_id);
        
        res.send(jsonData);
    }
    
})

async function postFromPostId(postId,user_info_id,user_id){
    try{
        await client.query("BEGIN");
        var baseQuery = "SELECT b.*,ui.user_info_id,ui.user_nickname,ui.user_profile_image_id,c.*,string_agg(DISTINCT file_name, ',') as image_names from \
        (select left_join_res.* from \
            (select b.*,bl.user_id as like_user_id from \
                board as b left join \
                (select * from board_like where user_id=$1) as bl \
                on b.post_id = bl.post_id order by b.post_time) as left_join_res) as b \
                left join (select * from user_info as aa left join user_profile as bb on aa.profile_id = bb.profile_id ) as ui on b.user_id = ui.user_id \
                left join board_type as bt on b.board_type_id = bt.board_type_id \
                left join category as c on b.category_id = c.category_id \
                left join board_image as b_image on b.post_id = b_image.post_id \
                group by b.post_body_search,b.is_image_uploading,ui.user_info_id,ui.user_profile_image_id,b.post_id,b.user_id,b.post_title,b.post_body,b.post_time,b.comment_count,b.like_count,b.post_view,b.board_type_id,b.category_id,b.school_id,b.is_delete,b.like_user_id,ui.user_nickname,c.category_id,bt.board_type_name,b.is_edit\
                having b.post_id = $2"
        const results = await client.query(baseQuery,[user_id,postId])

        


            var data = new Object()
            console.log(results.rows)
            if (results.rows.length < 1){
                return JSON.stringify({results:{post:data,isSuccess:false,error:"not exist"}})
            }
            data.post_id = results.rows[0].post_id
            if(results.rows[0].user_nickname==null){
                data.user_id = results.rows[0].user_id.substr(0,1)+'******'
            }else{
                data.user_id = results.rows[0].user_nickname.substr(0,1)+'******'
                if (results.rows[0].user_nickname == "Rudder"){
                    data.user_id = "Rudder"
                }
            }
            data.user_info_id = results.rows[0].user_info_id
            data.post_body = results.rows[0].post_body
            data.post_title = results.rows[0].post_title
            data.post_time = results.rows[0].post_time
            data.comment_count = results.rows[0].comment_count
            data.like_count = results.rows[0].like_count
            data.post_view = results.rows[0].post_view
            data.category_id = results.rows[0].category_id
            data.category_abbreviation = results.rows[0].category_abbreviation
            if (data.category_id == null || typeof data.category_id=='undefined'){
                data.category_id = 1
            }
            data.category_name = results.rows[0].category_name
            if (data.category_name == null || typeof data.category_name=='undefined'){
                data.category_name = "Random"
            }
            data.is_delete = results.rows[0].is_delete
            data.imageUrls = new Array()
            if(results.rows[0].image_names!=null){
                for(image_name of results.rows[0].image_names.split(',')){
                    data.imageUrls.push(process.env.CLOUDFRONT_URL+image_name)
                }
            }   
            if(results.rows[0].like_user_id==null){
                data.isLiked = false
            }else{
                data.isLiked = true
            }
            data.isMine=false
            if(results.rows[0].user_id==user_id){
                data.isMine=true
            }

            data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+'1'
            if (results.rows[0].user_profile_image_id != null){
                data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+results.rows[0].user_profile_image_id
            }

            if (data.user_id == "Rudder"){
                data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/rudder_admin_profile_image'
            }

            if (data.is_delete){
                return JSON.stringify({results:{post:data,isSuccess:false,error:"delete"}})
            }
        var jsonData = JSON.stringify({results:{post:data,isSuccess:true,error:""}})
        return jsonData;
    }catch(ex){
        console.log("Failed to execute board"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

//완료
router.post("/myPosts",async function(req,res){
    console.log("myPosts is called")
    //offset : int = 0,1,2,3...... 0페이지,1페이지,2페이지,3페이지....  default = 0
    const {token,offset} = req.body; 
    console.log(req.body)
    
    if(tk.decodeToken(token)){
        const tmp = jwt.verify(token,SECRET_KEY)
        var jsonData = await myPosts("bulletin",-1,-1,tmp.user_id,tmp.school_id,"",tmp.user_info_id,offset);
        res.send(JSON.stringify({results:{isSuccess:true,error:'',posts:jsonData}}))
    }
    
})

async function myPosts(board_type='bulletin',endPostId=-1,category_id=-1,user_id,school_id,searchBody="",user_info_id,offset=0){
    try{
        await client.query("BEGIN");
        var searchStr = " '%"+searchBody+"%' "
        offset = offset*20
        var results = await client.query("SELECT b.*,ui.user_info_id,ui.user_nickname,ui.user_profile_image_id,c.*,string_agg(DISTINCT file_name, ',') as image_names from \
        (select left_join_res.* from \
            (select b.*,bl.user_id as like_user_id \
             from board as b \
             left join (select * from board_like where user_id=$1) as bl \
                on b.post_id = bl.post_id \
             order by b.post_time) as left_join_res) as b \
                left join (select * from user_info as aa left join user_profile as bb on aa.profile_id = bb.profile_id ) as ui on b.user_id = ui.user_id \
                left join board_type as bt on b.board_type_id = bt.board_type_id \
                left join category as c on b.category_id = c.category_id \
                left join board_image as b_image on b.post_id = b_image.post_id \
                left join (select (select user_id from user_info where user_block.blocked_user_info_id=user_info.user_info_id),user_block.blocked_user_info_id from user_block where user_block.user_info_id = $4) as ub on ub.user_id = b.user_id \
                group by b.post_body_search,b.is_image_uploading,ui.user_id,ui.user_info_id,ui.user_profile_image_id,b.post_id,b.user_id,b.post_title,b.post_body,b.post_time,b.comment_count,b.like_count,b.post_view,b.board_type_id,b.category_id,b.school_id,b.is_delete,b.like_user_id,ui.user_nickname,c.category_id,bt.board_type_name,b.is_edit,ub.blocked_user_info_id \
                having b.is_delete = false and ub.blocked_user_info_id is null and b.post_body like '%%'  \
                and ui.user_info_id = $4 \
                order by post_time desc \
                limit $3 offset $2",[user_id,offset,POST_NUMBER_IN_ONE_PAGE,user_info_id])

        
        

        var post = new Array()
        for(i=0;i<results.rows.length;i++){
            var data = new Object()
            data.post_id = results.rows[i].post_id
            if(results.rows[i].user_nickname==null){
                data.user_id = results.rows[i].user_id.substr(0,1)+'******'
            }else{
                data.user_id = results.rows[i].user_nickname.substr(0,1)+'******'
                if (results.rows[i].user_nickname == "Rudder"){
                    data.user_id = "Rudder"
                }
            }
            data.user_info_id = results.rows[i].user_info_id
            data.post_body = results.rows[i].post_body
            data.post_title = results.rows[i].post_title
            data.post_time = results.rows[i].post_time
            data.comment_count = results.rows[i].comment_count
            data.like_count = results.rows[i].like_count
            data.post_view = results.rows[i].post_view
            data.category_id = results.rows[i].category_id
            data.category_abbreviation = results.rows[i].category_abbreviation
            if (data.category_id == null || typeof data.category_id=='undefined'){
                data.category_id = 1
            }
            data.category_name = results.rows[i].category_name
            if (data.category_name == null || typeof data.category_name=='undefined'){
                data.category_name = "Random"
            }
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

            data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+'1'
            if (results.rows[i].user_profile_image_id != null){
                data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+results.rows[i].user_profile_image_id
            }

            if (data.user_id == "Rudder"){
                data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/rudder_admin_profile_image'
            }

            post.push(data)
        }
        
        return post;
    }catch(ex){
        console.log("Failed to execute myPosts"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

//완료
router.post("/postsWithMyComment",async function(req,res){
    console.log("postsWithMyComment is called")
    //offset : int = 0,1,2,3...... 0페이지,1페이지,2페이지,3페이지....  default = 0
    const {token,offset} = req.body; 
    console.log(req.body)
    
    if(tk.decodeToken(token)){
        const tmp = jwt.verify(token,SECRET_KEY)
        var jsonData = await postsWithMyComment("bulletin",-1,-1,tmp.user_id,tmp.school_id,"",tmp.user_info_id,offset);
        
        res.send(JSON.stringify({results:{isSuccess:true,error:'',posts:jsonData}}))
    }
    
})

async function postsWithMyComment(board_type='bulletin',endPostId=-1,category_id=-1,user_id,school_id,searchBody="",user_info_id,offset=0){
    try{
        await client.query("BEGIN");
        var searchStr = " '%"+searchBody+"%' "
        offset = offset*20
        var results = await client.query("SELECT b.*,ui.user_info_id,ui.user_nickname,ui.user_profile_image_id,c.*,string_agg(DISTINCT file_name, ',') as image_names, bc.user_id as comment_user_id from \
        (select left_join_res.* from \
            (select b.*,bl.user_id as like_user_id \
             from board as b \
             left join (select * from board_like where user_id=$1) as bl \
                on b.post_id = bl.post_id \
             order by b.post_time) as left_join_res) as b \
                left join (select * from user_info as aa left join user_profile as bb on aa.profile_id = bb.profile_id ) as ui on b.user_id = ui.user_id \
                left join board_type as bt on b.board_type_id = bt.board_type_id \
                left join category as c on b.category_id = c.category_id \
                left join board_image as b_image on b.post_id = b_image.post_id \
            left join (select * from board_comment where user_id =$1) as bc on bc.post_id = b.post_id \
                left join (select (select user_id from user_info where user_block.blocked_user_info_id=user_info.user_info_id),user_block.blocked_user_info_id from user_block where user_block.user_info_id = $4) as ub on ub.user_id = b.user_id \
                group by  b.post_body_search,b.is_image_uploading,bc.user_id, ui.user_id,ui.user_info_id,ui.user_profile_image_id,b.post_id,b.user_id,b.post_title,b.post_body,b.post_time,b.comment_count,b.like_count,b.post_view,b.board_type_id,b.category_id,b.school_id,b.is_delete,b.like_user_id,ui.user_nickname,c.category_id,bt.board_type_name,b.is_edit,ub.blocked_user_info_id \
                having b.is_delete = false and ub.blocked_user_info_id is null and b.post_body like '%%'  \
                and bc.user_id is not null \
                order by post_time desc \
                limit $3 offset $2",[user_id,offset,POST_NUMBER_IN_ONE_PAGE,user_info_id])

        
        

        var post = new Array()
        for(i=0;i<results.rows.length;i++){
            var data = new Object()
            data.post_id = results.rows[i].post_id
            if(results.rows[i].user_nickname==null){
                data.user_id = results.rows[i].user_id.substr(0,1)+'******'
            }else{
                data.user_id = results.rows[i].user_nickname.substr(0,1)+'******'
                if (results.rows[i].user_nickname == "Rudder"){
                    data.user_id = "Rudder"
                }
            }
            data.user_info_id = results.rows[i].user_info_id
            data.post_body = results.rows[i].post_body
            data.post_title = results.rows[i].post_title
            data.post_time = results.rows[i].post_time
            data.comment_count = results.rows[i].comment_count
            data.like_count = results.rows[i].like_count
            data.post_view = results.rows[i].post_view
            data.category_id = results.rows[i].category_id
            data.category_abbreviation = results.rows[i].category_abbreviation
            if (data.category_id == null || typeof data.category_id=='undefined'){
                data.category_id = 1
            }
            data.category_name = results.rows[i].category_name
            if (data.category_name == null || typeof data.category_name=='undefined'){
                data.category_name = "Random"
            }
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

            data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+'1'
            if (results.rows[i].user_profile_image_id != null){
                data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/'+results.rows[i].user_profile_image_id
            }

            if (data.user_id == "Rudder"){
                data.userProfileImageUrl = process.env.CLOUDFRONT_URL+'profile_image_preview/rudder_admin_profile_image'
            }

            post.push(data)
        }
        var jsonData = post
        return jsonData;
    }catch(ex){
        console.log("Failed to execute postsWithMyComment"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}




async function addPost(board_type,post_title,post_body,user_id,imageInfoList=[],videoIdList,school_id,category_id=-1){
    try{
        await client.query("BEGIN")
        var result
        if (category_id==-1){
            result = await client.query("insert into board (post_id,user_id,post_title,post_body,post_time,comment_count,like_count,post_view,board_type_id,category_id,school_id) values \
            (default, $1, $2, $3, default,0,0,0,(select board_type_id from board_type where board_type_name = $4),(select category_id from category where category_name = $5 and school_id = $6),$6) \
            returning *",[user_id,post_title,post_body,board_type,NO_CATEGORY_NAME,school_id])
        }else{
            result = await client.query("insert into board (post_id,user_id,post_title,post_body,post_time,comment_count,like_count,post_view,board_type_id,category_id,school_id) values \
            (default, $1, $2, $3, default,0,0,0,(select board_type_id from board_type where board_type_name = $4),$5,$6) \
            returning *",[user_id,post_title,post_body,board_type,category_id,school_id])
        }
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
            await client.query("insert into board_like (post_id,user_id) values ($1, $2)",[post_id,user_id])
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


async function editPost(post_id,post_body){
    try{
        await client.query("BEGIN")
        await client.query("update board set post_body=$1,is_edit=true where post_id=$2",[post_body,post_id])
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute editPost"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

//완료
router.post("/editPost",async function(req,res){
    console.log("editPost is called") 
    const {post_body,post_id,token}=req.body
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        await editPost(post_id,post_body).then(res.send(JSON.stringify({results:{isSuccess:true}})))
    }else{
        res.send(JSON.stringify({results:{isSuccess:true}}))
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
            urlList.push(obj.url)
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


async function userSelectCategoryList(user_info_id,school_id){
    try{
        const results = await client.query(" \
        select cc.category_id,cc.category_name,cc.category_type,cc.category_abbreviation from category cc left join user_select_category usc on usc.category_id = cc.category_id \
        where category_enable = true and \
        case \
            when (select category_id from user_select_category where user_info_id = $1 limit 1) is null then school_id = $2 and category_type='common'\
            else usc.user_info_id = $1 \
        end group by cc.category_id order by cc.category_order",[user_info_id,school_id])
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




async function updateUserSelectCategory(user_info_id,categoryIdList){
    try{
        await client.query("BEGIN")
        await client.query("delete from user_select_category where user_info_id = $1",[user_info_id])
        for(category_id of categoryIdList){
            
            await client.query("insert into user_select_category values \
            (default,$1,$2)",[user_info_id,category_id])
        }
        await client.query("COMMIT")
    }catch(ex){
        console.log("Failed to execute updateUserSelectCategory"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function requestAddCategory(user_info_id,category_name,requestBody=''){
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




//완료
router.post("/requestAddCategory",async function(req,res){
    const {token,category_name,requestBody} = req.body
    if(tk.decodeToken){
        const tmp = jwt.verify(token,SECRET_KEY)
        await requestAddCategory(tmp.user_info_id,category_name,requestBody).then(res.send(JSON.stringify({results:{isSuccess:true}})))
    }
    
})

//완료
router.post("/userSelectCategoryList",async function(req,res){
    const {token} = req.body
    if(tk.decodeToken){
        const tmp = jwt.verify(token,SECRET_KEY)
        const categories = await userSelectCategoryList(tmp.user_info_id,tmp.school_id)
        res.send(JSON.stringify({results:categories}))
    }
    
})

router.post("/updateUserSelectCategory",async function(req,res){
    const {token,categoryIdList,user_id} = req.body
    if (typeof token =='undefined'){
        const result = await client.query("select * from user_info where user_id=$1",[user_id])
        await updateUserSelectCategory(result.rows[0].user_info_id,categoryIdList).then(res.send(JSON.stringify({results:{isSuccess:true}})))
    }else{
        if(tk.decodeToken(token)){
            const tmp = jwt.verify(token,SECRET_KEY)
            await updateUserSelectCategory(tmp.user_info_id,categoryIdList).then(res.send(JSON.stringify({results:{isSuccess:true}})))
        }
    }
    
    
    
})

//완료
router.post("/getUploadSignedUrls",async function(req,res){
    const {contentTypes,token,post_id} = req.body
    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)
        const urls = await getUploadSignedUrls(contentTypes,temp.user_info_id,post_id)
        res.send(JSON.stringify({results:{urls:urls}}))
    }
    
    
    
})





//완료
router.post("/deletePost",async function(req,res){
    console.log("deletePost is called")
    const {post_id} = req.body
    await deletePost(post_id).then(res.send(JSON.stringify({results:{isSuccess:true}})))
    
})



//완료
router.post("/addPost",async function(req,res){
    console.log("addPost is called")
    const {board_type,post_title,post_body,token,category_id,imageInfoList} = req.body



    if(tk.decodeToken(token)){
        var temp = jwt.verify(token,SECRET_KEY)

        const videoIdList=getVideoIdList(post_body)
        console.log(imageInfoList)
        const post_id = await addPost(board_type,post_title,post_body,temp.user_id,imageInfoList,videoIdList,temp.school_id,category_id)
        userRecord.insertUserActivity(temp.user_info_id,"post")
        res.send(JSON.stringify({results:{isSuccess:true,post_id:post_id}}))
        
    }else{
        var result = JSON.stringify({results:{isSuccess:false}})
        res.send(result)
    }
})


//완료
router.post("/addPostViewCount",async function(req,res){
    console.log("addPostViewCount is called")
    const {post_id} = req.body
    await addPostViewCount(post_id).then(res.send(JSON.stringify({results:{isSuccess:true}})))
})

//완료
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
    

    const result = await client.query("select ui.*,rc.code,u.school_name from user_info as ui left join recommendation_code as rc on ui.user_info_id = rc.user_info_id left join university as u on u.school_id = ui.school_id order by user_info_id desc")
    var text = result.rows.length.toString()+'<br/>'
    for(var i =0;i<result.rows.length;i++){
        text = text+'<b>'+result.rows[i].user_id+'</b>'+' : '+ result.rows[i].user_email+'   /  '+ result.rows[i].code+'   /  '+ result.rows[i].school_name+'<br/>'+'<br/>'
        
    }
    res.send(text)
})

router.get("/log",async function(req,res){
    

    const result = await client.query("select * from user_activity left join user_info ui on user_activity.user_info_id = ui.user_info_id order by user_activity_id")
    var text = result.rows.length.toString()+'<br/>'
    for(var i =0;i<result.rows.length;i++){
        text = text+'<b>'+result.rows[i].user_id+'</b>'+' : '+ result.rows[i].user_activity_type+'   /  '+ result.rows[i].user_activity_time+'<br/>'+'<br/>'
        
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

router.get("/addPostPage",async function(req,res){
    res.sendFile(__dirname + '/addPostPage.html');
})

router.get("/dau",async function(req,res){
    

    const result = await client.query("select count(a),a as day from \
    (select user_info_id,to_char(user_activity_time, 'YYYY-MM-DD') as a from user_activity \
    group by user_info_id,a) as tmp \
    group by a \
    order by a desc")
    var text = ""
    for(var i =0;i<result.rows.length;i++){
        text = text+'<b>'+result.rows[i].day+'</b>'+' : '+ result.rows[i].count+'<br/>'+'<br/>'
        
    }
    res.send(text)
})

router.get("/mau",async function(req,res){
    

    const result = await client.query("select count(a),a as day from \
    (select user_info_id,to_char(user_activity_time, 'YYYY-MM') as a from user_activity \
    group by user_info_id,a) as tmp \
    group by a \
    order by a desc")
    var text = ""
    for(var i =0;i<result.rows.length;i++){
        text = text+'<b>'+result.rows[i].day+'</b>'+' : '+ result.rows[i].count+'<br/>'+'<br/>'
        
    }
    res.send(text)
})

module.exports = router;