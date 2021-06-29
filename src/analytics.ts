const getGoogleAnalyticsAccounts = () => {
    const { items = [] } = Analytics?.Management?.Accounts?.list() || {};
    return items;
};

/**
 * @summary gets Google Analytics properties by account
 */
function getGaPropertiesArrByAcc(sAccID: string) {
    const response: {
        status: boolean;
        properties: GoogleAppsScript.Analytics.Schema.Webproperty[];
    } = { status: true, properties: [] };

    try {
        const { items } =
            Analytics?.Management?.Webproperties?.list(sAccID) || {};

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

const getGaProfiles = (accountId: string, webPropertyId: string) =>
    AnalyticsManagementHelper.listProfiles({ accountId, webPropertyId });

/**
 * @see {@link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters}
 */
type AnalyticsParameters = {
    v: number;
    tid: string;
    cid: string;
    t: "event";
    ec: string;
    ea: string;
    ev: number;
    z: number;
    ni: number;
    ua: string;
    dh?: string;
    dp?: string;
    dt?: string;
    uip?: string;
};

/**
 * @summary onEdit sending a hit to analytics
 */
const onEditEvent = (e: GoogleAppsScript.Events.SheetsOnEdit) =>
    TriggersApp.guardTracked(e, function onEditEvent({ range }) {
        const catActPair = range.getValue().toString();
        const iRow = range.getRow();

        const ss = SpreadsheetApp.getActiveSpreadsheet();

        if (!catActPair || !ss) return;

        const sheet = ss.getActiveSheet();

        const [[stamp, _timestamp, cid, geo, _src, tgt, title, userAgent]] =
            sheet.getRange(iRow, 1, 1, sheet.getLastColumn()).getValues();

        if (!cid) return sheet.getRange(`I${iRow}`).clearContent();

        const {
            accounts: {
                analytics: { property },
            },
        } = getSettings();

        const [category, action] = catActPair.split("/");

        const domain = extractDomain(tgt);
        const page = extractPage(tgt);

        const success = AnalyticsMeasurementHelper.collectEvent({
            tid: property,
            cid,
            category,
            action,
            domain,
            page,
            title,
            userAgent,
            timestamp: stamp,
            geo,
        });

        if (!success) promptUAinstall();

        ss.toast(
            success ? `Successfully sent` : `Failed to send`,
            "Google Analytics"
        );
    });

type CommonAnalyticsOptions = {
    accountId: string;
    profileId: string;
    webPropertyId: string;
};

type AnalyticsListProfilesOptions = Pick<
    CommonAnalyticsOptions,
    "accountId" | "webPropertyId"
>;

type AnalyticsGetGoalOptions = {
    goalId: string;
} & CommonAnalyticsOptions;

type AnalyticsGoal = GoogleAppsScript.Analytics.Schema.Goal & {
    type:
        | "URL_DESTINATION"
        | "VISIT_TIME_ON_SITE"
        | "VISIT_NUM_PAGES"
        | "EVENT";
};

type AnalyticsCreateGoalOptions = AnalyticsGoal & CommonAnalyticsOptions;

type AnalyticsUpdateGoalOptions = AnalyticsCreateGoalOptions & {
    goalId: string;
};

type AnalyticsListResponse<T extends "analytics#goals" | "analytics#profiles"> =
    {
        kind: T;
        totalResults: number;
        itemsPerPage: number;
        startIndex: number;
        username: string;
        items: {
            "analytics#goals": GoogleAppsScript.Analytics.Schema.Goal;
            "analytics#profiles": GoogleAppsScript.Analytics.Schema.Profile;
        }[T][];
        previousLink: string;
        nextLink: string;
    };

class AnalyticsManagementHelper extends Helper {
    static version = 3;

    static base = `https://www.googleapis.com/analytics/v${AnalyticsManagementHelper.version}/management`;

    static addAuthHeaders(headers: object = {}, token?: string) {
        return {
            headers: {
                ...headers,
                Authorization: `Bearer ${token || this.userAuthToken}`,
            },
        };
    }

    static getPropertyPath(accountId: string, webPropertyId: string) {
        return `accounts/${accountId}/webproperties/${webPropertyId}/`;
    }

    static getProfilePath(
        accountId: string,
        webPropertyId: string,
        profileId: string
    ) {
        return `${this.getPropertyPath(
            accountId,
            webPropertyId
        )}profiles/${profileId}/`;
    }

    static getGoalPath(
        accountId: string,
        webPropertyId: string,
        profileId: string,
        goalId: string
    ) {
        return `${this.getProfilePath(
            accountId,
            webPropertyId,
            profileId
        )}goals/${goalId}`;
    }

    /**
     * @see {@link https://developers.google.com/analytics/devguides/config/mgmt/v3/mgmtReference/management/goals/list}
     */
    static listGoals({
        accountId,
        profileId,
        webPropertyId,
    }: CommonAnalyticsOptions) {
        const { base } = this;

        const res = UrlFetchApp.fetch(
            `${base}/${this.getProfilePath(
                accountId,
                webPropertyId,
                profileId
            )}goals`,
            {
                ...this.getCommonFetchOpts(),
                ...this.addAuthHeaders(),
            }
        );

        const code = res.getResponseCode(),
            content = JSON.parse(res.getContentText());

        const success = code === 200;

        success || console.warn(content);

        if (!success) return [];

        //TODO: expand to include pagination
        const { items = [] } =
            content as AnalyticsListResponse<"analytics#goals">;

        return items;
    }

    /**
     * @see {@link https://developers.google.com/analytics/devguides/config/mgmt/v3/mgmtReference/management/goals/get}
     */
    static getGoal({
        accountId,
        profileId,
        webPropertyId,
        goalId,
    }: AnalyticsGetGoalOptions): GoogleAppsScript.Analytics.Schema.Goal {
        const { base } = this;

        const res = UrlFetchApp.fetch(
            `${base}/${this.getGoalPath(
                accountId,
                webPropertyId,
                profileId,
                goalId
            )}`,
            {
                ...this.getCommonFetchOpts(),
                ...this.addAuthHeaders(),
            }
        );

        const code = res.getResponseCode(),
            content = JSON.parse(res.getContentText());

        const success = code === 200;

        success || console.warn(content);

        return success ? content : null;
    }

    /**
     * @see {@link https://developers.google.com/analytics/devguides/config/mgmt/v3/mgmtReference/management/goals/insert}
     */
    static createGoal({
        accountId,
        profileId,
        webPropertyId,
        ...rest
    }: AnalyticsCreateGoalOptions) {
        const { base } = this;

        //generates sequential unique id for the goal
        const goals = this.listGoals({ accountId, profileId, webPropertyId });
        const goalIds = goals.map(({ id }) => id!).sort();
        const id = (+goalIds[goalIds.length - 1] + 1).toString();

        const goal: GoogleAppsScript.Analytics.Schema.Goal = {
            id,
            ...rest,
        };

        const res = UrlFetchApp.fetch(
            `${base}/${this.getProfilePath(
                accountId,
                webPropertyId,
                profileId
            )}goals`,
            {
                ...this.getCommonFetchOpts(),
                ...this.addAuthHeaders(),
                method: "post",
                payload: JSON.stringify(goal),
            }
        );

        return this.processResponse(res);
    }

    /**
     * @see {@link https://developers.google.com/analytics/devguides/config/mgmt/v3/mgmtReference/management/goals/patch}
     */
    static updateGoal({
        goalId,
        accountId,
        profileId,
        webPropertyId,
        ...rest
    }: AnalyticsUpdateGoalOptions) {
        const { base } = this;

        const res = UrlFetchApp.fetch(
            `${base}/${this.getGoalPath(
                accountId,
                webPropertyId,
                profileId,
                goalId
            )}s`,
            {
                ...this.getCommonFetchOpts(),
                ...this.addAuthHeaders(),
                method: "patch",
                payload: JSON.stringify(rest),
            }
        );

        return this.processResponse(res);
    }

    /**
     * @see {@link https://developers.google.com/analytics/devguides/config/mgmt/v3/mgmtReference/management/profiles/list}
     */
    static listProfiles({
        accountId,
        webPropertyId,
    }: AnalyticsListProfilesOptions) {
        const { base } = this;

        const res = UrlFetchApp.fetch(
            `${base}/${this.getPropertyPath(accountId, webPropertyId)}profiles`,
            {
                ...this.getCommonFetchOpts(),
                ...this.addAuthHeaders(),
            }
        );

        const code = res.getResponseCode(),
            content = JSON.parse(res.getContentText());

        const success = code === 200;

        success || console.warn(content);

        if (!success) return [];

        //TODO: expand to include pagination
        const { items = [] } =
            content as AnalyticsListResponse<"analytics#profiles">;

        return items;
    }
}

const testListGoals = () => {
    const goals = AnalyticsManagementHelper.listGoals({
        accountId: "134578661",
        profileId: "230400611",
        webPropertyId: "UA-134578661-2",
    });
    console.log({ goals });
};

const testCreateGoal = () => {
    AnalyticsManagementHelper.createGoal({
        accountId: "134578661",
        profileId: "230400611",
        webPropertyId: "UA-134578661-2",
        type: "EVENT",
        eventDetails: {
            eventConditions: [{}],
            useEventValue: true,
        },
    });
};

type AnalyticsPageviewOptions = {
    domain: string;
    page: string;
    title: string;
};

type AnalyticsCollectEventOptions = {
    value?: AnalyticsParameters["ev"];
    timestamp: AnalyticsParameters["z"];
    category: AnalyticsParameters["ec"];
    action: AnalyticsParameters["ea"];
    geo: AnalyticsParameters["uip"];
    userAgent: AnalyticsParameters["ua"];
} & Partial<AnalyticsPageviewOptions> &
    Pick<AnalyticsParameters, "cid" | "tid">;

class AnalyticsMeasurementHelper extends Helper {
    static version = 1;

    static base = `https://www.google-analytics.com`;

    static get isTest() {
        return APP_CONFIG.ENV === "test";
    }

    static get fullURL() {
        const { base, isTest } = this;
        return `${base}/${isTest ? `debug/collect` : "collect"}`;
    }

    /**
     * @see {@link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters}
     */
    static get commonCollectParams() {
        return {
            v: this.version,
            ni: 1,
            tid: APP_CONFIG.ids.analytics,
        };
    }

    static collectEvent({
        timestamp,
        value = 1,
        domain,
        page,
        title,
        tid,
        cid,
        category,
        action,
        userAgent,
        geo,
    }: AnalyticsCollectEventOptions) {
        const z = Math.trunc(new Date(timestamp).valueOf());

        const queryConfig: AnalyticsParameters = {
            ...this.commonCollectParams,
            tid,
            cid,
            z,
            t: "event",
            ec: category,
            ea: action,
            ev: value,
            ua: userAgent,
            dh: domain,
            dp: page,
            dt: title,
        };

        if (geo) queryConfig.uip = geo;

        const query = objectToQuery(queryConfig);

        const url = `${AnalyticsMeasurementHelper.fullURL}?${query}`;

        const res = UrlFetchApp.fetch(url, {
            muteHttpExceptions: true,
        });

        return this.processResponse(res);
    }

    static collectPageview(
        cid: string,
        location: string,
        title: string,
        path: string
    ) {
        const { fullURL, commonCollectParams } = this;

        const query = objectToQuery({
            ...commonCollectParams,
            t: "pageview",
            dl: location,
            dt: title,
            dp: path,
            cid,
        });

        const res = UrlFetchApp.fetch(`${fullURL}?${query}`, {
            muteHttpExceptions: true,
        });

        return this.processResponse(res);
    }
}

type EventGoalCreationOptions = {
    gaAccount: string;
    gaProperty: string;
    gaProfile: string;
    category: string;
    action: string;
};

const createEventGoal = ({
    gaAccount,
    gaProperty,
    gaProfile,
    category,
    action,
}: EventGoalCreationOptions) =>
    AnalyticsManagementHelper.createGoal({
        accountId: gaAccount,
        webPropertyId: gaProperty,
        profileId: gaProfile,
        type: "EVENT",
        name: getConfig().analytics.goals.name,
        active: true,
        eventDetails: {
            eventConditions: [
                {
                    type: "CATEGORY",
                    matchType: "EXACT",
                    expression: category,
                },
                {
                    type: "ACTION",
                    matchType: "EXACT",
                    expression: action,
                },
            ],
            useEventValue: true,
        },
    });

/**
 * @summary wrapper to client-side page view
 */
const sendPageview = (
    ...args: Parameters<typeof AnalyticsMeasurementHelper["collectPageview"]>
) => AnalyticsMeasurementHelper.collectPageview(...args);

const makeUAparameter = (id: string) => ({
    key: "trackingId",
    type: "template",
    value: id,
});

/**
 * @summary installs Google Analytics container
 */
const installGAtag = () => {
    try {
        const gtmInfo = getGtmInfo();

        const {
            accounts: {
                tagManager: { account, container, workspace },
                analytics: { property },
            },
        } = getSettings();

        HelpersTagManager.setIds({
            accountId: account,
            containerId: container,
            workspaceId: workspace,
        });

        HelpersTagManager.getAccountById(account);
        HelpersTagManager.getContainerById(container);

        const {
            tagManager: {
                tags: { ua },
                triggers: { view },
                versions: { main },
            },
        } = APP_CONFIG;

        const version = HelpersTagManager.getLiveVersion();
        if (!version) return false;

        const { trigger: triggers = [], tag: tags = [] } = version;

        const path = HelpersTagManager.getWorkspacePath();

        const existsTrigger = triggers.find(({ name }) => name === view);
        const existsTag = tags.find(({ name }) => name === ua);
        if (existsTrigger || existsTag) return true;

        //!important: GA tag must fire as soon as possible or `ga` is defined later than we submit
        const { triggerId } = installPageViewTrigger({
            triggers,
            name: view,
            path,
        });

        if (!triggerId) return false;

        const installed = installTag(
            tags,
            ua, //note: tag name must be unique (the function checks for tag existense, though)
            path,
            {
                type: "ua",
                parameter: [makeUAparameter(property)],
                firingTriggerId: [triggerId],
            }
        );

        const updated = versionWorkspace(path, main);
        const { code, containerVersion } = republishVersion(updated);

        if (code !== 200) return false;

        //!important: makes sure reinstalls reference updated versions
        gtmInfo.versionId = containerVersion!.containerVersionId!; //TODO: improve typings
        gtmInfo.workspaceId = installed.workspaceId!;
        setGtmInfo(gtmInfo);

        //remove metadata about GA prompt
        const sheet = getFormSheet();
        sheet && deleteAllMetadata({ sheet });

        return true;
    } catch (error) {
        console.warn(error);
        return false;
    }
};

type GASettings = {
    analyticsId?: string;
    propertyId?: string;
    profileId?: string;
};

interface AnalyticsListHelper extends GASettings {}

const errable =
    (returnOnError: unknown, msg: string) =>
    <T extends (...args: any[]) => any>(
        _tgt: object,
        _key: string,
        descr: TypedPropertyDescriptor<T>
    ) => {
        const nakedValue = descr.value!;

        return {
            ...descr,
            value: function (...args: Parameters<typeof nakedValue>) {
                try {
                    return nakedValue.apply(this, args);
                } catch (error) {
                    console.warn(msg.replace("%e", error));
                    return returnOnError;
                }
            },
        };
    };

class AnalyticsListHelper extends Helper {
    constructor(ids: GASettings = {}) {
        super();
        Object.assign(this, ids);
    }

    @errable([], "failed to list GA accounts: %e")
    listAccounts() {
        const { items = [] } = Analytics.Management?.Accounts?.list() || {};
        return items;
    }

    @errable([], "failed to list GA properties: %e")
    listProperties({ analyticsId }: GASettings = {}) {
        const { items = [] } =
            Analytics.Management?.Webproperties?.list(
                analyticsId || this.analyticsId!
            ) || {};
        return items;
    }

    @errable([], "failed to list GA profiles: %e")
    listProfiles({ analyticsId, propertyId }: GASettings = {}) {
        const { items = [] } =
            Analytics.Management?.Profiles?.list(
                analyticsId || this.analyticsId!,
                propertyId || this.propertyId!
            ) || {};
        return items;
    }
}
const listAnalyticsAccounts = () => new AnalyticsListHelper().listAccounts();
const listAnalyticsProperties = (analyticsId: string) =>
    new AnalyticsListHelper({ analyticsId }).listProperties();

const listAnalyticsProfiles = (analyticsId: string, propertyId: string) =>
    new AnalyticsListHelper({ analyticsId, propertyId }).listProfiles();
