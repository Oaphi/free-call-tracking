function include(filename: string) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

type ClearTypes = "all" | "format" | "notes" | "values";

interface CommonOptions {
    onError?: (err: Error) => void;
}

interface ClearSheetOptions extends CommonOptions {
    name?: string;
    range?: GoogleAppsScript.Spreadsheet.Range;
    skipRows?: number[];
    sheet?: GoogleAppsScript.Spreadsheet.Sheet;
    type?: ClearTypes;
}

interface ClearHandler {
    (
        sheet: GoogleAppsScript.Spreadsheet.Sheet
    ): GoogleAppsScript.Spreadsheet.Sheet;
}

/**
 * @summary clears a sheet
 */
const clearSheet = ({
    sheet,
    skipRows,
    range,
    name,
    type = "all",
    onError = (err) => console.warn(err),
}: ClearSheetOptions = {}) => {
    try {
        const targetSheet = range
            ? range.getSheet()
            : sheet ||
              SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
                  name || SpreadsheetApp.getActiveSheet().getSheetName()
              );

        if (!targetSheet) return false;

        if (skipRows) {
            const mrows = targetSheet.getMaxRows();
            const mcols = targetSheet.getMaxColumns();

            const rng = targetSheet.getRange(1, 1, mrows, mcols);

            const values = rng.getValues();
            const notes = rng.getNotes();
            const formulas = rng.getFormulas();
            const formats = rng.getNumberFormats();

            const updated = formulas.map((_, ri) => {
                const shouldSkip = skipRows.includes(ri + 1);

                notes[ri].forEach((note) => (shouldSkip ? note : ""));
                formats[ri].forEach((format) => (shouldSkip ? format : ""));

                return _.map((cell, ci) =>
                    shouldSkip ? cell || values[ri][ci] : ""
                );
            });

            rng.setValues(updated);
            return true;
        }

        const typeMap: Map<
            string,
            (
                sh: GoogleAppsScript.Spreadsheet.Sheet
            ) => GoogleAppsScript.Spreadsheet.Sheet
        > = new Map([
            ["all", (sh) => sh.clear()],
            ["format", (sh) => sh.clearFormats()],
            ["notes", (sh) => sh.clearNotes()],
            ["values", (sh) => sh.clearContents()],
        ]);

        const typeHandler = typeMap.get(type);

        if (!typeHandler) throw new RangeError("clear handler not found");

        typeHandler(targetSheet);

        return true;
    } catch (error) {
        onError(error);
        return false;
    }
};

interface ExpandParamsOptions {
    encode?: boolean;
    key: string;
    obj: object | any[];
    objectNotation?: "bracket" | "dot";
    arrayNotation?: "bracket" | "empty_bracket" | "comma";
}

/**
 * @summary expands object to parameter array
 */
const expandObjectToParams = ({
    key,
    obj,
    encode = true,
    objectNotation = "bracket",
    arrayNotation = "bracket",
}: ExpandParamsOptions): string[] => {
    const paramMap: Map<
        string,
        (k: string, v: string | null | undefined) => typeof v
    > = new Map([
        ["bracket", (k, v) => `${key}[${k}]=${v}`],
        ["comma", (k, v) => v],
        ["dot", (k, v) => `${key}.${k}=${v}`],
        ["empty_bracket", (k, v) => `${key}[]=${v}`],
    ]);

    if (Array.isArray(obj) && arrayNotation === "comma") {
        return [
            `${key}=${obj
                .map((elem) =>
                    typeof elem === "object" && elem
                        ? expandObjectToParams({
                              key,
                              obj: elem,
                              objectNotation,
                              arrayNotation,
                          })
                        : elem
                )
                .flat()
                .join(",")}`,
        ];
    }

    const ambientParamType = Array.isArray(obj)
        ? arrayNotation
        : objectNotation;

    return Object.entries(obj)
        .map(([k, v]) => {
            if (v === null || v === undefined) return;

            const isObj = typeof v === "object" && v;

            if (isObj) {
                return expandObjectToParams({
                    key: k,
                    obj: v,
                    objectNotation,
                    arrayNotation,
                });
            }

            const encoded = encode ? encodeURIComponent(v) : v;

            return paramMap.has(ambientParamType)
                ? paramMap.get(ambientParamType)!(k, encoded)
                : encoded;
        })
        .flat();
};

