((w, d) => {
    M.AutoInit();

    const config = {
        classes: {
            notify: {
                success: "primary-background",
                failure: "failure-background",
            },
        },
        ids: {
            submit: "reset",
        },
        toasts: {
            success: "Updated preferences! Installer will load shortly",
            error: "Something went wrong when saving preferences!",
        },
    };

    w.addEventListener("error", async ({ message }) => {
        await gscript("logException", "setup", message);
        notify("Something went wrong", config.classes.notify.failure);
    });

    w.addEventListener("unhandledrejection", async ({ reason = "" }) => {
        await gscript("logException", "setup", reason.toString());
        notify("Something went wrong", config.classes.notify.failure);
    });

    w.addEventListener("load", () => {
        const preload = d.getElementById("preload")!;

        d.addEventListener("click", async ({ target }) => {
            const { id } = <HTMLElement>target;

            if (id !== config.ids.submit) return;

            try {
                show(preload);

                disable(config.ids.submit);

                await gscript("setGaInstallDismissed", { dismissed: false });

                notify(config.toasts.success);

                await gscript("promptUAinstall");
            } catch ({ message }) {
                await gscript("logException", "ua_prompt", message);
                notify(config.toasts.error);
            } finally {
                hide(preload);
                enable(config.ids.submit);
            }
        });
    });
})(window, document);
