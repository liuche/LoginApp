pref("toolkit.defaultChromeURI", "chrome://login-app/content/main.xul");
pref("toolkit.singletonWindowType", "login-window");

# no caching
pref("nglayout.debug.disable_xul_cache", true);
pref("nglayout.debug.disable_xul_fastload", true);

# debugging prefs
pref("browser.dom.window.dump.enabled", true);
pref("javascript.options.showInConsole", true);
pref("javascript.options.strict", true);
pref("dom.report_all_js_exceptions", true);
pref("devtools.errorconsole.enabled" true);
pref("extensions.logging.enable", true);
