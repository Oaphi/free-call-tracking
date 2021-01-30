function onInstall(e: GoogleAppsScript.Events.AddonOnInstall) {
  recordNewOwner();
  return onOpen(e);
}

/**
 * @summary trigger firing on spreadsheet open
 * @param {GoogleAppsScript.Events.SheetsOnOpen}
 */
function onOpen(
  { authMode } = {
    authMode: ScriptApp.AuthMode.FULL,
  }
) {
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

function settingsGo() {
  prepareTriggersForUse();

  recordNewOwner();

  const templ = HtmlService.createTemplateFromFile("html/settings.html");

  templ.utils = loadDependency("html", "utils");
  templ.style = loadDependency("html", "style");
  templ.run = loadDependency("html", "run");

  const {
    ids: { analytics },
  } = APP_CONFIG;

  const content = template({
    template: templ,
    vars: {
      tid: analytics,
      page_title: "settings",
      page_url: getActiveURL(),
    },
  });

  return sidebarFromString(content);
}

function helpGo() {
  recordNewOwner();

  const template = HtmlService.createTemplateFromFile("html/help.html");

  template.style = loadDependency("html", "style");

  const html = template.evaluate();

  SpreadsheetApp.getUi().showSidebar(html);
}
