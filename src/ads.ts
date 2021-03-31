type Customer = {
  resourceName: string;
  callReportingSetting: [object];
  conversionTrackingSetting: [object];
  remarketingSetting: [object];
  payPerConversionEligibilityFailureReasons: [object];
  id: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  autoTaggingEnabled: boolean;
  hasPartnersBadge: boolean;
  manager: boolean;
  testAccount: boolean;
};

type ManagerLinkStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "PENDING"
  | "REFUSED"
  | "CANCELED";

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${Lowercase<T>}${Capitalize<SnakeToCamel<U>>}`
  : S;

type SnakeToCamelObj<T> = T extends object
  ? {
      [K in keyof T as SnakeToCamel<K & string>]: SnakeToCamelObj<T[K]>;
    }
  : T;

type CustomerClientLinkPayload = {
  manager_link_id: string;
  resource_name: string;
  client_customer: string;
  hidden: boolean;
  status: ManagerLinkStatus;
};

type CustomerManagerLinkPayload = {
  resource_name: string;
  status: ManagerLinkStatus;
};

type CustomerManagerLink = SnakeToCamelObj<CustomerManagerLinkPayload> & {
  manager_customer: string;
  manager_link_id: string;
};

type CustomerClientLink = SnakeToCamelObj<CustomerClientLinkPayload>;

type SearchGoogleAdsResponse<R> = {
  results: R[];
  nextPageToken?: string;
  totalResultsCount: number;
  fieldMask: string;
};

type ManagerLinkErrorCode =
  | "ALREADY_INVITED_BY_THIS_MANAGER"
  | "ALREADY_MANAGED_IN_HIERARCHY"
  | "DUPLICATE_CHILD_FOUND"
  | "TOO_MANY_MANAGERS"
  | "ACCOUNTS_NOT_COMPATIBLE_FOR_LINKING";

type AdsErrorResponse = {
  error: {
    code: number;
    message: string;
    status: string;
    details: {
      "@type": string;
      "errors": {
        location: {
          operationIndex: string;
          fieldPathElements?: { fieldName: string }[];
        };
        message: string;
        errorCode: {
          managerLinkError: ManagerLinkErrorCode; //TODO: expand
        };
      }[];
    }[];
  };
};

type Values<T> = T[keyof T];

type AdsErrorCodes = ManagerLinkErrorCode;

class AdsError extends Error {
  constructor(code: AdsErrorCodes, message: string) {
    super(AdsError.formatMessage(code, message));
    this.name = "GoogleAdsError";
  }

  static formatMessage(code: AdsErrorCodes, message: string) {
    return `${code} | ${message}`;
  }
}

type SearchOptions = {
  loginCustomerId?: string;
  operatingCustomerId: string;
  pageToken?: string;
  pageSize?: number;
};

type BulkSearchOptions = SearchOptions & { pages?: number };

type MutateCustomerLinkOptions = {
  fromId: string;
  linkId?: string;
  loginId?: string;
  resourceName?: string;
  toId: string;
  status?: ManagerLinkStatus;
};

const getAppAuthService = () => {
  const store = PropertiesService.getScriptProperties();

  const creds = store.getProperty("ads_secret");

  if (!creds) throw new Error("Missing App credentials");

  const { id, secret }: { id: string; secret: string } = JSON.parse(creds);

  const service = OAuth2.createService("ads_helper");
  service.setTokenUrl("https://oauth2.googleapis.com/token");
  service.setAuthorizationBaseUrl(
    "https://accounts.google.com/o/oauth2/v2/auth"
  );
  service.setPropertyStore(PropertiesService.getScriptProperties());
  service.setCache(CacheService.getScriptCache());
  service.setClientId(id);
  service.setClientSecret(secret);
  service.setScope("https://www.googleapis.com/auth/adwords");
  service.setParam("access_type", "offline");
  service.setParam("approval_prompt", "force");
  service.setCallbackFunction("authCallback");
  return service;
};

const authCallback = (request: object) => {
  const service = getAppAuthService();
  const status = service.handleCallback(request);
  return HtmlService.createHtmlOutput(status ? "success" : "failure");
};

const checkAppAccess = () => {
  const service = getAppAuthService();
  console.log(service.hasAccess());
};

const switchAppAccount = () => {
  const service = getAppAuthService();
  if (service.hasAccess()) service.reset();
  console.warn(service.getAuthorizationUrl());
};

class AdsHelper {
  static version = 6;

  static base = `https://googleads.googleapis.com/v${AdsHelper.version}`;

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/rest/auth#login_customer_id}
   */
  static get loginId() {
    return "6921327172";
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/first-call/dev-token}
   */
  static get devToken() {
    return "OzTAlzi33sZ1RedcmlPvJQ";
  }

  static get authToken() {
    return ScriptApp.getOAuthToken();
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/query/overview}
   */
  static search<R>(
    query: string,
    {
      operatingCustomerId,
      loginCustomerId,
      pageToken,
      pageSize = 1e4,
    }: SearchOptions
  ) {
    const { base, loginId } = AdsHelper;

    const full = `${base}/customers/${operatingCustomerId}/googleAds:search`;

    type AdsQueryPayload = {
      customer_id: string;
      pageSize?: number;
      query: string;
      pageToken?: string;
    };

    const payload: AdsQueryPayload = {
      customer_id: operatingCustomerId,
      pageSize,
      query,
    };

    if (pageToken) payload.pageToken = pageToken;

    const res = UrlFetchApp.fetch(full, {
      method: "post",
      headers: AdsHelper.getAuthHeaders(loginCustomerId || loginId),
      ...AdsHelper.getCommonFetchOpts(),
      payload: JSON.stringify(payload),
    });

    const code = res.getResponseCode(),
      resText = res.getContentText();

    const success = code >= 200 && code < 300;

    const { results = [], nextPageToken }: SearchGoogleAdsResponse<R> = success
      ? JSON.parse(resText)
      : { results: [] };

    return {
      nextPageToken,
      results,
      error: success ? "" : resText,
      success,
    };
  }

  static bulkSearch<R>(
    query: string,
    { pages = Infinity, ...rest }: BulkSearchOptions
  ) {
    let currentPageToken: string | undefined,
      currentPage = 0;

    const fullResults: R[] = [],
      errors: string[] = [];

    do {
      const { results, nextPageToken = "", error, success } = this.search<R>(
        query,
        {
          ...rest,
          pageToken: currentPageToken,
        }
      );

      success || errors.push(error);

      fullResults.push(...results);

      currentPageToken = nextPageToken;

      currentPage += 1;
    } while (currentPageToken && currentPage < pages);

    return {
      results: fullResults,
      errors,
      success: !errors.length,
    };
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/rest/auth#oauth_20_credentials}
   */
  static getAuthHeaders(loginCustomerId?: string) {
    const { loginId, devToken, authToken } = this;

    return {
      "Authorization": `Bearer ${authToken}`,
      "developer-token": devToken,
      "login-customer-id": loginId,
    };
  }

  static getAccountHierarhy() {
    const accounts = this.listAccesibleAccounts();
    return accounts.flatMap(({ id }) => this.listAccesibleAccounts(id));
  }

  static listAccesibleAccounts(loginId?: string) {
    const query = `SELECT customer_client.id FROM customer_client`;

    const { success, results } = this.search<{ id: string }>(query, loginId);

    console.log(results, success);

    if (!success) return [];

    console.log(results);

    return results;
  }
}

const testHelper = () => {
  console.log(AdsHelper.getAccountHierarhy());
};
