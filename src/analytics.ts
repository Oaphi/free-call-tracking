const getGoogleAnalyticsAccounts = () =>
  Analytics?.Management?.Accounts?.list() || { items: [] };

/**
 * @summary gets Google Analytics properties by account
 */
function getGaPropertiesArrByAcc(sAccID: string) {
  const response: {
    status: boolean;
    properties: GoogleAppsScript.Analytics.Schema.Webproperty[];
  } = { status: true, properties: [] };

  try {
    var { items } = Analytics?.Management?.Webproperties?.list(sAccID) || {};

    if (!items) {
      response.properties.push({
        name: "No available Accounts",
        id: "",
      });

      return response;
    }

    response.properties.push(...items);
  } catch (error) {
    console.warn(error);
    response.status = false;
  }

  return response;
}

/**
 * @see {@link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters}
 */
type AnalyticsParameters = {
  v: 1;
  tid: string;
  cid: string;
  t: "event";
  ec: string;
  ea: string;
  z: number;
  ni: 1;
  ua: string;
  dh: string;
  dp: string;
  dt: string;
  uip?: string;
};

/**
 * @summary onEdit sending a hit to analytics
 */
const onEditEvent = (e: GoogleAppsScript.Events.SheetsOnEdit) =>
  TriggersApp.guardTracked(e, function onEditEvent({ range }) {
    var sCurValue = range.getValue();
    var iRow = range.getRow();

    sCurValue += "";

    if (sCurValue === "") return;

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) return;

    var sheet = ss.getActiveSheet();

    var [[stamp, timestamp, cid, geo, src, tgt, title, ua]] = sheet
      .getRange(iRow, 1, 1, sheet.getLastColumn())
      .getValues();

    if (!cid) return sheet.getRange(`I${iRow}`).clearContent();

    const tid = getProfileID();

    const [ec, ea] = sCurValue.split("/");

    const domain = extractDomain(tgt);
    const page = extractPage(tgt);

    const queryConfig: AnalyticsParameters = {
      v: 1,
      tid,
      cid,
      t: "event",
      ec,
      ea,
      z: stamp,
      ni: 1,
      ua,
      dh: domain,
      dp: page,
      dt: title,
    };

    if (geo) queryConfig.uip = geo;

    const query = objectToQuery(queryConfig);

    const url = `${AnalyticsHelper.fullURL}?${query}`;

    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
    });

    ss.toast(res.getResponseCode().toString(), "Sent To Analytics");
  });

class AnalyticsHelper {
  static get baseURL() {
    return `https://www.google-analytics.com`;
  }

  static get isTest() {
    return APP_CONFIG.ENV === "test";
  }

  static get fullURL() {
    const { baseURL, isTest } = this;
    return `${baseURL}/${isTest ? `debug/collect` : "collect"}`;
  }

  /**
   * @see {@link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters}
   */
  static get commonParams() {
    return {
      v: 1,
      ni: 1,
      tid: APP_CONFIG.ids.analytics,
    };
  }

  static collectPageview(
    cid: string,
    location: string,
    title: string,
    path: string
  ) {
    const { fullURL, commonParams } = this;

    const query = objectToQuery({
      ...commonParams,
      t: "pageview",
      dl: location,
      dt: title,
      dp: path,
      cid,
    });

    const res = UrlFetchApp.fetch(`${fullURL}?${query}`, {
      muteHttpExceptions: true,
    });

    console.log(res.getContentText());

    return res.getResponseCode() === 200;
  }
}

/**
 * @summary wrapper to client-side page view
 */
const sendPageview = (
  ...args: Parameters<typeof AnalyticsHelper["collectPageview"]>
) => AnalyticsHelper.collectPageview(...args);

const makeUAparameter = (id: string) => ({
  key: "trackingId",
  type: "template",
  value: id,
});

//@ts-ignore
const alert = (msg: string) => SpreadsheetApp.getUi().alert(msg);

/**
 * @summary installs Google Analytics container
 */
const installGAtag = () => {
  const gtmInfo = getGtmInfo();

  const { accountId, containerId } = gtmInfo;

  const analyticsId = getProfileID();

  try {
    HelpersTagManager.getAccountById(accountId);
    HelpersTagManager.getContainerById(containerId);

    const {
      tagManager: {
        tags: { ua },
        triggers: { view },
      },
    } = APP_CONFIG;

    const version = HelpersTagManager.getLiveVersion();

    if (!version) return false;

    const { trigger: triggers = [], tag: tags = [] } = version;

    const [{ workspaceId }] = HelpersTagManager.listWorkspaces();

    HelpersTagManager.setIds({ workspaceId });

    //!important: GA tag must fire as soon as possible or `ga` is defined later than we submit
    const { triggerId } = installPageViewTrigger({
      triggers,
      name: view,
      path: HelpersTagManager.workspacePath,
    });

    if (!triggerId) return false;

    const installed = createOrUpdateTag(
      tags,
      ua, //note: tag name must be unique (the function checks for tag existense, though)
      HelpersTagManager.workspacePath,
      {
        type: "ua",
        parameter: [makeUAparameter(analyticsId)],
        firingTriggerId: [triggerId],
      }
    );

    const {
      tagManager: {
        versions: { main },
      },
    } = APP_CONFIG;

    const updated = versionWorkspace(HelpersTagManager.workspacePath, main);
    const newVersion = republishContainer(updated);

    if (!newVersion) return false;

    //!important: makes sure reinstalls reference updated versions
    gtmInfo.versionId = newVersion.containerVersionId!;
    gtmInfo.workspaceId = installed.workspaceId!;
    setGtmInfo(gtmInfo);

    deleteAllMetadata({ sheet: getFormSheet() });

    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
};
