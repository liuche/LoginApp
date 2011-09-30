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

function promptPassword() {
  let menu = document.getElementById("accounts-menu");
  if (menu.selectedIndex == (menu.itemCount - 1)) {
    document.getElementById("password-label").hidden = true;
    document.getElementById("password-input").hidden = true;
    alert("add/create account");
  } else if (menu.selectedIndex != 0) {
    document.getElementById("password-label").hidden = false;
    document.getElementById("password-input").hidden = false;
  } else {
    document.getElementById("password-label").hidden = true;
    document.getElementById("password-input").hidden = true;
  }
}

function launchAccount() {
  alert("set up profile");
};

function login() {
  let username = document.getElementById("accounts-menu").selectedItem.label;
  if (username == "Guest") {
    window.open();
  } else { // Authenticate against sync account.
    let usernameHash = Utils.sha1Base32(username.toLowerCase()).toLowerCase();
    let passwd = document.getElementById("password-input").value;

    // Determine sync server node and get authenticated.
    let client = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
    client.open("GET", "https://auth.services.mozilla.com/user/1.0/" + usernameHash + "/node/weave");
    client.onreadystatechange = function handler() {
      // Sync node request succeeded.
      if (this.readyState == 4 && this.status == 200) {
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
        dump("sent\n");
      }
    };
    client.send();
  }
}

