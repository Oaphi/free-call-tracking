interface TagManagerIds {
  accountId?: string;
  containerId?: string;
  tagId?: string;
  versionId?: string;
  workspaceId?: string;
}

var HelpersTagManager = (() => {
  const LastUsed: TagManagerIds = {
    accountId: "",
    containerId: "",
    tagId: "",
    workspaceId: "",
    versionId: "",
  };

  const getContainerPath = (used: typeof LastUsed) =>
    `accounts/${used.accountId}/containers/${used.containerId}`;

  const getWorkspacePath = (used: typeof LastUsed) =>
    `${getContainerPath(used)}/workspaces/${used.workspaceId}`;

  /**
   * @summary gets GTM account
   */
  function getAccount(path: string) {
    try {
      const account = TagManager?.Accounts?.get(path);

      if (!account) return null;

      LastUsed.accountId = account.accountId;
      return account;
    } catch (error) {
      console.warn(`failed to get account: ${error}`);
      return null;
    }
  }

  /**
   * @summary gets GTM account by Id
   */
  function getAccountById(id: string) {
    return getAccount(`accounts/${id}`);
  }

  /**
   * @summary lists GTM accounts
   */
  function getAccountsList(): GoogleAppsScript.TagManager.Schema.ListAccountsResponse {
    return TagManager?.Accounts?.list() || { account: [] };
  }

  /**
   * @summary gets GTM container
   */
  function getContainer(path: string) {
    try {
      const container = TagManager?.Accounts?.Containers?.get(path);

      if (!container) return null;

      LastUsed.containerId = container.containerId;
      LastUsed.accountId = container.accountId;
      return container;
    } catch (error) {
      console.warn(`failed to get container: ${error}`);
      return null;
    }
  }

  /**
   * @summary gets GTM container by Id
   */
  function getContainerById(id: string) {
    const { accountId } = LastUsed;
    return getContainer(`accounts/${accountId}/containers/${id}`);
  }

  /**
   * @summary lists GTM containers
   */
  function getConteinersListByAcc(parent: string) {
    return TagManager?.Accounts?.Containers?.list(parent) || { container: [] };
  }

  /**
   * @summary gets GTM workspace
   */
  function getWorkspace(path?: string) {
    const workspace = TagManager?.Accounts?.Containers?.Workspaces?.get(
      path || getWorkspacePath(LastUsed)
    );

    if (!workspace) return null;

    LastUsed.workspaceId = workspace.workspaceId;
    LastUsed.accountId = workspace.accountId;
    LastUsed.containerId = workspace.containerId;

    return workspace;
  }

  /**
   * @summary gets GTM workspace by id
   */
  function getWorkspaceById(id: string) {
    const { accountId, containerId } = LastUsed;
    return getWorkspace(
      `accounts/${accountId}/containers/${containerId}/workspaces/${id}`
    );
  }

  /**
   * @summary lists GTM workspaces
   */
  function listWorkspaces(containerPath?: string) {
    try {
      const {
        workspace = [],
      } = TagManager?.Accounts?.Containers?.Workspaces?.list(
        containerPath || getContainerPath(LastUsed)
      ) || { workspace: [] };
      return workspace;
    } catch (error) {
      console.warn(`failed to list workspaces: ${error}`);
      return [];
    }
  }

  /**
   * @summary gets GTM tag by path
   */
  function getTag(path: string) {
    const tag = TagManager?.Accounts?.Containers?.Workspaces?.Tags?.get(path);

    if (!tag) return null;

    LastUsed.accountId = tag.accountId;
    LastUsed.containerId = tag.containerId;
    LastUsed.workspaceId = tag.workspaceId;
    LastUsed.tagId = tag.tagId;
    return tag;
  }

  /**
   * @summary gets GTM tag by its id
   */
  function getTagById(id: string) {
    const { accountId, containerId, workspaceId } = LastUsed;

    return getTag(
      `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${id}`
    );
  }

  /**
   * @summary lists GTM tags
   */
  function listTags(path: string) {
    try {
      const {
        tag = [],
      } = TagManager?.Accounts?.Containers?.Workspaces?.Tags?.list(path) || {
        tag: [],
      };
      return tag;
    } catch (error) {
      console.warn(`failed to list tags: ${error}`);
      return [];
    }
  }

  /**
   * @summary lists GTM variables
   */
  function listVariables(parent: string) {
    try {
      const {
        variable = [],
      } = TagManager?.Accounts?.Containers?.Workspaces?.Variables?.list(
        parent
      ) || { variable: [] };
      return variable;
    } catch (error) {
      console.warn(`failed to list vars: ${error}`);
      return [];
    }
  }

  /**
   * @summary lists GTM triggers
   */
  function listTriggers(parent: string) {
    try {
      const {
        trigger = [],
      } = TagManager?.Accounts?.Containers?.Workspaces?.Triggers?.list(
        parent
      ) || { trigger: [] };
      return trigger;
    } catch (error) {
      console.warn(`failed to list triggers: ${error}`);
      return [];
    }
  }

  /**
   * @summary gets a version by path
   */
  function getVersion(path: string) {
    try {
      const version = TagManager?.Accounts?.Containers?.Versions?.get(path);

      if (!version) return null;

      const { containerId, accountId, containerVersionId } = version;
      LastUsed.containerId = containerId;
      LastUsed.accountId = accountId;
      LastUsed.versionId = containerVersionId;

      return version;
    } catch (error) {
      console.warn(`failed to get version: ${error}`);
      return null;
    }
  }

  /**
   * @summary gets a container version (by ID)
   */
  function getVersionById(id: string) {
    const { accountId, containerId } = LastUsed;

    return getVersion(
      `accounts/${accountId}/containers/${containerId}/versions/${id}`
    );
  }

  /**
   * @summary gets a currently live GTM version
   */
  function getLiveVersion(id?: string) {
    try {
      const { accountId, containerId } = LastUsed;
      const version = TagManager?.Accounts?.Containers?.Versions?.live(
        `accounts/${accountId}/containers/${id || containerId}`
      );

      if (!version) return null;

      LastUsed.accountId = version.accountId;
      LastUsed.containerId = version.containerId;

      return version;
    } catch (error) {
      console.warn(`failed to get live container: ${error}`);
      return null;
    }
  }

  /**
   * @summary versions GTM workspace
   */
  function version(path: string, name: string, notes: string = "") {
    const version: GoogleAppsScript.TagManager.Schema.CreateContainerVersionRequestVersionOptions = {
      name,
      notes,
    };

    return TagManager?.Accounts?.Containers?.Workspaces?.create_version(
      version,
      path
    );
  }

  return {
    get containerPath() {
      return getContainerPath(LastUsed);
    },

    get versionPath() {
      const { versionId } = LastUsed;
      const { containerPath } = this;
      return `${containerPath}/versions/${versionId}`;
    },

    get workspacePath() {
      return getWorkspacePath(LastUsed);
    },

    getAccount,
    getAccountById,
    getAccountsList,
    getContainer,
    getContainerById,
    getConteinersListByAcc,
    getWorkspace,
    getWorkspaceById,
    getTag,
    getTagById,
    getVersion,
    getLiveVersion,
    getVersionById,
    version,
    listTags,
    listTriggers,
    listVariables,
    listWorkspaces,

    setIds(ids: TagManagerIds) {
      Object.assign(LastUsed, ids);
    },
  };
})();
