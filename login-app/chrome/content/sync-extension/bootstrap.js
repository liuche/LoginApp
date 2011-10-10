const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

function startup(data, reason) {
  Services.prompt.alert(null, "starting up!", "startup!");
  let testFile = FileUtils.getFile("ProfD", ["test-data.txt"]);
  writeToFile(testFile, "helloworld\n");
  AddonManager.getAddonByID(data.id, function(addon) {
    Services.prompt.alert(null, "uninstalling", "uninstalling");
    addon.uninstall();
  });
}

function uninstall() {}

function shutdown(data, reason) {}

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
