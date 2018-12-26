var express = require('express');
var fileset = require('file-set');
// var path = require('path');
var fs = require('fs');
var spawnSync = require('child_process').spawnSync, child;

var app = express();

/*
 * localhost only
 * icons
 * onscreen keyboard
 * use glob instead of fileset
 * binOutput errors formatted wrong
 * bin and status should be same - status has timer property, both have timeout & sig
 * count warnings
 * */

var startPg = "Status";
var fileChunkSz = 100;
var orientation;

rowTemplate = '<span class="box box-info"><span class="box-content">{}</span></span>'

config = [
  {name:"Status", type:"status", location:"data/status/*",  buttons:"run"},
  {name:"Logs", type:"file", location:['/home/ich/Desktop/UnEncrypted/logs/*.err', "data/logs/*"],  buttons:"del"},
  {name:"Passwords", type:"password",  buttons:"del,reply"},
  {name:"Commands", type:"bin", location:"data/bin/*",  buttons:"run", timeout:5000, signal:9},
  //~ {name:"Output", type:"buffer",  buttons:"del"},
  {name:"Events", type:"buffer",  buttons:"del"}
];

// sends start page
app.get('/pgstart', function (req, res) {
  res.send(startPg);
});

// sends page names
app.get('/pgnames', function (req, res) {
  var names = config.map(d => { return d.name; });
  res.send(JSON.stringify(names));
});

// sends list of files in dir for page
app.get('/filelist', function (req, res) {
  var pgName = req.query.pgname;
  var confObj = config.filter(d => {return d.name == pgName;})[0];
  
  // no or bad name key
  if (confObj == undefined) {res.send(JSON.stringify(["BAD_NAME_KEY"])); return;}
  
  if (confObj.type == "file" || confObj.type == "bin" || confObj.type == "status") {
    var files = new fileset(confObj.location).files;
    res.send(JSON.stringify({type: confObj.type, data:files}));
  }
});

// sends chunk of a file - for load on demand of large logs
app.get('/fileOutput', function (req, res) {
  var pgName = req.query.pgname;
  var fpath = req.query.fpath;
  var start = parseInt(req.query.start);

  if (fpath == undefined) {res.send("BAD_FPATH"); return;}
  if (isNaN(start)) {start = 0}
  
  var confObj = config.filter(d => {return d.name == pgName;})[0];
  if (confObj == undefined || confObj.type != "file") {res.send("BAD_PGNAME"); return;}

  var file = new fileset(confObj.location).files;
  if (! file.includes(fpath)) {res.send("FILE_DOES_NOT_EXIST"); return;};
  
  fs.open(fpath, 'r', function(err, fd) {
    var buf = Buffer.alloc(fileChunkSz);  
    fs.read(fd, buf, 0, fileChunkSz, start);
    fs.close(fd);
    var output = buf.toString('utf8');
    res.send(JSON.stringify({type: confObj.type, data:output}));
  });
});

// sends output of binary
app.get('/binOutput', function (req, res) {
  var pgName = req.query.pgname;
  var fpath = req.query.fpath;

  if (fpath == undefined) {res.send(JSON.stringify({cmd:fpath, stdio:"BAD_FPATH", status:-1})); return;};
  
  var confObj = config.filter(d => {return d.name == pgName;})[0];
  if (confObj == undefined || !(confObj.type == "bin" || confObj.type == "status")) {res.send(JSON.stringify({cmd:fpath, stdio:"BAD_PGNAME", status:-1})); return;}

  var file = new fileset(confObj.location).files;
  if (! file.includes(fpath)) {res.send(JSON.stringify({cmd:fpath, stdio:"FILE_DOES_NOT_EXIST", status:-1})); return;};
  
  const rv = spawnSync(fpath, {shell:true, timeout:confObj.timeout, encoding:"utf8"}); // max 5 sec to run
  var output = {cmd:fpath, stdio:rv.output.join(""), status:rv.status};
  res.send(JSON.stringify({type: confObj.type, data:output}));
});

//~ app.get('/', function (req, res) {
  //~ res.send('Hello World');
//~ });

app.use(express.static('public'));

var server = app.listen(8080, function () {
  var host = "localhost"; // server.address().address;
  var port = server.address().port;
  console.log("Server: http://%s:%s", host, port);
});


