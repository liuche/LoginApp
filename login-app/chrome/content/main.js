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

const MENU_IMPORT = "Import Acount...";
const MENU_GUEST = "Guest";
const DEF_PROFILE = "default";
let accounts = [];
let profileService = Cc["@mozilla.org/toolkit/profile-service;1"]
                                .createInstance(Ci.nsIToolkitProfileService);

let prefs = Cc["@mozilla.org/preferences-service;1"]
              .getService(Ci.nsIPrefBranch);

// Load imported accounts into UI. 
function loadAccounts() {
  profileService.selectedProfile = profileService.getProfileByName("default");
  dump("current-profile:" + profileService.selectedProfile.name + "\n");
  profileService.flush();
  let accountsfile = FileUtils.getFile("ProfD", ["data", "accounts.txt"]);
  if (accountsfile.exists()) {
    dump("is file\n");
    NetUtil.asyncFetch(accountsfile, function(inputStream, status) {
      if (Components.isSuccessCode(status)) {
        accounts = NetUtil.readInputStreamToString(inputStream, inputStream.available()).split("\n");
        accounts.pop();
        dump("accounts:" + accounts + "\n");
      } else {
        dump("error reading from accounts-file\n");
      }
      dump("making menu\n");
      makeMenu();
    });
  } else {
    dump("making menu\n");
    makeMenu();
  }
}

// Generates the UI account selection menu.
function makeMenu() {
  dump("populating menu!!\n");
  let menu = document.getElementById("accounts-menu");
  accounts.forEach(function(element) {
    dump("user: " + element);
    menu.appendItem(element);
  });
  menu.appendItem(MENU_IMPORT);
}

// Helper file write function
function write(file, data) {
  dump("starting write\n");
  var ostream = FileUtils.openSafeFileOutputStream(file,
                   FileUtils.MODE_CREATE | FileUtils.MODE_WRONLY | FileUtils.MODE_APPEND);
  // TODO does not append! overwrites
  var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                     createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var istream = converter.convertToInputStream(data);
  dump("writing\n");
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (!Components.isSuccessCode(status)) {
      dump("error writing\n");
      return;
    }
  });
  return;
}

// Adds an account and writes it to file so it will be loaded next time.
function importAccount() {
  let username = document.getElementById("add-input").value;
  let accountsfile = FileUtils.getFile("ProfD", ["data", "accounts.txt"]);
  dump(accountsfile + "\n");
  if (accounts.indexOf(username) > -1) {
    dump("contains line; continuing\n");
    return;
  }
  accounts.push(username);
  write(accountsfile, username + "\n");
  dump("started async write\n");
  profileService.createProfile(null, null, username);
  profileService.flush();
}

// Process selection from login dropdown into UI changes. 
// (password entry, username entry)
function processSelection() {
  let menu = document.getElementById("accounts-menu");
  document.getElementById("add-row").hidden = true;
  if (menu.selectedIndex == (menu.itemCount - 1)) {
    document.getElementById("add-row").hidden = false;
    document.getElementById("password-row").hidden = false;
  } else if (menu.selectedIndex != 0) {
    document.getElementById("password-row").hidden = false;
  } else {
    document.getElementById("password-row").hidden = true;
  }
}

// Login.
function login() {
  let username = document.getElementById("accounts-menu").selectedItem.label;
  if (username == MENU_GUEST) {
    // TODO create new profile, delete it afterwards
    window.open();
  } else { // Authenticate against sync account.
    if (username == MENU_IMPORT) {
      username = document.getElementById("add-input").value;
    }
    dump("authing...\n");
    let usernameHash = Utils.sha1Base32(username.toLowerCase()).toLowerCase();
    let passwd = document.getElementById("password-input").value;

    // Determine sync server node and get authenticated.
    let client = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
    client.open("GET", "https://auth.services.mozilla.com/user/1.0/" + usernameHash + "/node/weave");

    dump("setting handler\n");

    client.onreadystatechange = function handler() {
      // Sync node request succeeded.
      dump("state:" + this.readyState + "/status:" + this.status + "/statusText:" + this.statusText + "\n");
      if (this.readyState == 2 && this.status == 404) {
        alert("Username does not exist. Please try 'Create Account'.");
      } else if (this.readyState == 4 && this.status == 200) {
        let server = client.responseText;

        // Now authenticate against the server node.
        client.onreadystatechange = function handler1() {
          dump("state:" + this.readyState + "/status:" + this.status + "/statusText:" + this.statusText + "\n");
          if (this.readyState == 4) {
            switch(this.status) {
              case 200: // Success!
                dump("success!\n");
                if (document.getElementById("accounts-menu").selectedItem.label == MENU_IMPORT) {
                  dump("importing...\n");
                  importAccount();
                }
                launchAccount();
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
}

function launchAccount() {
  let username = "liuche+002@mozilla.com";
  dump("starting user profile: " + username + "\n");
  dump("fetching " + profileService.getProfileByName(username) + "\n");
  profileService.selectedProfile = profileService.getProfileByName(username);
  profileService.flush();
  dump("loaded profile " + profileService.selectedProfile.name + "\n");
  dump("homepage = ");
  let homepage = prefs.getCharPref("browser.startup.homepage");
  if (homepage == "") {
    window.open();
  } else {
    dump("homepage: " + homepage + "\n");
    window.open(homepage);
  }
}
function test() {
  dump("[profile-debug]\n");
  let psIt = profileService.profiles;
  dump("all profiles:\n");
  while (psIt.hasMoreElements()) {
    var elt = psIt.getNext();
    dump("[" + elt.name + "/" + elt.localDir.leafName + "]\n");
  }
  dump("current profile:");
  dump(profileService.selectedProfile.name + "\n");
}
