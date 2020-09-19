/* exported getGoogleAnalyticsAccounts */
/**
 * @return {GoogleAppsScript.Analytics.Schema.Accounts}
 */
function getGoogleAnalyticsAccounts() {
  var accounts = Analytics.Management.Accounts.list();
  return accounts;
}

/* exported getGaPropertiesArrByAcc */
/**
 *
 * @param {string} sAccID
 * @return {GoogleAppsScript.Analytics.Schema.Webproperties}
 */
function getGaPropertiesArrByAcc(sAccID) {
  var webProperties = Analytics.Management.Webproperties.list(sAccID);
  if (webProperties) {
    var ArrProperties = webProperties.items;
  } else {
    ArrProperties[0].name = 'No available Accounts';
    ArrProperties[0].id = '';
  }
  return ArrProperties;
}
