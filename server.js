var express = require('express');
var fileset = require('file-set');
// var path = require('path');
var fs = require('fs');
var spawnSync = require('child_process').spawnSync, child;

// Assumptions:
// each usage of askpass will have an arbitrary key name argument e.g.(node client-askpass "keyname")
// each key name will be associated with ONLY one use case
// the browser will handle key management
// you are running the server/client on localhost
// each status script will print only one line of text and return a value
// it will be used for a landscape 480x320 screen (modify css if needed)

//
// IPC or askpass erzatz
//

const ipc=require('node-ipc');

ipc.config.id = 'nasMenu';
ipc.config.retry= 1500;

var pwKeyQueue = []; // keys polled from HTML interface
var pwObjQueue = []; // obj waiting till pwd sent from HTML interface

ipc.serve(function(){
        ipc.server.on('app.message', function(data,socket){
            pwObjQueue.push({key:data.message, socket:socket, tstamp:new Date().getTime()});
            pwKeyQueue.push({key:data.message});
            // ipc.server.emit(socket, 'app.message', {
            //     message : data.message
            //     });
            });
    });

ipc.server.start();
//setTimeout(ipc.server.start, 10000);


//
// express server
//

var app = express();

/*
 * onscreen keyboard
 * add config options: timeout to [page], bin: timeout, sig, ip, port
    * bin and status should be same - status has timer property, both have timeout & sig
 
 * use glob instead of fileset
 * icons
 * external config file 
 * - rotating div for sideways on rpi - or https://www.raspberrypi-spy.co.uk/2017/11/how-to-rotate-the-raspberry-pi-display-output/
 
 * X localhost only
 * X stop timer when modal up
 * X timeout to Status
 * X add name to placeholder
 * X delete all older objects
 * X turn on screen when pwd appears
 * X style UI for tiny screen
 * X binOutput errors formatted wrong
 * - count warnings in "Pages" button
 * */

var startPg = "Logs";
var fileChunkSz = 100;
// var orientation;

// var rowTemplate = '<span class="box box-info"><span class="box-content">{}</span></span>'

var config = [
  {name:"Status", type:"status", location:"data/status/*",  buttons:"run"},
  {name:"Logs", type:"file", location:['/home/ich/Desktop/UnEncrypted/logs/*.err', "data/logs/*"],  buttons:"del"},
  //~ {name:"Passwords", type:"password",  buttons:"del,reply"},
  {name:"Commands", type:"bin", location:"data/bin/*",  buttons:"run", timeout:5000, signal:9},
];

// send next request key for password
app.get('/passpoll', function (req, res) {
  var key = pwKeyQueue.pop();
  if (key!=undefined) // assume the modal will show.  unblank screen.
    spawnSync("xset", [ 'dpmi', 'force', 'on'], {shell:true, env:{DISPLAY:':0'}});
  res.send(key==undefined?"":key);
});

// send next request key for password
app.get('/passset', function (req, res) {
  console.log(req.query);
  if ('key' in req.query && 'psw' in req.query) {
    var changed = false;  
    
    pwObjQueue = pwObjQueue.reverse().filter((d) => { // if multiple, answer last, first
      var rv = d.key == req.query.key;
      if (changed && !pwKeyQueue.includes(d.key)) return false; // del older unqueued requests
      if (!changed && rv) {
        ipc.server.emit(d.socket, 'app.message', {
            message : req.query.psw
            });
        changed = true;
        }
      return (rv);
      }); 
  }

});

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
  if (! file.includes(fpath)) {res.send("FILE_DOES_NOT_EXIST"); return;}
  
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

  if (fpath == undefined) {res.send(JSON.stringify({type: confObj.type, data:{cmd:fpath, stdio:"BAD_FPATH", status:-1}})); return;}
  
  var confObj = config.filter(d => {return d.name == pgName;})[0];
  if (confObj == undefined || !(confObj.type == "bin" || confObj.type == "status")) {res.send(JSON.stringify({cmd:fpath, stdio:"BAD_PGNAME", status:-1})); return;}

  var file = new fileset(confObj.location).files;
  if (! file.includes(fpath)) {res.send(JSON.stringify({type: confObj.type, data:{cmd:fpath, stdio:"FILE_DOES_NOT_EXIST", status:-1}})); return;}
  
  const rv = spawnSync(fpath, {shell:true, timeout:confObj.timeout, encoding:"utf8"}); // max 5 sec to run
  var output = {cmd:fpath, stdio:rv.output.join(""), status:rv.status};
  res.send(JSON.stringify({type: confObj.type, data:output}));
});

//~ app.get('/', function (req, res) {
  //~ res.send('Hello World');
//~ });

app.use(express.static('public'));

var host='localhost';
var server = app.listen(8080, host, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("Server: http://%s:%s", host, port);
});

