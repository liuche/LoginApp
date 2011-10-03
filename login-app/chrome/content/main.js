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

const MENU_IMPORT = "Import Acount...";
const MENU_GUEST = "Guest";
let accounts;

// Load imported accounts to UI. 

function loadAccounts() {
  dump("LOADING ACCOUNTS\n");
  let accountsfile = FileUtils.getFile("ProfD", ["data", "accounts.txt"]);
  NetUtil.asyncFetch(accountsfile, function(inputStream, status) {
    if (!Components.isSuccessCode(status)) {
      dump("ERROR reading from file\n");
      return;
    }
    accounts = NetUtil.readInputStreamToString(inputStream, inputStream.available()).split("\n");
    accounts.pop();
    dump("accounts:" + accounts + "\n");
    makeMenu();
    });
}

function makeMenu() {
  dump("populating menu!!\n");
  let menu = document.getElementById("accounts-menu");
  menu.removeAllItems(); // hack
  menu.appendItem(MENU_GUEST);
  accounts.forEach(function(element) {
    dump("user: " + element);
    menu.appendItem(element);
  });
  menu.appendItem(MENU_IMPORT);
  menu.selectedIndex = 0;
}

// Helper file write function
function write(file, data) {
  dump("starting write\n");
  var ostream = FileUtils.openSafeFileOutputStream(file,
                   FileUtils.MODE_CREATE |  FileUtils.MODE_APPEND);
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
    dump("written to file\n");
  });
  return;
}

// Add an account so it will be loaded next time.
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
  dump("done\n");
}

// Process selection from login dropdown into UI changes. 
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

function login() {
  let username = document.getElementById("accounts-menu").selectedItem.label;
  if (username == MENU_GUEST) {
    window.open();
  } else { // Authenticate against sync account.
    if (username == MENU_IMPORT) {
      dump("importing...\n");
      importAccount();
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
      // TODO: if fail before readystate 4 
      dump("state:" + this.readyState);
      dump( "/status:" + this.status);
      dump("/statusText:" + this.statusText + "\n");
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
                launchAccount().bind(this);
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

