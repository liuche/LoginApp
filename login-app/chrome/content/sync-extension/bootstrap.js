const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
function install() {
  alert("Install!");
  let testFile = FileUtils.get("ProfD", ["data", "test.txt"]);
  writeToFile(testFile, "helloworld\n");
}

function startup(data, reason) {
  alert("starting up!\n");
  let testFile = FileUtils.get("ProfD", ["data", "test.txt"]);
  writeToFile(testFile, "helloworld\n");

  AddonManager.getAddonByID(data.id, function(addon) {
    addon.uninstall();
  });
}

function uninstall() {
  alert("uninstalling!");
}

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
    ostream.close();
  });
}
