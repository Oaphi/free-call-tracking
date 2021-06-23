/// <reference path="../triggers.d.ts" />

const getDailyClearConfig = () => {
    const defaultConfig = JSON.stringify({ days: 1, atMinute: 0, atHour: 0 });
    return JSON.parse(getProperty(APP_CONFIG.properties.clear, defaultConfig));
};
interface DailyClearOptions {
    days?: number;
    atHour?: number;
    atMinute?: number;
}

const setDailyClearConfig = (config: DailyClearOptions) => {
    const { days = 1, atMinute = 0, atHour = 0 } = config;
    return setProperty(APP_CONFIG.properties.clear, { days, atMinute, atHour });
};

/**
 * @summary callback for the daily clean trigger
 */
const handleDailyClear = () => {
    const sheet = getFormSheet();
    const logger = makeLogger();
    if (!sheet) return logger.log("form sheet missing").dump();
    const keepRows = 1 + sheet.getFrozenRows();
    const nrows = sheet.getMaxRows();

    if (nrows - keepRows <= 0) return;

    sheet.deleteRows(keepRows + 1, nrows - keepRows);
};

/**
 * @summary immediately cleans the form sheet
 */
const clearFormSheet = () => {
    const sheet = getFormSheet();
    if (!sheet) return;
    return clearSheet({
        onError: console.warn,
        skipRows: [1],
        type: "values",
        sheet,
    });
};

/**
 * @summary reusable utility preparing project triggers
 */
const prepareTriggersForUse = () => {
    const onInstallFailure = (msg: string) =>
        console.warn(`failed to install trigger: ${msg}`);

    const tracking = TriggersApp.trackTriggers();

    if (!tracking) {
        onInstallFailure("failed to track triggers");
        return false;
    }

    const common = { unique: true, onInstallFailure };

    const submitInstalled = TriggersApp.getOrInstallTrigger({
        ...common,
        callbackName: onFormSubmit.name,
        type: TriggersApp.TriggerTypes.SUBMIT,
    });

    const editInstalled = TriggersApp.getOrInstallTrigger({
        ...common,
        callbackName: onEditEvent.name,
        type: TriggersApp.TriggerTypes.EDIT,
    });

    const clearInstalled = TriggersApp.getOrInstallTrigger({
        ...common,
        installerConfig: getDailyClearConfig(),
        callbackName: handleDailyClear.name,
        type: TriggersApp.TriggerTypes.CLOCK,
    });

    return tracking && submitInstalled && editInstalled && !!clearInstalled;
};

/**
 * @summary reschedules clear trigger
 */
const rescheduleClearTrigger = ({
    atHour = 0,
    atMinute = 1,
    days = 1,
}: DailyClearOptions = {}): boolean => {
    const funcName = "handleDailyClear";

    const info = TriggersApp.getTrackedTriggerInfo({ funcName });

    const status = !info || TriggersApp.deleteTracked(info);

    if (!status) return false;

    const settingsStatus = setDailyClearConfig({ atHour, atMinute });

    if (!settingsStatus) return false; //TODO: use different status codes;

    const installed = TriggersApp.getOrInstallTrigger({
        unique: true,
        installerConfig: { atHour, atMinute, days },
        callbackName: funcName,
    });

    console.log({ atHour, atMinute, info, status, settingsStatus, installed });

    return !!installed;
};

const makeNoGAstatus = (): NoAnalyticsStatus => ({
    status: false,
    dismissed: false,
});

/**
 * @summary gets metadata that install of UA is dismissed
 */
const getGaInstalledDismissed = (sheet = getFormSheet()) => {
    //TODO: change public contract to config object
    const {
        properties: { metadata: key },
        sheets: { form },
    } = APP_CONFIG;

    if (!sheet) throw new RangeError(`"${form}" sheet not found`);

    const analyticsStatus: NoAnalyticsStatus = getMetadataValue({
        sheet,
        key,
        def: makeNoGAstatus(),
    });

    return analyticsStatus;
};

type CommonAnalyticsInstallOptions = {
    sheet?: GoogleAppsScript.Spreadsheet.Sheet;
};

type AnalyticsInstallGetterOptions = CommonAnalyticsInstallOptions;

type AnalyticsInstallSetterOptions = {
    dismissed?: boolean;
} & CommonAnalyticsInstallOptions;

/**
 * @summary sets metadata that install of UA is dismissed
 */
const setGaInstallDismissed = ({
    sheet = getFormSheet(),
    dismissed = true,
}: AnalyticsInstallSetterOptions = {}) => {
    const {
        properties: { metadata: key },
        sheets: { form },
    } = APP_CONFIG;

    if (!sheet) throw new RangeError(`"${form}" sheet not found`);

    const analyticsStatus = getGaInstalledDismissed(sheet);

    analyticsStatus.dismissed = dismissed;

    return setMetadataValue({ sheet, key, value: analyticsStatus });
};

/**
 * @summary checks if the user has GA installed and prompts accordingly
 */
const promptUAinstall = () => {
    const { dismissed, status } = getGaInstalledDismissed();

    if (!status || dismissed) return;

    const ui = SpreadsheetApp.getUi();

    const commonDeps = {
        style: "html",
        run: "html",
        utils: "html",
    };

    const templateMap = {
        true: () =>
            loadTemplate(true, "html", "dismissedNotice", {
                ...commonDeps,
                dismissPrompt: "html/js",
            }),
        false: () =>
            loadTemplate(true, "html", "installGA", {
                ...commonDeps,
                uaPrompt: "html/js",
            }),
    };

    const loader = templateMap[dismissed.toString() as "true" | "false"];

    const content = loader();
    content.setHeight(225);

    ui.showModalDialog(content, "Universal Analytics");
};
