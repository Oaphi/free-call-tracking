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
      "login-customer-id": loginCustomerId || loginId,
    };
  }

  static getCommonFetchOpts(): Partial<GoogleAppsScript.URL_Fetch.URLFetchRequestOptions> {
    return {
      contentType: "application/json",
      muteHttpExceptions: true,
    };
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/account-management/get-account-hierarchy}
   */
  static getAllCustomers() {
    const ids = this.listAccesibleAccounts();

    const customers = this.listCustomers(ids);

    const query = `
    SELECT
      customer_client.client_customer,
      customer_client.level,
      customer_client.manager,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.id
    FROM
      customer_client
    WHERE
      customer_client.level = 1
    `;

    const processedIds: Partial<Record<string, 1>> = {};

    const walkAccount = (id: string, managerId = id): Customer[] => {
      console.log(`walking customer: ${id}, manager: ${managerId}`);

      if (processedIds[id]) return [];

      const { results } = this.bulkSearch<{ customerClient: Customer }>(query, {
        operatingCustomerId: id,
        loginCustomerId: managerId,
      });

      processedIds[id] = 1;

      return results.flatMap(({ customerClient }) => {
        if (!customerClient.manager) return [customerClient];
        return [customerClient, ...walkAccount(customerClient.id, managerId)];
      });
    };

    return customers.flatMap((acc) => [acc, ...walkAccount(acc.id)]);
  }

  static getCustomerManagerLinkResourceName(
    managerId: string,
    clientId: string,
    linkId: string
  ) {
    return `${AdsHelper.getCustomerResourceName(
      clientId
    )}/customerManagerLinks/${managerId}~${linkId}`;
  }

  static getCustomerClientLinkResourceName(
    managerId: string,
    clientId: string,
    linkId: string
  ) {
    return `${AdsHelper.getCustomerResourceName(
      managerId
    )}/customerClientLinks/${clientId}~${linkId}`;
  }

  static getCustomerResourceName(id: string) {
    return `customers/${id}`;
  }

  static getCustomerLink(
    managerId: string,
    clientId: string,
    status: ManagerLinkStatus = "PENDING"
  ) {
    const name = "customer_client_link";

    const query = `
    SELECT
      ${name}.manager_link_id,
      ${name}.client_customer
    FROM
      ${name}
    WHERE
      ${name}.client_customer = "${AdsHelper.getCustomerResourceName(clientId)}"
    AND ${name}.status = ${status}`;

    const { results: [match] = [] } = this.search<{
      customerClientLink: CustomerClientLink;
    }>(query, {
      operatingCustomerId: managerId,
      loginCustomerId: managerId,
    });

    if (!match) return;

    const { customerClientLink } = match;

    return customerClientLink;
  }

  static fetchAPI<P extends object>(
    path: string,
    {
      method = "get",
      loginId,
      payload,
    }: { method?: "get" | "post"; loginId?: string; payload?: P }
  ) {
    const { base } = AdsHelper;

    const res = UrlFetchApp.fetch(`${base}/${path}`, {
      method,
      headers: AdsHelper.getAuthHeaders(loginId),
      ...AdsHelper.getCommonFetchOpts(),
      payload: JSON.stringify(payload),
    });

    const code = res.getResponseCode(),
      content = JSON.parse(res.getContentText());

    const success = code >= 200 && code < 300;

    return { code, success, content };
  }

  static handleCustomerLinkError(
    managerId: string,
    clientId: string,
    response: AdsErrorResponse,
    _status: ManagerLinkStatus //TODO: make used in v2
  ) {
    const {
      error: {
        details: [
          {
            errors: [
              {
                errorCode: { managerLinkError },
                message,
              },
            ],
          },
        ],
      },
    }: AdsErrorResponse = response;

    /**
     * @see {@link https://developers.google.com/google-ads/api/reference/rpc/v6/ManagerLinkErrorEnum.ManagerLinkError}
     */
    const errorStatuses: Record<
      ManagerLinkErrorCode,
      (mid: string, cid: string) => boolean
    > = {
      ALREADY_INVITED_BY_THIS_MANAGER: () => false,
      ALREADY_MANAGED_IN_HIERARCHY: () => false,
      DUPLICATE_CHILD_FOUND: () => false,
      TOO_MANY_MANAGERS: (_mid, _cid) => {
        return false; //TODO: in v2, should trigger new manager account from pool
      },
      ACCOUNTS_NOT_COMPATIBLE_FOR_LINKING: () => false,
    };

    console.warn(new AdsError(managerLinkError, message), managerLinkError);

    return errorStatuses[managerLinkError](managerId, clientId); //TODO: add parameters
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/reference/rpc/v6/CustomerClientLink}
   */
  static mutateCustomerClientLink({
    fromId,
    linkId,
    resourceName,
    toId,
    status = "PENDING",
  }: MutateCustomerLinkOptions) {
    const managerId = AdsHelper.mangleId(fromId),
      clientId = AdsHelper.mangleId(toId);

    const isCreating = status === "PENDING";

    const clientLink: Partial<CustomerClientLinkPayload> = {
      status,
    };

    //client_customer field is immutable
    if (isCreating) clientLink.client_customer = `customers/${clientId}`;

    if (!isCreating) {
      if (!linkId && !resourceName)
        throw new RangeError("links can't be updated without ID");

      clientLink.resource_name =
        resourceName ||
        AdsHelper.getCustomerClientLinkResourceName(
          managerId,
          clientId,
          linkId!
        );
    }

    const op = new AdsMutatateOperation(managerId);
    isCreating ? op.setCreate(clientLink) : op.setUpdate(clientLink);

    const {
      content,
      success,
    } = AdsHelper.fetchAPI(
      `${this.getCustomerResourceName(managerId)}/customerClientLinks:mutate`,
      { method: "post", loginId: managerId, payload: op }
    );

    if (!success)
      return this.handleCustomerLinkError(managerId, clientId, content, status);

    return true;
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/reference/rpc/v6/CustomerManagerLink}
   */
  static mutateCustomerManagerLink({
    fromId,
    linkId,
    loginId,
    resourceName,
    toId,
    status = "PENDING",
  }: MutateCustomerLinkOptions) {
    const managerId = AdsHelper.mangleId(fromId),
      clientId = AdsHelper.mangleId(toId);

    const clientLink: Partial<CustomerManagerLinkPayload> = {
      status,
    };

    if (!linkId && !resourceName)
      throw new RangeError("links can't be updated without ID");

    clientLink.resource_name =
      resourceName ||
      AdsHelper.getCustomerManagerLinkResourceName(
        managerId,
        clientId,
        linkId!
      );

    const op = new AdsMutateOperations(clientId);
    op.addUpdate(clientLink);

    const {
      content,
      success,
    } = AdsHelper.fetchAPI(
      `${this.getCustomerResourceName(clientId)}/customerManagerLinks:mutate`,
      { method: "post", loginId: loginId || clientId, payload: op }
    );

    if (!success)
      return this.handleCustomerLinkError(managerId, clientId, content, status);

    return true;
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/account-management/listing-accounts}
   */
  static listAccesibleAccounts() {
    const { base } = AdsHelper;

    const full = `${base}/customers:listAccessibleCustomers`;

    const res = UrlFetchApp.fetch(full, {
      headers: AdsHelper.getAuthHeaders(),
      ...AdsHelper.getCommonFetchOpts(),
    });

    const code = res.getResponseCode(),
      text = res.getContentText();

    const success = code >= 200 && code < 300;

    if (!success) {
      logException("customer list", new Error(text));
      return [];
    }

    type ListAccessibleCustomersResponse = {
      resourceNames: string[];
    };

    const { resourceNames }: ListAccessibleCustomersResponse = JSON.parse(text);

    return resourceNames.map((name) => name.replace("customers/", ""));
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/reference/rpc/v6/CustomerService#getcustomer}
   */
  static listCustomers(ids: string[]): Customer[] {
    const { base } = AdsHelper;

    const requests: GoogleAppsScript.URL_Fetch.URLFetchRequest[] = ids.map(
      (id) => ({
        url: `${base}/customers/${id}`,
        ...AdsHelper.getCommonFetchOpts(),
        headers: AdsHelper.getAuthHeaders(id),
      })
    );

    const results = UrlFetchApp.fetchAll(requests);

    const succeded = results.filter((res) => {
      const code = res.getResponseCode();
      return code >= 200 && code < 300;
    });

    return succeded.map((res) => JSON.parse(res.getContentText()));
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/conversions/upload-calls}
   */
  static addCallConversion(clientId: string) {}
}

