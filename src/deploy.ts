/**
 * @summary utility for safe getting of GTM/GA accounts
 */
const getAccounts = <T>(
  accountGetter: () => T[],
  errMsg: string,
  errNotification: string
) => {
  const accounts: T[] = [];

  try {
    accounts.push(...accountGetter());

    if (!accounts.length) throw new Error(errMsg);
  } catch (error) {
    const uuid = Utilities.getUuid();

    const ui = SpreadsheetApp.getUi();

    console.warn(uuid, error);

    ui.alert(
      "Warning!",
      `"${errNotification}\nIssue id: ${uuid}`,
      ui.ButtonSet.OK
    );
    return [];
  }

  return accounts;
};

/**
 * @summary setup process running on add-on deployment
 */
function deployAddonGo() {
  prepareTriggersForUse();
  recordNewOwner();

  const ui = SpreadsheetApp.getUi();

  const analyticsAccounts = getAccounts(
    () => getGoogleAnalyticsAccounts().items || [],
    "There is access to Analytics, but no account.",
    "No Google Analytics accounts available. Please create at least one."
  );

  const gtagAccounts = getAccounts(
    () => HelpersTagManager.getAccountsList().account || [],
    "There is access to GTM, but no account.",
    "No Google Tag Manager accounts found. Please create and setup at least one."
  );

  const output = loadTemplate(
    true,
    "html",
    "setup.html",
    {
      run: "html",
    },
    {
      ArrAccs: gtagAccounts,
      ArrGaAccs: analyticsAccounts,
    }
  );

  const {
    sizes: {
      setup: [width, height],
    },
  } = APP_CONFIG;

  output.setHeight(height);
  output.setWidth(width);
  output.setTitle(sFORM_TITLE);

  ui.showModalDialog(output, sFORM_TITLE);
}

/**
 * @summary creates a GTM variable or updates it
 */
const createOrUpdateVar = (
  vars: GoogleAppsScript.TagManager.Schema.Variable[],
  nameToFind: string,
  path: string,
  init: GoogleAppsScript.TagManager.Schema.Variable
) => {
  const v = vars.find(({ name }) => nameToFind === name);
  const applied = { ...init, name: nameToFind };

  const varsService = TagManager?.Accounts?.Containers?.Workspaces?.Variables!;

  return v
    ? varsService.update(applied, v.path!)
    : varsService.create(applied, path);
};

class TagModel {
  tags: GoogleAppsScript.TagManager.Schema.Tag[];
  path: string;

  constructor(path: string, tags: GoogleAppsScript.TagManager.Schema.Tag[]) {
    this.tags = tags || [];
    this.path = path;
  }

  createHTML(name: string, pathToFile: string) {
    const value = HtmlService.createHtmlOutputFromFile(this.path).getContent();

    const tag = createOrUpdateTag(this.tags, name, this.path, {
      liveOnly: false,
      parameter: [
        {
          key: "html",
          type: "template",
          value,
        },
      ],
    });

    this.tags.push(tag);

    return tag;
  }
}

class VariableModel {
  variables: GoogleAppsScript.TagManager.Schema.Variable[];
  path: string;

  constructor(
    vars: GoogleAppsScript.TagManager.Schema.Variable[],
    path: string
  ) {
    this.variables = vars || [];
    this.path = path;
  }

  createOrUpdateCustomJS(name: string, value: string) {
    const variable = createOrUpdateVar(this.variables, name, this.path, {
      type: "jsm",
      parameter: [
        {
          type: "template",
          key: "javascript",
          value,
        },
      ],
    });

    this.variables.push(variable);
  }

  createOrUpdateJS(name: string, value: string) {
    const variable = createOrUpdateVar(this.variables, name, this.path, {
      type: "j",
      parameter: [
        {
          type: "template",
          key: "name",
          value,
        },
      ],
    });

    this.variables.push(variable);
  }
}

/**
 * @summary creates a GTM variable or updates it
 */
const createOrUpdateTrigger = (
  triggers: GoogleAppsScript.TagManager.Schema.Trigger[],
  nameToFind: string,
  path: string,
  init: GoogleAppsScript.TagManager.Schema.Trigger
): GoogleAppsScript.TagManager.Schema.Trigger => {
  const t = triggers.find(({ name }) => nameToFind === name);
  const applied = { ...init, name: nameToFind };

  const trgService = TagManager?.Accounts?.Containers?.Workspaces?.Triggers!;

  return t
    ? trgService.update(applied, t.path!)
    : trgService.create(applied, path);
};

/**
 * @summary creates a GTM tag or updates it
 */
const createOrUpdateTag = (
  tags: GoogleAppsScript.TagManager.Schema.Tag[],
  nameToFind: string,
  path: string,
  init: GoogleAppsScript.TagManager.Schema.Tag
) => {
  const t = tags.find(({ name }) => nameToFind === name);
  const applied = { ...init, name: nameToFind };

  const tagService = TagManager?.Accounts?.Containers?.Workspaces?.Tags!;

  return t
    ? tagService.update(applied, t.path!)
    : tagService.create(applied, path);
};

const installWindowLoadedTrigger = (
  triggers: GoogleAppsScript.TagManager.Schema.Trigger[],
  path: string,
  name: string
) =>
  createOrUpdateTrigger(triggers, name, path, {
    type: "windowLoaded",
  });

interface PageViewInstallOptions {
  triggers: GoogleAppsScript.TagManager.Schema.Trigger[];
  name: string;
  path: string;
}

