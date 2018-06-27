#!/usr/bin/env node
const getRepoInfo = require("atlas-repo-info")
const Logger = require("atlas-basic-logger")
const { getInput } = require("./util")
const command = require("./command");
const cwd = process.cwd()

getRepoInfo(cwd, (err, repoInfo={gitRoot: cwd}) => {
  const userInput = getInput(process.argv.slice(2));
  const log = Logger(userInput.debug);
  err ? log(err) : command(userInput, repoInfo, log)
})
