function onInstall(e: GoogleAppsScript.Events.AddonOnInstall) {
  recordNewOwner();
  return onOpen(e);
}

/**
 * @summary trigger firing on spreadsheet open
 */
function onOpen({
  authMode = ScriptApp.AuthMode.FULL,
}:
  | GoogleAppsScript.Events.SheetsOnOpen
  | GoogleAppsScript.Events.AddonOnInstall) {
  //can work with triggers
  if (authMode !== ScriptApp.AuthMode.NONE) {
    prepareTriggersForUse();
  }

  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem(`Deploy the ${sADDON_NAME} Addon`, deployAddonGo.name)
    .addItem("Track Analytics", userActionUpdateFreeCall.name)
    .addItem("Open Settings", settingsGo.name)
    .addItem("Get Help", helpGo.name)
    .addToUi();
}

const getActiveURL = () => SpreadsheetApp.getActiveSpreadsheet().getUrl();

const sidebarFromString = (content: string) =>
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(content));

/**
 * @summary triggers settings screen sidebar
 */
function settingsGo() {
  prepareTriggersForUse();

  recordNewOwner();

  const templ = HtmlService.createTemplateFromFile("html/settings.html");
  templ.utils = loadDependency("html", "utils");
  templ.style = loadDependency("html", "style");
  templ.run = loadDependency("html", "run");

  const content = template({
    template: templ,
    vars: {
      tid: APP_CONFIG.ids.analytics,
      page_path: "/settings",
      page_title: "settings",
      page_url: getActiveURL(),
    },
  });

  return sidebarFromString(content);
}

/**
 * @summary triggers help screen sidebar
 */
function helpGo() {
  recordNewOwner();

  const templ = HtmlService.createTemplateFromFile("html/help.html");
  templ.utils = loadDependency("html", "utils");
  templ.style = loadDependency("html", "style");
  templ.run = loadDependency("html", "run");

  const content = template({
    template: templ,
    vars: {
      tid: APP_CONFIG.ids.analytics,
      page_path: "/help",
      page_title: "help",
      page_url: getActiveURL(),
    },
  });

  return sidebarFromString(content);
}
