/* exported getUserDefinedVariables_ */
/**
 *
 * @param {string} variable
 * @return {string}
 */
function getUserDefinedVariables_(variable) {
  return HtmlService.createHtmlOutputFromFile(
    'UserDefinedVariables/' + variable
  )
    .getContent()
    .replace(/<\/?script>/g, '');
}
