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
// hardcoded FF location (for now)
const DEFAULT_FF = "/Applications/Nightly.app/Contents/MacOS/firefox-bin";

let accounts = [];

// Load imported accounts into UI, during startup. 
function loadAccounts() {
  let accountsfile = FileUtils.getFile("ProfD", ["data", "accounts.txt"]);
  if (accountsfile.exists()) {
    NetUtil.asyncFetch(accountsfile, function(inputStream, status) {
      if (Components.isSuccessCode(status)) {
        accounts = NetUtil.readInputStreamToString(inputStream, inputStream.available()).split("\n");
        accounts.pop(); // last entry is ""
        dump("accounts:" + accounts + "\n");
      } else {
        dump("error reading from accounts-file\n");
      }
    });
  }
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
  let username = document.getElementById("username-input").value;

  // Authenticate against sync account.
  dump("authing...\n");
  let usernameHash = Utils.sha1Base32(username.toLowerCase()).toLowerCase();
  let passwd = document.getElementById("password-input").value;

  // Determine sync server node and get authenticated.
  let client = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
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
                importAccount(username);
              }
              let userProfile = profileService.getProfileByName(username);
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
  let newProfile = profileService.createProfile();
  dump("newProfile name: " + newProfile.name + "\n");
}

// Adds an account and writes it to file so it will be loaded next time.
function importAccount(username) {
  // check if in accounts
  if (accounts.indexOf(username) > -1) {
    dump("already loaded " + username + "; continuing\n");
    return;
  }
  accounts.push(username);

  let accountsfile = FileUtils.getFile("ProfD", ["data", "accounts.txt"]);
  dump(accountsfile + "\n");
  appendAcct(accountsfile, username + "\n");
  dump("started async write\n");
  let userProfile = profileService.createProfile(null, null, username);
  // TODO copy sync setup addon over 
  profileService.flush();
}

// Starts selected profile in a separate Firefox profile.
function launchAccount(profile) {
  let ffFile;
  try {
    // TODO not the best way to load files. prolly. 
    ffFile = Cc["@mozilla.org/file/local;1"].
                createInstance(Ci.nsILocalFile);
    ffFile.initWithPath(DEFAULT_FF);
  } catch(e) {
    dump("error:" + e + ":" + DEFAULT_FF);
  }

  let processargs = ["-profile", profile.rootDir.path];
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
function appendAcct(file, data) {
  dump("starting write\n");
  // TODO does not append! overwrites for some reason!
  var ostream = FileUtils.openSafeFileOutputStream(file,
                   FileUtils.MODE_CREATE | FileUtils.MODE_APPEND);
  var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                     createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var istream = converter.convertToInputStream(data);
  dump("writing\n");
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (!Components.isSuccessCode(status)) {
      dump("error writing\n");
    }
  });
}

function test() {
  dump("This profile: ");
  dump(profileService.selectedProfile.name + "\n");
}
