// ------------------------------------------------------------------------- New Config -----------------------------------------------------------------------------

var sADDON_NAME = "Free Call Tracking";

var sFORM_TITLE = "GA and GTM linking";
var sFORM_NAME = "Free Call Tracking";
var sSHEET_FORM = "Calls Qualification";

var sVERSION_NAME = "MyVersion0";

var APP_CONFIG = {
  menus: {
    main: {
      items: {
        deploy: "Deploy the Addon",
        installUA: "Install Universal Analytics",
        openSettings: "Open Settings",
        openHelp: "Get Help",
      },
    },
  },
  strings: {
    help: {
      title: "Help",
    },
    form: {
      visitorId: "Site Visitor (Client ID)",
      title: "GA and GTM linking",
      timestamp: "GA Timestamp",
      userAgent: "User Agent",
      pageTitle: "Page Title",
      geoLocation: "Geolocation",
    },
  },
  sizes: {
    setup: [620, 820],
  },
  sheets: {
    form: "Calls Qualification",
  },
  properties: {
    clear: "clear_trigger",
    metadata: "no_ga",
    profile: "analytics_id",
    gtm: "gtm_settings",
    settings: "addon_settings",
    lead: "lead",
  },
  logging: {
    users:
      "https://script.google.com/macros/s/AKfycbwxXJlZ3Xg8J8RxFFDKj5vpMkskSztHRFA4_en5msqoWV0ub0g/exec",
  },
  ids: {
    analytics: "UA-168009246-1",
  },
  tagManager: {
    versions: {
      main: "MyVersion0",
    },
    variables: {
      prefix: "FCT_",
      get geo() {
        return `${this.prefix}geo`;
      },
      get cid() {
        return `${this.prefix}Cid`;
      },
      get clid() {
        return `${this.prefix}getClientId`;
      },
      get time() {
        return `${this.prefix}getTime`;
      },
      get uagent() {
        return `${this.prefix}userAgent`;
      },
      get title() {
        return `${this.prefix}pageTitle`;
      },
    },
    triggers: {
      load: "Window Loaded",
      view: "Page Viewed",
    },
    tags: {
      ua: "Universal Analytics",
    },
  },
  ENV: "prod",
};

const getConfig = () => APP_CONFIG;

//proactively inject dependency
TriggersApp.use(PropertiesService);

// -------------------------------------------------------------------------- header --------------------------------------------------------------------------------

var sTIMESTAMP = "GA Timestamp";
var sSOURCE = "Source / Previous Page";
var sCURR_PAGE = "Current Page";

// ------------------------------------------------------------------------- msg ------------------------------------------------------------------------------------
var sMSG_FORM_EXISTS =
  "We found an existing form connected to the Spreadsheet and will be using it for manual tracking.";
