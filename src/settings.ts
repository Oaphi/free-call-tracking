type Indexable = {
    [x: string]: string | number | boolean | null | undefined | Indexable;
};

const fromPath = <V>(
    options: {
        path?: string;
        value?: V;
    } = {}
) => {
    const { path = "", value } = options;

    const output: Indexable = {};

    path.split(/\/|\\/).reduce(
        (a, c, i, paths) =>
            (a[c] =
                i < paths.length - 1 || !("value" in options) ? {} : value!),
        output
    );

    return output;
};

const deepAssign = <T extends Indexable>(tgt: T, ...src: Indexable[]): T => {
    src.forEach((source) => {
        Object.entries(source).forEach(([key, val]) => {
            const tgtVal = tgt[key];

            if (
                typeof tgtVal === "object" &&
                tgtVal &&
                typeof val === "object" &&
                val
            )
                return deepAssign(tgtVal, val);

            //@ts-expect-error
            tgt[key] = val;
        });
    });

    return tgt;
};

type AppSettings = {
    firstTime: boolean;
    triggers: {
        enableDailyClear: boolean;
        enableEditTrigger: boolean;
    };
    accounts: {
        ads: string;
        analytics: {
            account: string;
            profile: string;
            property: string;
        };
        tagManager: {
            account: string;
            container: string;
            workspace: string;
        };
    };
};

const getDefaults = (): AppSettings => ({
    firstTime: true,
    triggers: {
        enableDailyClear: true,
        enableEditTrigger: true,
    },
    accounts: {
        ads: "",
        analytics: {
            account: "",
            profile: "",
            property: "",
        },
        tagManager: {
            account: "",
            container: "",
            workspace: "",
        },
    },
});

const getSettings = (): AppSettings => {
    const defaults = getDefaults();

    const {
        properties: { settings },
    } = APP_CONFIG;

    try {
        const stored: AppSettings = JSON.parse(
            getProperty(settings, JSON.stringify(defaults))
        );
        //ensures structural updates don't break defaults
        return deepAssign(defaults, stored);
    } catch (error) {
        logException("settings", error);
        return defaults;
    }
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
            ? `${P}${Sep}${ExtractPathExpressions<T[P], Sep>}` | P
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

    try {
        const updates = Object.entries(updatesDict).map(([path, value]) =>
            fromPath({ path, value })
        );

        deepAssign(source, ...updates);

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
    } catch (error) {
        logException("settings", error);
    }

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
