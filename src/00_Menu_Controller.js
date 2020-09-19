/* global sADDON_NAME */

/* exported onInstall */
function onInstall() {
  onOpen();
}

/* exported onOpen */
function onOpen() {
  SpreadsheetApp.getUi()
    .createAddonMenu()
    // eslint-disable-next-line camelcase
    .addItem("Deploy a '" + sADDON_NAME + "' Addon", 'deployAddonGo')
    .addItem('Track Analytics', 'userActionUpdateFreeCall')
    .addItem('Event trigger', 'userActionEveentTriggerSettings')
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
  var html = HtmlService.createTemplateFromFile('99_Help.html').evaluate();

  html.setHeight(500);
  html.setWidth(600);
  html.setTitle(sTitle);

  SpreadsheetApp.getUi().showModalDialog(html, sTitle);
}
