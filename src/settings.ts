/**
 * @summary parse an object from path and value
 */
const fromPath = <V>(
    options: {
        path?: string;
        value?: V;
    } = {}
) => {
    const { path = "", value } = options;

    const output: Record<string, unknown> = {};

    path.split(/\/|\\/).reduce(
        (a, c, i, paths) =>
            (a[c] =
                i < paths.length - 1 || !("value" in options) ? {} : value!),
        output
    );

    return output;
};

type DeepAssignOpts = Errable<{
    source?: Record<string, unknown>;
    updates?: Record<string, unknown>[];
    objGuard?: (obj: unknown) => boolean;
}>;

/**
 * @summary deep assigns object props
 */
const deepAssign = ({
    source = {},
    updates = [],
    objGuard = <T extends object>(obj: T | unknown): obj is T =>
        typeof obj === "object" && !!obj,
    onError = console.warn,
}: DeepAssignOpts): Record<string, unknown> => {
    try {
        return updates.reduce((ac, up) => {
            const entries = Object.entries(up);

            const objEntries = entries.filter(([_, v]) => objGuard(v));
            const restEntries = entries.filter(([_, v]) => !objGuard(v));

            Object.assign(source, Object.fromEntries(restEntries));

            objEntries.reduce(
                (a, [k, v]) =>
                    (a[k] = deepAssign({
                        source: (a[k] as typeof source) || {}, //TODO: improve typing
                        updates: [v] as typeof updates,
                    })),
                ac
            );

            return ac;
        }, source);
    } catch (error) {
        onError(error);
    }

    return source;
};

type AppSettings = {
    firstTime: boolean;
    triggers: {
        enableDailyClear: boolean;
        enableEditTrigger: boolean;
    };
    accounts: {
        ads: string;
        analytics: string;
    };
};

const getSettings = (): AppSettings => {
    const defaults: AppSettings = {
        firstTime: true,
        triggers: {
            enableDailyClear: true,
            enableEditTrigger: true,
        },
        accounts: {
            ads: "",
            analytics: "",
        },
    };

    const {
        properties: { settings },
    } = APP_CONFIG;

    return JSON.parse(getProperty(settings, JSON.stringify(defaults)));
};

type ExtractPathExpressions<T, Sep extends string = "."> = Exclude<
    keyof {
        [P in Exclude<keyof T, symbol> as T[P] extends any[] | readonly any[]
            ?
                  | P
                  | `${P}[${number}]`
                  | `${P}[${number}]${Sep}${Exclude<
                        ExtractPathExpressions<T[P][number]>,
                        keyof number | keyof string
                    >}`
            : T[P] extends { [x: string]: any }
            ? `${P}${Sep}${ExtractPathExpressions<T[P]>}` | P
            : P]: string;
    },
    symbol
>;

type ValueByPathExpression<
    T,
    K extends ExtractPathExpressions<T, Sep>,
    Sep extends string = "/"
> = {
    [P in K]: P extends `${infer F}${Sep}${infer L}`
        ? F extends keyof T
            ? ValueByPathExpression<
                  T[F],
                  L extends ExtractPathExpressions<T[F], Sep> ? L : never,
                  Sep
              >
            : never
        : P extends keyof T
        ? T[P]
        : never;
}[K];

const updateSettings = <PE extends ExtractPathExpressions<AppSettings, "/">>(
    updatesDict: {
        [P in PE]: ValueByPathExpression<AppSettings, P>;
    }
) => {
    const source = getSettings();

    const updates = Object.entries(updatesDict).map(([path, value]) =>
        fromPath({ path, value })
    );

    deepAssign({ source, updates });

    source.firstTime = false;

    const {
        triggers: { enableDailyClear, enableEditTrigger },
    } = source;

    const trackedClear = {
        funcName: handleDailyClear.name,
        type: TriggersApp.TriggerTypes.CLOCK,
    };
    const trackedEdit = {
        funcName: onEditEvent.name,
        type: TriggersApp.TriggerTypes.EDIT,
    };

    enableDailyClear
        ? TriggersApp.enableTracked(trackedClear)
        : TriggersApp.disableTracked(trackedClear);

    enableEditTrigger
        ? TriggersApp.enableTracked(trackedEdit)
        : TriggersApp.disableTracked(trackedEdit);

    const {
        properties: { settings },
    } = APP_CONFIG;

    setProperty(settings, source);

    return source;
};

type ActionStatus = {
    errors: string[];
    warnings: string[];
    status: boolean;
    err(r: string): void;
    warn(r: string): void;
};

const makeActionStatus = (): ActionStatus => {
    return {
        status: true,
        warnings: [],
        errors: [],
        err(reason: string) {
            this.errors.push(reason);
            this.status = false;
        },
        warn(reason: string) {
            this.warnings.push(reason);
        },
    };
};

/**
 * @summary removes all saved addon data
 */
const reset = ({ onError = console.warn } = {}) => {
    const common = { onError };

    const status = makeActionStatus();

    const {
        properties: { metadata: key },
    } = APP_CONFIG;

    const untriggered = TriggersApp.deleteAllTracked(common);

    if (!untriggered) status.err(`Failed to delete triggers`);

    const untracked = TriggersApp.untrackTriggers(common);

    if (!untracked) status.err(`Failed to stop tracking triggers`);

    const deleted = deleteAllProperties(common);

    if (!deleted) status.err(`Failed to delete settings`);

    const unlinked = unlinkForm(common);

    if (!unlinked) {
        status.err(
            `Failed to unlink form<br>(if it is deleted, please unlink manually)`
        );
    }

    const removed = deleteFormSheet({ ...common, key });

    if (!removed && unlinked)
        status.err(`Failed to remove sheet with the form`);

    return status;
};
