const buildTime = ({ hours = 0, minutes = 0 } = {}) => {
    const over = minutes > 59 ? Math.floor(minutes / 60) || 1 : 0;

    const hh = hours + over;

    const mm = over ? minutes - over * 60 : minutes;

    return `${hh < 10 ? `0${hh}` : hh}:${mm < 10 ? `0${mm}` : mm}`;
};

const disable = (elOrId: string | HTMLElement) =>
    (typeof elOrId === "string"
        ? document.getElementById(elOrId)
        : elOrId
    )?.classList.add("disabled");

const enable = (elOrId: string | HTMLElement) =>
    (typeof elOrId === "string"
        ? document.getElementById(elOrId)
        : elOrId
    )?.classList.remove("disabled");

const show = ({ classList }: HTMLElement, className = "hide") =>
    classList.remove(className);

const hide = ({ classList }: HTMLElement, className = "hide") =>
    classList.add(className);

const notify = (msg: string, ...styles: string[]) =>
    M.toast({ html: msg, classes: styles.join(" ") });

const debounce = <T extends (...args: any[]) => any>(func: T, seconds = 1) => {
    let debounced = false;

    return (...args: Parameters<T>) => {
        if (debounced) return;

        debounced = true;

        setTimeout(() => (debounced = false), seconds * 1e3);

        return func(...args);
    };
};

declare const uuidv4: typeof import("uuidv4")["uuid"];

const getCid = () => {
    const cidName = "fct_cid";

    let cid;

    try {
        cid = localStorage.getItem(cidName);

        if (!cid) {
            cid = uuidv4();
            localStorage.setItem(cidName, cid);
        }
    } catch (error) {
        console.debug(error);
        cid = uuidv4();
    } finally {
        return cid;
    }
};

/**
 * @summary lists Google Ads accounts
 */
const getAdsAccounts = async (mapper: (...args: any[]) => any) => {
    try {
        const customers = await gscript("getAllAccounts");
        return customers.map(mapper);
    } catch (error) {
        console.warn(error);
        notify("Failed to list Google Ads accounts!");
        return [];
    }
};

/**
 * @summary adds options to an HTMLSelectElement
 */
const addOptions = (
    sel: HTMLSelectElement,
    options: [string, string][]
): HTMLSelectElement => {
    const opts = options.map(([val, txt]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = txt;
        return opt;
    });

    sel.append(...opts);
    return sel;
};
