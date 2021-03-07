class AdsHelper {
  static base = "https://googleads.googleapis.com/v6";

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
  static search<R>(query: string, override?: string, pageToken?: string) {
    const { base, loginId } = AdsHelper;

    const full = `${base}/customers/${override || loginId}`;

    type AdsQueryPayload = {
      pageSize?: number;
      query: string;
      pageToken?: string;
    };

    const payload: AdsQueryPayload = {
      pageSize: 10000,
      query,
    };

    if (pageToken) payload.pageToken = pageToken;

    const res = UrlFetchApp.fetch(full, {
      method: "post",
      contentType: "application/json",
      headers: {
        ...AdsHelper.getAuthHeaders(),
      },
      muteHttpExceptions: true,
      followRedirects: true,
      payload,
    });

    const code = res.getResponseCode(),
      resText = res.getContentText();

    console.log(code, resText);

    const success = code >= 200 && code < 300;

    //TODO: expand type definition
    const { results }: { results: R[] } = success
      ? JSON.parse(resText)
      : { results: [] };

    return {
      results,
      error: success ? "" : resText,
      success,
    };
  }

  /**
   * @see {@link https://developers.google.com/google-ads/api/docs/rest/auth#oauth_20_credentials}
   */
  static getAuthHeaders() {
    const { loginId, devToken, authToken } = this;

    return {
      "Authorization": `Bearer: ${authToken}`,
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
