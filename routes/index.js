var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.writeHead(301, {
    Location: 'https://bush-thorn-7ed.notion.site/Welcome-to-UCL-s-Student-Community-be2b4d26d8904e758356522b987e0293'
  }).end();
});

module.exports = router;
