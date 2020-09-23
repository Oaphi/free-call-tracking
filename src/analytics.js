/* eslint-disable camelcase */
/* global getProfileID sSITE_VISITOR_ID */

/* exported userActionUpdateFreeCall  */

/**
 *
 */
function userActionUpdateFreeCall() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var activeCell = sheet.getActiveCell();
  var row = activeCell.getRow();
  if (row <= (sheet.getFrozenRows() || 1)) return;
  onEditEvent({
    range: activeCell
  });
}

const onEditEvent = (e) => TriggersApp.guardTracked(e, function onEditEvent(e) {

  var sCurValue = e.range.getValue();

  if (sCurValue == '') return;

  sCurValue += '';

  var iRow = e.range.getRow();

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (ss == undefined) return;

  var sheet = ss.getActiveSheet();

  var data = sheet.getRange(iRow, 1, 1, 6).getValues();
  var row = data[0];

  if (row[2] == undefined || row[2] == 'undefined' || row[2] == '') {
    Browser.msgBox(sSITE_VISITOR_ID + ' is undefined!!!');
    sheet.getRange('F' + iRow).setValue('');
    return;
  }

  // url для отправки: в категорию передается "Заявка", в действие статус

  var sId = getProfileID();
  // var url = "http://www.google-analytics.com/collect?v=1&tid=" + sId + "&cid=" + row[2] + "&t=event&ec=call&ea=call&z=" + row[0] + "&ni=1";

  if (sCurValue) {
    var ArrPar = sCurValue.split('/');
    var url =
      'http://www.google-analytics.com/collect?v=1&tid=' +
      sId +
      '&cid=' +
      row[2] +
      '&t=event&ec=' +
      ArrPar[0] +
      '&ea=' +
      ArrPar[1] +
      '&z=' +
      row[0] +
      '&ni=1';

    // https://developers.google.com/analytics/devguides/config/mgmt/v3

    // https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters
    // dh dt uip ua и dp
    // dt -  title
    // dh -  domen host name
    // dp -  page
    // uip - user IP

    var res = UrlFetchApp.fetch(url);

    SpreadsheetApp.getActive().toast(res.getResponseCode(), 'Done');
  }
});

const prepareAndSendHit = (e) => TriggersApp.guardTracked(e, callback)

/* exported switchTrigger */
/**
 *
 */
function switchTrigger() {
  var trgr = getTrigger();
  if (trgr === 1) {
    removeTrigger();
    return 0;
  } else if (trgr === 0) {
    createTrigger();
    return 1;
  }
  return -1;
}

/**
 *
 */
function getTrigger() {
  var triggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return (
      trigger.getEventType() === ScriptApp.EventType.ON_EDIT &&
      trigger.getHandlerFunction() == 'onEditEvent'
    );
  });
  var user = SpreadsheetApp.getActive()
    .getOwner()
    .getEmail();
  var current = Session.getActiveUser().getEmail();
  if (user !== current) return -1;
  if (triggers.length) return 1;
  return 0;
}

/**
 *
 */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (
      trigger.getEventType() === ScriptApp.EventType.ON_EDIT &&
      trigger.getHandlerFunction() == 'onEditEvent'
    )
      ScriptApp.deleteTrigger(trigger);
  });
}

/**
 *
 */
function createTrigger() {
  ScriptApp.newTrigger('onEditEvent')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}
