type HandlerConfig = {
    action: () => Promise<boolean>;
    onSuccess: () => void;
    onFailure: () => void;
    onError: (msg: string) => void;
};

((w, d) => {
    w.addEventListener("load", async () => {
        const preload = d.getElementById("preload")!;

        w.addEventListener("error", async ({ message }) => {
            await gscript("logException", "install_ua", message);
            notify("Something went wrong", config.classes.notify.failure);
            hide(preload, "hidden");
        });

        w.addEventListener("unhandledrejection", async ({ reason = "" }) => {
            await gscript("logException", "install_ua", reason.toString());
            notify("Something went wrong", config.classes.notify.failure);
            hide(preload, "hidden");
        });

        M.AutoInit();

        const {
            accounts: { tagManager, analytics },
        } = await gscript<AppSettings>("getSettings");

        await setupAnalytics(analytics);
        await setupTagManager(tagManager);
        checkGTM(tagManager) && checkAnalytics(analytics) && enable("yes");

        const handlerMap: { [x: string]: HandlerConfig } = {
            yes: {
                action: () => gscript("installGAtag"),
                onSuccess: () =>
                    notify(
                        "Successfully installed tag",
                        config.classes.notify.success
                    ),
                onFailure: () =>
                    notify(
                        "Failed to install tag",
                        config.classes.notify.failure
                    ),
                onError: () =>
                    notify(
                        "Something went wrong during install",
                        config.classes.notify.failure
                    ),
            },
            no: {
                action: () => gscript("setGaInstallDismissed"),
                onSuccess: () => google.script.host.close(),
                onFailure: () => google.script.host.close(),
                onError: () =>
                    notify(
                        `Failed to save (you will be prompted if no tag is found)`,
                        config.classes.notify.failure
                    ),
            },
        };

        const ids = Object.keys(handlerMap);

        const listener: EventListener = () =>
            void checkGTM(tagManager) &&
            checkAnalytics(analytics) &&
            enable("yes");

        d.addEventListener("gtm-change", listener);
        d.addEventListener("ga-change", listener);

        d.addEventListener("click", async ({ target }) => {
            const { id } = <HTMLElement>target;

            if (!ids.includes(id)) return;

            const { action, onSuccess, onFailure, onError } = handlerMap[id];

            try {
                show(preload, "hidden");

                ids.forEach(disable);

                const status = await action();

                status ? onSuccess() : onFailure();
            } catch ({ message }) {
                await gscript("logException", "install_ua", message);
                onError(message);
            } finally {
                hide(preload, "hidden");
                ids.forEach(enable);
            }
        });
    });
})(window, document);
