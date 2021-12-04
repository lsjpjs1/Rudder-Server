const express = require('express')
const router = express.Router()
const client = require("./database");
const tk = require("./tokenhandle")
process.env.TZ='Asia/Tokyo'
async function courseSearch(searchContents,selectedSchool,selectedCredit,user_info_id,language){
    try{
        await client.query("BEGIN")
        const tmp = "%"+searchContents+"%";
        selectedSchool = "%"+selectedSchool+"%";
        if(selectedCredit==''){
            results = await client.query("SELECT * from course where (course_name ilike $1 or professor ilike $1 or course_name_japan ilike $1 or professor_japan ilike $1) and school like $2",[tmp,selectedSchool])
        }else{
            results = await client.query("SELECT * from course where (course_name ilike $1 or professor ilike $1 or course_name_japan ilike $1 or professor_japan ilike $1) and school like $2 and course_credit = $3",[tmp,selectedSchool,parseInt(selectedCredit)])
        }
        const isVerified = await client.query("SELECT user_verified from user_info where user_info_id = $1",[user_info_id])
        var courseList = new Array()
        for(i=0;i<results.rows.length;i++){
            var data = new Object()
            data.course_id = results.rows[i].course_id
            data.course_name = results.rows[i].course_name
            data.course_start = results.rows[i].course_start
            data.professor = results.rows[i].professor
            data.course_credit = results.rows[i].course_credit
            data.school = results.rows[i].school
            data.course_code = results.rows[i].course_code
            data.course_year = results.rows[i].course_year
            if(language=='e'){
                data.course_name = results.rows[i].course_name
                data.course_start = results.rows[i].course_start
                data.professor = results.rows[i].professor
                data.school = results.rows[i].school
            }else if(language=='j'){
                data.course_name = results.rows[i].course_name_japan
                data.course_start = results.rows[i].course_start_japan
                data.professor = results.rows[i].professor_japan
                data.school = results.rows[i].school_japan
            }
            if(user_info_id==5000000){
                data.isVerified=true
            }else{
            data.isVerified=isVerified.rows[0].user_verified 
            }
            courseList.push(data)
        }
        var jsonData = JSON.stringify(courseList)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function favoriteCourseSearch(user_info_id,language){
    try{
        await client.query("BEGIN")
        favoriteResult = await client.query("SELECT * from user_favorite where user_info_id=$1",[user_info_id])
        var courseList = new Array()
        for(i=0;i<favoriteResult.rows.length;i++){
            var data = new Object()
            
            results = await client.query("SELECT * from course where course_id=$1",[favoriteResult.rows[i].course_id])
            data.course_id = results.rows[0].course_id
            data.course_name = results.rows[0].course_name
            data.course_start = results.rows[0].course_start
            data.professor = results.rows[0].professor
            data.course_credit = results.rows[0].course_credit
            data.school = results.rows[0].school
            data.course_code = results.rows[0].course_code
            data.course_year = results.rows[0].course_year
            if(language=='e'){
                data.course_name = results.rows[0].course_name
                data.course_start = results.rows[0].course_start
                data.professor = results.rows[0].professor
                data.school = results.rows[0].school
            }else if(language=='j'){
                data.course_name = results.rows[0].course_name_japan
                data.course_start = results.rows[0].course_start_japan
                data.professor = results.rows[0].professor_japan
                data.school = results.rows[0].school_japan
            }
            courseList.push(data)
        }
        var jsonData = JSON.stringify(courseList)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}
async function reportCount(post_type,post_id){
    try{
        await client.query("BEGIN")
        const results= await client.query("select * from report_count where post_type=$1 and post_id=$2",[post_type,post_id])
        if(results.rows.length==0){
            await client.query("insert into report_count values ($1,$2,$3)",[post_type,post_id,1]) 
        }else{
            await client.query("update report_count set report_count=report_count+1 where post_type=$1 and post_id=$2",[post_type,post_id])
        }
        await client.query("COMMIT")


        const results2= await client.query("select * from report_count where post_type=$1 and post_id=$2",[post_type,post_id])
        const row = results2.rows[0]
        if(row.report_count>=5){
            await client.query("BEGIN")
            if(row.post_type=='post'){
                await client.query("update board set is_delete=true where post_id=$1",[post_id])
            }else if(row.post_type=='comment'){
                await client.query("update board_comment set is_delete=true where comment_id=$1",[post_id])
            }
            await client.query("COMMIT")
        }

    }catch(ex){
        console.log("Failed to execute reportReceive"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function reportReceive(user_id,post_id,post_type,report_body){
    try{
        await client.query("BEGIN")
        await client.query("insert into report_receive values (default,$1,$2,$3,$4)",[post_type,report_body,user_id,post_id])
        await client.query("COMMIT")
        await reportCount(post_type,post_id)

    }catch(ex){
        console.log("Failed to execute reportReceive"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function getSchoolList(school_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT school from course where school_id = $1 group by school order by school",[school_id])
        var courseList = new Array()
        for(i=0;i<results.rows.length;i++){
            if(results.rows[i].school!=""){
                courseList.push(results.rows[i].school)
            }
        }
        var jsonData = JSON.stringify(courseList)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function getCreditList(school_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT course_credit from course where school_id = $1 group by course_credit order by course_credit",[school_id])
        var courseList = new Array()
        for(i=0;i<results.rows.length;i++){
            if(results.rows[i].course_credit != null){
                courseList.push(results.rows[i].course_credit.toString())
            }
        }
        var jsonData = JSON.stringify(courseList)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}



async function reviewrender(course_id,user_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT * from review where course_id = $1 order by post_time desc",[course_id])
        var reviews = new Array()
        for(i=0;i<results.rows.length;i++){
            var data = new Object()
            var userIdResult = await client.query("SELECT * from user_info where user_info_id = $1",[results.rows[i].user_id])
            data.review_id = results.rows[i].review_id
            if(userIdResult.rows[0].user_nickname==null){
                data.user_id = userIdResult.rows[0].user_id[0]+'*****'
            }else{
                data.user_id = userIdResult.rows[0].user_nickname[0]+'*****'
            }
            
            data.review_body = results.rows[i].review_content
            data.post_time = results.rows[i].post_time
            data.assignment_score = results.rows[i].assignment_score
            data.lecture_difficulty_score= results.rows[i].lecture_difficulty_score
            data.exam_score = results.rows[i].exam_score
            data.grade_ease_score = results.rows[i].grade_ease_score
            data.satisfaction_score = results.rows[i].satisfaction_score
            data.overall_score = results.rows[i].overall_score
            if(user_id == userIdResult.rows[0].user_id){
                data.isMine = true
            }else{
                data.isMine = false
            }
            reviews.push(data)
        }
        var jsonData = JSON.stringify(reviews)
        return jsonData;
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function IsNullNickname(user_info_id){
    try{
        await client.query("BEGIN")
        const results = await client.query("SELECT * from user_info where user_info_id=$1",[user_info_id])
        if(results.rows[0].user_nickname==null){
            var jsonData = JSON.stringify({isNull:true})
            return jsonData
        }else{
            var jsonData = JSON.stringify({isNull:false})
            return jsonData
        }
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}

async function setNickname(user_info_id,nickname){
    try{
        await client.query("BEGIN")
        await client.query("update user_info set user_nickname=$1 where user_info_id=$2",[nickname,user_info_id])
        await client.query("COMMIT")
        return
    }catch(ex){
        console.log("Failed to execute signin"+ex)
        await client.query("ROLLBACK")
    }finally{
       // await client.end()
        console.log("Cleaned.") 
    }
}


router.post("/setNickname",async function(req, res){
    
    const {token,nickname}=req.body

    console.log(nickname)
    const temp = JSON.parse(await tk.decodeToken(token))
    
    
    if(JSON.parse(temp.valid)){
        const results = await client.query("select * from user_info where user_nickname=$1",[nickname])
        if(results.rows.length>0){
            res.send('duplicate')
        }else{
            await setNickname(temp.user_info_id,nickname).then(res.send(''));
        }        
        
        
    }else{
        res.send('error')
    }
    
    
    
})

router.post("/IsNullNickname",async function(req, res){
    
    const token=req.body.token

    if(token=='tempUser'){
        res.send(false);
    }else{
        const temp = JSON.parse(await tk.decodeToken(token))
        
        
            if(JSON.parse(temp.valid)){
                var result = await IsNullNickname(temp.user_info_id);
                res.send(result);
            }else{
                res.send('error')
            }
    }
    
    
    
})

router.post("/courseSearch",async function(req, res){
    const searchContents = req.body.searchContents;
    const selectedSchool = req.body.selectedSchool
    const selectedCredit = req.body.selectedCredit
    const language = req.body.language
    const token=req.body.token

    console.log(language)
    if(token=='tempUser'){
        var jsonData = await courseSearch(searchContents,selectedSchool,selectedCredit,5000000,language); //  이새끼 나중에 바꿔야함@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        res.send(jsonData);
    }else{
        const temp = JSON.parse(await tk.decodeToken(token))
        
        
            if(JSON.parse(temp.valid)){
                var jsonData = await courseSearch(searchContents,selectedSchool,selectedCredit,temp.user_info_id,language);
                res.send(jsonData);
            }else{
                res.send('error')
            }
    }
    
    
    
})

router.post("/favoriteCourseSearch",async function(req, res){
    const {token,language}=req.body
    const decodeJson = JSON.parse(await tk.decodeToken(token))
    if(decodeJson.valid){
        var jsonData = await favoriteCourseSearch(decodeJson.user_info_id,language);
        res.send(jsonData);
    }else{
        res.send('error')
    }
    
    
})

router.post("/reviewrender",async function(req,res){
    console.log("reviewrender is called")
    const course_id = req.body.course_id; 
    const token = req.body.token
    const decodeJson = JSON.parse(await tk.decodeToken(token))
    if(decodeJson.valid){
        var jsonData= await reviewrender(course_id,decodeJson.user_id);
        res.send(jsonData);
    }else{
        res.send('error')
    }
    

})

router.post("/getSchoolList",async function(req, res){
    const {school_id} = req.body;
    const token=req.body.token
    if(token=='tempUser'){
        var jsonData = await getSchoolList(school_id);
        res.send(jsonData);
    }else{
    if(JSON.parse(await tk.decodeToken(token)).valid){
        var jsonData = await getSchoolList(school_id);
        res.send(jsonData);
    }else{
        res.send('error')
    }}
    
    
})

router.post("/getAlert",async function(req, res){
    res.send("New Version Avaliable in App Store!")
    
    
})

router.post("/getCreditList",async function(req, res){
    const {school_id} = req.body;
    const token=req.body.token
    if(token=='tempUser'){
        var jsonData = await getCreditList(school_id);
        res.send(jsonData);
    }else{
    if(JSON.parse(await tk.decodeToken(token)).valid){
        var jsonData = await getCreditList(school_id);
        res.send(jsonData);
    }else{
        res.send('error')
    }}
    
    
})

router.post("/sendReport",async function(req,res){
    const token=req.body.token
    const post_id = req.body.post_id
    const report_body=req.body.report_body
    const post_type=req.body.post_type
    const decodeJson = JSON.parse(await tk.decodeToken(token))
    if(decodeJson.valid){
        await reportReceive(decodeJson.user_id,post_id,post_type,report_body).then(res.send(JSON.stringify({results:{isSuccess:true}})));
    }else{
        res.send(JSON.stringify({results:{isSuccess:false}}))
    }
    
})

router.post("/tokenValidCheck",async function(req, res){
    const token=req.body.token
    if(JSON.parse(await tk.decodeToken(token)).valid){
        res.send('true');
    }else{
        res.send('false')
    }
    
    
})

module.exports = router;