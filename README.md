# nasMenu

### TL;DR
The small screens for the RPi are not great to navigate a desktop. This is a very basic HTTP UI that can run scripts, view logs, show status, and provides an ssh-askpass erzatz.

### Assumptions
* The askpass and httpd user are the same. (The posix Unix Domain Sockets spec, used here for IPC, does not provide ways to limit access to a group.)
* Each usage of askpass will have an arbitrary key name argument e.g.(node nasMenu-askpass.js "keyname")
    * Each key name will be associated with ONLY one use case
* The browser will handle askpass key management
* The server/client run on localhost
* Each status script will print only one line of text and return a value
* The UI is optimized for a landscape 480x320 screen (modify css if needed)
* You know how to set up your screen, use node & npm

### Node Modules Used
node-ipc express file-set fs

### Howto
In my case user pi is autologged-in and nasMenu is cloned into /home/pi/bin/nasmenu .

Modify .config/lxsession/LXDE-pi/autostart to start the server and chrome with something like:
```bash
cd /home/pi/bin/nasmenu
node server.js &
# If you want the browser to store your keys, start one time without --incognito
chromium-browser --app=http://localhost:8080 --start-fullscreen --incognito --disable-extensions --disable-plugins &
```
A typical argument for askpass would look like:
```
/usr/bin/node /home/pi/bin/nasmenu/nasMenu-askpass.js myEncryption program
```

Modify the config file

### Caveats
With the above invocation of chromium, the UI takes around 40mb.  Further savings could be realized by removing LXDE and making a bespoke X session just for the browser.

Neither the IPC or HTTP is encrypted.  That said, both are bound to the local host by default and are therefore as safe as the Pi itself.  If your box is uncompromised, has only the default 'pi' account, and you don't bind HTTP to the public IP, I am not aware of any security risk.

 
