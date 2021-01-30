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

declare interface GtmInfo {
  accountId: string;
  containerId: string;
  workspaceId: string;
  versionId: string;
}

const setGtmInfo = (info: GtmInfo) => {
  try {
    const {
      properties: { gtm },
    } = APP_CONFIG;
    return setProperty(gtm, info);
  } catch (error) {
    console.warn(error);
    return false;
  }
};

const getGtmInfo = (): GtmInfo => {
  const {
    properties: { gtm },
  } = APP_CONFIG;
  return JSON.parse(getProperty(gtm, "{}"));
};

/**
 * @summary gets Analytics profile ID
 */
const getProfileID = ({ onError = console.warn } = {}): string => {
  try {
    const {
      properties: { profile },
    } = APP_CONFIG;

    return getHighAccessProperty(profile) || "";
  } catch (error) {
    onError(error);
    return "";
  }
};

/**
 * @summary converts category and event to category/event pair
 * @param {string} category
 * @param {string} event
 * @returns {string}
 */
const toEventPair = (category = "Event", event = "Event") =>
  `${category}/${event}`;

type MaybeDate = string | number | Date;

/**
 * @summary extracts date part in ISO format
 */
const toISODate = (date: MaybeDate = Date.now()): string =>
  new Date(date).toISOString().slice(0, 10);

/**
 * @summary gets column index from A1 notation
 * @param {string} a1
 * @param {("column"|"row")} [type]
 * @returns {number}
 */
const getIndexFromA1 = (a1, type = "column") => {
  if (!a1) {
    throw new RangeError(`Expected A1 notation`);
  }

  const alphabet = "abcdefghijklmnopqrstuvwxyz";

  const [, cellChars, rowNumber] = a1.match(/^([A-Z]+)(?=(\d+)|$)/i) || [];

  if (!cellChars) {
    throw new RangeError(`Expected correct A1 notation, actual: ${a1}`);
  }

  if (type === "row") {
    return rowNumber - 1;
  }

  const lcaseChars = cellChars.toLowerCase().split("").reverse();
  const middle = lcaseChars.reduce((acc, cur, i) => {
    return acc + (alphabet.indexOf(cur) + 1) * (i > 0 ? 26 ** i : 1);
  }, 0); //A -> skipped, B -> processed //

  return middle - 1;
};

/**
 * @summary leaves only unique elements
 */
const uniqify = (arr: any[] = []): any[] => [...new Set(arr).values()];

const loadDependency = (path: string, name: string) =>
  HtmlService.createHtmlOutputFromFile(`${path}/${name}`).getContent();

declare interface Logger {
  logs: Map<number, string>;
  clear(): void;
  dump(): void;
  iso(num: Number): string;
  log(msg: string): void;
}

const makeLogger = (): Logger => {
  return {
    logs: new Map(),
    clear() {
      const { logs } = this;
      logs.clear();
    },
    iso(num: number) {
      return new Date(num).toISOString();
    },
    log(msg: string) {
      const [stamp, log] = [Date.now(), msg];
      this.logs.set(stamp, log);
    },
    dump() {
      const { logs } = this;

      for (const [key, val] of logs) {
        console.log(`${this.iso(key)} | ${val}`);
      }

      logs.clear();
    },
  };
};

const getMetadataValue = ({
  sheet = SpreadsheetApp.getActiveSheet(),
  key,
  def,
}: {
  def?: any;
  key: string;
  sheet: GoogleAppsScript.Spreadsheet.Sheet;
}) => {
  const items = sheet.getDeveloperMetadata();
  const data = items.find((data) => data.getKey() === key);
  return data !== void 0 ? JSON.parse(data.getValue()) : def;
};

const setMetadataValue = ({
  sheet = SpreadsheetApp.getActiveSheet(),
  key,
  value,
}) => {
  const items = sheet.getDeveloperMetadata();
  const data = items.find((data) => data.getKey() === key);

  const prepared = JSON.stringify(value);

  if (data) {
    data.setValue(prepared);
    return true;
  }

  sheet.addDeveloperMetadata(key, prepared);
  return true;
};

const deleteMetadata = ({ sheet = SpreadsheetApp.getActiveSheet(), key }) => {
  const items = sheet.getDeveloperMetadata();
  const data = items.find((data) => data.getKey() === key);
  data && data.remove();
  return true;
};

const deleteAllMetadata = ({
  sheet = SpreadsheetApp.getActiveSheet(),
} = {}) => {
  const items = sheet.getDeveloperMetadata();
  items.forEach((item) => item.remove());
  return true;
};

const getFormSheet = () => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  return sheets.find((sheet) => !!sheet.getFormUrl());
};

const loadTemplate = (
  path: string,
  name: string,
  deps?: Record<string, string>,
  vars?: Record<string, any>
) => {
  const templ = HtmlService.createTemplateFromFile(`${path}/${name}`);
  Object.entries(deps || {}).forEach(
    ([name, path]) => (templ[name] = loadDependency(path, name))
  );

  vars && Object.assign(templ, vars);

  return templ.evaluate();
};

const withCatch = (onError) => (func, ...args) => {
  try {
    return func(...args);
  } catch (error) {
    return onError(error, func, ...args);
  }
};

const uuid = () => Utilities.getUuid();

const makeRunTimes = (num = 1) => (
  callback: (idx: number, ...arg: any[]) => any,
  ...args: any[]
) => {
  let i = 0;
  while (i < num) {
    callback(i, ...args);
    i++;
  }
};

const makeResponseSetter = (res: GoogleAppsScript.Forms.FormResponse) => (
  item: GoogleAppsScript.Forms.Item,
  text: string
) => res.withItemResponse(item.asTextItem().createResponse(text));

const extractDomain = (url: string) =>
  url.replace(/^\w+:\/\//i, "").replace(/(\w+)\/.+/i, "$1");

const extractPage = (url: string) =>
  (url.replace(/(?:#|\?).+?.+$/i, "").match(/\w+(\/.+)$/i) || [])[1] || "/";

type RequireOneOf<T, R extends keyof T = keyof T> = {
  [P in R]: Required<Pick<T, P>> & Partial<Omit<T, P>>;
}[R];

type TemplateOpts = RequireOneOf<
  {
    template: GoogleAppsScript.HTML.HtmlTemplate;
    content: string;
    returnMissing?: boolean;
    preserveMissing?: string[];
    vars?: Record<string, string | number>;
    onError?: (err: Error) => void;
  },
  "template" | "content"
>;

/**
 * @summary parses string template
 */
const template = ({
  template,
  content,
  vars = {},
  onError = (err) => console.warn(err),
  returnMissing = false,
  preserveMissing = [],
}: TemplateOpts) => {
  const full =
    (template ? template.evaluate().getContent() : "") + (content || "");

  try {
    return full.replace(
      /{{(\w+)}}/gi,
      (_, name) =>
        (vars[name] as string) ||
        (vars[name] === 0
          ? "0"
          : returnMissing || preserveMissing.includes(name)
          ? _
          : "")
    );
  } catch (error) {
    onError(error);
    return full;
  }
};
