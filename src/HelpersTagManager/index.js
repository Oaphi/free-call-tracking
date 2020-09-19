(function(self) {
  var _HelpersTagManager = function() {
    /**
     *
     * @param {string} parent
     * @return {GoogleAppsScript.TagManager.Schema.ListWorkspacesResponse}
     */
    function getWorkspacesListByCont(parent) {
      return TagManager.Accounts.Containers.Workspaces.list(parent);
    }

    /**
     *
     * @param {string} parent
     * @return {GoogleAppsScript.TagManager.Schema.ListContainersResponse}
     */
    function getConteinersListByAcc(parent) {
      return TagManager.Accounts.Containers.list(parent);
    }

    /**
     * @return {GoogleAppsScript.TagManager.Schema.ListAccountsResponse}
     */
    function getAccountsList() {
      return TagManager.Accounts.list();
    }

    return {
      getConteinersListByAcc: getConteinersListByAcc,
      getAccountsList: getAccountsList,
      getWorkspacesListByCont: getWorkspacesListByCont
    };
  };
  self.HelpersTagManager = _HelpersTagManager();
})(this);
