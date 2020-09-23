/* global sADDON_NAME */

/* exported onInstall */
function onInstall() {
  onOpen();
}

/* exported onOpen */
function onOpen() {

  TriggersApp.trackTriggers();

  TriggersApp.getOrInstallTrigger({
    unique: true,
    callbackName: "onEditEvent",
    type: TriggersApp.TriggerTypes.EDIT
  });

  TriggersApp.getOrInstallTrigger({
    unique: true,
    installerConfig: getDailyClearConfig(),
    callbackName: "handleDailyClear"
  });

  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem("Deploy a '" + sADDON_NAME + "' Addon", 'deployAddonGo')
    .addItem('Track Analytics', 'userActionUpdateFreeCall')
    .addItem("Open Settings", "settingsGo")
    .addItem('Setup and Use Manual', 'helpGo')
    .addToUi();
}

/* global selectAccountDeployAddon */
/* exported deployAddonGo */
/**
 * Show user deploy dialog
 */
function deployAddonGo() {
  selectAccountDeployAddon();
}

/* exported helpGo */
/**
 * Show user help dialog
 */
function helpGo() {
  var sTitle = 'Free call tracking';
  var html = HtmlService.createTemplateFromFile('html/99_Help.html').evaluate();

  html.setHeight(500);
  html.setWidth(600);
  html.setTitle(sTitle);

  SpreadsheetApp.getUi().showModalDialog(html, sTitle);
}

function settingsGo() {

  const utils = include("html/utils.html");

  const template = HtmlService.createTemplateFromFile("html/settings.html");

  Object.assign(template, { utils });

  const output = template.evaluate();

  SpreadsheetApp.getUi().showSidebar(output);

}
