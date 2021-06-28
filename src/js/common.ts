type Option = [value: string, text: string];

type ChangeHandler = (
    sel: HTMLSelectElement,
    ...params: string[]
) => Promise<void>;

type IdChangeHandler<T> = {
    [P in keyof T]: (v: string) => ReturnType<ChangeHandler>;
};

type AnalyticsSettings = {
    account: string;
    property: string;
    profile: string;
};

type TagManagerSettings = {
    account: string;
    container: string;
    workspace: string;
};

type Prefixed<T, K extends string> = {
    [P in keyof T as `${K}-${Exclude<P, symbol>}`]: T[P];
};

type PfxGTMSettings = Prefixed<TagManagerSettings, "gtm">;

const mapToOpts = ({ id, name }: { id?: string; name?: string }) =>
    <Option>[id, name];

const clearSelect = ({ options }: HTMLSelectElement, leave = 0) =>
    [...options].slice(leave).forEach((option) => option.remove());

const reinitSelect = (sel: HTMLSelectElement, value = "") => {
    sel.value = value;
    const { options } = M.FormSelect.getInstance(sel);
    return M.FormSelect.init(sel, options);
};
const appendOptions = (sel: HTMLSelectElement, options: Option[]) => {
    const opts = options.map(([val, txt]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = txt;
        return opt;
    });
    sel.append(...opts);
    return sel;
};

/**
 * @summary generic change handler
 */
const makeChangeHandler =
    <P extends { name?: string }>(prop: keyof P, sel: HTMLSelectElement) =>
    (data: P[], value = "") => {
        clearSelect(sel, 1);
        const opts = data.map((item) => [item[prop], item.name]);
        appendOptions(sel, <Option[]>opts);
        reinitSelect(sel, value);
    };

type EntityGetterOptions<T> = {
    key: keyof T;
    cbk: string;
    val: string;
    params?: google.script.Parameter[];
};

const getEntities = async <T>(
    sel: HTMLSelectElement,
    { key, cbk, val, params = [] }: EntityGetterOptions<T>
) => {
    const entities = await gscript<T[]>(cbk, ...params);
    return makeChangeHandler<T>(key, sel)(entities, val);
};

const updateGAaccounts: ChangeHandler = (sel, val = "") =>
    getEntities<GoogleAppsScript.Analytics.Schema.Account>(sel, {
        key: "id",
        cbk: "getGoogleAnalyticsAccounts",
        val,
    });

const updateGAproperties: ChangeHandler = (sel, accountId, val = "") =>
    getEntities<GoogleAppsScript.Analytics.Schema.Webproperty>(sel, {
        key: "id",
        cbk: "listAnalyticsProperties",
        params: [accountId],
        val,
    });

const updateGAprofiles: ChangeHandler = (
    sel,
    accountId,
    propertyId,
    val = ""
) =>
    getEntities<GoogleAppsScript.Analytics.Schema.Profile>(sel, {
        key: "id",
        cbk: "listAnalyticsProfiles",
        params: [accountId, propertyId],
        val,
    });

const updateGTMaccounts: ChangeHandler = (sel, val = "") =>
    getEntities<GoogleAppsScript.TagManager.Schema.Account>(sel, {
        key: "accountId",
        cbk: "listTagManagerAccounts",
        val,
    });

const updateGTMcontainers: ChangeHandler = (sel, accountId, val = "") =>
    getEntities<GoogleAppsScript.TagManager.Schema.Container>(sel, {
        key: "containerId",
        cbk: "getConteinersArrByAcc",
        params: [accountId],
        val,
    });

const updateGTMwspaces: ChangeHandler = (
    sel,
    accountId,
    containerId,
    val = ""
) =>
    getEntities<GoogleAppsScript.TagManager.Schema.Workspace>(sel, {
        key: "workspaceId",
        cbk: "getWorkspacesArrByCont",
        params: [accountId, containerId],
        val,
    });

const setupAnalytics = async (settings: AnalyticsSettings) => {
    const { account, property, profile } = settings;

    const ids: (keyof AnalyticsSettings)[] = ["account", "property", "profile"];

    const [acc, prop, prof] = ids.map(
        (id) => document.getElementById<HTMLSelectElement>(id)!
    );

    await updateGAaccounts(acc, account);
    if (prop) await updateGAproperties(prop, account, property);
    if (prof) await updateGAprofiles(prof, account, property, profile);

    document.addEventListener("change", async ({ target }) => {
        const el = <HTMLSelectElement>target;

        const { id, parentElement, value } = el;

        const actionMap: IdChangeHandler<AnalyticsSettings> = {
            account: (v) => updateGAproperties(prop, v),
            property: (v) => updateGAprofiles(prof, acc.value, v),
            profile: () => Promise.resolve(),
        };

        const handler = actionMap[<keyof AnalyticsSettings>id];
        if (!handler) return;

        await handler(value);

        await gscript("updateSettings", {
            [`accounts/analytics/${id}`]: value,
        });

        settings[<keyof AnalyticsSettings>id] = value;

        const { nextElementSibling: label } = parentElement!;
        notify(
            `${label?.textContent || "Setting"} saved`,
            config.classes.notify.success
        );
    });
};

const setupTagManager = async (settings: TagManagerSettings) => {
    const { account, container, workspace } = settings;

    const ids: (keyof PfxGTMSettings)[] = [
        "gtm-account",
        "gtm-container",
        "gtm-workspace",
    ];

    const [acc, con, wrk] = ids.map(
        (id) => document.getElementById<HTMLSelectElement>(id)!
    );

    await updateGTMaccounts(acc, account);
    if (container) await updateGTMcontainers(con, account, container);
    if (workspace) await updateGTMwspaces(wrk, account, container, workspace);

    document.addEventListener("change", async ({ target }) => {
        const el = <HTMLSelectElement>target;

        const { id, parentElement, value } = el;

        const actionMap: IdChangeHandler<PfxGTMSettings> = {
            "gtm-account": (v) => updateGTMcontainers(con, v),
            "gtm-container": (v) => updateGTMwspaces(wrk, acc.value, v),
            "gtm-workspace": () => Promise.resolve(),
        };

        const handler = actionMap[<keyof PfxGTMSettings>id];
        if (!handler) return;

        await handler(value);

        const unpfxed = <keyof TagManagerSettings>id.replace("gtm-", "");

        await gscript("updateSettings", {
            [`accounts/tagManager/${unpfxed}`]: value,
        });

        settings[unpfxed] = value;

        const custom = new CustomEvent("gtm-change", {
            bubbles: true,
            detail: settings,
        });
        document.dispatchEvent(custom);

        const { nextElementSibling: label } = parentElement!;
        notify(
            `${label?.textContent || "Setting"} saved`,
            config.classes.notify.success
        );
    });
};

const checkGTM = (info: AppSettings["accounts"]["tagManager"]) =>
    Object.values(info).every(Boolean);

const checkAnalytics = (info: AppSettings["accounts"]["analytics"]) =>
    Object.values(info).every(Boolean);
