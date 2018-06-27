const { describe, it } = require("mocha")
const { join } = require("path")
const rewire = require("rewire")
const { expect } = require("chai")
const helpers = rewire("../src/util")

let revert;

describe("helper methods", function(){

  beforeEach(function(){
    revert && revert();
  })

  describe("getInput", function(){
    it("should return current desired sub-command", function(){
      const cmd = "command"
      const input = helpers.getInput([cmd, "arg", "arg"])
      expect(input.cmd).to.equal(cmd)
    })
    it("should return any args passed to sub-command", function(){
      const cmd = "command", arg = "arg"
      const input = helpers.getInput([cmd, arg, arg])
      expect(input.args).to.deep.equal([arg, arg])
    })
    it("should return empty args if none passed", function(){
      expect(helpers.getInput(["command"]).args).to.deep.equal([])
      expect(helpers.getInput([]).args).to.deep.equal([])
    })
    it("should return whether or not unsafe flag is passed", function(){
      expect(helpers.getInput(["command", "--unsafe"]).unsafe).to.be.true
      expect(helpers.getInput(["command"]).unsafe).to.be.false
    })
    it("should return whether or not ext flag is passed", function(){
      expect(helpers.getInput(["command", "--ext"]).ext).to.be.true
      expect(helpers.getInput(["command"]).ext).to.be.false
    })
    it("should return whether or not debug flag is passed", function(){
      expect(helpers.getInput(["command", "--debug"]).debug).to.be.true
      expect(helpers.getInput(["command"]).debug).to.be.false
    })
    it("should not return any passed unused flags", function(){
      expect(helpers.getInput(["command", "--unused"]).unused).to.be.undefined
    })
  })

  describe("run", function(){
    it("should create a new shell with the specified command and cwd", function(done){
      const cmd = "cmd", cwd = "cwd"
      revert = helpers.__set__("Shell", class Shell {
        constructor(cmd, opts){
          expect(cmd).to.equal(cmd);
          expect(opts).to.deep.equal({cwd})
          done()
        }
      })
      helpers.run(cmd, cwd)
    })
    it("should return an instance of the shell", function(){
      const cmd = "cmd", cwd = "cwd"
      const Shell = class Shell {
        onDone(){ return this; }
      }
      revert = helpers.__set__({Shell})
      const shell = helpers.run(cmd, cwd);
      expect(shell).to.be.an.instanceOf(Shell)
    })
    it("should return an error if the shell if the command cannot be run", function(done){
      const msg = "could not run shell"
      revert = helpers.__set__("Shell", class Shell {
        log(){ return this; }
        onDone(cb){cb(new Error(msg))}
      })
      helpers.run("cmd", "cwd", err => {
        expect(err).to.be.an("error");
        expect(err.message).to.equal(msg);
        done()
      })
    })
    it("should return an error with offending code if command exits with error code", function(done){
      const code = 1
      revert = helpers.__set__("Shell", class Shell {
        log(){ return this; }
        onDone(cb){cb(null, code)}
      })
      helpers.run("cmd", "cwd", err => {
        expect(err).to.be.an("error");
        expect(err.message).to.equal(""+code);
        done()
      })
    })
    it("should return true if command completes with a zero exit code", function(done){
      revert = helpers.__set__("Shell", class Shell {
        log(){ return this; }
        onDone(cb){cb(null, 0)}
      })
      helpers.run("cmd", "cwd", (err, isSuccess) => {
        expect(err).to.be.null
        expect(isSuccess).to.be.true;
        done()
      })
    })
  })

  describe("url", function(){
    it("should return a http login github repo url if isLogin", function(){
      const githubUrl = helpers.url("user", "repo", true);
      expect(githubUrl).to.equal("https://user@github.com/user/repo.git")
    })
    it("should return a github repo url if not isLogin", function(){
      const githubUrl = helpers.url("user", "repo");
      expect(githubUrl).to.equal("https://github.com/user/repo.git")
    })
  })
})
