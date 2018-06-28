const Authorizer = require("atlas-recursive-auth")
const bind = require("atlas-bind-methods")
const { getProps } = require("./util")
const Git = require("./accessors/Git");
const Github = require("./accessors/Github")
const { name } = require("../package");

module.exports = (input, info, log) => {
  const repoUsage = "atlas repo <owner> <name> --ext? --unsafe? --debug?"
  const configStore = {}, args = input.args;
  const git = bind(new Git(info.gitRoot, info.name, info.branch, configStore));
  const github = bind(new Github(info.name, configStore)); 
  const { clearAuth, getAuth } = github;
  const authorizer = new Authorizer({props: getProps(), name, clearAuth, getAuth});
  github.setAuth(authorizer.getConfig())

  if (input.cmd === "logout") 
    return authorizer.revoke(log);
  if (input.cmd !== "repo") 
    return log(`${repoUsage}\natlas repo --unsafe? --debug?\natlas logout --debug?`);

  const auth = authorizer.createProvider(configStore, log);

  const secure = cb => {
    if (!input.unsafe && (!args.length || input.ext))
      auth(github.restrict)(args[1] || null, cb);
  }

  // clone existing repo
  if (args.length){
    const clone = () => auth(git.clone)(...args, secure);
    if ("name" in info) return log("already a repo");
    if (args.length !== 2) return log(repoUsage);
    return input.ext ? auth(github.fork)(...args, clone) : clone()
  }

  // copy local repo to github
  const authNew = authorizer.createProvider(configStore, () => {
    auth(github.delete)()
  });
  if (!("name" in info)) return log("not in a repo")
  if (!info.branch) return log("no commits");
  if (info.remotes && info.remotes.origin) 
    return log("already has origin");
  return auth(github.create)(() => {
    authNew(git.updatePackage)(() => {
      authNew(git.updateReadme)(() => {
        authNew(git.init)(secure)        
      })
    })
  })
}
