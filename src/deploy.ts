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
const deployAddonGo = () => {
    prepareTriggersForUse();
    recordNewOwner();

    const { firstTime } = getSettings();
    if (firstTime) return showInstructionsOnFirstTime();

    const analyticsAccounts = getAccounts(
        getGoogleAnalyticsAccounts,
        "There is access to Analytics, but no account.",
        "No Google Analytics accounts available. Please create at least one."
    );

    const gtagAccounts = getAccounts(
        listTagManagerAccounts,
        "There is access to GTM, but no account.",
        "No Google Tag Manager accounts found. Please create and setup at least one."
    );

    const output = loadTemplate(
        true,
        "dist",
        "setup",
        {
            ...commonDependencies,
            setupStyle: "dist/css",
            setupUtils: "dist/js",
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
        strings: {
            form: { title },
        },
    } = APP_CONFIG;

    output.setHeight(height);
    output.setWidth(width);
    output.setTitle(title);

    const ui = SpreadsheetApp.getUi();
    return ui.showModalDialog(output, title);
};

/**
 * @summary creates a GTM variable or updates it
 */
const installVariable = (
    vars: GoogleAppsScript.TagManager.Schema.Variable[],
    nameToFind: string,
    path: string,
    init: GoogleAppsScript.TagManager.Schema.Variable
) => {
    const v = vars.find(({ name }) => nameToFind === name);
    const applied = { ...init, name: nameToFind };

    const varsService =
        TagManager?.Accounts?.Containers?.Workspaces?.Variables!;

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
        const value = HtmlService.createHtmlOutputFromFile(
            this.path || pathToFile
        ).getContent();

        const tag = installTag(this.tags, name, this.path, {
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

    installCustomJS(name: string, value: string) {
        const { variables, path } = this;

        const variable = installVariable(variables, name, path, {
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

    installJS(name: string, value: string) {
        const variable = installVariable(this.variables, name, this.path, {
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
const installTrigger = (
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
const installTag = (
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

type AddonDeploymentOptions = {
    containerId: string;
    workspaceId: string;
    accountId: string;
    category: string;
    action: string;
    // adsAccountId: string;
};

type VariableOptions = Pick<
    AddonDeploymentOptions,
    "accountId" | "containerId" | "workspaceId"
>;

type VariableNames = {
    title: string;
    uagent: string;
    geo: string;
    clid: string;
    time: string;
    cid: string;
};

/**
 * @summary creates or updates required variables
 */
const installVariables = (
    ids: VariableOptions,
    { title, uagent, geo, clid, cid, time }: VariableNames,
    publicId?: string
) => {
    try {
        HelpersTagManager.setIds(ids);

        const wspacePath = HelpersTagManager.getWorkspacePath();
        const vars = HelpersTagManager.listVariables(wspacePath);

        const VModel = new VariableModel(vars, wspacePath);

        VModel.installJS(title, "document.title");

        VModel.installCustomJS(uagent, getUserVariables_("userAgent"));
        VModel.installCustomJS(geo, getUserVariables_("geolocation"));

        VModel.installCustomJS(
            clid,
            getUserVariables_("clientId", {
                vars: { publicId },
            })
        );

        VModel.installCustomJS(time, getUserVariables_("getTime"));
        VModel.installCustomJS(cid, getUserVariables_("cid"));

        return true;
    } catch (error) {
        console.warn(`failed to install vars: ${error}`);
        return false;
    }
};

/**
 * @summary installs GTM container and variables
 */
function deployAddon({
    containerId,
    workspaceId,
    accountId,
    category,
    action,
}: // adsAccountId,
AddonDeploymentOptions) {
    const { sUrl: sTagCommand } = createForm(category, action);

    if (!sTagCommand) return showMsg("Failed to create tracking Form!");

    try {
        HelpersTagManager.setIds({ containerId, accountId, workspaceId });

        const container = HelpersTagManager.getContainerById(containerId);
        if (!container) return showMsg(`Failed to get GTM container`);

        const { publicId } = container;

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

        const wspacePath = HelpersTagManager.getWorkspacePath();

        const installedVars = installVariables(
            { accountId, containerId, workspaceId },
            varNames,
            publicId
        );

        if (!installedVars) return showMsg("Failed to install GTM variables!");

        Utilities.sleep(1e3); //reduce chances of rate limiting

        const triggers = HelpersTagManager.listTriggers(wspacePath);
        const tags = HelpersTagManager.listTags(wspacePath);

        const commonBackoffOptions: Pick<
            BackoffOptions<any>,
            "comparator" | "scheduler" | "threshold" | "retries"
        > = {
            comparator: ({ code } = {}) => code !== 429,
            scheduler: (wait) => Utilities.sleep(wait),
            threshold: 2e3,
            retries: 5,
        };

        const { triggerId } = backoffSync(installTrigger, {
            onBeforeBackoff: () => console.log(`quota: ${installTrigger.name}`),
            ...commonBackoffOptions,
        })(triggers, triggerNames.load, wspacePath, {
            type: "windowLoaded",
        });

        backoffSync(installTag, {
            onBeforeBackoff: () => console.log(`quota: ${installTag.name}`),
            ...commonBackoffOptions,
        })(tags, tagNames.img, wspacePath, {
            type: "img",
            parameter: [
                { type: "boolean", value: "true", key: "useCacheBuster" },
                { type: "template", value: sTagCommand, key: "url" },
                {
                    type: "template",
                    value: "gtmcb",
                    key: "cacheBusterQueryParam",
                },
            ],
            firingTriggerId: [triggerId!],
        });

        const version = backoffSync(versionWorkspace, {
            onBeforeBackoff: () =>
                console.warn(`quota: ${versionWorkspace.name}`),
            ...commonBackoffOptions,
        })(wspacePath, sVERSION_NAME);

        const { code, containerVersion } = backoffSync(republishVersion, {
            onBeforeBackoff: () =>
                console.warn(`quota: ${republishVersion.name}`),
            ...commonBackoffOptions,
        })(version);

        if (code === 400) return showMsg(`Failed to republish container`);

        const { name, containerVersionId } = containerVersion!;

        //save GTM info;
        const gtmStatus = setGtmInfo({
            accountId,
            containerId,
            workspaceId: version.workspaceId,
            versionId: containerVersionId!,
        });

        if (!gtmStatus) return showMsg("Failed to save GTM data!");

        showMsg(`Updated "${name}" container (version ${containerVersionId})`);
    } catch (e) {
        console.warn(`failed to deploy: ${e}`);
        showMsg(`Failed to deploy Add-on`);
        return e;
    }
}

/**
 * @summary creates a new GTM Workspace version
 */
const versionWorkspace = (workspacePath: string, name: string) => {
    const response = HelpersTagManager.version(workspacePath, name) || {};

    const { compilerError, containerVersion, newWorkspacePath } = response;

    if (compilerError || !newWorkspacePath)
        throw new Error(`Failed to create GTM container version`);

    //update returns old workspace ID, but new ID in path
    const workspaceId = newWorkspacePath.replace(/.+workspaces\//, "");

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
function republishVersion({
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
