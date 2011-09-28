Components.utils.import("resource://services-sync/util.js");

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
