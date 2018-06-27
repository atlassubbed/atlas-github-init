const uuidv4 = require("uuid/v4")
const Shell = require("atlas-interactive-shell")
const parseArgs = require("minimist")

const randomId = () => uuidv4().replace(/-/g, "").slice(0,17)

const noAuth = err => err.code === 401

const run = (cmd, cwd, cb) => new Shell(cmd, {cwd}).onDone((err, code) => {
  if (err || code) return cb(err || new Error(code));
  cb(null, true)
})

const url = (username, repo, isLogin) => {
  return `https://${isLogin ? `${username}@` : ""}github.com/${username}/${repo}.git`
}

const getProps = () => ({
  username: {message: "Enter Github username"},
  password: {message: "Enter Github password", hidden: true}
})

const getInput = flags => {
  const { unsafe, debug, ext, _ } = parseArgs(flags);
  const cmd = _[0], args = _.slice(1);
  return { cmd, args, unsafe: !!unsafe, debug: !!debug, ext: !!ext }
}

module.exports = {
  randomId, 
  getInput,
  getProps,
  noAuth, 
  run,
  url
}
