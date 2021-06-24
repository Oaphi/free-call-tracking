interface EventListener {
    (evt: Event): void | Promise<void>;
}
(() => {
    const config = {
        classes: {
            notify: {
                error: "toast-error",
                success: "primary-background",
                failure: "failure-background",
            },
        },
        times: {
            notify: {
                fast: 1e3,
                slow: 4e3,
            },
        },
        ids: {
            preloader: "#Preloader1",
        },
    };

    /**
     * @summary adds a select option
     */
    const addOption = (text: string, value: string) => {
        const opt = document.createElement("option");
        opt.appendChild(document.createTextNode(text));
        opt.setAttribute("value", value);
        return opt;
    };

    /**
     * @summary removes select options
     */
    const removeOptions = (selectElement: HTMLSelectElement) => {
        const { options } = selectElement;
        [...options].forEach((o) => o.remove());
    };

    function resetSelectPropagation() {
        document.addEventListener("click", (event) => {
            const { target, currentTarget } = event;
            if (target === currentTarget) return;
            if ((<HTMLElement>target).matches(".select-wrapper"))
                event.stopPropagation();
        });
    }

    window.addEventListener("error", async ({ message }) => {
        await gscript("logException", "setup", message);
        notify("Something went wrong", config.classes.notify.failure);
    });

    window.addEventListener("unhandledrejection", async ({ reason = "" }) => {
        await gscript("logException", "setup", reason.toString());
        notify("Something went wrong", config.classes.notify.failure);
    });

    window.addEventListener("load", async () => {
        const preloader = document.getElementById(config.ids.preloader)!;

        M.AutoInit();

        //map of selector : handler
        const changeHandlers = {
            // gAdsSwitch: changeAdsFormVisibility,
            GaAcc: formChangeGaAccount,
            Acc: formChangeAccount,
            Prop: formChangeGaProperty,
            Cont: formChangeContainer,
        };

        Object.entries(changeHandlers).forEach(([id, handler]) => {
            document.addEventListener("change", async (evt) => {
                const { target } = evt;

                if (id !== (<HTMLElement>target).id) return;

                show(preloader);
                await handler(evt);
                hide(preloader);
            });
        });

        resetSelectPropagation();

        document.body.classList.remove("hidden");

        show(preloader);

        const [
            gaAccount,
            gaProperty,
            gaProfile,
            // adsAccount,
        ] = $<HTMLSelectElement>("#GaAcc, #Prop, #Prof, #Acc, #Cont, #Work");

        const settings = await gscript("getSettings");

        const {
            accounts: {
                analytics: { account, property, profile },
            },
        } = settings;

        if (account) {
            gaAccount.value = account;
            $(gaAccount).formSelect();
            //@ts-expect-error
            await formChangeGaAccount({ target: gaAccount });
        }

        if (property) {
            gaProperty.value = property;
            $(gaProperty).formSelect();
            //@ts-expect-error
            await formChangeGaProperty({ target: gaProperty });
        }

        if (profile) {
            gaProfile.value = profile;
            $(gaProfile).formSelect();
        }

        // const customers = await getAdsAccounts(
        //     ({ id, descriptiveName }) => ({
        //         name: descriptiveName,
        //         id,
        //     })
        // );

        // handleChange("Ads", "id")(customers);

        const bouncedDeploy = debounce(deployAddon);

        const submitBtn = document.getElementById("submit")!;
        submitBtn.addEventListener("click", () => bouncedDeploy(preloader));

        const cancelBtn = document.getElementById("cancel")!;
        cancelBtn.addEventListener("click", () => google.script.host.close());

        hide(preloader);
    });

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

    /**
     * @summary generic change handler
     */
    const handleChange =
        (id: string, prop: string) =>
        (data: { name: string; [x: string]: string }[]) => {
            const sel = <HTMLSelectElement>document.getElementById(id);
            removeOptions(sel);

            data.unshift({ name: "Select", [prop]: "" });

            const opts = data.map((item) => addOption(item.name, item[prop]));

            sel.append(...opts);

            $(sel).formSelect();
        };

    /**
     * @summary processes change failure
     */
    const handleChangeFailure = (selId: string) => (err: Error) => {
        $(`#${selId}`).find("option:first").prop("selected", true);
        $(`#${selId}`).formSelect();
        notify(err.toString(), config.classes.notify.failure);
    };

    const formChangeGaAccount: EventListener = async ({ target }: Event) => {
        const { value } = <HTMLSelectElement>target;

        const { status, properties } = await run({
            funcName: "getGaPropertiesArrByAcc",
            params: [value],
            onFailure: handleChangeFailure("#GaAcc"),
        });

        if (!status)
            return void notify(
                `Failed to load Analytics properties!`,
                config.classes.notify.failure
            );

        handleChange("Prop", "id")(properties);
    };

    /**
     * @summary handles Analytics account dropdown chage
     */
    const formChangeGaProperty: EventListener = async ({ target }: Event) => {
        const { value } = <HTMLSelectElement>target;

        const sAccId = $("#GaAcc").val();

        const profiles = await run({
            funcName: "getGaProfiles",
            params: [sAccId, value],
            onFailure: handleChangeFailure("#GaAcc"),
        });

        handleChange("Prof", "id")(profiles);
    };

    /**
     * @summary extracts entities for the inputs
     */
    const getEntities = async (
        selId: string,
        subSelId: string,
        prop: string,
        handlerName: string
    ) => {
        const sAccPath = $(`#${selId}`).val();

        if (!sAccPath) return;

        const entities = await run({
            funcName: handlerName,
            params: [sAccPath],
            onFailure: handleChangeFailure(selId),
        });

        handleChange(subSelId, prop)(entities);
    };

    const formChangeAccount: EventListener = () =>
        getEntities("Acc", "Cont", "path", "getConteinersArrByAcc");

    const formChangeContainer: EventListener = () =>
        getEntities("Cont", "Work", "path", "getWorkspacesArrByCont");

    async function deployAddon(preloader: HTMLElement) {
        const [
            gaAccount,
            gaProperty,
            gaProfile,
            gtmAccountPath,
            gtmContainerPath,
            gtmWorkspacePath,
            // adsAccount,
        ] = $("#GaAcc, #Prop, #Prof, #Acc, #Cont, #Work").map((i, el) =>
            $(el).val()
        );

        // const willLinkAds = $("#gAdsSwitch").is(":checked");
        // const willCreateGoal = $("#createGoal").is(":checked");

        const issues = [];

        if (!gaAccount) issues.push("Please select an Analytics Account!");
        if (!gaProperty) issues.push("Please select an Analytics Property!");
        if (!gtmAccountPath)
            issues.push("Please select a Tag Manager Account!");
        if (!gtmContainerPath) issues.push("Please select a Container!");
        if (!gtmWorkspacePath) issues.push("Please select a Workspace!");
        // if (willLinkAds && !adsAccount)
        //     issues.push("Please select an Ads Account");

        // if (willCreateGoal && !gaProfile)
        //     issues.push(`Please select an Analytics Profile!`);

        const { error } = config.classes.notify;

        if (issues.length) return issues.forEach((msg) => notify(msg, error));

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

        const gaCategory = $("#MyCategory").val() || "Call";
        const gaEvent = $("#MyEvent").val() || "Call";

        // if (willCreateGoal) {
        //     const goalStatus = await gscript("createEventGoal", {
        //         gaAccount,
        //         gaProperty,
        //         gaProfile,
        //         gaCategory,
        //         gaEvent,
        //     });

        //     goalStatus
        //         ? notify(
        //               `Created Analytics Goal`,
        //               config.times.notify.slow,
        //               config.classes.notify.success
        //           )
        //         : showError(`Failed to create Analytics Goal!`);
        // }

        try {
            await gscript("deployAddon", {
                gaAccount,
                gaProperty,
                gaProfile,
                gaCategory,
                gaEvent,
                gtmContainerPath,
                gtmWorkspacePath,
                gtmAccountPath,
            });

            google.script.host.close();
        } catch (error) {
            console.debug({ error });
            notify("Something went wrong");
        } finally {
            enable("submit");
            hide(preloader);
        }
    }

    document.addEventListener("click", ({ target }) => {
        const el = <HTMLElement>target;
        if (!el.matches(".toast")) return;
        M.Toast.getInstance(el).dismiss();
    });
})();
