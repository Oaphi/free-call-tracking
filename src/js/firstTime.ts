((w, d) => {
    /**
     * @summary enables action items
     */
    const enableActions = () => {
        const actionWrap = d.getElementById("actions")!;
        const actions = [...actionWrap.querySelectorAll("a.btn")];
        actions.forEach(({ classList }) => classList.remove("disabled"));
    };

    /**
     * @summary check if can enable actions
     */
    const checkSettings = (
        accSel: HTMLSelectElement,
        contSel: HTMLSelectElement,
        wspaceSel: HTMLSelectElement
    ) => [accSel, contSel, wspaceSel].every(({ value }) => !!value);

    const preload = d.getElementById("preload")!;

    w.addEventListener("error", async ({ message }) => {
        hide(preload, "hidden");
        await gscript("logException", "FTE", message);
        notify("Something went wrong", "failure-background");
    });

    w.addEventListener("unhandledrejection", async ({ reason = "" }) => {
        hide(preload, "hidden");
        await gscript("logException", "FTE", reason.toString());
        notify("Something went wrong", "failure-background");
    });

    d.addEventListener("click", async ({ target }) => {
        const { id } = <HTMLElement>target;

        try {
            show(preload, "hidden");

            const idMap: Record<string, () => Promise<void>> = {
                deploy: async () => {
                    await gscript("updateSettings", { firstTime: false });
                    await gscript("deployAddonGo");
                    google.script.host.close();
                },
            };

            const handler = idMap[id];
            if (!handler) return;

            await handler();
        } catch ({ message }) {
            await gscript("logException", "FTE", message);
        } finally {
            hide(preload, "hidden");
        }
    });

    w.addEventListener("load", async () => {
        M.AutoInit();

        show(preload, "hidden");
        const accounts = await gscript<
            GoogleAppsScript.TagManager.Schema.Account[]
        >("listTagManagerAccounts");
        const accOpts = accounts.map(
            ({ accountId, name }) => <Option>[accountId!, name!]
        );

        hide(preload, "hidden");

        const accSel = d.getElementById<HTMLSelectElement>("Acc")!;
        const contSel = d.getElementById<HTMLSelectElement>("Cont")!;
        const workSel = d.getElementById<HTMLSelectElement>("Work")!;

        addOptions(accSel, accOpts);
        M.FormSelect.init(accSel);

        const makeSelChange =
            <T>(
                cbk: string,
                path: string,
                type: "containers" | "workspaces" | "accounts",
                mapper: (e: T) => Option
            ): EventListener =>
            async ({ target }: Event) => {
                const { value } = <HTMLSelectElement>target;
                try {
                    show(preload, "hidden");
                    const entities = await gscript<T[]>(cbk, path + value);
                    addOptions(contSel, entities.map(mapper));
                    M.FormSelect.init(contSel);
                } catch ({ message }) {
                    await gscript("logException", "FTE", message);
                    notify(`Failed to load ${type}`, "failure-background");
                } finally {
                    hide(preload, "hidden");
                    checkSettings(accSel, contSel, workSel) && enableActions();
                }
            };

        accSel.addEventListener(
            "change",
            makeSelChange<GoogleAppsScript.TagManager.Schema.Container>(
                "getConteinersArrByAcc",
                `accounts/`,
                "containers",
                ({ containerId, name }) => <Option>[containerId, name]
            )
        );

        contSel.addEventListener(
            "change",
            makeSelChange<GoogleAppsScript.TagManager.Schema.Workspace>(
                "getWorkspacesArrByCont",
                `accounts/${accSel.value}/containers/`,
                "workspaces",
                ({ workspaceId, name }) => <Option>[workspaceId, name]
            )
        );

        workSel.addEventListener("change", () => {
            checkSettings(accSel, contSel, workSel) && enableActions();
        });

        const cleanBtn = d.getElementById("clean")!;
        cleanBtn.addEventListener("click", async () => {
            show(preload, "hidden");

            const ids = [accSel, contSel, workSel].map(({ value }) => value);

            const regex =
                /(?:caller on site|window loaded|cid|getClientId|getTime)[\w-]+/i;

            const status = await gscript(
                "cleanupOldVersion",
                ...ids,
                regex.source,
                regex.flags
            );

            notify(
                status ? "Finished cleaning up" : "Failed to clean up",
                status ? "primary-background" : "failure-background"
            );

            hide(preload, "hidden");
        });
    });
})(window, document);
