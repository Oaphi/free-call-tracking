/// <reference path="../triggers.d.ts" />

type CommonAnalyticsInstallOptions = {
    sheet?: GoogleAppsScript.Spreadsheet.Sheet;
    config?: typeof APP_CONFIG;
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
    deployed: false,
});

/**
 * @summary gets metadata that install of UA is dismissed
 */
const getGaInstalledDismissed = (sheet = getFormSheet()) => {
    //TODO: change public contract to config object
    const {
        properties: { metadata: key },
    } = APP_CONFIG;

    const def = makeNoGAstatus();
    if (!sheet) return def;

    const analyticsStatus: NoAnalyticsStatus = getMetadataValue({
        sheet,
        key,
        def,
    });

    return analyticsStatus;
};

/**
 * @summary sets metadata that install of UA is dismissed
 */
const setGaInstallDismissed = ({
    sheet = getFormSheet(),
    config: { sheets, properties } = getConfig(),
    dismissed = true,
}: AnalyticsInstallSetterOptions = {}) => {
    const { metadata: key } = properties;
    const { form } = sheets;

    if (!sheet) {
        console.warn(`"${form}" sheet not found`);
        return false;
    }

    const analyticsStatus = getGaInstalledDismissed(sheet);
    analyticsStatus.dismissed = dismissed;
    analyticsStatus.deployed = true;

    return setMetadataValue({ sheet, key, value: analyticsStatus });
};

/**
 * @summary checks if the user has GA installed and prompts accordingly
 */
const promptUAinstall = () => {
    const { dismissed, status, deployed } = getGaInstalledDismissed();

    if (deployed && (!status || dismissed)) return;

    const ui = SpreadsheetApp.getUi();

    const templateMap = {
        true: () =>
            loadTemplate(true, "dist", "dismissedNotice", {
                ...commonDependencies,
                dismissPrompt: "dist/js",
            }),
        false: () =>
            loadTemplate(true, "dist", "installUA", {
                ...commonDependencies,
                uaPrompt: "dist/js",
            }),
    };

    const loader = templateMap[dismissed.toString() as "true" | "false"];

    const content = loader();
    content.setHeight(850);

    ui.showModalDialog(content, "Universal Analytics");
};
