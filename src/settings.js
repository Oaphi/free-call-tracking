/**
 * @summary parse an object from path and value
 * @param {{
 *  path   : string,
 *  value ?: any
 * }} [options]
 * @return {object} 
 */
const fromPath = (options = {}) => {

  const { path = "", value } = options;

  const output = {};

  path.split(/\/|\\/).reduce(
    (a, c, i, paths) => a[c] = i < paths.length - 1 || !("value" in options) ? {} : value,
    output
  );

  return output;
};

/**
 * @summary deep assigns object props
 * @param {{
 *  source?   : object,
 *  updates?  : object[],
 *  objGuard? : (any) => boolean,
 *  onError?  : console.warn
 * }} 
 * @returns {object}
 */
const deepAssign = ({
  source = {},
  updates = [],
  objGuard = (obj) => typeof obj === "object" && obj,
  onError = console.warn
} = {}) => {

  try {

    return updates.reduce((ac, up) => {

      const entries = Object.entries(up);

      const objEntries = entries.filter(([_, v]) => objGuard(v));
      const restEntries = entries.filter(([_, v]) => !objGuard(v));

      Object.assign(source, Object.fromEntries(restEntries));

      objEntries.reduce((a, [k, v]) => a[k] = deepAssign({
        source: a[k] || {},
        updates: [v]
      }), ac);

      return ac;

    }, source);

  } catch (error) {
    onError(error);
  }

  return source;
};

const getSettings = () => {

  const defaults = {
    triggers: {
      enableDailyClear: true,
      enableEditTrigger: true
    }
  };

  const { properties: { settings } } = APP_CONFIG;

  return JSON.parse(
    getProperty(settings, JSON.stringify(defaults))
  );
};

const updateSettings = (updatesDict) => { // Object<path : string, value : any>

  console.log(updatesDict);

  const source = getSettings();

  const updates = Object.entries(updatesDict).map(([path, value]) => fromPath({ path, value }));

  deepAssign({ source, updates });

  const { triggers: { enableDailyClear, enableEditTrigger } } = source;

  const trackedClear = { funcName: "handleDailyClear", type: TriggersApp.TriggerTypes.CLOCK };
  const trackedEdit = { funcName: "onEditEvent", type: TriggersApp.TriggerTypes.EDIT };

  enableDailyClear ?
    TriggersApp.enableTracked(trackedClear) :
    TriggersApp.disableTracked(trackedClear);

  enableEditTrigger ?
    TriggersApp.enableTracked(trackedEdit) :
    TriggersApp.disableTracked(trackedEdit);

  const { properties: { settings } } = APP_CONFIG;

  setProperty(settings, JSON.stringify(source));

  return source;
};