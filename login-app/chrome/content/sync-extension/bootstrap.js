const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://services-sync/main.js");

function install(data, reason) {
  Services.prompt.alert(null, "install()", "installing");

  // Get Sync set up.
  let accountfile = FileUtils.getFile("ProfD", ["sync-data.json"]);
  if (accountfile.exists()) { // imported user
    // Fetch sync data using creds.
    Services.prompt.alert(null, "user exists", "user exists");
  } else {
    Services.prompt.alert(null, "setting up observer", "Obs.add");
    // Register "sync-complete" observer 
    Weave.Svc.Obs.add("weave:service:setup-complete", function onSyncFinish() {
      Services.prompt.alert(null, "SETUP-COMPLETE", "passphrase:");
      Services.prompt.alert(null, "passphrase", Weave.Service.passphrase);
      let username = Weave.Service.username;
      let usernameHash = Utils.sha1Base32(username.toLowerCase()).toLowerCase();
      let passwd = Weave.Service.password;
      let synckey = Weave.Service.passphrase;
      Services.prompt.alert(null, "Username:" + username, "passwd: " + passwd + "/" + synckey);

      // Store creds for sync in profile.
      Services.prompt.alert(null, "storing creds", "creds");
      let userObj = {"usernameHash" : usernameHash,
        "userpassHash" : btoa(usernameHash + ":" + passwd),
        "synckey" : synckey};
      let userJson = JSON.stringify(userObj);
      dump("stringify: " + userJson + "\n");
      writeToFile(accountfile, userJson);

      // Rename profile
      let profileService = Cc["@mozilla.org/toolkit/profile-service;1"].
                              createInstance(Ci.nsIToolkitProfileService);
      profileService.getSelectProfile.name = username;
      profileService.flush();
      Services.prompt.alert(null, "dumped profile", username);

    });
  }
}

function startup(data, reason) {
  Services.prompt.alert(null, "startup()", "startup");
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
    ostream.close();
  });
}
