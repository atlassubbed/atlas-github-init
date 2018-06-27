const { exec } = require("child_process")
const { readFile, writeFile } = require("fs");
const { join } = require("path");
const { url, run } = require("../util")

// only init/clone/updatePackage require auth

module.exports = class Git {
  constructor(gitRoot, name, branch, configStore){
    this.gitRoot = gitRoot;
    this.name = name;
    this.branch = branch;
    this.store = configStore;
  }
  init(cb){
    const { branch, name, gitRoot, store: { config } } = this;
    const username = config && config.username;
    if (!username) return cb(null);
    run(`
      git remote add origin "${url(username, name, true)}" &&
      git checkout master -q &&
      git push origin master --progress || git remote remove origin
      git checkout ${branch} -q
    `, gitRoot, cb).log()
  }
  clone(owner, repo, cb){
    const { store: { config } } = this;
    const username = config && config.username;
    if (!username) return cb(null)
    run(`
      mkdir -p ${owner} && cd ${owner}
      git clone "${url(username, repo)}" --progress &&
      cd ${repo} &&
      git remote add upstream "${url(owner, repo)}"
    `, this.gitRoot, cb).log()
  }
  updatePackage(cb){
    const { gitRoot, name, store: { config } } = this;
    const username = config && config.username;
    if (!username) return cb(null);
    const pkgLoc = join(gitRoot, "package.json")
    readFile(pkgLoc, (err, data) => {
      if (err) return cb(err);
      const pkg = JSON.parse(data.toString());
      const webUrl = url(username, name).slice(0,-4)
      pkg.homepage = `${webUrl}#readme`
      pkg.bugs = `${webUrl}/issues`
      pkg.repository = {
        type: "git",
        url: url(username, name)
      }
      writeFile(pkgLoc, `${JSON.stringify(pkg, null, 2)}\n`, err => {
        if (err) return cb(err);
        const add = "git add -A"
        const commit = 'git commit -am "updates repository information in package.json"'
        exec(`${add} && ${commit}`, {cwd: gitRoot}, err => {
          if (err) return cb(err);
          cb(null, true)
        })
      })
    })
  }
}
