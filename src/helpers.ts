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

type ClearTypes = "all" | "format" | "notes" | "values";

declare interface ClearSheetOptions {
  name?: string;
  range?: GoogleAppsScript.Spreadsheet.Range;
  sheet?: GoogleAppsScript.Spreadsheet.Sheet;
  type?: ClearTypes;
}

declare interface ClearHandler {
  (sheet: GoogleAppsScript.Spreadsheet.Sheet): GoogleAppsScript.Spreadsheet.Sheet;
}

/**
 * @summary Clears a sheet of data | notes | formatting
 */
const clearSheet = ({
  sheet,
  range,
  name,
  type = "all",
}: ClearSheetOptions = {}) => {
  const targetSheet = range
    ? range.getSheet()
    : sheet ||
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      name || SpreadsheetApp.getActiveSheet().getSheetName()
    );

  const typeMap: Map<string, ClearHandler> = new Map([
    ["all", (sh) => sh.clear()],
    ["format", (sh) => sh.clearFormats()],
    ["notes", (sh) => sh.clearNotes()],
    ["values", (sh) => sh.clearContents()],
  ]);

  const typeHandler = typeMap.get(type);

  typeHandler(targetSheet);
};

const getProperty = (key, def) => {
  const store = PropertiesService.getScriptProperties();
  const prop = store.getProperty(key);
  return prop !== null ? prop : def;
};

const setProperty = (key, val) => {
  try {
    const store = PropertiesService.getScriptProperties();
    store.setProperty(key, val);
    return true;
  }
  catch (error) {
    return false;
  }
};
