type HandlerConfig = {
    action: () => Promise<boolean>;
    onSuccess: () => void;
    onFailure: () => void;
    onError: (msg: string) => void;
};

(() => {
    M.AutoInit();

    const handlerMap: { [x: string]: HandlerConfig } = {
        yes: {
            action: () => gscript("installGAtag"),
            onSuccess: () => notify("Successfully installed tag"),
            onFailure: () => notify("Failed to install tag"),
            onError: () => notify("Something went wrong during install"),
        },
        no: {
            action: () => gscript("setGaInstallDismissed"),
            onSuccess: () => google.script.host.close(),
            onFailure: () => {}, //noop
            onError: () =>
                notify(
                    `Failed to save (you will be prompted again if no UA tag is found)`
                ),
        },
    };

    const ids = Object.keys(handlerMap);

    document.addEventListener("click", async ({ target }) => {
        const { id } = <HTMLElement>target;

        if (!ids.includes(id)) return;

        const { action, onSuccess, onFailure, onError } = handlerMap[id];

        const preload = document.getElementById("preload")!;

        try {
            show(preload);

            ids.forEach(disable);

            const status = await action();

            status ? onSuccess() : onFailure();
        } catch ({ message }) {
            await gscript("logException", "settings", message);
            onError(message);
        } finally {
            hide(preload);
            ids.forEach(enable);
        }
    });
})();
