const { describe, it } = require("mocha")
const rewire = require("rewire")
const { expect } = require("chai")
const Github = rewire("../src/accessors/Github");
const { description } = require("../package");

let revert;

// DORY: Do Repeat Yourself

describe("Github accessor", function(){

  // using done() to end code paths is slow on failures
  this.timeout(100)

  beforeEach(function(){
    revert && revert();
  })

  describe("instantiation", function(){
    it("should set the repo name on the instance", function(){
      revert = Github.__set__("GithubClient", () => {})
      const repo = "repo"
      const github = new Github(repo, {});
      expect(github.name).to.equal(repo)
    })
    it("should set the config store on the instance", function(){
      revert = Github.__set__("GithubClient", () => {})
      const store = {}
      const github = new Github("repo", store);
      expect(github.store).to.equal(store)
    })
    it("should set a github client on the instance", function(){
      const githubClient = () => {}
      revert = Github.__set__("GithubClient", () => githubClient)
      const github = new Github("repo", {});
      expect(github.cli).to.equal(githubClient)
    })
  })
  describe("setAuth", function(){
    it("should update the cached config store", function(){
      const newConfig = {token: "is new token"}
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {}
      }))
      const github = new Github("repo", {})
      github.setAuth(newConfig);
      expect(github.store.config).to.deep.equal(newConfig)
    })
    it("should authenticate github client with token", function(done){
      const token = "my token"
      revert = Github.__set__("GithubClient", () => ({
        authenticate: opts => {
          expect(opts).to.deep.equal({type: "token", token})
          done()
        }
      }))
      const github = new Github("repo", {})
      github.setAuth({token});
    })
    it("should not authenticate github client with token if there isn't one", function(){
      const notAToken = "my widget"
      let didAuth = false;
      revert = Github.__set__("GithubClient", () => ({
        authenticate: opts => {
          didAuth = true;
        }
      }))
      const github = new Github("repo", {})
      github.setAuth({notAToken});
      expect(didAuth).to.be.false;
    })
  })
  describe("clearAuth", function(){
    it("should return unauthorized if no username provided", function(done){
      const password = "22/7"
      revert = Github.__set__("GithubClient", () => {})
      const github = new Github("repo", {})
      github.clearAuth({password}, {id: "tokenId"}, (err, fields) => {
        expect(err).to.be.null;
        expect(fields).to.be.undefined;
        done();
      })
    })
    it("should return unauthorized if no password provided", function(done){
      const username = "atlassubbed"
      revert = Github.__set__("GithubClient", () => {})
      const github = new Github("repo", {})
      github.clearAuth({username}, {id: "tokenId"}, (err, fields) => {
        expect(err).to.be.null;
        expect(fields).to.be.undefined;
        done();
      })
    })
    it("should return error if no token in config", function(done){
      const username = "atlassubbed", password = "22/7"
      revert = Github.__set__("GithubClient", () => {})
      const github = new Github("repo", {})
      github.clearAuth({username, password}, {}, (err, fields) => {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("no token present")
        expect(fields).to.be.undefined;
        done();
      })
    })
    it("should authenticate github client with credentials", function(done){
      const username = "atlassubbed", password = "22/7"
      revert = Github.__set__("GithubClient", () => ({
        authenticate: opts => {
          expect(opts).to.deep.equal({type: "basic", username, password});
          done()
        }
      }))
      const github = new Github("repo", {})
      github.clearAuth({username, password}, {id: "tokenId"}, () => {})
    })
    it("should attempt to delete stored token from github", function(done){
      const username = "atlassubbed", password = "22/7", id = "tokenId";
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          delete: opts => {
            expect(opts).to.deep.equal({id})
            done()
          }
        }
      }))
      const github = new Github("repo", {})
      github.clearAuth({username, password}, {id}, () => {})
    })
    it("should return unauthorized if github request not authorized", function(done){
      const username = "atlassubbed", password = "22/7", id = "tokenId";
      let didDelete = 0;
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          delete: (opts, cb) => {
            didDelete++
            const authErr = new Error();
            authErr.code = 401;
            cb(authErr)
          }
        }
      }))
      const github = new Github("repo", {})
      github.clearAuth({username, password}, {id}, (err, fields) => {
        expect(err).to.be.null;
        expect(fields).to.be.undefined;
        expect(didDelete).to.equal(1);
        done();
      })
    })
    it("should return error for generic github request error", function(done){
      const username = "atlassubbed", password = "22/7", id = "tokenId";
      const msg = "api is down"
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          delete: (opts, cb) => cb(new Error(msg))
        }
      }))
      const github = new Github("repo", {})
      github.clearAuth({username, password}, {id}, (err, fields) => {
        expect(err).to.be.an("error");
        expect(err.message).to.equal(msg);
        expect(fields).to.be.undefined;
        done();
      })
    })
    it("should otherwise return list of config fields to be deleted", function(done){
      const username = "atlassubbed", password = "22/7", id = "tokenId";
      const msg = "api is down"
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          delete: (opts, cb) => cb(null, {some: "response"})
        }
      }))
      const github = new Github("repo", {})
      github.clearAuth({username, password}, {id}, (err, fields) => {
        expect(err).to.be.null;
        expect(fields).to.deep.equal(["username", "id", "token"])
        done();
      })
    })
  })
  describe("getAuth", function(){
    it("should return unauthorized if no username provided", function(done){
      const password = "22/7"
      revert = Github.__set__("GithubClient", () => {})
      const github = new Github("repo", {})
      github.getAuth({password}, {}, (err, config) => {
        expect(err).to.be.null;
        expect(config).to.be.undefined;
        done();
      })
    })
    it("should return unauthorized if no password provided", function(done){
      const username = "atlassubbed"
      revert = Github.__set__("GithubClient", () => {})
      const github = new Github("repo", {})
      github.getAuth({username}, {}, (err, config) => {
        expect(err).to.be.null;
        expect(config).to.be.undefined;
        done();
      })
    })
    it("should authenticate github client with credentials", function(done){
      const username = "atlassubbed", password = "22/7"
      revert = Github.__set__("GithubClient", () => ({
        authenticate: opts => {
          expect(opts).to.deep.equal({type: "basic", username, password});
          done()
        }
      }))
      const github = new Github("repo", {})
      github.getAuth({username, password}, {}, () => {})
    })
    it("should attempt to create new personal access token on github", function(done){
      const username = "atlassubbed", password = "22/7";
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          create: opts => {
            const { note, scopes } = opts;
            expect(scopes).to.deep.equal(["user", "repo", "delete_repo"])
            expect(note.indexOf(description)).to.equal(0);
            const randomPart = note.slice(description.length+1);
            expect(randomPart.length).to.equal(19);
            expect(randomPart[0]).to.equal("(")
            expect(randomPart[randomPart.length-1]).to.equal(")")
            done()
          }
        }
      }))
      const github = new Github("repo", {})
      github.getAuth({username, password}, {}, () => {})
    })
    it("should return unauthorized if github request not authorized", function(done){
      const username = "atlassubbed", password = "22/7"
      let didCreate = 0;
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          create: (opts, cb) => {
            didCreate++
            const authErr = new Error();
            authErr.code = 401;
            cb(authErr)
          }
        }
      }))
      const github = new Github("repo", {})
      github.getAuth({username, password}, {}, (err, config) => {
        expect(err).to.be.null;
        expect(config).to.be.undefined;
        expect(didCreate).to.equal(1);
        done();
      })
    })
    it("should return unauthorized if response is missing token id", function(done){
      const username = "atlassubbed", password = "22/7"
      let didCreate = 0;
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          create: (opts, cb) => {
            didCreate++
            cb(null, {data: {token: "ffff"}})
          }
        }
      }))
      const github = new Github("repo", {})
      github.getAuth({username, password}, {}, (err, config) => {
        expect(err).to.be.null;
        expect(config).to.be.undefined;
        expect(didCreate).to.equal(1);
        done();
      })
    })
    it("should return unauthorized if response is missing token", function(done){
      const username = "atlassubbed", password = "22/7"
      let didCreate = 0;
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          create: (opts, cb) => {
            didCreate++
            cb(null, {data: {id: "123"}})
          }
        }
      }))
      const github = new Github("repo", {})
      github.getAuth({username, password}, {}, (err, config) => {
        expect(err).to.be.null;
        expect(config).to.be.undefined;
        expect(didCreate).to.equal(1);
        done();
      })
    })
    it("should return error for generic github request error", function(done){
      const username = "atlassubbed", password = "22/7"
      const msg = "api is down"
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          create: (opts, cb) => cb(new Error(msg))
        }
      }))
      const github = new Github("repo", {})
      github.getAuth({username, password}, {}, (err, config) => {
        expect(err).to.be.an("error");
        expect(err.message).to.equal(msg);
        expect(config).to.be.undefined;
        done();
      })
    })
    it("should authenticate github client with token if successful", function(done){
      const username = "atlassubbed", password = "22/7"
      const token = "ffff"
      let didAuth = 0;
      revert = Github.__set__("GithubClient", () => ({
        authenticate: opts => {
          if (++didAuth === 2){
            expect(opts).to.deep.equal({type: "token", token})
            done()
          }
        },
        authorization: {
          create: (opts, cb) => cb(null, {data: {token, id: "123"}})
        }
      }))
      const github = new Github("repo", {})
      github.getAuth({username, password}, {}, () => {})
    })
    it("should return new config to be stored if successful", function(done){
      const username = "atlassubbed", password = "22/7";
      const token = "ffff", id = "123";
      revert = Github.__set__("GithubClient", () => ({
        authenticate: () => {},
        authorization: {
          create: (opts, cb) => cb(null, {data: {token, id}})
        }
      }))
      const github = new Github("repo", {})
      github.getAuth({username, password}, {}, (err, config) => {
        expect(err).to.be.null
        expect(config).to.deep.equal({token, id, username})
        done();
      })
    })
  })
  describe("create", function(){
    it("should attempt to create current repo as new repo on github", function(done){
      const repo = "repo";
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          create: opts => {
            expect(opts).to.deep.equal({name: repo})
            done()
          }
        }
      }))
      new Github(repo, {}).create(() => {})
    })
    it("should return error for generic github request error", function(done){
      const repo = "repo", msg = "api is down"
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          create: (opts, cb) => cb(new Error(msg))
        }
      }))
      new Github(repo, {}).create((err, res) => {
        expect(err).to.be.an("error")
        expect(err.message).to.equal(msg)
        expect(res).to.be.undefined
        done()
      })
    })
    it("should return unauthorized if github request not authorized", function(done){
      const repo = "repo"
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          create: (opts, cb) => {
            const authErr = new Error();
            authErr.code = 401;
            cb(authErr)
          }
        }
      }))
      new Github(repo, {}).create((err,res) => {
        expect(err).to.be.null
        expect(res).to.be.undefined;
        done()
      })
    })
    it("should otherwise return true", function(done){
      const repo = "repo"
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          create: (opts, cb) => cb(null, {some: "response"})
        }
      }))
      new Github(repo, {}).create((err,res) => {
        expect(err).to.be.null
        expect(res).to.be.true;
        done()
      })
    })
  })
  describe("fork", function(){
    it("should attempt to fork given repo on github", function(done){
      const repo = "ext-repo", owner = "ext-owner"
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          fork: opts => {
            expect(opts).to.deep.equal({owner, repo})
            done()
          }
        }
      }))
      new Github("my-repo", {}).fork(owner, repo, () => {})
    })
    it("should return error for generic github request error", function(done){
      const repo = "ext-repo", owner = "ext-owner", msg = "api is down"
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          fork: (opts, cb) => cb(new Error(msg))
        }
      }))
      new Github(repo, {}).fork(owner, repo, (err, res) => {
        expect(err).to.be.an("error")
        expect(err.message).to.equal(msg)
        expect(res).to.be.undefined
        done()
      })
    })
    it("should return unauthorized if github request not authorized", function(done){
      const repo = "ext-repo", owner = "ext-owner"
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          fork: (opts, cb) => {
            const authErr = new Error();
            authErr.code = 401;
            cb(authErr)
          }
        }
      }))
      new Github(repo, {}).fork(owner, repo, (err,res) => {
        expect(err).to.be.null
        expect(res).to.be.undefined;
        done()
      })
    })
    it("should otherwise return true", function(done){
      const repo = "ext-repo", owner = "ext-owner"
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          fork: (opts, cb) => cb(null, {some: "response"})
        }
      }))
      new Github(repo, {}).fork(owner, repo, (err,res) => {
        expect(err).to.be.null
        expect(res).to.be.true;
        done()
      })
    })
  })
  describe("restrict", function(){
    it("should attempt to restrict master branch on github for current repo", function(done){
      const repo = "repo", store = {config: {username: "atlassubbed"}} 
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          updateBranchProtection: opts => {
            expect(opts).to.deep.equal({
              branch: "master",
              owner: store.config.username,
              repo,
              required_status_checks: {
                strict: true,
                contexts: []
              },
              restrictions: null,
              enforce_admins: true,
              required_pull_request_reviews: null
            })
            done()
          }
        }
      }))
      new Github(repo, store).restrict(null, () => {})
    })
    it("should attempt to restrict master branch on github for given repo", function(done){
      const repo = "ext-repo", store = {config: {username: "atlassubbed"}}; 
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          updateBranchProtection: opts => {
            expect(opts).to.deep.equal({
              branch: "master",
              owner: store.config.username,
              repo,
              required_status_checks: {
                strict: true,
                contexts: []
              },
              restrictions: null,
              enforce_admins: true,
              required_pull_request_reviews: null
            })
            done()
          }
        }
      }))
      new Github(null, store).restrict(repo, () => {})
    })
    it("should return error for generic github request error", function(done){
      const store = {config: {username: "atlassubbed"}}, msg = "api is down"
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          updateBranchProtection: (opts, cb) => cb(new Error(msg))
        }
      }))
      new Github("repo", store).restrict(null, (err, res) => {
        expect(err).to.be.an("error");
        expect(err.message).to.equal(msg);
        expect(res).to.be.undefined;
        done()
      })
    })
    it("should return unauthorized if github request not authorized", function(done){
      const store = {config: {username: "atlassubbed"}}
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          updateBranchProtection: (opts, cb) => {
            const authErr = new Error();
            authErr.code = 401;
            cb(authErr)
          }
        }
      }))
      new Github("repo", store).restrict(null, (err, res) => {
        expect(err).to.be.null
        expect(res).to.be.undefined;
        done()
      })
    })
    it("should otherwise return true", function(done){
      const store = {config: {username: "atlassubbed"}}
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          updateBranchProtection: (opts, cb) => cb(null, {some: "response"})
        }
      }))
      new Github("repo", store).restrict(null, (err, res) => {
        expect(err).to.be.null
        expect(res).to.be.true;
        done()
      })
    })
  })
  describe("delete", function(){
    it("should return unauthorized if there is no username in config", function(done){
      const store = {config: {}};
      revert = Github.__set__("GithubClient", () => {});
      new Github("repo", store).delete((err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.undefined;
        done();
      })
    })
    it("should attempt to delete current repo on github", function(done){
      const owner = "atlassubbed", repo = "my-repo";
      const store = {config: {username: owner}};
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          delete: opts => {
            expect(opts).to.deep.equal({owner, repo})
            done()
          }
        }
      }))
      new Github(repo, store).delete(() => {})
    })
    it("should return error for generic github request error", function(done){
      const msg = "api is down"
      const store = {config: {username: "atlassubbed"}};
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          delete: (opts, cb) => cb(new Error(msg))
        }
      }))
      new Github("repo", store).delete((err, res) => {
        expect(err).to.be.an("error");
        expect(err.message).to.equal(msg);
        expect(res).to.be.undefined;
        done();
      })
    })
    it("should return unauthorized if github request not authorized", function(done){
      let didDelete = 0;
      const store = {config: {username: "atlassubbed"}};
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          delete: (opts, cb) => {
            didDelete++
            const authErr = new Error();
            authErr.code = 401;
            cb(authErr)
          }
        }
      }))
      new Github("repo", store).delete((err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.undefined;
        expect(didDelete).to.equal(1)
        done();
      })
    })
    it("should otherwise return true", function(done){
      const store = {config: {username: "atlassubbed"}};
      revert = Github.__set__("GithubClient", () => ({
        repos: {
          delete: (opts, cb) => cb(null, {some: "response"})
        }
      }))
      new Github("repo", store).delete((err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.true;
        done();
      })
    })
  })
})
