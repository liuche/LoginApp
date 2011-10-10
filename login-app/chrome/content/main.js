const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

// Register resource aliases. Sadly these lines in the manifest wouldn't work:
// resource services-sync resource://gre/modules/services-sync
// resource services-crypto resource:/gre/modules/services-crypto
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

let profileService = Cc["@mozilla.org/toolkit/profile-service;1"]
                                .createInstance(Ci.nsIToolkitProfileService);
let prefs = Cc["@mozilla.org/preferences-service;1"]
              .getService(Ci.nsIPrefBranch);

// Global variables.
const GUEST_ACCT = "guest";
const NEW_ACCT = "newuser";
// hardcoded FF location (for now)
const DEFAULT_FF = "/Applications/Nightly.app/Contents/MacOS/firefox-bin";
//const DEFAULT_FF = "/Applications/Firefox.app/Contents/MacOS/firefox-bin";
const EXT_ID = "sync-setup@ff-login.com.xpi";

let accounts = [];

// Load imported accounts into UI, during startup. 
function loadAccounts() {
  let accountsfile = FileUtils.getFile("ProfD", ["data", "accounts.txt"]);
  if (accountsfile.exists()) {
    accounts = readFromFile(accountsfile);
  }
  dump("accounts:" + accounts + "\n");
}

// Guest Login
function guestLogin() {
  // Delete old guest profile, if it exists.
  let guestAcct;
  try {
    guestAcct = profileService.getProfileByName(GUEST_ACCT);
    guestAcct.remove(true);
  } catch(e){
    dump("guest account does not exist\n");
  }
  guestAcct = profileService.createProfile(null, null, GUEST_ACCT);
  dump("path:");
  dump(guestAcct.localDir.path + " " + guestAcct.rootDir.path + "\n");
  profileService.flush();
  launchAccount(guestAcct);
}

// Username/password login
function userLogin() {
  dump("loggin in\n");
  let username = document.getElementById("username-input").value;
  loadAccounts();

  // Authenticate against sync account.
  dump("authing...\n");
  let usernameHash = Utils.sha1Base32(username.toLowerCase()).toLowerCase();
  let passwd = document.getElementById("password-input").value;

  // Determine sync server node and get authenticated.
  let client = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
  client.open("GET", "https://auth.services.mozilla.com/user/1.0/" + usernameHash + "/node/weave");

  dump("setting handler\n");
  // Handler for success in sync node request
  client.onreadystatechange = function handler() {
    dump("state:" + this.readyState + "/status:" + this.status + "/statusText:" + this.statusText + "\n");

    if (this.readyState == 2 && this.status == 404) {
      alert("Username does not exist. Please try 'Create Account'.");
    } else if (this.readyState == 4 && this.status == 200) {
      let server = client.responseText;

      // Handler to authenticate against the server node.
      client.onreadystatechange = function handler1() {
        dump("state:" + this.readyState + "/status:" + this.status + "/statusText:" + this.statusText + "\n");
        if (this.readyState == 4) {
          switch(this.status) {
            case 200: // Success!
              if (accounts.indexOf(username) == -1) { // account does not exist locally
                dump("login importing\n");
                importAccount(username);
                dump("login done importing\n");
              }
              let userProfile = profileService.getProfileByName(username);
              dump("launching profile " + userProfile.name + "\n");
              launchAccount(userProfile);
              break;
            case 401: // Unauthorized
              alert("Incorrect Password");
              break;
            default:
              alert("Error: " + this.statusText);
          }
        }
      };
      client.open("GET", server + "1.1/" + usernameHash + "/info/collections\n");
      client.setRequestHeader("Authorization", "Basic " + btoa(usernameHash + ":" + passwd));
      client.send();
    }
  };
  client.send();
}

// Creates an account
function createAccount() {
  dump("creating profile...\n");
  let newProfile = profileService.createProfile(null, null, NEW_ACCT);
  profileService.flush();

  // Copy xpi to new profile's extensions
  let xpifile = FileUtils.getFile("AChrom", ["content","sync-extension", EXT_ID]);
  let dest = Cc["@mozilla.org/file/local;1"].
                createInstance(Ci.nsILocalFile);
  dest.initWithPath(newProfile.rootDir.path);
  dest.append("extensions");
  xpifile.copyTo(dest, null);

  launchAccount(newProfile, true);
}

