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
var btoa = Cu.import("resource://services-sync/log4moz.js").btoa;

function install(data, reason) {
  Services.prompt.alert(null, "install()", "installing");

  // Get Sync set up.
  let accountfile = FileUtils.getFile("ProfD", ["sync-data.json"]);
  if (!accountfile.exists()) {
    Services.prompt.alert(null, "setting up observer", "Obs.add");
    // Register "sync-complete" observer 
    Weave.Svc.Obs.add("weave:service:setup-complete", function onSyncFinish() {
      Services.prompt.alert(null, "SETUP-COMPLETE", "passphrase:");
      Services.prompt.alert(null, "passphrase", Weave.Service.passphrase);

      // TODO rename profile; can't do at runtime, clone and copy later

      // Store creds for sync in profile.
      let username = Weave.Service.username;
      let usernameHash = Utils.sha1Base32(username.toLowerCase()).toLowerCase();
      let passwd = Weave.Service.password;
      let synckey = Weave.Service.passphrase;
      Services.prompt.alert(null, "testing btoa", btoa("hello"));
      Services.prompt.alert(null, "Username:" + username, "btoa: " + btoa(usernameHash + ":" + passwd));

      Services.prompt.alert(null, "storing creds", "(creds)");
      let userObj = {"usernameHash" : usernameHash,
        "userpassHash" : btoa(usernameHash + ":" + passwd),
        "synckey" : synckey};
      Services.prompt.alert(null, "userobj","userobj");
      let userJson = JSON.stringify(userObj);
      Services.prompt.alert(null, "stringify, then write", userJson);
      writeToFile(accountfile, userJson);

//      // Store sync key on sync key server.
//      let client = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
//      client.open("GET", "https://auth.services.mozilla.com/user/1.0/" + usernameHash + "/node/weave");
//
//      dump("setting handler\n");
//      // Handler for success in sync node request
//      client.onreadystatechange = function handler() {
//        dump("state:" + this.readyState + "/status:" + this.status + "/statusText:" + this.statusText + "\n");
//
//        if (this.readyState == 2 && this.status == 404) {
//          alert("Username does not exist. Please try 'Create Account'.");
//        } else if (this.readyState == 4 && this.status == 200) {
//          let server = client.responseText;
//
//          // Handler to authenticate against the server node.
//          client.onreadystatechange = function handler1() {
//            dump("state:" + this.readyState + "/status:" + this.status + "/statusText:" + this.statusText + "\n");
//            if (this.readyState == 4) {
//              switch(this.status) {
//                case 200: // Success!
//                  break;
//                case 401: // Unauthorized
//                  break;
//                default:
//                  alert("Error: " + this.statusText);
//              }
//            }
//          };
//          let wbo = {"id" : usernameHash, "payload" : synckey};
//          client.open("PUT", server + "1.0/" + usernameHash + "/storage/keyescrow/key\n");
//          client.setRequestHeader("Authorization", "Basic " + btoa(usernameHash + ":" + passwd));
//          client.send();
//        }
//      };
//      client.send();
//
//  });
  }
}

function startup(data, reason) {
  Services.prompt.alert(null, "startup()", "startup");
  Services.prompt.alert(null, "btoa", btoa("hello"));
  // Start up sync if sync key is stored.
  let accountfile= FileUtils.getFile("ProfD", ["sync-data.json"]);
  if (accountfile.exists()) {
    let userObj = JSON.parse(readFromFile(accountfile)[0]);
    let synckey = userObj["synckey"];
    if (synckey != undefined) {
      Services.prompt.alert(null, "Sync Key", synckey);
    } else {
      Services.prompt.alert("null", "no sync key", "none");
    }
  }
}

function shutdown(data, reason) {}

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
  // TODO does not append! overwrites for some reason!
  var ostream = FileUtils.openSafeFileOutputStream(file,
                   FileUtils.MODE_CREATE | FileUtils.MODE_WRONLY | FileUtils.MODE_APPEND);
  var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                     createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var istream = converter.convertToInputStream(data);
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (!Components.isSuccessCode(status)) {
      Services.prompt.alert(null, "error writing","error writing");
    }
    Services.prompt.alert(null, "done writing", "done writing");
  });
}
