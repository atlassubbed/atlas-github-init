const { exec } = require("child_process")
const { writeFile, readFile, access, constants: { F_OK, X_OK } } = require("fs")
const { join, basename } = require("path")
const tmp = require("tmp")
const { setIdentity } = require("atlas-git-identity")

// XXX currently node-tmp doesn't cleanup on CTRL+C, should be fixed soon
tmp.setGracefulCleanup()

const log = (cwd, cb) => exec("git log", {cwd}, cb)

const fetch = (remote, cwd, cb) => exec(`git fetch ${remote}`, {cwd}, cb)

const checkout = (branch, cwd, cb) => {
  exec(`git checkout ${branch} || git checkout -b ${branch}`, {cwd}, cb)
}

const readPackage = (cwd, cb) => {
  readFile(join(cwd, "package.json"), (err, data) => cb(err, JSON.parse(data)))
}

const push = (remote, branch, cwd, cb) => {
  exec(`git push ${remote} ${branch}`, {cwd}, cb)
}

const commit = (cwd, msg, cb) => {
  exec(`git commit -am "${msg}"`, {cwd}, cb)
}

const exists = (fullPath, cb) => access(fullPath, F_OK, cb)

const isExe = (fullPath, cb) => access(fullPath, X_OK, cb)

const diff = (branch1, branch2, cwd, cb) => {
  exec(`git diff ${branch1} ${branch2}`, {cwd}, (err, sout, serr) => {
    cb(err, sout.trim() || serr.trim())
  })
}

const makeFolder = cb => {
  tmp.dir({dir: __dirname, unsafeCleanup: true, keep: false}, (err, cwd) => {
    if (err) return cb(err);
    cb(null, {root: cwd, name: basename(cwd)})
  })
}

const initRepo = cb => {
  makeFolder((err, stat) => {
    if (err) return cb(err);
    exec("git init && git config receive.denyCurrentBranch updateInstead", {cwd: stat.root}, err => {
      if (err) return cb(err);
      const id = {name: "atlassubbed", email: "atlassubbed@gmail.com"};
      setIdentity(id, stat.root, err => {
        cb(err, stat)
      })
    })
  })
}

const updateRepo = (branch, file, cwd, cb) => {
  checkout(branch, cwd, err => {
    if (err) return cb(err);
    exec(`touch ${file} && git add . && git commit -am "commit ${file}"`, {cwd}, cb)
  })
}

const cloneRepo = (branch, originName, source, cwd, cb) => {
  exec(`git clone ${source.root} --origin ${originName}`, {cwd}, err => {
    if (err) return cb(err);
    const id = {name: "atlas", email: "altas@atlassubbed.com"}
    const cloneRoot = join(cwd, source.name);
    setIdentity(id, cloneRoot, err => {
      if (err) return cb(err);
      checkout(branch, cloneRoot, cb)
    })
  })
}

module.exports = {
  cloneRepo,
  updateRepo,
  initRepo,
  exists,
  isExe,
  makeFolder,
  readPackage,
  checkout, 
  diff,
  push,
  commit,
  fetch, 
  log 
}
