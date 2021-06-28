((w, d) => {
    /**
     * @summary enables action items
     */
    const enableActions = () => {
        const actionWrap = d.getElementById("actions")!;
        const actions = [...actionWrap.querySelectorAll("a.btn")];
        actions.forEach(({ classList }) => classList.remove("disabled"));
    };

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

        const {
            accounts: { tagManager },
        } = await gscript<AppSettings>("getSettings");

        await setupTagManager(tagManager);

        d.addEventListener(
            "change",
            () => checkGTM(tagManager) && enableActions()
        );

        const cleanBtn = d.getElementById("clean")!;
        cleanBtn.addEventListener("click", async () => {
            show(preload, "hidden");

            const { account, container, workspace } = tagManager;

            const ids = [account, container, workspace];

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
