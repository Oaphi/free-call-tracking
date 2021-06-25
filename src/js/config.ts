type AppSettings = {
    firstTime: boolean;
    triggers: {
        enableDailyClear: boolean;
        enableEditTrigger: boolean;
    };
    accounts: {
        ads: string;
        analytics: {
            account: string;
            profile: string;
            property: string;
        };
    };
};

const config = {
    classes: {
        notify: {
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
        preloader: "preloader",
    },
};