/**
 * @summary customizable converter from object to query string
 */
const objectToQuery = (
    source: object,
    {
        arrayNotation = "bracket",
        objectNotation = "bracket",
        encode = true,
    }: Partial<ExpandParamsOptions> = {}
): string => {
    const output: string[] = [];

    Object.entries(source).forEach(([key, val]) => {
        if (val === null || val === undefined) return;

        const isObj = typeof val === "object" && val;

        if (isObj) {
            const objParams = expandObjectToParams({
                key,
                obj: val as any,
                objectNotation,
                arrayNotation,
                encode,
            });
            return output.push(...objParams);
        }

        output.push(`${key}=${val}`);
    });

    return output.join("&");
};

const getAllProperties = ({ onError = console.warn } = {}) => {
    try {
        const store = PropertiesService.getScriptProperties();
        return store.getProperties();
    } catch (error) {
        onError(error);
        return {};
    }
};

const deleteAllProperties = ({ onError = console.warn } = {}) => {
    try {
        const store = PropertiesService.getUserProperties();
        store.deleteAllProperties();
        return true;
    } catch (error) {
        onError(error);
        return false;
    }
};

const getProperty = (key: string, def: string) => {
    const store = PropertiesService.getUserProperties();
    const prop = store.getProperty(key);
    return prop !== null ? prop : def;
};

