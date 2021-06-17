type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${Lowercase<T>}${Capitalize<SnakeToCamel<U>>}`
  : S;

type SnakeToCamelObj<T> = T extends object
  ? {
      [K in keyof T as SnakeToCamel<K & string>]: SnakeToCamelObj<T[K]>;
    }
  : T;

type Values<T> = T[keyof T];

type OmitArrKeys<T> = Exclude<keyof T, keyof (any[] | readonly any[])>;

type ExtractProp<T extends object, K extends string> = {
  [P in OmitArrKeys<T>]: T[P] extends object ? ExtractProp<T[P], K> : T[P];
}[OmitArrKeys<T>];

declare interface AdsEnums {
  Common: {
    ErrorCode: "RESOURCE_NAME_MALFORMED" | "INVALID_ARGUMENT";
  };

  ManagerLinks: {
    Status: "ACTIVE" | "INACTIVE" | "PENDING" | "REFUSED" | "CANCELED";
    ErrorCode:
      | "ALREADY_INVITED_BY_THIS_MANAGER"
      | "ALREADY_MANAGED_IN_HIERARCHY"
      | "DUPLICATE_CHILD_FOUND"
      | "TOO_MANY_MANAGERS"
      | "ACCOUNTS_NOT_COMPATIBLE_FOR_LINKING";
  };

  /** @see {@link https://developers.google.com/google-ads/api/reference/rpc/v6/ConversionUploadErrorEnum.ConversionUploadError} */
  ConversionUploads: {
    ErrorCode: "TOO_RECENT_CONVERSION_ACTION";
    CallConversions: {
      ErrorCode:
        | "EXPIRED_CALL"
        | "CALL_NOT_FOUND"
        | "TOO_RECENT_CALL"
        | "UNPARSEABLE_CALLERS_PHONE_NUMBER";
    };
  };

  ConversionActions: {
    Category: "PHONE_CALL_LEAD" | "LEAD" | "CONTACT";
    Status: "ENABLED" | "REMOVED" | "HIDDEN";
    Type: "UPLOAD_CALLS" | "CLICK_TO_CALL" | "WEBSITE_CALL";
  };
}

type ErrorCodes = ExtractProp<AdsEnums, "ErrorCode">;

//TODO: improve nested props typings
/** @see {@link https://developers.google.com/google-ads/api/reference/rpc/v6/Customer} */
type Customer = {
  resourceName: string;
  callReportingSetting: [object];
  conversionTrackingSetting: {
    conversionTrackingId: number;
    crossAccountConversionTrackingId: number;
  };
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

type WithClientId<T extends object> = T & { clientId: string };

type CommonPayload = {
  resource_name: string;
};

type CustomerClientLinkPayload = {
  manager_link_id: string;
  client_customer: string;
  hidden: boolean;
  status: AdsEnums["ManagerLinks"]["Status"];
} & CommonPayload;

type CustomerManagerLinkPayload = {
  status: AdsEnums["ManagerLinks"]["Status"];
} & CommonPayload;

type ConversionActionPayload = {
  resource_name: string;
  type: AdsEnums["ConversionActions"]["Type"];
  status: AdsEnums["ConversionActions"]["Status"];
  name: string;
  include_in_conversions_metric?: boolean;
  category: AdsEnums["ConversionActions"]["Category"];
};

type ConversionPayload<T extends object> = T & {
  currency_code: string;
  conversion_action: string;
  conversion_value: number;
};

type CallConversionPayload = ConversionPayload<{
  caller_id: string;
  call_start_date_time: SparseISO8601DTstring;
  conversion_date_time: SparseISO8601DTstring;
}>;

/** @see {@link https://developers.google.com/google-ads/api/reference/rpc/v6/TagSnippet} */
type TagSnippet = {
  global_site_tag: string;
  event_snippet: string;
};

type ConversionAction = SnakeToCamelObj<ConversionActionPayload> & {
  id: string;
  tag_snippets: TagSnippet[];
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

type AdsErrorOrPartialError = {
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
      trigger?: { stringValue: string };
      errorCode: {
        //TODO: expand
        managerLinkError: AdsEnums["ManagerLinks"]["ErrorCode"];
        conversionUploadError: AdsEnums["ConversionUploads"]["CallConversions"]["ErrorCode"];
      };
    }[];
  }[];
};

type AdsErrorResponse = {
  error: AdsErrorOrPartialError;
  partialFailureError: AdsErrorOrPartialError;
};

type SearchOptions = {
  loginCustomerId?: string;
  operatingCustomerId: string;
  pageToken?: string;
  pageSize?: number;
};

type BulkSearchOptions = SearchOptions & { pages?: number };

type CommonMutateOptions = {
  resourceName?: string;
};

type MutateCustomerLinkOptions = {
  fromId: string;
  linkId?: string;
  loginId?: string;
  toId: string;
  status?: AdsEnums["ManagerLinks"]["Status"];
} & CommonMutateOptions;

type MutateConversionActionOptions = WithClientId<{
  name: string;
  actionId?: string;
  type: AdsEnums["ConversionActions"]["Type"];
  status?: AdsEnums["ConversionActions"]["Status"];
  category?: AdsEnums["ConversionActions"]["Category"];
  defaultValue?: number;
  alwaysDefault?: boolean;
}> &
  CommonMutateOptions;

type Digit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "0";

type EveryOfType<A extends readonly any[], T> = keyof {
  [P in Exclude<keyof A, keyof any[]> as A[P] extends T ? never : P]: P;
} extends never
  ? true
  : false;

type SplitString<
  T extends string,
  A extends string[] = []
> = T extends `${infer F}${infer L}` ? SplitString<L, [...A, F]> : A;

type E164Format<T extends string> = SplitString<T> extends [
  "+",
  Digit,
  ...infer L
]
  ? L["length"] extends 12 | 10
    ? EveryOfType<L, Digit> extends true
      ? T
      : never
    : never
  : never;

type UploadCallConversionOptions<T extends string> = WithClientId<{
  phone: E164Format<T>;
  calledAt?: Date;
  datetime?: Date;
  value?: number;
  currency?: string;
  actionName: string;
}>;

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

class AdsError extends Error {
  constructor(code: ErrorCodes, message: string) {
    super(AdsError.formatMessage(code, message));
    this.name = "GoogleAdsError";
  }

  static formatMessage(code: ErrorCodes, message: string) {
    return `${code} | ${message}`;
  }
}

class Helper {
  static get userAuthToken() {
    return ScriptApp.getOAuthToken();
  }

  static getCommonFetchOpts(): Partial<GoogleAppsScript.URL_Fetch.URLFetchRequestOptions> {
    return {
      contentType: "application/json",
      muteHttpExceptions: true,
    };
  }
}

class AdsHelper extends Helper {
  static version = 6;

  static base = `https://googleads.googleapis.com/v${AdsHelper.version}`;

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/rest/auth#login_customer_id}
   */
  static loginId = "6921327172";

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/first-call/dev-token}
   */
  static devToken = "OzTAlzi33sZ1RedcmlPvJQ";

  static authMode: "user" | "app" = "user";

  static get appAuthToken() {
    const service = getAppAuthService();
    return service.getAccessToken();
  }

  static get authToken() {
    const { authMode } = this;
    return authMode === "user" ? this.userAuthToken : this.appAuthToken;
  }

  static mangleId(id: string) {
    return id.replace(/\-/g, "");
  }

  static toSelect(fields: string[], resource: string) {
    return fields.map((field) => `${resource}.${field}`).join(", ");
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

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/account-management/get-account-hierarchy}
   */
  static getAllCustomers() {
    const ids = this.listAccesibleAccounts();

    const customers = this.listCustomers(ids);

    const rname = "customer_client";

    const fields = [
      "client_customer",
      "level",
      "manager",
      "descriptive_name",
      "currency_code",
      "time_zone",
      "id",
    ];

    const query = `
    SELECT
      ${this.toSelect(fields, rname)}
    FROM
      ${rname}
    WHERE
      ${rname}.level = 1
    `;

    const processedIds: Partial<Record<string, 1>> = {};

    const walkAccount = (id: string, managerId = id): Customer[] => {
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

  static getCustomerResourceName(customerId: string) {
    return `customers/${customerId}`;
  }

  static getConversionActionResourceName(clientId: string, actionId: string) {
    return `${this.getCustomerResourceName(
      clientId
    )}/conversionActions/${actionId}`;
  }

  static getCustomerLink(
    managerId: string,
    clientId: string,
    status: AdsEnums["ManagerLinks"]["Status"] = "PENDING"
  ) {
    const name = "customer_client_link";

    const fields = ["manager_link_id", "client_customer"];

    const query = `
    SELECT
      ${this.toSelect(fields, name)}
    FROM
      ${name}
    WHERE
      ${name}.client_customer = "${AdsHelper.getCustomerResourceName(clientId)}"
      AND ${name}.status = ${status}
    `;

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

    const { error, partialFailureError } = content;

    const errOrPartialErr = error || partialFailureError;

    const success = code >= 200 && code < 300 && !errOrPartialErr;

    return {
      code,
      success,
      content,
      errors: errOrPartialErr || [],
    };
  }

  static handleCustomerLinkError(
    managerId: string,
    clientId: string,
    response: AdsErrorResponse,
    _status: AdsEnums["ManagerLinks"]["Status"] //TODO: make used in v2
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
    } = response;

    /**
     * @see {@link https://developers.google.com/google-ads/api/reference/rpc/v6/ManagerLinkErrorEnum.ManagerLinkError}
     */
    const statuses: Record<
      AdsEnums["ManagerLinks"]["ErrorCode"],
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

    console.warn(new AdsError(managerLinkError, message));

    return statuses[managerLinkError](managerId, clientId); //TODO: add parameters
  }

  static handleCallUploadError<T extends string>(
    options: UploadCallConversionOptions<T>,
    response: AdsErrorResponse
  ) {
    const {
      details: [{ errors }],
    } = response["error"] || response["partialFailureError"];

    //TODO: add more meaningful handling
    const statuses: Record<
      AdsEnums["ConversionUploads"]["CallConversions"]["ErrorCode"],
      (opts: UploadCallConversionOptions<T>) => boolean
    > = {
      TOO_RECENT_CALL: () => false,
      CALL_NOT_FOUND: () => false,
      EXPIRED_CALL: () => false,
      UNPARSEABLE_CALLERS_PHONE_NUMBER: () => false,
    };

    return errors.every(({ errorCode: { conversionUploadError }, message }) => {
      console.warn(new AdsError(conversionUploadError, message));
      return statuses[conversionUploadError](options);
    });
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

    return (
      success ||
      this.handleCustomerLinkError(managerId, clientId, content, status)
    );
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

    return (
      success ||
      this.handleCustomerLinkError(managerId, clientId, content, status)
    );
  }

  static getCustomerById(
    clientId: string,
    customerId: string = clientId
  ): Customer | null {
    const { success, content, errors } = this.fetchAPI(
      `customers/${customerId}`,
      {
        method: "get",
        loginId: clientId,
      }
    );

    success || console.warn(errors);

    return success ? content : null;
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/account-management/listing-accounts}
   */
  static listAccesibleAccounts() {
    const { success, content } = this.fetchAPI(
      `customers:listAccessibleCustomers`,
      {
        method: "get",
      }
    );

    if (!success) return [];

    type ListAccessibleCustomersResponse = {
      resourceNames: string[];
    };

    const { resourceNames }: ListAccessibleCustomersResponse = content;

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

  static getConversionAction({
    name,
    clientId,
  }: WithClientId<Partial<ConversionAction>>): ConversionAction | null {
    //TODO: only need name now, expand later and add code branch: if id -> GET request

    const rname = "conversion_action";

    const fields = ["id", "name", "owner_customer"];

    const query = `
    SELECT
      ${this.toSelect(fields, rname)}
    FROM
      ${rname}
    WHERE
      ${rname}.name = "${name}"
    `;

    const {
      results: [{ conversionAction }],
      error,
    } = this.search<{ conversionAction: ConversionAction }>(query, {
      operatingCustomerId: clientId,
      loginCustomerId: clientId,
    });

    if (error) {
      console.warn(error); //TODO: handle properly
      return null;
    }

    return conversionAction;
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/conversions/create-conversion-actions}
   */
  static mutateConversionAction({
    clientId,
    actionId,
    resourceName,
    status = "ENABLED",
    ...rest
  }: MutateConversionActionOptions) {
    const isCreating = resourceName === void 0;

    const action: Partial<ConversionActionPayload> = {
      status,
      include_in_conversions_metric: true, //TODO: make configurable?
      ...rest,
    };

    if (!isCreating) {
      if (!resourceName && !actionId)
        throw new RangeError(
          `action update must provide action id or resource name`
        );

      action.resource_name =
        resourceName ||
        this.getConversionActionResourceName(clientId, actionId!);
    }

    const payload = new AdsMutateOperations(clientId);
    payload.add(action, isCreating);

    const { content, success } = this.fetchAPI(
      `customers/${clientId}/conversionActions:mutate`,
      {
        method: "post",
        loginId: clientId,
        payload,
      }
    );

    success ||
      console.log((content as AdsErrorResponse).error.details[0].errors);

    //TODO: handle failure gracefully

    return success;
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/conversions/upload-calls}
   */
  static uploadCallConversion<T extends string>(
    options: UploadCallConversionOptions<T>
  ) {
    const {
      clientId,
      phone,
      actionName,
      calledAt = new Date(),
      currency = "USD",
      datetime = new Date(),
      value = 1,
    } = options;

    const payload = new UploadConversionRequest<CallConversionPayload>(
      clientId
    );

    payload.add({
      caller_id: phone,
      call_start_date_time: toSparseISO8601(calledAt),
      conversion_action: actionName,
      conversion_date_time: toSparseISO8601(datetime),
      conversion_value: value,
      currency_code: currency,
    });

    const { success, content } = this.fetchAPI(
      `customers/${clientId}:uploadCallConversions`,
      {
        method: "post",
        loginId: clientId,
        payload,
      }
    );

    return success || this.handleCallUploadError(options, content);
  }
}

class Operation {
  constructor(public customer_id: string) {}
}

class UploadConversionRequest<
  T extends ConversionPayload<{}>
> extends Operation {
  readonly partial_failure = true;

  conversions: Partial<T>[] = [];

  constructor(customer_id: string, public validate_only = false) {
    super(customer_id);
  }

  add(conversion: Partial<T>) {
    this.conversions.push(conversion);
  }
}

class AdsMutatateOperation extends Operation {
  operation: Partial<
    Record<"create" | "update" | "remove" | "update_mask", unknown>
  > = {};

  constructor(customer_id: string, public setCustomerId = true) {
    super(customer_id);
  }

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

class AdsMutateOperations extends Operation {
  operations: AdsMutatateOperation[] = [];

  add<T>(resource: T, isCreating = true) {
    return isCreating ? this.addCreate(resource) : this.addUpdate(resource);
  }

  addCreate<T>(resource: T) {
    const { operations, customer_id } = this;

    const operation = new AdsMutatateOperation(customer_id, false);
    operation.setCreate(resource);

    operations.push(operation);
  }

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

const listAccessibleAccounts = () => AdsHelper.listAccesibleAccounts();
const listCustomers = () => AdsHelper.listCustomers(listAccessibleAccounts());
const getAllAccounts = () => AdsHelper.getAllCustomers();
const linkAllAccounts = () => {
  const customers = AdsHelper.getAllCustomers();

  AdsHelper.authMode = "app";

  const managerId = "4854204549"; //TODO: remove override once prod token is obtained

  const withoutRoot = customers.filter(({ id }) => id !== managerId);

  const succeededPending = withoutRoot.filter(({ id }) =>
    AdsHelper.mutateCustomerClientLink({
      fromId: managerId,
      toId: id,
    })
  );

  const customerLinks = succeededPending.map((customer) => ({
    link: AdsHelper.getCustomerLink(managerId, customer.id),
    customer,
  }));

  AdsHelper.authMode = "user";

  const succeededAccepted = customerLinks.filter(
    ({ link, customer: { manager } }) => {
      if (!link) return false;

      const { managerLinkId, clientCustomer } = link;

      const a = {
        nameToCustomerId(resourceName: string) {
          return resourceName.replace(/customers\/(\d+)/, "$1");
        },
      };

      console.log(
        "testing name to customer",
        a.nameToCustomerId(clientCustomer)
      );

      const clientId = clientCustomer.replace("customers/", ""); //TODO: abstract to a method,

      return AdsHelper.mutateCustomerManagerLink({
        fromId: managerId,
        toId: clientId,
        linkId: managerLinkId,
        loginId: manager ? clientId : "4854204549", //TODO: fixup
        status: "ACTIVE",
      });
    }
  );

  return succeededAccepted;
};

const sendCallConversion = <T extends string>({
  clientId,
  ...conversionOptions
}: UploadCallConversionOptions<T>): boolean => {
  /**
   * Algo:
   *  - get conversion action by name from CONFIG
   *  - if not found, create with name from CONFIG
   *  - upload call conversion
   */
  const {
    ads: {
      conversions: { call },
    },
  } = getConfig();

  const action = AdsHelper.getConversionAction({ name: call, clientId });

  if (!action) {
    const created = AdsHelper.mutateConversionAction({
      clientId,
      name: call,
      type: "UPLOAD_CALLS",
      category: "PHONE_CALL_LEAD",
    });

    return created
      ? sendCallConversion({ clientId, ...conversionOptions })
      : false;
  }

  return AdsHelper.uploadCallConversion({
    clientId,
    ...conversionOptions,
    actionName: action.resourceName,
  });
};

const installGlobalSiteTag = (workspacePath: string, clientId: string) => {
  const customer = AdsHelper.getCustomerById(clientId);

  if (!customer) return false;

  const {
    conversionTrackingSetting: { conversionTrackingId },
  } = customer;

  const tagName = "FCT_Ads";

  const template = `<!-- Global site tag (gtag.js) - Google Ads: ${conversionTrackingId} -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-${conversionTrackingId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-${conversionTrackingId}');
</script>`;

  /** @see {@link https://developers.google.com/tag-manager/api/v2/tag-dictionary-reference#html} */
  return createOrUpdateTag([], tagName, workspacePath, {
    type: "html",
    parameter: [
      {
        key: "html",
        type: "template",
        value: template,
      },
    ],
  });
};

const testGetCustomer = () => {
  const [first] = AdsHelper.listAccesibleAccounts();
  const customer = AdsHelper.getCustomerById(first);
  console.log(customer);
  console.log(customer?.conversionTrackingSetting);
};

const testAccesibleAccounts = () => {
  console.log(AdsHelper.listAccesibleAccounts());
};

const testCustomers = () => {
  const ids = AdsHelper.listAccesibleAccounts();
  const customers = AdsHelper.listCustomers(ids);
  console.log({ customers });
};

const testAccountHierarchy = () => {
  const accounts = AdsHelper.getAllCustomers();
  console.log({ accounts });
};

const testGetAction = () => {
  const [firstId] = AdsHelper.listAccesibleAccounts();
  const conversion = AdsHelper.getConversionAction({
    clientId: firstId,
    name: "Test Conversion Action",
  })!;
  console.log(conversion);
};

const testMutateAction = () => {
  const [firstId] = AdsHelper.listAccesibleAccounts();
  const created = AdsHelper.mutateConversionAction({
    clientId: firstId,
    name: "Test Conversion Action",
    type: "UPLOAD_CALLS",
    category: "PHONE_CALL_LEAD",
  });

  console.log(created);
};

const testCallConversion = () => {
  const [firstId] = AdsHelper.listAccesibleAccounts();
  const { resourceName } = AdsHelper.getConversionAction({
    clientId: firstId,
    name: "Test Conversion Action",
  })!;

  const phone = "+1234123456789" as const;

  const uploaded = AdsHelper.uploadCallConversion({
    clientId: firstId,
    actionName: resourceName,
    phone,
    calledAt: offsetDays(new Date(), -2),
    value: 1,
  });

  console.log({
    firstId,
    resourceName,
    uploaded,
  });
};
