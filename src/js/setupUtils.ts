interface EventListener {
    (evt: Event): void | Promise<void>;
}

((w, d) => {
    // /**
    //  * @summary event listener for changing Ads group visibility
    //  */
    // const changeAdsFormVisibility: EventListener = (event) => {
    //     const {
    //         target: { checked },
    //     } = event;

    //     const adsForm = $("#gAdsSetup"),
    //         duration = 100;

    //     checked ? adsForm.show(duration) : adsForm.hide(duration);
    // };

    const installAnalyticsGoal = async (options: {
        gaAccount?: string;
        gaProperty?: string;
        gaProfile?: string;
        category: string;
        action: string;
    }) => {
        try {
            const status = await gscript("installEventGoal", options);

            status
                ? notify(
                      `Created an Analytics Goal`,
                      config.classes.notify.success
                  )
                : notify(
                      `Failed to create Analytics Goal!`,
                      config.classes.notify.failure
                  );
        } catch ({ message }) {
            await gscript("logException", "setup_goal", message);
        }
    };

    async function deployAddon(preloader: HTMLElement) {
        const ids = [
            "account",
            "property",
            "profile",
            "gtm-account",
            "gtm-container",
            "gtm-workspace",
        ];

        const [
            gaAccount,
            gaProperty,
            gaProfile,
            accountId,
            containerId,
            workspaceId,
        ] = ids.map((id) => d.getElementById<HTMLSelectElement>(id)?.value);

        // const willLinkAds = $("#gAdsSwitch").is(":checked");
        const { checked: willCreateGoal = false } =
            d.getElementById<HTMLInputElement>("createGoal") || {};

        const issues: string[] = [];
        if (!gaAccount) issues.push("Please select an Analytics Account!");
        if (!gaProperty) issues.push("Please select an Analytics Property!");
        if (!gaProfile) issues.push("Please select an Analytics Profile!");
        if (!accountId) issues.push("Please select a Tag Manager Account!");
        if (!containerId) issues.push("Please select a Container!");
        if (!workspaceId) issues.push("Please select a Workspace!");
        // if (willLinkAds && !adsAccount)
        //     issues.push("Please select an Ads Account");

        const { failure } = config.classes.notify;

        if (issues.length) return issues.forEach((msg) => notify(msg, failure));

        show(preloader);

        disable("submit");

        // if (willLinkAds) {
        //     await run({
        //         funcName: "linkAllAccounts",
        //         onFailure: () =>
        //             showError(
        //                 `Failed to link your Ads accounts!`,
        //                 config.times.notify.slow
        //             ),
        //         onSuccess: ({ length }) => {
        //             notify(
        //                 `Linked ${length} Ads account${
        //                     length === 1 ? "" : "s"
        //                 }`,
        //                 config.times.notify.slow,
        //                 config.classes.notify.success
        //             );
        //         },
        //     });
        // }

        const category = d.getElementById<HTMLInputElement>("category")!.value;
        const action = d.getElementById<HTMLInputElement>("action")!.value;

        if (willCreateGoal) {
            await installAnalyticsGoal({
                category,
                action,
                gaAccount,
                gaProfile,
                gaProperty,
            });
        }

        try {
            await gscript("deployAddon", {
                category,
                action,
                containerId,
                workspaceId,
                accountId,
            });

            google.script.host.close();
        } catch ({ message }) {
            await gscript("logException", "setup", message);
            notify("Failed to deploy", config.classes.notify.failure);
            show(document.getElementById("multiaccount")!);
        } finally {
            enable("submit");
            hide(preloader);
        }
    }

    w.addEventListener("load", async () => {
        const preloader = document.getElementById(config.ids.preloader)!;

        w.addEventListener("error", async ({ message }) => {
            await gscript("logException", "setup", message);
            notify("Something went wrong", config.classes.notify.failure);
            hide(preloader);
        });

        w.addEventListener("unhandledrejection", async ({ reason = "" }) => {
            await gscript("logException", "setup", reason.toString());
            notify("Something went wrong", config.classes.notify.failure);
            hide(preloader);
            show(document.getElementById("multiaccount")!);
        });

        M.AutoInit();

        d.body.classList.remove("hidden");

        try {
            show(preloader);

            const {
                accounts: { analytics, tagManager },
                setup: {
                    analytics: { action, category },
                },
            } = await gscript<AppSettings>("getSettings");

            await Promise.all([
                setupAnalytics(analytics),
                setupTagManager(tagManager),
            ]);

            const gaCat = d.getElementById<HTMLInputElement>("category")!;
            const gaAct = d.getElementById<HTMLInputElement>("action")!;

            gaCat.value = category;
            gaAct.value = action;
        } catch ({ message }) {
            await gscript("logException", "setup", message);
            notify("Something went wrong", config.classes.notify.failure);
        } finally {
            hide(preloader);
        }

        // const customers = await getAdsAccounts(
        //     ({ id, descriptiveName }) => ({
        //         name: descriptiveName,
        //         id,
        //     })
        // );

        const bouncedDeploy = debounce(deployAddon);

        const submitBtn = d.getElementById("submit")!;
        submitBtn.addEventListener("click", () => bouncedDeploy(preloader));

        const cancelBtn = d.getElementById("cancel")!;
        cancelBtn.addEventListener("click", () => google.script.host.close());
    });

    d.addEventListener("click", ({ target }) => {
        const el = <HTMLElement>target;
        if (!el.matches(".toast")) return;
        M.Toast.getInstance(el).dismiss();
    });
})(window, document);
