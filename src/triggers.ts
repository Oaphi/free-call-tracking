/// <reference path="../triggers.d.ts" />

type CommonAnalyticsInstallOptions = {
    sheet?: GoogleAppsScript.Spreadsheet.Sheet;
};

type AnalyticsInstallGetterOptions = CommonAnalyticsInstallOptions;

type AnalyticsInstallSetterOptions = {
    dismissed?: boolean;
} & CommonAnalyticsInstallOptions;

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
