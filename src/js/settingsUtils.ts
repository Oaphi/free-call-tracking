interface Document {
    getElementById<T extends HTMLElement>(elementId: string): T | null;
}

((w, d) => {
    const primBckg = "primary-background";
    const failureBckg = "failure-background";
    const hideCls = "hidden";

    const initTooltipped = (options = {}) => {
        const elems = document.querySelectorAll(".tooltipped");
        return M.Tooltip.init(elems, options);
    };

    w.addEventListener("error", async ({ message = "unknown error" }) => {
        await gscript("logException", "settings", message);
        notify("Something went wrong!", failureBckg);
    });

    w.addEventListener(
        "unhandledrejection",
        async ({ reason: { name = "Error", message = "" } }) => {
            await gscript("logException", "settings", `${name} | ${message}`);
            notify("Something went wrong!", failureBckg);
        }
    );

    w.addEventListener("DOMContentLoaded", async () => {
        M.AutoInit();

        await gscript(
            "sendPageview",
            getCid(),
            "{{page_url}}",
            "{{page_title}}",
            "{{page_path}}"
        );

        const preloader = <HTMLElement>d.getElementById("preload")!;

        initTooltipped();

        const tpicker = d.querySelector<HTMLSelectElement>(".timepicker")!;

        const { atHour, atMinute } = await gscript("getDailyClearConfig");

        const time = buildTime({
            hours: atHour,
            minutes: atMinute,
        });

        tpicker.value = time;

        const initialized = new M.Timepicker(tpicker, {
            defaultTime: time,
            twelveHour: false,
            showClearBtn: true,
            onCloseEnd: async () => {
                const { time } = initialized;

                if (!time) return;

                const [hour, minute] = time.split(":");

                if (+hour === atHour && +minute === atMinute) return;

                try {
                    show(preloader, hideCls);

                    await gscript("rescheduleClearTrigger", {
                        atHour: +hour,
                        atMinute: +minute,
                    });

                    notify("Updated trigger!", primBckg);
                } catch ({ message }) {
                    await gscript("logException", "settings", message);
                    notify("Failed to update trigger!", failureBckg);
                } finally {
                    hide(preloader, hideCls);
                }
            },
        });

        const clearNow = document.getElementById("clearNow")!;
        clearNow.addEventListener("click", async () => {
            try {
                await gscript("handleDailyClear");
                notify("Cleared!", primBckg);
            } catch (error) {
                notify("Failed to clear!", failureBckg);
            } finally {
                hide(preloader, hideCls);
            }
        });

        const formatNow = document.getElementById("formatNow")!;
        formatNow.addEventListener("click", async () => {
            try {
                show(preloader, hideCls);
                await gscript("formatFormSheet");
                notify("Formatted!", primBckg);
            } catch (error) {
                notify("Failed to format!", failureBckg);
            } finally {
                hide(preloader, hideCls);
            }
        });

        const settings = await gscript<AppSettings>("getSettings");

        const {
            triggers: { enableDailyClear, enableEditTrigger },
            accounts: { analytics },
            setup: { activity },
        } = settings;

        const clear = d.getElementById<HTMLInputElement>("clear")!;
        const edit = d.getElementById<HTMLInputElement>("edit")!;
        const keep = d.getElementById<HTMLInputElement>("keep")!;

        clear.checked = enableDailyClear;
        edit.checked = enableEditTrigger;
        keep.value = activity.keep.toString();

        await setupAnalytics(analytics);

        M.updateTextFields();

        // const adsSel = document.getElementById("adsid");
        // const options = await getAdsAccounts(
        //     ({ id, descriptiveName }) => [id, descriptiveName]
        // );

        // addOptions(adsSel, options);
        // M.FormSelect.getInstance(adsSel).destroy();
        // adsSel.value = ads; //TODO: change
        // const inst = M.FormSelect.init(adsSel);

        d.addEventListener("change", async ({ target, currentTarget }) => {
            if (target === currentTarget) return;

            const { id } = <HTMLElement>target;

            const settingsCallback = "updateSettings";

            const handlerMap: {
                [x: string]: (t: HTMLInputElement) => Promise<boolean>;
            } = {
                clear: ({ checked }) =>
                    gscript(settingsCallback, {
                        "triggers/enableDailyClear": checked,
                    }),
                edit: ({ checked }) =>
                    gscript(settingsCallback, {
                        "triggers/enableEditTrigger": checked,
                    }),
                keep: ({ valueAsNumber }) =>
                    gscript(settingsCallback, {
                        "setup/activity/keep": Math.trunc(valueAsNumber),
                    }),
                // adsid: {
                //     action: ({ value }) =>
                //         gscript("updateSettings", {
                //             "accounts/ads": value,
                //         })
                // },
            };

            const action = handlerMap[id];

            try {
                show(preloader, hideCls);

                const status = await action(<HTMLInputElement>target);

                notify(
                    status ? `Settings updated` : `Failed to update`,
                    status ? primBckg : failureBckg
                );
            } catch ({ message }) {
                await gscript("logException", "save", message);
            } finally {
                hide(preloader, hideCls);
            }
        });

        const reset = d.getElementById("reset")!;

        reset.addEventListener("click", async () => {
            try {
                show(preloader, hideCls);
                disable(reset);

                const { status, errors } = await gscript<{
                    status: boolean;
                    errors: string[];
                }>("reset");

                reinitSelect(d.getElementById("account")!);
                reinitSelect(d.getElementById("property")!);
                reinitSelect(d.getElementById("profile")!);

                tpicker.value = buildTime();
                clear.checked = true;
                edit.checked = true;

                if (status) return notify(`Reset succeeded`, primBckg);

                errors.forEach((err) => notify(err, failureBckg));
            } catch ({ message }) {
                await gscript("logException", "reset", message);
            } finally {
                hide(preloader, hideCls);
                enable(reset);
            }
        });

        hide(preloader, hideCls);
    });
})(window, document);
