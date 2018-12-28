var ipc=require('node-ipc');
var process=require('process');

// ssh-askpass erzatz for nasMenu

ipc.config.id = 'nasMenu';
ipc.config.retry = 1000;
ipc.config.silent = true; 

ipc.connectTo('nasMenu',() => {
  ipc.of.nasMenu.on('connect',() => {
    
    ipc.of.nasMenu.emit('app.message', // send key
      {message: process.argv[2]!=undefined?process.argv[2]:""});
      });
      
    ipc.of.nasMenu.on('app.message', (d) => {
      process.stdout.write(d.message); // output password
      process.exit(0);
      });
    });
