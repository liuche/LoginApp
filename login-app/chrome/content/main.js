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
    alert("check credentials for " + username);
  }
}