const setProperty = (key: string, val: any) => {
    try {
        const store = PropertiesService.getUserProperties();
        store.setProperty(key, JSON.stringify(val));
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * @summary high-access property getter (using caching)
 */
const getHighAccessProperty = <T>(key: string, def?: T): T | undefined => {
    const cache = CacheService.getUserCache()!;

    const cached = cache.get(key);

    if (cached) return JSON.parse(cached);

    const store = PropertiesService.getUserProperties();
    const stored = store.getProperty(key);

    if (stored) {
        cache.put(key, stored);
        return JSON.parse(stored);
    }

    if (def !== void 0) {
        cache.put(key, JSON.stringify(def));
        return def;
    }
};

/**
 * @summary gets Analytics profile ID
 */
const getProfileID = ({ onError = console.warn } = {}): string => {
    const {
        accounts: { analytics },
    } = getDefaults();

    try {
        const {
            properties: { settings },
        } = APP_CONFIG;

        const prop = getHighAccessProperty<AppSettings>(
            settings,
            getDefaults()
        );

        return prop ? prop.accounts.analytics : analytics;
    } catch (error) {
        onError(error);
        return analytics;
    }
};

interface GtmInfo {
    accountId: string;
    containerId: string;
    workspaceId: string;
    versionId: string;
}

const setGtmInfo = (info: GtmInfo) => {
    try {
        const {
            properties: { gtm },
        } = APP_CONFIG;
        return setProperty(gtm, info);
    } catch (error) {
        console.warn(error);
        return false;
    }
};

const getGtmInfo = (): GtmInfo => {
    const {
        properties: { gtm },
    } = APP_CONFIG;
    return JSON.parse(getProperty(gtm, "{}"));
};

type MaybeDate = string | number | Date;

/**
 * @summary extracts date part in ISO format
 */
const toISODate = (date: MaybeDate = Date.now()) =>
    new Date(date).toISOString().slice(0, 10);

/**
 * @summary gets column index from A1 notation
 */
const getIndexFromA1 = (a1: string, type: "row" | "column" = "column") => {
    if (!a1) throw new RangeError(`Expected A1 notation`);

    const alphabet = "abcdefghijklmnopqrstuvwxyz";

    const [, cellChars, rowNumber] = a1.match(/^([A-Z]+)(?=(\d+)|$)/i) || [];

    if (!cellChars)
        throw new RangeError(`Expected correct A1 notation, actual: ${a1}`);

    if (type === "row") return +rowNumber - 1;

    const lcaseChars = cellChars.toLowerCase().split("").reverse();
    const middle = lcaseChars.reduce((acc, cur, i) => {
        return acc + (alphabet.indexOf(cur) + 1) * (i > 0 ? 26 ** i : 1);
    }, 0); //A -> skipped, B -> processed //

    return middle - 1;
};

/**
 * @summary leaves only unique elements
 */
const uniqify = (arr: any[] = []): any[] => [...new Set(arr).values()];

const loadDependency = (path: string, name: string) =>
    HtmlService.createHtmlOutputFromFile(`${path}/${name}`).getContent();

declare interface Logger {
    logs: Map<number, string>;
    clear(): void;
    dump(): void;
    iso(num: Number): string;
    log(msg: string): void;
}

const makeLogger = (): Logger => {
    return {
        logs: new Map(),
        clear() {
            const { logs } = this;
            logs.clear();
        },
        iso(num: number) {
            return new Date(num).toISOString();
        },
        log(msg: string) {
            const [stamp, log] = [Date.now(), msg];
            this.logs.set(stamp, log);
        },
        dump() {
            const { logs } = this;

            for (const [key, val] of logs) {
                console.log(`${this.iso(key)} | ${val}`);
            }

            logs.clear();
        },
    };
};

type MetadataOpts = {
    sheet: GoogleAppsScript.Spreadsheet.Sheet;
    key: string;
};

type MetadataGetterOpts = MetadataOpts & { def?: unknown };

type MetadataSetterOpts = MetadataOpts & { value: unknown };

const getMetadataValue = ({
    sheet = SpreadsheetApp.getActiveSheet(),
    key,
    def,
}: MetadataGetterOpts) => {
    const items = sheet.getDeveloperMetadata();
    const data = items.find((data) => data.getKey() === key);
    return data !== void 0 ? JSON.parse(data.getValue() || "{}") : def;
};

const setMetadataValue = ({
    sheet = SpreadsheetApp.getActiveSheet(),
    key,
    value,
}: MetadataSetterOpts) => {
    const items = sheet.getDeveloperMetadata();
    const data = items.find((data) => data.getKey() === key);

    const prepared = JSON.stringify(value);

    if (data) {
        data.setValue(prepared);
        return true;
    }

    sheet.addDeveloperMetadata(key, prepared);
    return true;
};

const deleteMetadata = ({
    sheet = SpreadsheetApp.getActiveSheet(),
    key,
}: MetadataOpts) => {
    const items = sheet.getDeveloperMetadata();
    const data = items.find((data) => data.getKey() === key);
    data && data.remove();
    return true;
};

const deleteAllMetadata = ({
    sheet = SpreadsheetApp.getActiveSheet(),
} = {}) => {
    const items = sheet.getDeveloperMetadata();
    items.forEach((item) => item.remove());
    return true;
};

const getFormSheet = () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    return sheets.find((sheet) => !!sheet.getFormUrl());
};

const loadTemplate = <T extends boolean>(
    evaluate: T,
    path: string,
    name: string,
    deps?: Record<string, string>,
    vars?: Record<string, unknown>
) => {
    const templ = HtmlService.createTemplateFromFile(`${path}/${name}`);
    Object.entries(deps || {}).forEach(
        ([name, path]) => (templ[name] = loadDependency(path, name))
    );

    vars && Object.assign(templ, vars);

    return (evaluate ? templ.evaluate() : templ) as T extends true
        ? GoogleAppsScript.HTML.HtmlOutput
        : GoogleAppsScript.HTML.HtmlTemplate;
};

const withCatch =
    <T extends (...args: any[]) => any>(
        onError: (err: Error, func: T, ...args: Parameters<T>) => unknown
    ) =>
    (func: T, ...args: Parameters<T>) => {
        try {
            return func(...args);
        } catch (error) {
            return onError(error, func, ...args);
        }
    };

const uuid = () => Utilities.getUuid();

const makeRunTimes =
    (num = 1) =>
    (callback: (idx: number, ...arg: any[]) => any, ...args: any[]) => {
        let i = 0;
        while (i < num) {
            callback(i, ...args);
            i++;
        }
    };

const makeResponseSetter =
    (res: GoogleAppsScript.Forms.FormResponse) =>
    (item: GoogleAppsScript.Forms.Item, text: string) =>
        res.withItemResponse(item.asTextItem().createResponse(text));

const extractDomain = (url: string) =>
    url.replace(/^\w+:\/\//i, "").replace(/(\w+)\/.+/i, "$1");

const extractPage = (url: string) =>
    (url.replace(/(?:#|\?).+?.+$/i, "").match(/\w+(\/.+)$/i) || [])[1] || "/";

type RequireOneOf<T, R extends keyof T = keyof T> = {
    [P in R]: Required<Pick<T, P>> & Partial<Omit<T, P>>;
}[R];

type TemplateOpts = RequireOneOf<
    {
        template: GoogleAppsScript.HTML.HtmlTemplate;
        content: string;
        returnMissing?: boolean;
        preserveMissing?: string[];
        vars?: Record<string, string | number>;
        onError?: (err: Error) => void;
    },
    "template" | "content"
>;

/**
 * @summary parses string template
 */
const template = ({
    template,
    content,
    vars = {},
    onError = (err) => console.warn(err),
    returnMissing = false,
    preserveMissing = [],
}: TemplateOpts) => {
    const full =
        (template ? template.evaluate().getContent() : "") + (content || "");

    try {
        return full.replace(
            /{{(\w+)}}/gi,
            (_, name) =>
                (vars[name] as string) ||
                (vars[name] === 0
                    ? "0"
                    : returnMissing || preserveMissing.includes(name)
                    ? _
                    : "")
        );
    } catch (error) {
        onError(error);
        return full;
    }
};

const logException = (context: string, err: string | Error) => {
    const time = new Date();
    const stamp = `${time.toISOString()} | ${context}`;
    console.warn(`${stamp} | ${err}`);
};

const showMsg = (msg: string) => Browser.msgBox(msg);

type BackoffOptions<F extends (...args: any[]) => any, T = null> = {
    comparator: (res: ReturnType<F>) => boolean;
    scheduler: (wait: number) => any;
    onBeforeBackoff: (retries: number, exp: number, threshold?: number) => any;
    onError?: (err: string | Error, errRetries: number) => void;
    retryOnError?: boolean;
    retries?: number;
    threshold?: number;
    thisObj?: T;
};

type Backoffer = <F extends (...args: any[]) => any, T = null>(
    cbk: F,
    opts: BackoffOptions<F, T>
) => (...params: Parameters<F>) => ReturnType<F>;

const backoffSync: Backoffer = (
    callback,
    {
        comparator,
        scheduler,
        retryOnError = false,
        retries = 3,
        threshold = 50,
        thisObj = null,
        onBeforeBackoff,
        onError = console.warn,
    }
) => {
    return (...params) => {
        let exp = 0,
            errRetries = retries + 1;

        do {
            try {
                const response = callback.apply(thisObj, params);

                if (comparator(response) === true) return response;

                onBeforeBackoff && onBeforeBackoff(retries, exp, threshold);

                retries -= 1;

                scheduler(2 ** exp * threshold);

                exp += 1;
            } catch (error) {
                onError(error, errRetries);

                errRetries -= 1;

                if (!retryOnError || errRetries < 1) throw error;
            }
        } while (retries > 0);
    };
};
