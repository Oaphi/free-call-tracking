interface UserVarsOpts {
    vars?: Record<string, any>;
    deps?: Record<string, string>;
}

const getUserVariables_ = (varName: string, options: UserVarsOpts = {}) => {
    const { vars = {}, deps = {} } = options;

    const tmpl = HtmlService.createTemplateFromFile(`src/variables/${varName}`);

    Object.entries(deps).forEach(([alias, path]) => (tmpl[alias] = path));
    Object.entries(vars).forEach(([name, value]) => (tmpl[name] = value));

    const content = tmpl.evaluate().getContent();

    return content.replace(/<\/?script>/g, "");
};
