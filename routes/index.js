var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.writeHead(301, {
    Location: 'https://bush-thorn-7ed.notion.site/Rudder-05a628bb03a44097ada829222aec0603'
  }).end();
});

module.exports = router;
