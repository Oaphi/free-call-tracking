const getDailyClearConfig = () => {
  const defaultConfig = JSON.stringify({ days: 1, atMinute: 0, atHour: 0 });
  return JSON.parse(getProperty(APP_CONFIG.properties.clear, defaultConfig));
};

declare interface DailyClearOptions {
  days?: number;
  atHour?: number;
  atMinute?: number;
}

const setDailyClearConfig = (config: DailyClearOptions) => {
  const { days = 1, atMinute = 0, atHour = 0 } = config;
  return setProperty(
    APP_CONFIG.properties.clear,
    JSON.stringify({ days, atMinute, atHour })
  );
};

const handleDailyClear = ({ 
  onError = console.warn 
} = {}) => {
  try {
    clearSheet({
      name: sSHEET_FORM,
      type: "values",
    });
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
};

/**
 * @summary reschedules clear trigger
 * @returns {boolean}
 */
const rescheduleClearTrigger = ({
  atHour = 0,
  atMinute = 1,
  days = 1,
}: DailyClearOptions = {}) => {
  const funcName = "handleDailyClear";

  // @ts-ignore
  const info = TriggersApp.getTrackedTriggerInfo({ funcName });

  // @ts-ignore
  const status = TriggersApp.deleteTracked(info);

  if (!status) {
    return false;
  }

  const settingsStatus = setDailyClearConfig({ atHour, atMinute });

  if (!settingsStatus) {
    return false; //TODO: use different status codes;
  }

  // @ts-ignore
  const installed = TriggersApp.getOrInstallTrigger({
    unique: true,
    installerConfig: { atHour, atMinute, days },
    callbackName: funcName
  });

  console.log({ atHour, atMinute, info, status, settingsStatus, installed });

  return !!installed;
};
