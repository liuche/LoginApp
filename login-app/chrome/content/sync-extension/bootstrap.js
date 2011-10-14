const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

function addResourceAlias() {
  Cu.import("resource://gre/modules/Services.jsm");
  const resProt = Services.io.getProtocolHandler("resource")
                          .QueryInterface(Ci.nsIResProtocolHandler);
  let uri;
  uri = Services.io.newURI("resource://gre/modules/services-sync/", null, null);
  resProt.setSubstitution("services-sync", uri);
  uri = Services.io.newURI("resource://gre/modules/services-crypto/", null, null);
  resProt.setSubstitution("services-crypto", uri);
}
addResourceAlias();

Cu.import("resource://services-sync/util.js");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://services-sync/service.js");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://services-sync/main.js");

var DEBUG = true;
var btoa = Cu.import("resource://services-sync/log4moz.js").btoa;
const NEWUSER = "newuser";
var obsService= Cc["@mozilla.org/observer-service;1"].
                  getService(Ci.nsIObserverService);

let logfile = FileUtils.getFile("ProfD", ["logfile.txt"]);
let usernameHash;
let passwd;
let synckey;
let client;

/* Install function for bootstrapping.
 * 
 * Checks for user credentials in "sync-data.json".
* If doesn't exist, stores creds and sends to key escrow.
 *
 */
function install(data, reason) {
  log("installing\n");
  log("installing line 2\n");

  // New user; store user credentials.
  let accountfile = FileUtils.getFile("ProfD", ["sync-data.json"]);
  if (!accountfile.exists()) { // New user
    // Register "sync-complete" observer for a new user.
    Weave.Svc.Obs.add("weave:service:setup-complete", function onSyncFinish() {
      log("SETUP COMPLETE; passphrase:" + Weave.Service.passphrase + "\n");

      usernameHash = Weave.Service.username;
      passwd = Weave.Service.password;
      synckey = Weave.Service.passphrase;

      client = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

      // Test observer
      obsService.addObserver(testPutObs, "login:PUT:ok", false);
      // Store creds on sync escrow.
      // Determine sync server node and get authenticated.
      log("start: getting node\n");
      client.open("GET", "https://auth.services.mozilla.com/user/1.0/" + usernameHash + "/node/weave\n");
      log("GET, https://auth.services.mozilla.com/user/1.0/" + usernameHash + "/node/weave\n");
      // Add observer to start PUT
      obsService.addObserver(putObs, "login:http:ok", false);
      // Handler for success in sync node request
      client.onreadystatechange = function () {
        log("statechange: " + this.readyState + " " + this.status + "\n");
        if (this.readyState == 4 && this.status == 200) {
          // success
          log("notifying " + this.readyState + " " + this.status + " " + this.responseText + "\n");
          obsService.notifyObservers(null, "login:http:ok", this.responseText);
          log("notified; " + this.readyState + " " + this.status + " " + this.responseText + "\n");
        } else if (this.readyState == 4 && this.status == 0) {
          // HACK TODO: fix
          // server doesn't store user data fast enough
          Weave.Svc.Obs.notify("weave:service:setup-complete");
        }
      }
      client.send();
      log("sent SERVER-GET\n");
    });
  }
}
// Observer functions
function testPutObs(subject, topic, data) {
        log("testing PUT, sending GET...\n");
        client.open("GET", data + "1.1/" + usernameHash + "/storage/keyescrow/key\n\n");
        log(data + "1.1/" + usernameHash + "/storage/keyescrow/key\n");
        client.setRequestHeader("Authorization", "Basic " + btoa(usernameHash + ":" + passwd));
        client.setreadystatechange(function() {
          log("handler for PUT check (GET):" + this.readyState + "/" + this.responseText + "\n");
        });
        client.send();
        log("sent PUT-GET\n");
}
function putObs(subject, topic, data){
          log("starting PUT\n");
          log("server:" + data + " usernameHash:" + usernameHash + "\n");
          client.open("PUT", data + "1.1/" + usernameHash + "/storage/keyescrow/key\n");
          client.setRequestHeader("Authorization", "Basic " + btoa(usernameHash + ":" + passwd));
          let wboJson = JSON.stringify({
            "id":"key",
            "payload": synckey
          });
          log("wboJson: " + wboJson + "\n");
          client.onreadystatechange = function() {
            log("PUT:statechange : " + this.readyState + " " + this.status + " " + this.responseText + "\n");
            if (this.readyState == 4 && this.status == 200) {
              log("notifying PUT-check\n");
              obsService.notifyObservers(null, "login:PUT:ok", data);
            }
          };
          log("sending wboJson\n");
          client.send(wboJson);
}
function startup(data, reason) {
  // Start up sync if sync key is stored.
  let accountfile = FileUtils.getFile("ProfD", ["sync-data.json"]);
  if (accountfile.exists()) {
    let userObj = JSON.parse(readFromFile(accountfile)[0]);
    let synckey = userObj["synckey"];
    if (synckey != undefined) {
      Services.prompt.alert(null, "Sync Key", synckey);
    } else {
      // Fetch sync key from keyescrow
      Services.prompt.alert("null", "no sync key", "none");
    }
  }
}

function shutdown(data, reason) {
  let profileService = Cc["@mozilla.org/toolkit/profile-service;1"]
                                .createInstance(Ci.nsIToolkitProfileService);
  if (profileService.selectedProfile.name == NEWUSER) {
    // TODO clone profile and rename it
  }
}

/*
 * Helper functions
 */

// Synchronous read from file
function readFromFile(file) {
  let istream = Cc["@mozilla.org/network/file-input-stream;1"].
                   createInstance(Ci.nsIFileInputStream);
  istream.init(file, 0x01, 0444,0);
  istream.QueryInterface(Ci.nsILineInputStream);
  dump("reading\n");

  let line = {}, lines = [], hasmore;
  do {
    hasmore = istream.readLine(line);
    dump("line:" + line.value + "\n");
    lines.push(line.value);
  } while(hasmore);
  istream.close();
  dump("done reading\n");
  return lines;
}

// Writes data to file.
function writeToFile(file, data) {
  var ostream = FileUtils.openFileOutputStream(file, FileUtils.MODE_APPEND | FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE);
  var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                     createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var istream = converter.convertToInputStream(data);
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (!Components.isSuccessCode(status)) {
      Services.prompt.alert(null, "error writing","error writing");
    }
  });
}

function log(data) {
  if (DEBUG) writeToFile(logfile, data);
}

