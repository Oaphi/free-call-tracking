/* global sSHEET_FORM */

/* exported setProfileID */
/**
 *
 * @param {string} sID
 */
function setProfileID(sID) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(sSHEET_FORM);
  sh.getRange('F1').setValue(sID);
}

/* exported getProfileID */
/**
 *
 */
function getProfileID() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(sSHEET_FORM);
  return sh.getRange('F1').getValue();
}

/* exported include */
/**
 *
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
