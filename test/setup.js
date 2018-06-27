const { exec } = require("child_process")
const { writeFile } = require("fs")
const { join, basename } = require("path")
const parallel = require("atlas-parallel")
const {
  cloneRepo,
  updateRepo,
  initRepo,
  checkout,
  makeFolder,
} = require("./helpers")

const mkdirp = (fullPath, cb) => exec(`mkdir -p ${fullPath}`, cb);

const makeNodeRepo = cb => {
  initRepo((err, stat) => {
    if (err) return cb(err);
    const pkg = {scripts: {test: 'echo "ran test script"'}}
    writeFile(join(stat.root, "package.json"), JSON.stringify(pkg), err => {
      if (err) return cb(err);
      updateRepo("master", "file1.js", stat.root, err => {
        cb(err, stat)
      })
    })
  })
}

const makeNodeRepoUnstaged = (branch, cb) => {
  makeNodeRepo((err,  stat) => {
    if (err) return cb(err);
    checkout(branch, stat.root, err => {
      if (err) return cb(err);
      exec("rm file1.js && touch file3.js", {cwd: stat.root}, err => {
        cb(err, stat)
      })
    })
  })
}

const makeFullRepo = (branch, cb) => {
  initRepo((err, stat) => {
    if (err) return cb(err);
    updateRepo("master", "file1.js", stat.root, err => {
      if (err || !branch) return cb(err, stat);
      updateRepo(branch, "file2.js", stat.root, err => {
        cb(err, stat)
      })
    })
  })
}

const makeFullAndEmpty = cb => {
  const result = {};
  parallel([
    done => makeFullRepo(null, (err, stat) => {
      done(err || void(result.full = stat))
    }),
    done => makeFolder((err, stat) => {
      done(err || void(result.empty = stat))
    })
  ], errs => cb(errs[0] || null, result))
}

const makeFullAndBare = (branch, cb) => {
  if (!cb) cb = branch, branch = null;
  const result = {};
  parallel([
    done => makeFullRepo(branch, (err, stat) => {
      done(err || void(result.full = stat))
    }),
    done => initRepo((err, stat) => {
      done(err || void(result.bare = stat))
    })
  ], errs => cb(errs[0] || null, result))
}

const makeClone = (branch, originName, cb) => {
  makeFullAndEmpty((err, { full: source, empty: clone }) => {
    if (err) return cb(err);
    cloneRepo(branch, originName, source, clone.root, err => {
      if (err) return cb(err);
      clone.root = join(clone.root, source.name)
      clone.name = source.name;
      return cb(null, { source, clone })
    })
  })
}

const makeCloneAhead = (branch, originName, cb) => {
  makeClone(branch, originName, (err, { source, clone }) => {
    if (err) return cb(err);
    updateRepo(branch, "file2.js", clone.root, err => {
      cb(err, { source, clone })
    })
  })
}

module.exports = { 
  makeNodeRepoUnstaged, 
  makeCloneAhead, 
  makeFullAndBare, 
  makeFullAndEmpty,
  makeNodeRepo,
  makeFullRepo,
  mkdirp
}
