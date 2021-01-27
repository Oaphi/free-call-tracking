/* global sADDON_NAME */

/**
 * @summary trigger firing on addon install
 * @param {GoogleAppsScript.Events.AddonOnInstall}
 */
function onInstall() {
  recordNewOwner();
  return onOpen();
}

/**
 * @summary trigger firing on spreadsheet open
 * @param {GoogleAppsScript.Events.SheetsOnOpen}
 * @returns {void}
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
    .addItem(`Deploy the ${sADDON_NAME} Addon`, "deployAddonGo")
    .addItem("Track Analytics", "userActionUpdateFreeCall")
    .addItem("Open Settings", "settingsGo")
    .addItem("Get Help", "helpGo")
    .addToUi();
}

const getActiveURL = () => SpreadsheetApp.getActiveSpreadsheet().getUrl();

const sidebarFromString = (content: string) =>
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(content));

/**
 * @summary opens settings sidebar
 */
function settingsGo() {
  prepareTriggersForUse();

  recordNewOwner();

  const templ = HtmlService.createTemplateFromFile("html/settings.html");

  templ.utils = loadDependency("html", "utils");
  templ.style = loadDependency("html", "style");
  templ.run = loadDependency("html", "run");

  const content = template({
    content: templ.evaluate().getContent(),
    vars: {
      tid: "UA-168009246-1",
      page_title: "settings",
      page_url: getActiveURL(),
    },
  });

  return sidebarFromString(content);
}

/**
 * @summary opens help sidebar
 */
function helpGo() {
  recordNewOwner();

  const template = HtmlService.createTemplateFromFile("html/help.html");

  template.style = loadDependency("html", "style");

  const html = template.evaluate();

  SpreadsheetApp.getUi().showSidebar(html);
}
