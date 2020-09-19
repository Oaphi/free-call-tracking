/**
 *
 * @param {string} sId The Form id
 * @return {{
 *   sFormId: string,
 *   sUrl: string
 * }}
 */
function getPrefilledUrl(sId) {
  var form = FormApp.openById(sId);
  var items = form.getItems();

  // Skip headers, then build URLs for each row in Sheet1.
  // Create a form response object, and prefill it
  var formResponse = form.createResponse();

  var formItem1 = items[0].asTextItem();
  var response1 = formItem1.createResponse('$$1$$');
  formResponse.withItemResponse(response1);

  var formItem2 = items[1].asTextItem();
  var response2 = formItem2.createResponse('$$2$$');
  formResponse.withItemResponse(response2);

  var formItem3 = items[2].asTextItem();
  var response3 = formItem3.createResponse('$$3$$');
  formResponse.withItemResponse(response3);

  var formItem4 = items[3].asTextItem();
  var response4 = formItem4.createResponse('$$4$$');
  formResponse.withItemResponse(response4);

  // Get prefilled form URL
  var url = formResponse.toPrefilledUrl();

  var sUrl = url.replace('viewform', 'formResponse');

  var sUrlOut = sUrl
    .replace('$$1$$', '{{getTime' + sId + '}}')
    .replace('$$2$$', '{{getClientId' + sId + '}}')
    .replace('$$3$$', '{{Referrer}}')
    .replace('$$4$$', '{{Page Hostname}}{{Page Path}}');

  return { sFormId: sId, sUrl: sUrlOut };
}

/* global sMSG_FORM_EXISTS sFORM_NAME sTIMESTAMP sSITE_VISITOR_ID sSOURCE sSHEET_FORM sCURR_PAGE */
/* exported createForm */
/**
 *
 * @param {string} sMyCategory
 * @param {string} sMyEvent
 * @return {{
 *   sFormId: string,
 *   sUrl: string
 * }}
 */
function createForm(sMyCategory, sMyEvent) {
  var ss = SpreadsheetApp.getActive();
  var sCurrFormUrl = ss.getFormUrl();

  if (sCurrFormUrl) {
    Browser.msgBox(sMSG_FORM_EXISTS);
    return '';
  }

  var form = FormApp.create(sFORM_NAME).setAllowResponseEdits(false);
  try {
    form.setRequireLogin(false);
  } catch (error) {
    console.warn(error.message);
  }

  form.addTextItem().setTitle(sTIMESTAMP);
  form.addTextItem().setTitle(sSITE_VISITOR_ID);
  form.addTextItem().setTitle(sSOURCE);
  form.addTextItem().setTitle(sCURR_PAGE);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  SpreadsheetApp.flush();

  var sh = ss.getSheets()[0].setName(sSHEET_FORM);

  sh.setColumnWidth(1, 140);
  sh.setColumnWidth(2, 119);
  sh.setColumnWidth(3, 174);
  sh.setColumnWidth(4, 232);
  sh.setColumnWidth(5, 399);
  sh.setColumnWidth(6, 121);
  sh.getRange('E:E').setHorizontalAlignment('right');

  sh.getRange('F2:F' + sh.getMaxRows()).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .setAllowInvalid(false)
      .requireValueInList([sMyCategory + '/' + sMyEvent], true)
      .build()
  );

  var sPrefilledUrl = getPrefilledUrl(form.getId());

  return sPrefilledUrl;
}
