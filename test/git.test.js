const { describe, it } = require("mocha")
const { join } = require("path")
const rewire = require("rewire")
const { expect } = require("chai")
const getRepoInfo = require("atlas-repo-info")
const Git = rewire("../src/accessors/Git")
const { run } = require("../src/util")
const { readPackage, diff, log, fetch, exists, isExe, push, commit } = require("./helpers")
const { 
  makeNodeRepoUnstaged, 
  makeCloneAhead,
  makeFullAndBare, 
  makeFullAndEmpty,
  makeNodeRepo,
  makeFullRepo,
  mkdirp } = require("./setup")

const runMockLog = (...a) => run(...a) && {log: () => {}}

let revert;

describe("Git accessor", function(){

  this.timeout(1500)

  beforeEach(function(){
    revert && revert();
  })

  describe("instantiation", function(){
    it("should set the git root on the instance", function(){
      const gitRoot = "gitRoot"
      const git = new Git(gitRoot, "repo", "branch", {});
      expect(git.gitRoot).to.equal(gitRoot)
    })
    it("should set the repo name on the instance", function(){
      const repo = "repo"
      const git = new Git("gitRoot", repo, "branch", {});
      expect(git.name).to.equal(repo)
    })
    it("should set the repo branch on the instance", function(){
      const branch = "branch"
      const git = new Git("gitRoot", "repo", branch, {});
      expect(git.branch).to.equal(branch)
    })
    it("should set the config store on the instance", function(){
      const store = {}
      const git = new Git("gitRoot", "repo", "branch", store);
      expect(git.store).to.equal(store)
    })
  })
  describe("init", function(){
    it("should return unauthorized if there is no config", function(done){
      const git = new Git("root", "repo", "branch", {})
      git.init((err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.undefined;
        done();
      })
    })
    it("should return unauthorized if there is no username in config", function(done){
      const git = new Git("root", "repo", "branch", {config: {}})
      git.init((err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.undefined;
        done();
      })
    })
    describe("from master branch", function(){
      it("should attempt to log output", function(done){
        const store = { config: { username: "atlassubbed" } }
        revert = Git.__set__("run", () => ({log: () => done()}))
        const git = new Git("root", "repo", "master", store)
        git.init(() => {})
      })
      it("should add an origin pointing to the destination repo", function(done){
        const username = "atlassubbed";
        makeFullAndBare((err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({
            url: (inUsername, inRepo, isLogin) => {
              expect(inUsername).to.equal(username)
              expect(inRepo).to.equal(full.name);
              expect(isLogin).to.be.true;
              return bare.root
            }, 
            run: runMockLog
          })
          const git = new Git(full.root, full.name, "master", { config: { username }})
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            getRepoInfo(full.root, (err, info) => {
              if (err) return done(err);
              expect(info.remotes).to.not.be.null;
              expect(info.remotes.origin).to.equal(bare.root);
              done()
            })
          })
        })
      })
      it("should push the current repo's master to the origin's master", function(done){
        const store = { config: { username: "atlassubbed" } }
        makeFullAndBare((err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({url: () => bare.root, run: runMockLog})
          const git = new Git(full.root, full.name, "master", store)
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            fetch("origin", full.root, err => {
              if (err) return done(err);
              diff("master", "origin/master", full.root, (err, delta) => {
                expect(delta).to.equal("")
                done();
              })
            })
          })
        })
      })
      it("should remain on master after the push succeeds", function(done){
        const store = { config: { username: "atlassubbed" } }
        makeFullAndBare((err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({url: () => bare.root, run: runMockLog})
          const git = new Git(full.root, full.name, "master", store)
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            getRepoInfo(full.root, (err, info) => {
              if (err) return done(err);
              expect(info.branch).to.equal("master")
              done()
            })
          })
        })
      })
      it("should remain on master if the push fails", function(done){
        const store = { config: { username: "atlassubbed" } }
        makeFullAndBare((err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({url: () => "fake repo", run: runMockLog})
          const git = new Git(full.root, full.name, "master", store)
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            getRepoInfo(full.root, (err, info) => {
              if (err) return done(err);
              expect(info.branch).to.equal("master")
              done()
            })
          })
        })
      })
      it("should remove the origin if the push fails", function(done){
        const store = { config: { username: "atlassubbed" } }
        makeFullAndBare((err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({url: () => "fake repo", run: runMockLog})
          const git = new Git(full.root, full.name, "master", store)
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            getRepoInfo(full.root, (err, info) => {
              if (err) return done(err);
              expect(info.remotes).to.be.null;
              done()
            })
          })
        })
      })
    })
    describe("from a feature branch", function(){
      it("should attempt to log output", function(done){
        const store =  { config: { username: "atlassubbed" } }
        revert = Git.__set__("run", () => ({log: () => done()}))
        const git = new Git("root", "repo", "feature", store)
        git.init(() => {})
      })
      it("should add an origin pointing to the destination repo", function(done){
        const branch = "feature", username = "atlassubbed"
        makeFullAndBare(branch, (err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({
            url: (inUsername, inRepo, isLogin) => {
              expect(inUsername).to.equal(username);
              expect(inRepo).to.equal(full.name)
              expect(isLogin).to.be.true
              return bare.root
            },
            run: runMockLog
          })
          const git = new Git(full.root, full.name, branch, { config: { username }})
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            getRepoInfo(full.root, (err, info) => {
              if (err) return done(err);
              expect(info.remotes).to.not.be.null;
              expect(info.remotes.origin).to.equal(bare.root);
              done()
            })
          })
        })
      })
      it("should push the current repo's master to the origin's master", function(done){
        const store = { config: { username: "atlassubbed" } }
        const branch = "feature"
        makeFullAndBare(branch, (err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({url: () => bare.root, run: runMockLog})
          const git = new Git(full.root, full.name, branch, store)
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            fetch("origin", full.root, err => {
              if (err) return done(err);
              diff("master", "origin/master", full.root, (err, delta) => {
                expect(delta).to.equal("")
                done();
              })
            })
          })
        })
      })
      it("should switch back to the feature branch after the push succeeds", function(done){
        const store = { config: { username: "atlassubbed" } }
        const branch = "feature"
        makeFullAndBare(branch, (err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({url: () => bare.root, run: runMockLog})
          const git = new Git(full.root, full.name, branch, store)
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            getRepoInfo(full.root, (err, info) => {
              if (err) return done(err);
              expect(info.branch).to.equal(branch)
              done()
            })
          })
        })
      })
      it("should switch back to the feature branch if the push fails", function(done){
        const store = { config: { username: "atlassubbed" } }
        const branch = "feature"
        makeFullAndBare(branch, (err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({url: () => "fake repo", run: runMockLog})
          const git = new Git(full.root, full.name, branch, store)
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            getRepoInfo(full.root, (err, info) => {
              if (err) return done(err);
              expect(info.branch).to.equal(branch)
              done()
            })
          })
        })
      })
      it("should remove the origin if the push fails", function(done){
        const store = { config: { username: "atlassubbed" } }
        const branch = "feature"
        makeFullAndBare(branch, (err, { full, bare }) => {
          if (err) return done(err);
          revert = Git.__set__({url: () => "fake repo", run: runMockLog})
          const git = new Git(full.root, full.name, branch, store)
          git.init((err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            getRepoInfo(full.root, (err, info) => {
              if (err) return done(err);
              expect(info.remotes).to.be.null
              done()
            })
          })
        })
      })
    })
  })
  describe("clone", function(){
    it("should return unauthorized if there is no config", function(done){
      const git = new Git("root", "repo", "branch", {})
      git.clone("owner", "ext-repo", (err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.undefined;
        done();
      })
    })
    it("should return unauthorized if there is no username in config", function(done){
      const git = new Git("root", "repo", "branch", {config: {}})
      git.clone("owner", "ext-repo", (err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.undefined;
        done();
      })
    })
    it("should attempt to log output", function(done){
      const store = { config: { username: "atlassubbed" } }
      revert = Git.__set__("run", () => ({log: () => done()}))
      const git = new Git("root", "repo", "master", store)
      git.clone("owner", "ext-repo", () => {})
    })
    it("should clone the user's forked repo under a dir named after owner", function(done){
      const username = "atlassubbed", owner = "another-person"
      let calledUrl = 0;
      makeFullAndEmpty((err, { full, empty }) => {
        if (err) return done(err);
        revert = Git.__set__({
          url: (inUsername, inRepo, isLogin) => {
            if (++calledUrl === 1){
              expect(inUsername).to.equal(username);
              expect(inRepo).to.equal(full.name);
              expect(isLogin).to.be.undefined;
            };
            return full.root;
          }, 
          run: runMockLog
        })
        const git = new Git(empty.root, null, null, { config: { username } })
        git.clone(owner, full.name, (err, res) => {
          expect(err).to.be.null;
          expect(res).to.be.true;
          const clonedRoot = join(empty.root, owner, full.name);
          getRepoInfo(clonedRoot, (err, info) => {
            if (err) return done(err);
            expect(info.name).to.equal(full.name)
            expect(calledUrl).to.equal(2)
            diff("master", "origin/master", clonedRoot, (err, delta) => {
              if (err) return done(err);
              expect(delta).to.equal("");
              done()
            })
          })
        })
      })
    })
    it("should add an upstream remote pointing to the owner's repo", function(done){
      const username = "atlassubbed", owner = "another-person", upstreamUrl = "owner-url"
      let calledUrl = 0;
      makeFullAndEmpty((err, { full, empty }) => {
        if (err) return done(err);
        revert = Git.__set__({
          url: (inUsername, inRepo, isLogin) => {
            if (++calledUrl === 2){
              expect(inUsername).to.equal(owner);
              expect(inRepo).to.equal(full.name);
              expect(isLogin).to.be.undefined;
              return upstreamUrl
            };
            return full.root;
          }, 
          run: runMockLog
        })
        const git = new Git(empty.root, null, null, { config: { username } })
        git.clone(owner, full.name, (err, res) => {
          expect(err).to.be.null;
          expect(res).to.be.true;
          const clonedRoot = join(empty.root, owner, full.name);
          getRepoInfo(clonedRoot, (err, info) => {
            if (err) return done(err);
            expect(info.remotes).to.not.be.null
            expect(info.remotes.upstream).to.equal(upstreamUrl)
            expect(calledUrl).to.equal(2)
            done()
          })
        })
      })
    })
    it("should not fail if the parent dir already existed", function(done){
      const store = { config: { username: "atlassubbed" } }, owner = "another-person"
      makeFullAndEmpty((err, { full, empty }) => {
        if (err) return done(err);
        mkdirp(join(empty.root, owner), err => {
          if (err) return done(err);
          revert = Git.__set__({
            url: (inUsername, inRepo, isLogin) => full.root, 
            run: runMockLog
          })
          const git = new Git(empty.root, null, null, store)
          git.clone(owner, full.name, (err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            done();
          })
        })
      })
    })
    it("should not fail if the repo dir already exists under the parent dir", function(done){
      const store = { config: { username: "atlassubbed" } }, owner = "another-person"
      makeFullAndEmpty((err, { full, empty }) => {
        if (err) return done(err);
        mkdirp(join(empty.root, owner, full.name), err => {
          if (err) return done(err);
          revert = Git.__set__({
            url: (inUsername, inRepo, isLogin) => full.root, 
            run: runMockLog
          })
          const git = new Git(empty.root, null, null, store)
          git.clone(owner, full.name, (err, res) => {
            expect(err).to.be.null;
            expect(res).to.be.true;
            done();
          })
        })
      })
    })
    it("should fail if a non-empty repo dir already exists under the parent dir", function(done){
      const store = { config: { username: "atlassubbed" } }, owner = "another-person"
      makeFullAndEmpty((err, { full, empty }) => {
        if (err) return done(err);
        mkdirp(join(empty.root, owner, full.name, "folder"), err => {
          revert = Git.__set__({
            url: (inUsername, inRepo, isLogin) => full.root, 
            run: runMockLog
          })
          const git = new Git(empty.root, null, null, store)
          git.clone(owner, full.name, (err, res) => {
            expect(err).to.be.an("error");
            expect(res).to.be.undefined;
            done();
          })
        })
      })
    })
  })
  describe("updatePackage", function(){
    it("should return unauthorized if there is no config", function(done){
      const git = new Git("root", "repo", "branch", {})
      git.updatePackage((err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.undefined;
        done();
      })
    })
    it("should return unauthorized if there is no username in config", function(done){
      const git = new Git("root", "repo", "branch", {config: {}})
      git.updatePackage((err, res) => {
        expect(err).to.be.null;
        expect(res).to.be.undefined;
        done();
      })
    })
    it("should add correct bugs url to package.json", function(done){
      const username = "atlassubbed", store = { config: { username } }
      makeNodeRepo((err, { name, root: cwd }) => {
        const git = new Git(cwd, name, "master", store)
        git.updatePackage((err, res) => {
          expect(err).to.be.null;
          expect(res).to.be.true;
          readPackage(cwd, (err, pkg) => {
            if (err) return done(err);
            expect(pkg.bugs).to.equal(`https://github.com/${username}/${name}/issues`)
            done()
          })
        })
      })
    })
    it("should add correct homepage url to package.json", function(done){
      const username = "atlassubbed", store = { config: { username } }
      makeNodeRepo((err, { name, root: cwd }) => {
        const git = new Git(cwd, name, "master", store)
        git.updatePackage((err, res) => {
          expect(err).to.be.null;
          expect(res).to.be.true;
          readPackage(cwd, (err, pkg) => {
            if (err) return done(err);
            expect(pkg.homepage).to.equal(`https://github.com/${username}/${name}#readme`)
            done()
          })
        })
      })
    })
    it("should add correct repository information to package.json", function(done){
      const username = "atlassubbed", store = { config: { username } }
      makeNodeRepo((err, { name, root: cwd }) => {
        const git = new Git(cwd, name, "master", store)
        git.updatePackage((err, res) => {
          expect(err).to.be.null;
          expect(res).to.be.true;
          readPackage(cwd, (err, pkg) => {
            if (err) return done(err);
            expect(pkg.repository).to.deep.equal({
              type: "git",
              url: `https://github.com/${username}/${name}.git`
            })
            done()
          })
        })
      })
    })
    it("should commit the changes made to package.json", function(done){
      const username = "atlassubbed", store = { config: { username } }
      makeNodeRepo((err, { name, root: cwd }) => {
        const git = new Git(cwd, name, "master", store)
        git.updatePackage((err, res) => {
          expect(err).to.be.null;
          expect(res).to.be.true;
          log(cwd, (err, logs) => {
            if (err) return done(err);
            expect(logs).to.contain("updates repository information in package.json")
            done()
          })
        })
      })
    })
  })    
})
