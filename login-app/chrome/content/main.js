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

function login() {
  let username = document.getElementById("accounts-menu").selectedItem.label;
  if (username == "Guest") {
    window.open();
  } else {
    let passwd = document.getElementById("password-input").value;
    dump("calculating hash of " + username.toLowerCase() + "\n");
    let usernameHash = Utils.sha1Base32(username.toLowerCase());
    dump("sha1:" + usernameHash + "\n");
    let client = new XMLHttpRequest();
    //client.open("GET", "https://auth.services.mozilla.com/user/1.0/" + usernameHash + "/node/weave");
  }
}
