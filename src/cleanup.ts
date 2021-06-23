interface DailyClearOptions {
    days?: number;
    atHour?: number;
    atMinute?: number;
}

const getDailyClearConfig = () => {
    const defaults: DailyClearOptions = { days: 1, atMinute: 0, atHour: 0 };
    const defaultConfig = JSON.stringify(defaults);
    return JSON.parse(getProperty(APP_CONFIG.properties.clear, defaultConfig));
};

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

    const frozen = sheet.getFrozenRows();

    const keepRows = 1 + frozen;
    const nrows = sheet.getMaxRows();

    sheet.getRange(frozen + 1, 1, 1, sheet.getMaxColumns()).clearContent();

    const diff = nrows - keepRows;
    if (diff <= 0) return;

    sheet.deleteRows(keepRows + 1, diff);
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

    return !!installed;
};
