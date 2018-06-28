const { noAuth, randomId } = require("../util")
const GithubClient = require("@octokit/rest")
const { description } = require("../../package");

module.exports = class Github {
  constructor(name, configStore){
    this.name = name;
    this.store = configStore
    this.cli = GithubClient()
  }
  setAuth(config){
    this.store.config = config;
    const { token } = config;
    if (token) this.cli.authenticate({type: "token", token});
  }
  clearAuth({ username, password }, { id }, cb){
    if (!username || !password) return cb(null);
    if (!id) return cb(new Error("no token present"));
    this.cli.authenticate({type: "basic", username, password});
    this.cli.authorization.delete({id}, (err, res) => {
      if (err) return cb(noAuth(err) ? null : err);
      cb(null, ["username", "id", "token"])
    })
  }
  getAuth({ username, password }, config, cb){
    if (!username || !password) return cb(null);
    this.cli.authenticate({type: "basic", username, password});
    this.cli.authorization.create({
      note: `${description} (${randomId()})`,
      scopes: ["user", "repo", "delete_repo"]
    }, (err,res) => {
      if (err) return cb(noAuth(err) ? null : err);
      const { id, token } = res.data;
      if (!id || !token) return cb(null);
      this.cli.authenticate({type: "token", token});
      cb(null, { username, id, token })
    })
  }
  create(cb){
    this.cli.repos.create({
      name: this.name,
      // allow_rebase_merge: false
    }, (err, res) => {
      if (err) return cb(noAuth(err) ? null : err);
      cb(null, true)
    })
  }
  fork(owner, repo, cb){
    this.cli.repos.fork({ 
      owner, repo
    }, (err, res) => {
      if (err) return cb(noAuth(err) ? null : err);
      cb(null, true)
    })
  }
  restrict(repoName, cb){
    const { store: { config } } = this;
    const username = config && config.username;
    if (!username) return cb(null);
    this.cli.repos.updateBranchProtection({
      branch: "master",
      owner: username,
      repo: repoName || this.name,
      required_status_checks: {
        strict: true,
        contexts: []
      },
      restrictions: null,
      enforce_admins: true,
      required_pull_request_reviews: null
    }, (err, res) => {
      if (err) return cb(noAuth(err) ? null : err);
      cb(null, true)
    })
  }
  delete(cb){
    const { store: { config } } = this;
    const username = config && config.username;
    if (!username) return cb(null);
    this.cli.repos.delete({
      owner: username,
      repo: this.name,
    }, (err, res) => {
      if (err) return cb(noAuth(err) ? null : err);
      cb(null, true)
    })
  }
}
