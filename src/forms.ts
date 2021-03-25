type Errable<T> = T & { onError?: (err: Error) => void };

type FormSheetRemovalOpts = Errable<{ key: string }>;

const decodeVars = (url: string) =>
  url
    .replace(/%7B%7B(\w+)\+(\w+)%7D%7D/gi, "{{$1 $2}}")
    .replace(/%7B%7B(\w+)%7D%7D/gi, "{{$1}}");

/**
 * @summary prefills form URL with variables
 */
function getPrefilledUrl(sFormId: string): FormInfo {
  var form = FormApp.openById(sFormId);
  var items = form.getItems();

  // Skip headers, then build URLs for each row in Sheet1.
  // Create a form response object, and prefill it
  var formResponse = form.createResponse();

  const setResponse = makeResponseSetter(formResponse);

  const {
    tagManager: {
      variables: { clid, time, uagent, title, geo },
    },
  } = APP_CONFIG;

  setResponse(items[0], `{{${time}}}`);
  setResponse(items[1], `{{${clid}}}`);
  setResponse(items[2], `{{${geo}}}`);
  setResponse(items[3], "{{Referrer}}");
  setResponse(items[4], "{{Page Hostname}}{{Page Path}}");
  setResponse(items[5], `{{${title}}}`);
  setResponse(items[6], `{{${uagent}}}`);

  // Get prefilled form URL
  var url = formResponse.toPrefilledUrl().replace("viewform", "formResponse");

  const sUrl = decodeVars(url);

  return { sFormId, sUrl };
}

type FormInfo = {
  sFormId: string;
  sUrl: string;
};

/**
 * @summary creates a form to be used with the Add-on
 */
function createForm(sMyCategory: string, sMyEvent: string) {
  var ss = SpreadsheetApp.getActive();
  var sCurrFormUrl = ss.getFormUrl();

  if (sCurrFormUrl) {
    console.log(`found form url: ${sCurrFormUrl}`);

    let canAccess = true;

    try {
      const existing = FormApp.openByUrl(sCurrFormUrl);
      return getPrefilledUrl(existing.getId());
    } catch (error) {
      console.warn(error);
      canAccess = false;
    }

    alert(
      sMSG_FORM_EXISTS +
        (canAccess
          ? ""
          : "\nUnfortunately, we couldn't access it. Please, check if it exists or ask the owner to share")
    );

    return { sFormId: "", sUrl: "" };
  }

  var form = FormApp.create(sFORM_NAME).setAllowResponseEdits(false);

  try {
    form.setRequireLogin(false);
  } catch (error) {
    console.warn(error);
  }

  const {
    strings: {
      form: { userAgent, pageTitle, geoLocation, timestamp, visitorId },
    },
  } = APP_CONFIG;

  form.addTextItem().setTitle(timestamp);
  form.addTextItem().setTitle(visitorId);
  form.addTextItem().setTitle(geoLocation);
  form.addTextItem().setTitle(sSOURCE);
  form.addTextItem().setTitle(sCURR_PAGE);
  form.addTextItem().setTitle(pageTitle);
  form.addTextItem().setTitle(userAgent);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  SpreadsheetApp.flush();

  const [sh] = ss.getSheets();

  sh.setName(sSHEET_FORM);

  const run = makeRunTimes(6);

  run((i, sheet) => sheet.autoResizeColumn(i + 1), sh);

  sh.getRange("H2:H").setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  sh.hideColumns(2);

  sh.getRange("I2:I" + sh.getMaxRows()).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .setAllowInvalid(false)
      .requireValueInList(
        [toEventPair(), toEventPair(sMyCategory, sMyEvent)],
        true
      )
      .build()
  );

  const formId = form.getId();

  console.log(`created form: ${formId}`);

  return getPrefilledUrl(formId);
}

interface NoAnalyticsStatus {
  status: boolean;
  dismissed: boolean;
}

/**
 * @summary fires on manual analytics form being submitted
 */
function onFormSubmit({
  values,
  range,
  onError = console.warn,
}: Errable<GoogleAppsScript.Events.SheetsOnFormSubmit>) {
  try {
    const src = range.getSheet();
    const sheet = range.getSheet();

    const [_fstamp, _tstamp, clientId] = values;

    const {
      properties: { metadata: key },
    } = APP_CONFIG;

    const noGAmeta: NoAnalyticsStatus = getMetadataValue({
      key,
      sheet,
      def: makeNoGAstatus(),
    });

    if (!clientId) {
      const { dismissed = false }: NoAnalyticsStatus = noGAmeta;

      if (dismissed) return;

      noGAmeta.status = true;
    }

    //readjust column size to fit info
    const run = makeRunTimes(6);
    run((i, sheet) => sheet.autoResizeColumn(i + 1), src);

    setMetadataValue({
      sheet,
      key,
      value: noGAmeta,
    });

    TriggersApp.getOrInstallTrigger({
      callbackName: promptUAinstall.name,
      type: TriggersApp.TriggerTypes.CHANGE,
      unique: true,
    });
  } catch (error) {
    onError(error);
  }
}

/**
 * @summary deletes sheet with linked form and associated metadata
 */
const deleteFormSheet = ({
  onError = console.warn,
  key,
}: FormSheetRemovalOpts) => {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sSHEET_FORM);

    if (sheet) {
      deleteMetadata({ sheet, key });
      ss.deleteSheet(sheet);
    }

    return true;
  } catch (error) {
    onError(error);
    return false;
  }
};

/**
 * @summary deletes linked form
 */
const unlinkForm = ({ onError = console.warn }: Errable<{}>) => {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const uri = ss.getFormUrl();

    if (!uri) return true;

    const form = FormApp.openByUrl(uri);

    form.removeDestination();

    return true;
  } catch (error) {
    onError(error);
    return false;
  }
};
