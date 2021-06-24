function onInstall(e: GoogleAppsScript.Events.AddonOnInstall) {
    recordNewOwner();
    return onOpen(e);
}

const commonDependencies: { [x: string]: string } = {
    utils: "dist/js",
    run: "dist/js",
    style: "dist/css",
};

/**
 * @summary shows instructions on first-time use
 */
const showInstructionsOnFirstTime = () => {
    const templ = loadTemplate(false, "dist", "firstTimePrompt", {
        ...commonDependencies,
        firstTime: "dist/js",
    });

    const content = template({
        template: templ,
        vars: {
            tid: APP_CONFIG.ids.analytics,
            page_path: "/first_time",
            page_title: "first_time",
            page_url: getActiveURL(),
        },
    });

    const ui = SpreadsheetApp.getUi();

    const output = HtmlService.createHtmlOutput(content);
    output.setHeight(700);

    return ui.showModalDialog(output, "New Version First Time Use");
};

/**
 * @summary trigger firing on spreadsheet open
 */
function onOpen({
    authMode = ScriptApp.AuthMode.FULL,
}:
    | GoogleAppsScript.Events.SheetsOnOpen
    | GoogleAppsScript.Events.AddonOnInstall) {
    //can work with triggers
    if (authMode !== ScriptApp.AuthMode.NONE) prepareTriggersForUse();

    const {
        menus: {
            main: { items },
        },
    } = getConfig();

    SpreadsheetApp.getUi()
        .createAddonMenu()
        .addItem(items.deploy, deployAddonGo.name)
        .addItem(items.installUA, promptUAinstall.name)
        .addItem(items.openSettings, settingsGo.name)
        .addItem(items.openHelp, helpGo.name)
        .addToUi();
}

const getActiveURL = () => SpreadsheetApp.getActiveSpreadsheet().getUrl();

const sidebarFromString = (content: string) =>
    SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(content));

/**
 * @summary triggers settings screen sidebar
 */
function settingsGo() {
    prepareTriggersForUse();

    recordNewOwner();

    const templ = loadTemplate(false, "dist", "settings", {
        ...commonDependencies,
        common: "dist/js",
        settingsUtils: "dist/js",
    });

    const content = template({
        template: templ,
        vars: {
            tid: APP_CONFIG.ids.analytics,
            page_path: "/settings",
            page_title: "settings",
            page_url: getActiveURL(),
        },
    });

    return sidebarFromString(content);
}

/**
 * @summary triggers help screen sidebar
 */
function helpGo() {
    recordNewOwner();

    const templ = loadTemplate(false, "dist", "help", {
        ...commonDependencies,
    });

    const content = template({
        template: templ,
        vars: {
            tid: APP_CONFIG.ids.analytics,
            page_path: "/help",
            page_title: "help",
            page_url: getActiveURL(),
        },
    });

    return sidebarFromString(content);
}