const installPageViewTrigger = ({
  triggers,
  name,
  path,
}: PageViewInstallOptions) => {
  const old = triggers.find(
    ({ name: n, type }) => type === "pageview" && name === n
  );

  const trgConfig = {
    type: "pageview",
    name,
  };

  const trgService = TagManager?.Accounts?.Containers?.Workspaces?.Triggers!;

  return old
    ? trgService.update(trgConfig, path)
    : trgService.create(trgConfig, path);
};

/**
 * @summary installs GTM container and variables
 */
function deployAddon(
  gaAccountID: string,
  containerPath: string,
  wspacePath: string,
  sMyCategory: string,
  sMyEvent: string,
  accountId: string
) {
  const ui = SpreadsheetApp.getUi();

  const { sUrl: sTagCommand } = createForm(sMyCategory, sMyEvent);

  const status = setProfileID(gaAccountID);

  if (!status) return ui.alert("Failed to save Analytics ID!");

  if (!sTagCommand) return ui.alert("Failed to create tracking Form!");

  try {
    const container = HelpersTagManager.getContainer(containerPath);

    if (!container || !container.containerId)
      return ui.alert(`Failed to get GTM container`);

    const { publicId, containerId } = container;

    const {
      tagManager: {
        variables: varNames,
        variables: { prefix },
      },
    } = APP_CONFIG;

    const tagNames = {
      img: `${prefix}Caller on Site`,
      geo: `${prefix}Geolocation`,
    };

    const triggerNames = {
      load: `${prefix}Window Loaded`,
    };

    const vars = HelpersTagManager.listVariables(wspacePath);

    const VModel = new VariableModel(vars, wspacePath);

    VModel.createOrUpdateJS(varNames.title, "document.title");

    VModel.createOrUpdateCustomJS(
      varNames.uagent,
      getUserDefinedVariables_("userAgent")
    );

    VModel.createOrUpdateCustomJS(
      varNames.geo,
      getUserDefinedVariables_("geolocation")
    );

    VModel.createOrUpdateCustomJS(
      varNames.clid,
      getUserDefinedVariables_("clientId", {
        vars: { publicId },
      })
    );

    VModel.createOrUpdateCustomJS(
      varNames.time,
      getUserDefinedVariables_("getTime")
    );

    VModel.createOrUpdateCustomJS(
      varNames.cid,
      getUserDefinedVariables_("cid")
    );

    const triggers = HelpersTagManager.listTriggers(wspacePath);

    const { triggerId } = installWindowLoadedTrigger(
      triggers,
      wspacePath,
      triggerNames.load
    );

    const tags = HelpersTagManager.listTags(wspacePath);

    createOrUpdateTag(tags, tagNames.img, wspacePath, {
      type: "img",
      parameter: [
        { type: "boolean", value: "true", key: "useCacheBuster" },
        { type: "template", value: sTagCommand, key: "url" },
        { type: "template", value: "gtmcb", key: "cacheBusterQueryParam" },
      ],
      firingTriggerId: [triggerId!],
    });

    const version = versionWorkspace(wspacePath, sVERSION_NAME);

    const { code, containerVersion } = backoffSync(republishContainer, {
      onBeforeBackoff: () => console.warn("too many GTM requests, backoff"),
      comparator: ({ code }) => code !== 429,
      scheduler: (wait) => Utilities.sleep(wait),
      threshold: 1e3,
    })(version);

    if (code === 400) return showMsg(`Failed to republish container`);

    const { name, containerVersionId } = containerVersion!;

    //save GTM info;
    const gtmStatus = setGtmInfo({
      accountId: accountId.replace("accounts/", ""),
      containerId,
      workspaceId: version.workspaceId,
      versionId: containerVersionId!,
    });

    if (!gtmStatus) return ui.alert("Failed to save GTM data!");

    showMsg(`Published "${name}" container (version ${containerVersionId})`);
  } catch (e) {
    console.warn(e);
    showMsg(`Failed to deploy Add-on`);
    return e;
  }
}

/**
 * @summary creates a new GTM Workspace version
 */
const versionWorkspace = (workspacePath: string, name: string) => {
  const response = HelpersTagManager.version(workspacePath, name);

  if (!response) throw new Error(`Failed to version GTM container`);

  const { compilerError, containerVersion, newWorkspacePath } = response;

  if (compilerError) throw new Error(`Failed to create GTM container version`);

  //update returns old workspace ID, but new ID in path
  const workspaceId = newWorkspacePath!.replace(/.+workspaces\//, "");

  return {
    ...containerVersion,
    workspaceId,
  };
};

type ContainerPublishResult = {
  code?: 429 | 400 | 200;
  containerVersion?: GoogleAppsScript.TagManager.Schema.ContainerVersion;
};

/**
 * @summary republishes a Tag Manager Container
 */
function republishContainer({
  path,
}: GoogleAppsScript.TagManager.Schema.ContainerVersion) {
  const result: ContainerPublishResult = {};

  try {
    const { compilerError, containerVersion } =
      TagManager?.Accounts?.Containers?.Versions?.publish(path!) || {};

    if (compilerError) {
      result.code = 400;
      return result;
    }

    result.containerVersion = containerVersion;
    result.code = 200;

    return result;
  } catch ({ details: { code, message } }) {
    console.warn(message);
    result.code = code;
    return result;
  }
}

/**
 * @summary lists account containers
 */
const getConteinersArrByAcc = (parent: string) =>
  HelpersTagManager.getConteinersListByAcc(parent).container;

/**
 * @summary lists container workspaces
 */
const getWorkspacesArrByCont = (parent: string) =>
  HelpersTagManager.listWorkspaces(parent);