// Adds an account and writes it to file so it will be loaded next time.
function importAccount(username) {
  // Create profile for user.
  let userProfile = profileService.createProfile(null, null, username);
  profileService.flush();

  accounts.push(username);

  let accountsfile = FileUtils.getFile("ProfD", ["data", "accounts.txt"]);
  dump(accountsfile + "\n");
  writeToFile(accountsfile, username + "\n");

  // Write username/sync-key to JSON, for fetching sync key.
  let userpassfile = Cc["@mozilla.org/file/local;1"].
                createInstance(Ci.nsILocalFile);
  dump("create instance\n");
  userpassfile.initWithPath(userProfile.rootDir.path);
  dump("exists:" + userpassfile.exists() + "\n");
  dump("init sync-data.json\n");
  userpassfile.append("sync-data.json");
  let usernameHash = Utils.sha1Base32(username.toLowerCase()).toLowerCase();
  let passwd = document.getElementById("password-input").value;

  let userObj = {"usernameHash" : usernameHash,
    "userpassHash" : btoa(usernameHash + ":" + passwd)};
  let userJson = JSON.stringify(userObj);
  dump("stringify: " + userJson + "\n");
  writeToFile(userpassfile, userJson);

  // Copy xpi to new profile's extensions
//
  dump("copying xpi\n");
  let xpifile = FileUtils.getFile("AChrom", ["content","sync-extension", EXT_ID]);
  let dest = Cc["@mozilla.org/file/local;1"].
                createInstance(Ci.nsILocalFile);
  dest.initWithPath(userProfile.rootDir.path);
  dest.append("extensions");
  dump("xpi dest: " + dest.path + "\n");
  xpifile.copyTo(dest, null);
  dump("sent copy request\n");
}

// Starts selected profile in a separate Firefox profile.
function launchAccount(profile, create) {
  // locate Firefox 
  let ffFile;
  dump("locating ff\n");
  try {
    // TODO not the best way to load files. prolly. 
    ffFile = Cc["@mozilla.org/file/local;1"].
                createInstance(Ci.nsILocalFile);
    ffFile.initWithPath(DEFAULT_FF);
  } catch(e) {
    dump("error:" + e + ":" + DEFAULT_FF);
  }

  // Launch Firefox process with profile.
  let processargs = ["-profile", profile.rootDir.path];
  if (create) {
    processargs.push("-chrome");
    processargs.push("chrome://browser/content/syncSetup.xul");
  }
  let process = Cc["@mozilla.org/process/util;1"].
                   createInstance(Ci.nsIProcess);
  try {

    process.init(ffFile);
    process.run(false, processargs, processargs.length);

  } catch(e) {
    dump("ERROR starting process! " + e + "\n");
  }
  dump("finished starting process\n");
}

/*
 * Helper Functions
 */

// Writes data to file.
function writeToFile(file, data) {
  dump("starting write\n");
  // TODO does not append! overwrites for some reason!
  var ostream = FileUtils.openSafeFileOutputStream(file,
                   FileUtils.MODE_CREATE | FileUtils.MODE_WRONLY | FileUtils.MODE_APPEND);
  var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                     createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var istream = converter.convertToInputStream(data);
  dump("writing\n");
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (!Components.isSuccessCode(status)) {
      dump("error writing\n");
    }
    dump("finished writing\n");
  });
}

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

function test() {
  let thisProfile = profileService.selectedProfile;
  dump("This profile: ");
  dump(thisProfile.name + "\n");
  dump("testing JSON\n");
  let obj = {"username":"user1"};
  let jObj = JSON.stringify(obj);
  dump("obj:" + jObj + "\n");
  var unjObj = JSON.parse(jObj);
  dump(unjObj["username"] + "\n");
  dump("testing write\n");
  let file = FileUtils.getFile("ProfD", ["data", "test.json"]);
  dump("got file\n");
  writeToFile(file, jObj);

//  dump("written...now testing:\n");
//
//  let infile = FileUtils.getFile("ProfD", ["data", "test.json"]);
//  let readStr = readFromFile(infile);
//  dump("readStr: " + readStr + "\n");
//  if (readStr != null) {
//    dump("read:" + readStr + "\n");
//    let outjson = JSON.parse(readStr[0]);
//    dump("username:" + outjson["username"] + "\n");
//  }
//  dump("done reading\n");
}
