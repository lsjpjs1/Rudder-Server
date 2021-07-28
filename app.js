const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
process.env.TZ='Asia/Tokyo'
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
require('dotenv').config();
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

app.get('/test', function(req, res) {
  res.send('hello world');
});




const bodyParser = require("body-parser");


//signupin module
const signupinRouter = require('./routes/signupin')
const addreviewRouter = require('./routes/addreview')
const verifyRouter = require('./routes/schoolverify')
const discussionRouter = require('./routes/discussion')
const boardRouter = require('./routes/board')
const favoriteRouter = require('./routes/favorite')
const reviewsearchRouter = require('./routes/reviewsearch')

// const client = require("./routes/database");
// const tk = require("./routes/tokenhandle")

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get("/:name", function(req, res){
    const name = req.params.name;//위의 name과 match되어야함?np
    res.send("Welcome to Minho's web server. You added "+name+" in URL");
});
app.get("/", function(req,res){
    res.send("Welcome to Minho's node server. This server is for handling Minho's Simple Signup/login App!123");
});

app.use('/signupin',signupinRouter)
app.use('/addreview',addreviewRouter)
app.use('/schoolverify',verifyRouter)
app.use('/discussion',discussionRouter)
app.use('/favorite',favoriteRouter)
app.use('/reviewsearch',reviewsearchRouter)
app.use('/board',boardRouter)


module.exports = app;
