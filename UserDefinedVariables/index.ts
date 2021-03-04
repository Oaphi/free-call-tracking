/* exported getUserDefinedVariables_ */

//TODO: remove entirely
const FOLDER = "UserDefinedVariables";

declare interface UserDefinedVarsOpts {
  vars?: Record<string, any>;
  deps?: Record<string, string>;
}

function getUserDefinedVariables_(varName : string, options: UserDefinedVarsOpts = {}) {
  const { vars = {}, deps = {} } = options;

  const template = HtmlService.createTemplateFromFile(`${FOLDER}/${varName}`);

  Object.entries(deps).forEach(([alias, path]) => (template[alias] = path));
  Object.entries(vars).forEach(([name, value]) => (template[name] = value));

  const content = template.evaluate().getContent();

  return content.replace(/<\/?script>/g, "");
}
