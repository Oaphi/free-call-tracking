type Option = [value: string, text: string];

const mapToOpts = ({ id, name }: { id: string; name: string }): Option => [
    id,
    name,
];

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

const updateProperties = async (analyticsId: string, value = "") => {
    const propSel = document.getElementById<HTMLSelectElement>("property")!;

    const properties = await gscript("listAnalyticsProperties", analyticsId);

    clearSelect(propSel, 1);
    const propIds = properties.map(mapToOpts);
    appendOptions(propSel, propIds);
    reinitSelect(propSel, value);
};

const updateProfiles = async (
    analyticsId: string,
    propertyId: string,
    value = ""
) => {
    const profSel = document.getElementById<HTMLSelectElement>("profile")!;

    const profiles = await gscript(
        "listAnalyticsProfiles",
        analyticsId,
        propertyId
    );

    clearSelect(profSel, 1);
    const profIds = profiles.map(mapToOpts);
    appendOptions(profSel, profIds);
    reinitSelect(profSel, value);
};

type UserSettings = {
    account: string;
    property: string;
    profile: string;
};

const setupAnalytics = async (settings: UserSettings) => {
    const { account, property, profile } = settings;

    const accSel = document.getElementById<HTMLSelectElement>("account")!;
    const propSel = document.getElementById<HTMLSelectElement>("property")!;
    const profSel = document.getElementById<HTMLSelectElement>("profile")!;

    const accounts = await gscript("getGoogleAnalyticsAccounts");

    const accIds = accounts.map(mapToOpts);
    appendOptions(accSel, accIds);

    updateProperties(account, property);
    updateProfiles(account, property, profile);

    reinitSelect(accSel, account);
    reinitSelect(propSel, property);
    reinitSelect(profSel, profile);

    document.addEventListener("change", async ({ target, currentTarget }) => {
        if (target === currentTarget) return;

        const { id, parentElement, value } = <HTMLSelectElement>target;

        const actionMap: { [x: string]: () => Promise<void> } = {
            account: () => updateProperties(value),
            property: () => updateProfiles(accSel.value, value),
        };

        const handler = actionMap[<keyof UserSettings>id];
        if (handler) handler();

        await gscript("updateSettings", {
            [`accounts/analytics/${id}`]: value,
        });

        settings[<keyof UserSettings>id] = value;

        const { nextElementSibling: label } = parentElement!;
        notify(
            `${label?.textContent || "Setting"} saved`,
            "primary-background"
        );
    });
};