class AdsMutatateOperation {
  operation: Partial<
    Record<"create" | "update" | "remove" | "update_mask", unknown>
  > = {};

  constructor(public customer_id: string, public setCustomerId = true) {}

  static resourceToProtoBuf<T>(resource: T) {
    return Object.keys(resource).join(","); //TODO: conform to ProtoBuff spec
  }

  setCreate<T>(resource: T) {
    this.operation.create = resource;
  }

  setUpdate<T>(resource: T) {
    this.operation.update = resource;
    this.operation.update_mask = AdsMutatateOperation.resourceToProtoBuf(
      resource
    );
  }

  toJSON() {
    const { setCustomerId, operation, customer_id } = this;
    return setCustomerId ? { operation, customer_id } : { operation };
  }
}

class AdsMutateOperations {
  operations: AdsMutatateOperation[] = [];

  constructor(public customer_id: string) {}

  addUpdate<T>(resource: T) {
    const { operations, customer_id } = this;

    const operation = new AdsMutatateOperation(customer_id, false);
    operation.setUpdate(resource);

    operations.push(operation);
  }

  toJSON() {
    const { operations, customer_id } = this;
    return {
      customer_id,
      operations: operations.map(({ operation }) => operation),
    };
  }
}

const testHelper = () => {
  console.log(AdsHelper.getAccountHierarhy());
};
