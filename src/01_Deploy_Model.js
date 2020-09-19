/* global
HelpersTagManager sFORM_TITLE createForm setProfileID getUserDefinedVariables_ sVERSION_NAME
getGoogleAnalyticsAccounts
*/
/* exported selectAccountDeployAddon */
/**
 *
 */
function selectAccountDeployAddon() {
  var arrGaAccs = [];
  try {
    arrGaAccs = getGoogleAnalyticsAccounts().items;
    if (!arrGaAccs || !arrGaAccs.length)
      throw new Error('There is access to Analytics, but there is no account.');
  } catch (error) {
    var _uuid1_ = Utilities.getUuid();
    console.error(_uuid1_, error);
    SpreadsheetApp.getUi().alert(
      'Warning!',
      'No Google Analytics accounts available. Please create at least one.\n' +
        'Issue uuid: ' +
        _uuid1_,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  var arrAccs = [];
  try {
    arrAccs = HelpersTagManager.getAccountsList().account;
    if (!arrAccs || !arrAccs.length)
      throw new Error('There is access to GTM, but there is no account.');
  } catch (error) {
    var _uuid2_ = Utilities.getUuid();
    console.error(_uuid2_, error);
    SpreadsheetApp.getUi().alert(
      'Warning!',
      'No Google Tag Manager accounts available. Please create and setup at least one.\n' +
        'Issue uuid: ' +
        _uuid2_,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  var template = HtmlService.createTemplateFromFile('99_SelectAccount.html');

  template.ArrAccs = arrAccs;
  template.ArrGaAccs = arrGaAccs;

  var html = template.evaluate();

  html.setHeight(670);
  html.setWidth(620);
  html.setTitle(sFORM_TITLE);

  SpreadsheetApp.getUi().showModalDialog(html, sFORM_TITLE);
}

/* exported deployAddon */
/**
 *
 * @param {string} sProfileId
 * @param {string} sContPath
 * @param {string} sWorkspacePath
 * @param {string} sMyCategory
 * @param {string} sMyEvent
 */
function deployAddon(
  sProfileId,
  sContPath,
  sWorkspacePath,
  sMyCategory,
  sMyEvent
) {
  var oTagCommand = createForm(sMyCategory, sMyEvent);
  var sTagCommand = oTagCommand.sUrl;
  var sId = oTagCommand.sFormId;

  if (sTagCommand == '' || sTagCommand == undefined) return;

  setProfileID(sProfileId);

  try {
    var sWsPath = sWorkspacePath;

    // create Vars
    var oNewVarGetClientId = {
      name: 'getClientId' + sId + '',
      type: 'jsm',
      parameter: [
        {
          type: 'template',
          key: 'javascript',
          value: getUserDefinedVariables_('clientId')
        }
      ]
    };

    TagManager.Accounts.Containers.Workspaces.Variables.create(
      oNewVarGetClientId,
      sWsPath
    );

    var oNewVarGetTime = {
      name: 'getTime' + sId,
      type: 'jsm',
      parameter: [
        {
          type: 'template',
          key: 'javascript',
          value: getUserDefinedVariables_('getTime')
        }
      ]
    };

    TagManager.Accounts.Containers.Workspaces.Variables.create(
      oNewVarGetTime,
      sWsPath
    );

    var oNewVarCid = {
      name: 'Cid' + sId,
      type: 'jsm',
      parameter: [
        {
          type: 'template',
          key: 'javascript',
          value: getUserDefinedVariables_('cid')
        }
      ]
    };

    TagManager.Accounts.Containers.Workspaces.Variables.create(
      oNewVarCid,
      sWsPath
    );

    // create a trigger
    var oNewTrigWL = { name: 'Window Loaded' + sId + '', type: 'windowLoaded' };
    var oTrigWL = TagManager.Accounts.Containers.Workspaces.Triggers.create(
      oNewTrigWL,
      sWsPath
    );

    // create Tag
    var oNewTagCS = {
      name: 'Caller on Site' + sId,
      type: 'img',
      parameter: [
        { type: 'boolean', value: 'true', key: 'useCacheBuster' },
        { type: 'template', value: sTagCommand, key: 'url' },
        { type: 'template', value: 'gtmcb', key: 'cacheBusterQueryParam' }
      ],
      firingTriggerId: [oTrigWL.triggerId]
    };

    TagManager.Accounts.Containers.Workspaces.Tags.create(oNewTagCS, sWsPath);

    republishContainer(sContPath, sWsPath);

    Browser.msgBox('Completed');
  } catch (e) {
    Browser.msgBox(e);
    return e;
  }

  return;
}

function republishContainer(sContPath, sWsPath) {
  var version = TagManager.Accounts.Containers.Workspaces.create_version(
    { name: sVERSION_NAME },
    sWsPath
  ).containerVersion;
  TagManager.Accounts.Containers.Versions.publish(version.path);

  return;
}

/* exported getConteinersArrByAcc */
/**
 *
 * @param {string} parent
 */
function getConteinersArrByAcc(parent) {
  return HelpersTagManager.getConteinersListByAcc(parent).container;
}

/* exported getWorkspacesArrByCont */
/**
 *
 * @param {string} parent
 */
function getWorkspacesArrByCont(parent) {
  return HelpersTagManager.getWorkspacesListByCont(parent).workspace;
}
