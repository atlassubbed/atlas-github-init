const { describe, it } = require("mocha")
const { expect } = require("chai")
const { join } = require("path")
const rewire = require("rewire")
const command = rewire("../src/command")
const pkg = require("../package")

let revert;

describe("command", function(){
  this.timeout(100)
  beforeEach(function(){
    revert && revert();
  })

  describe("initialization", function(){
    it("should properly instantiate Git accessor", function(done){
      let madeInst = false;
      const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
      const Git = class Git {
        constructor(cwd, name, branch, store){
          madeInst = true;
          expect(cwd).to.equal(repoInfo.gitRoot);
          expect(name).to.equal(repoInfo.name);
          expect(branch).to.equal(repoInfo.branch);
          expect(store).to.deep.equal({})
        }
      }
      revert = command.__set__({
        bind: inst => {
          expect(inst).to.be.an.instanceOf(Git);
          expect(madeInst).to.be.true;
          done();
        },
        Git
      })
      command({args: []}, repoInfo, () => {})
    })
    it("should properly instantiate Github accessor", function(done){
      let madeInst = false, configStore, calledBind = 0;
      const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
      const Github = class Github {
        constructor(name, store){
          madeInst = true;
          expect(name).to.equal(repoInfo.name);
          expect(store).to.equal(configStore)
        }
      }
      revert = command.__set__({
        bind: inst => {
          if (++calledBind === 1) return;
          expect(inst).to.be.an.instanceOf(Github);
          expect(madeInst).to.be.true;
          done();
        },
        Git: class Git {
          constructor(cwd, name, branch, store){
            configStore = store;
          }
        },
        Github
      })
      command({args: []}, repoInfo, () => {})
    })
    it("should properly instantiate an Authorizer", function(done){
      let calledBind = 0, github;
      const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
      revert = command.__set__({
        bind: inst => {
          if (++calledBind === 2) github = inst;
          return inst;
        },
        Git: class Git {},
        Github: class Github {
          clearAuth(){}
          getAuth(){}
          setAuth(){}
        },
        Authorizer: class Authorizer {
          constructor(opts){
            expect(opts.name).to.equal(pkg.name)
            expect(opts.props).to.deep.equal({
              username: {message: "Enter Github username"},
              password: {message: "Enter Github password", hidden: true}
            })
            expect(github).to.not.be.undefined;
            expect(opts.clearAuth).to.equal(github.clearAuth)
            expect(opts.getAuth).to.equal(github.getAuth);
            done();
          }
        }
      })
      command({args: []}, repoInfo, () => {})
    })
    it("should set the existing config", function(done){
      const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
      const existingConfig = {token: 123};
      revert = command.__set__({
        bind: inst => inst,
        Git: class Git {},
        Github: class Github {
          clearAuth(){}
          getAuth(){}
          setAuth(config){
            expect(config).to.deep.equal(existingConfig)
            done()
          }
        },
        Authorizer: class Authorizer {
          constructor(opts){
            this.getConfig = () => Object.assign({}, existingConfig)
          }
        }
      })
      command({args: []}, repoInfo, () => {})
    })
  })

  describe("atlas <invalid command>", function(){
    it("should log usage information", function(){
      let msg;
      const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
      const logger = inMsg => {msg = inMsg};
      revert = command.__set__({
        bind: inst => inst,
        Git: class Git {},
        Github: class Github {
          clearAuth(){}
          getAuth(){}
          setAuth(){}
        },
        Authorizer: class Authorizer {
          createProvider(){}
          getConfig(){}
        }
      })
      command({args: [], cmd: "not-a-command"}, repoInfo, logger)
      expect(msg).to.equal("atlas repo <owner> <name> --ext? --unsafe? --debug?\natlas repo --unsafe? --debug?\natlas logout --debug?")
    })
  })

  describe("atlas logout", function(){
    it("should call revoke on the authorizer with the logger callback", function(){
      let didCallRevoke = false;
      const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
      const logger = inMsg => {msg = inMsg};
      revert = command.__set__({
        bind: inst => inst,
        Git: class Git {},
        Github: class Github {
          clearAuth(){}
          getAuth(){}
          setAuth(){}
        },
        Authorizer: class Authorizer {
          createProvider(){}
          revoke(cb){
            didCallRevoke = true;
            expect(cb).to.equal(logger)
          }
          getConfig(){}
        }
      })
      command({args: [], cmd: "logout"}, repoInfo, logger)
      expect(didCallRevoke).to.be.true;
    })
  })

  describe("atlas repo", function(){
    it("should create an auth provider with the config store which logs errors on failure", function(done){
      let calledBind = 0, configStore;
      const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
      const logger = () => {};
      revert = command.__set__({
        bind: inst => inst,
        Git: class Git {
          constructor(cwd, name, branch, store){
            configStore = store;
          }
        },
        Github: class Github {
          clearAuth(){}
          getAuth(){}
          setAuth(){}
        },
        Authorizer: class Authorizer {
          createProvider(store, log){
            expect(log).to.equal(logger);
            expect(store).to.equal(configStore)
            done();
          }
          getConfig(){}
        }
      })
      command({args: [], cmd: "repo"}, repoInfo, logger)
    })
    describe("clones an existing repository on github", function(){
      describe("atlas repo <owner> <repo> --ext", function(){
        it("should fail if the current directory is already a repo", function(){
          let msg;
          const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
          const logger = (inMsg) => {msg = inMsg};
          revert = command.__set__({
            bind: inst => inst,
            Git: class Git {},
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
            },
            Authorizer: class Authorizer {
              createProvider(){}
              getConfig(){}
            }
          })
          command({args: ["owner", "repo"], cmd: "repo", ext: true}, repoInfo, logger)
          expect(msg).to.equal("already a repo");
        })
        it("should fail if a repo name is not provided", function(){
          let msg;
          const repoInfo = {gitRoot: "root"}
          const logger = (inMsg) => {msg = inMsg};
          revert = command.__set__({
            bind: inst => inst,
            Git: class Git {},
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
            },
            Authorizer: class Authorizer {
              getConfig(){}
              createProvider(){}
            }
          })
          command({args: ["owner"], cmd: "repo", ext: true}, repoInfo, logger)
          expect(msg).to.equal("atlas repo <owner> <name> --ext? --unsafe? --debug?");
        })
        it("should perform an authorized fork of the owner's repository", function(){
          let calledBind = 0, calledAuth = 0, didFork = false, github;
          const repoInfo = {gitRoot: "root"}
          const logger = () => {};
          revert = command.__set__({
            bind: inst => {
              if (++calledBind === 2) github = inst;
              return inst;
            },
            Git: class Git {},
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
              fork(){}
            },
            Authorizer: class Authorizer {
              getConfig(){}
              createProvider(){
                return method => {
                  if (++calledAuth === 2) return () => {};
                  expect(method).to.be.a("function")
                  expect(github).to.not.be.undefined;
                  expect(method).to.equal(github.fork);
                  return (owner, repo, cb) => {
                    didFork = true;
                    expect(owner).to.equal("owner")
                    expect(repo).to.equal("repo")
                    cb();
                  }
                }
              }
            }
          })
          command({args: ["owner", "repo"], cmd: "repo", ext: true}, repoInfo, logger)
          expect(calledAuth).to.equal(2);
          expect(didFork).to.be.true;
        })
        it("should perform an authorized clone of the fork", function(){
          let calledBind = 0, calledAuth = 0, didClone = false, git;
          const repoInfo = {gitRoot: "root"}
          const logger = () => {};
          revert = command.__set__({
            bind: inst => {
              if (++calledBind === 1) git = inst;
              return inst;
            },
            Git: class Git {
              clone(){}
            },
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
              restrict(){}
            },
            Authorizer: class Authorizer {
              getConfig(){}
              createProvider(){
                return method => {
                  if (++calledAuth === 1) return (owner, repo, cb) => cb();
                  if (calledAuth === 3) return () => {};
                  expect(method).to.be.a("function")
                  expect(git).to.not.be.undefined;
                  expect(method).to.equal(git.clone);
                  return (owner, repo, cb) => {
                    didClone = true;
                    expect(owner).to.equal("owner")
                    expect(repo).to.equal("repo")
                    cb();
                  }
                }
              }
            }
          })
          command({args: ["owner", "repo"], cmd: "repo", ext: true}, repoInfo, logger)
          expect(calledAuth).to.equal(3);
          expect(didClone).to.be.true;
        })
        it("should perform an authorized restriction of forked github master branch", function(){
          let calledBind = 0, calledAuth = 0, didRestrict = false, github;
          const repoInfo = {gitRoot: "root"}
          const logger = () => {};
          revert = command.__set__({
            bind: inst => {
              if (++calledBind === 2) github = inst;
              return inst;
            },
            Git: class Git {},
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
              restrict(){}
            },
            Authorizer: class Authorizer {
              getConfig(){}
              createProvider(){
                return method => {
                  if (++calledAuth < 3)
                    return (owner, repo, cb) => cb();
                  expect(method).to.be.a("function")
                  expect(github).to.not.be.undefined;
                  expect(method).to.equal(github.restrict)
                  return (repo, cb) => {
                    didRestrict = true;
                    expect(repo).to.equal("repo");
                    expect(cb).to.be.undefined;
                  }
                }
              }
            }
          })
          command({args: ["owner", "repo"], cmd: "repo", ext: true}, repoInfo, logger)
          expect(calledAuth).to.equal(3);
          expect(didRestrict).to.be.true;
        })
        describe("atlas repo <owner> <repo> --ext --unsafe", function(){
          it("should not perform an authorized restriction of the fork's master branch", function(){
            let calledBind = 0, calledAuth = 0, github;
            const repoInfo = {gitRoot: "root"}
            const logger = () => {};
            revert = command.__set__({
              bind: inst => {
                if (++calledBind === 2) github = inst;
                return inst;
              },
              Git: class Git {},
              Github: class Github {
                clearAuth(){}
                getAuth(){}
                setAuth(){}
                restrict(){}
              },
              Authorizer: class Authorizer {
                getConfig(){}
                createProvider(){
                  return method => {
                    calledAuth++
                    expect(method).to.not.equal(github.restrict)
                    return (owner, repo, cb) => cb();
                  }
                }
              }
            })
            command({args: ["owner", "repo"], cmd: "repo", ext: true, unsafe: true}, repoInfo, logger)
            expect(calledAuth).to.equal(2);
          })
        })
      })
      describe("atlas repo <owner> <repo>", function(){
        it("should fail if the current directory is already a repo", function(){
          let msg;
          const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
          const logger = (inMsg) => {msg = inMsg};
          revert = command.__set__({
            bind: inst => inst,
            Git: class Git {},
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
            },
            Authorizer: class Authorizer {
              getConfig(){}
              createProvider(){}
            }
          })
          command({args: ["owner", "repo"], cmd: "repo", ext: false}, repoInfo, logger)
          expect(msg).to.equal("already a repo");
        })
        it("should fail if a repo name is not provided", function(){
          let msg;
          const repoInfo = {gitRoot: "root"}
          const logger = (inMsg) => {msg = inMsg};
          revert = command.__set__({
            bind: inst => inst,
            Git: class Git {},
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
            },
            Authorizer: class Authorizer {
              createProvider(){}
              getConfig(){}
            }
          })
          command({args: ["owner"], cmd: "repo", ext: false}, repoInfo, logger)
          expect(msg).to.equal("atlas repo <owner> <name> --ext? --unsafe? --debug?");
        })
        it("should perform an authorized clone of the owner's repository", function(){
          let calledBind = 0, calledAuth = 0, didClone = false, git;
          const repoInfo = {gitRoot: "root"}
          const logger = () => {};
          revert = command.__set__({
            bind: inst => {
              if (++calledBind === 1) git = inst;
              return inst;
            },
            Git: class Git {
              clone(){}
            },
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
            },
            Authorizer: class Authorizer {
              getConfig(){}
              createProvider(){
                return method => {
                  calledAuth++;
                  expect(method).to.be.a("function")
                  expect(git).to.not.be.undefined;
                  expect(method).to.equal(git.clone);
                  return (owner, repo, cb) => {
                    didClone = true;
                    expect(owner).to.equal("owner")
                    expect(repo).to.equal("repo")
                    cb();
                  }
                }
              }
            }
          })
          command({args: ["owner", "repo"], cmd: "repo", ext: false}, repoInfo, logger)
          expect(calledAuth).to.equal(1);
          expect(didClone).to.be.true;
        })
        it("should not perform an authorized restriction of cloned github master branch", function(){
          let calledBind = 0, calledAuth = 0, github;
          const repoInfo = {gitRoot: "root"}
          const logger = () => {};
          revert = command.__set__({
            bind: inst => {
              if (++calledBind === 2) github = inst;
              return inst;
            },
            Git: class Git {},
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
              restrict(){}
            },
            Authorizer: class Authorizer {
              getConfig(){}
              createProvider(){
                return method => {
                  calledAuth++
                  expect(method).to.not.equal(github.restrict)
                  return (owner, repo, cb) => { cb() }
                }
              }
            }
          })
          command({args: ["owner", "repo"], cmd: "repo", ext: false}, repoInfo, logger)
          expect(calledAuth).to.equal(1);
        })
        describe("atlas repo <owner> <repo> --unsafe", function(){
          it("should not perform an authorized restriction of the clone's master branch", function(){
            let calledBind = 0, calledAuth = 0, github;
            const repoInfo = {gitRoot: "root"}
            const logger = () => {};
            revert = command.__set__({
              bind: inst => {
                if (++calledBind === 2) github = inst;
                return inst;
              },
              Git: class Git {},
              Github: class Github {
                clearAuth(){}
                getAuth(){}
                setAuth(){}
                restrict(){}
              },
              Authorizer: class Authorizer {
                getConfig(){}
                createProvider(){
                  return method => {
                    calledAuth++
                    expect(method).to.not.equal(github.restrict)
                    return (owner, repo, cb) => cb();
                  }
                }
              }
            })
            command({args: ["owner", "repo"], cmd: "repo", ext: false, unsafe: true}, repoInfo, logger)
            expect(calledAuth).to.equal(1);
          })
        })
      })
    })
    describe("uploads local repository to github", function(){
      it("should create auth provider which performs authorized deletion of newly created github repo on failures", function(done){
        let calledBind = 0, configStore, github, calledProvider = 0;
        const repoInfo = {gitRoot: "root", branch: "feature", name: "my-repo"}
        const logger = () => {};
        revert = command.__set__({
          bind: inst => {
            if (++calledBind === 2) github = inst;
            return inst;
          },
          Git: class Git {
            constructor(cwd, name, branch, store){
              configStore = store;
            }
          },
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
            delete(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(store, cb){
              if (++calledProvider === 1) {
                expect(cb).to.equal(logger)
                return method => {
                  expect(github).to.not.be.undefined;
                  expect(method).to.equal(github.delete);
                  return () => {
                    expect(calledProvider).to.equal(2)
                    done();
                  }
                }
              }
              expect(store).to.equal(configStore)
              expect(cb).to.not.equal(logger)
              cb();
            }
          }
        })
        command({args: [], cmd: "repo"}, repoInfo, logger)
      })
      it("should fail if the current directory is not a repo", function(){
        let msg;
        const repoInfo = {gitRoot: "root"}
        const logger = (inMsg) => {msg = inMsg};
        revert = command.__set__({
          bind: inst => inst,
          Git: class Git {},
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(){}
          }
        })
        command({args: [], cmd: "repo", ext: false}, repoInfo, logger)
        expect(msg).to.equal("not in a repo");
      })
      it("should fail if there is no branch in the current repository", function(){
        let msg;
        const repoInfo = {gitRoot: "root", name: "my-repo", branch: null}
        const logger = (inMsg) => {msg = inMsg};
        revert = command.__set__({
          bind: inst => inst,
          Git: class Git {},
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(){}
          }
        })

        command({args: [], cmd: "repo", ext: false}, repoInfo, logger)
        expect(msg).to.equal("no commits");
      })
      it("should fail if the current repo already has an origin", function(){
        let msg, remotes = { origin: "some url"}
        const repoInfo = {gitRoot: "root", name: "my-repo", branch: "feature", remotes}
        const logger = (inMsg) => {msg = inMsg};
        revert = command.__set__({
          bind: inst => inst,
          Git: class Git {},
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(){}
          }
        })
        command({args: [], cmd: "repo", ext: false}, repoInfo, logger)
        expect(msg).to.equal("already has origin");
      })
      it("should create a new github repository", function(){
        let calledBind = 0, calledAuth = 0, didCreate = false, github;
        const repoInfo = {gitRoot: "root", branch: "my-branch", name: "my-repo", remotes: {}}
        const logger = () => {};
        revert = command.__set__({
          bind: inst => {
            if (++calledBind === 2) github = inst;
            return inst;
          },
          Git: class Git {
          },
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
            create(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(){
              return method => {
                calledAuth++;
                expect(method).to.be.a("function")
                expect(github).to.not.be.undefined;
                expect(method).to.equal(github.create);
                return cb => {
                  expect(cb).to.be.a("function")
                  didCreate = true;
                }
              }
            }
          }
        })
        command({args: [], cmd: "repo", ext: false}, repoInfo, logger)
        expect(calledAuth).to.equal(1);
        expect(didCreate).to.be.true;
      })
      it("should update the package.json with the new auth provider", function(){
        let calledBind = 0, calledAuth = 0, calledAuthNew = 0, calledProvider = 0
        let didUpdate = false, git;
        const repoInfo = {gitRoot: "root", branch: "my-branch", name: "my-repo", remotes: {}}
        const logger = () => {};
        revert = command.__set__({
          bind: inst => {
            if (++calledBind === 1) git = inst;
            return inst;
          },
          Git: class Git {
            updatePackage(){}
          },
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(configStore, providerCb){
              if (++calledProvider === 1){
                expect(providerCb).to.equal(logger)
                return method => {
                  calledAuth++;
                  return cb => cb();
                }
              }
              expect(providerCb).to.not.equal(logger)
              return method => {
                calledAuthNew++;
                expect(method).to.be.a("function")
                expect(git).to.not.be.undefined;
                expect(method).to.equal(git.updatePackage);
                return cb => {
                  expect(cb).to.be.a("function");
                  didUpdate = true;
                }
              }
            }
          }
        })
        command({args: [], cmd: "repo", ext: false}, repoInfo, logger)
        expect(calledAuth).to.equal(1);
        expect(calledAuthNew).to.equal(1);
        expect(calledProvider).to.equal(2);
        expect(didUpdate).to.be.true;
      })
      it("should try to update the readme with the new auth provider", function(){
        let calledBind = 0, calledAuth = 0, calledAuthNew = 0, calledProvider = 0
        let didUpdate = false, git;
        const repoInfo = {gitRoot: "root", branch: "my-branch", name: "my-repo", remotes: {}}
        const logger = () => {};
        revert = command.__set__({
          bind: inst => {
            if (++calledBind === 1) git = inst;
            return inst;
          },
          Git: class Git {
            updateReadme(){}
          },
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(configStore, providerCb){
              if (++calledProvider === 1){
                expect(providerCb).to.equal(logger)
                return method => {
                  calledAuth++;
                  return cb => cb();
                }
              }
              expect(providerCb).to.not.equal(logger)
              return method => {
                if (++calledAuthNew === 1) return cb => cb();
                expect(method).to.be.a("function")
                expect(git).to.not.be.undefined;
                expect(method).to.equal(git.updateReadme);
                return cb => {
                  expect(cb).to.be.a("function");
                  didUpdate = true;
                }
              }
            }
          }
        })
        command({args: [], cmd: "repo", ext: false}, repoInfo, logger)
        expect(calledAuth).to.equal(1);
        expect(calledAuthNew).to.equal(2);
        expect(calledProvider).to.equal(2);
        expect(didUpdate).to.be.true;
      })
      it("should push to the github repo with the new auth provider", function(){
        let calledBind = 0, calledAuth = 0, calledAuthNew = 0, calledProvider = 0
        let didInit = false, git;
        const repoInfo = {gitRoot: "root", branch: "my-branch", name: "my-repo", remotes: {}}
        const logger = () => {};
        revert = command.__set__({
          bind: inst => {
            if (++calledBind === 1) git = inst;
            return inst;
          },
          Git: class Git {
            init(){}
          },
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(configStore, providerCb){
              if (++calledProvider === 1){
                expect(providerCb).to.equal(logger)
                return method => {
                  calledAuth++;
                  return cb => cb();
                }
              }
              expect(providerCb).to.not.equal(logger)
              return method => {
                if (++calledAuthNew < 3) return cb => cb();
                expect(method).to.be.a("function")
                expect(git).to.not.be.undefined;
                expect(method).to.equal(git.init);
                return cb => {
                  expect(cb).to.be.a("function");
                  didInit = true;
                }
              }
            }
          }
        })
        command({args: [], cmd: "repo", ext: false}, repoInfo, logger)
        expect(calledAuth).to.equal(1);
        expect(calledAuthNew).to.equal(3);
        expect(calledProvider).to.equal(2);
        expect(didInit).to.be.true;
      })
      it("should perform an authorized restriction of new github master branch", function(){
        let calledBind = 0, calledAuth = 0, didRestrict = false, github;
        const repoInfo ={gitRoot: "root", branch: "my-branch", name: "my-repo", remotes:{}}
        const logger = () => {};
        revert = command.__set__({
          bind: inst => {
            if (++calledBind === 2) github = inst;
            return inst;
          },
          Git: class Git {},
          Github: class Github {
            clearAuth(){}
            getAuth(){}
            setAuth(){}
            restrict(){}
          },
          Authorizer: class Authorizer {
            getConfig(){}
            createProvider(configStore, providerCb){
              return method => {
                if (++calledAuth < 5) return cb => cb();
                expect(method).to.be.a("function")
                expect(providerCb).to.equal(logger)
                expect(github).to.not.be.undefined;
                expect(method).to.equal(github.restrict)
                return (repo, cb) => {
                  didRestrict = true;
                  expect(repo).to.be.null
                  expect(cb).to.be.undefined;
                }
              }
            }
          }
        })
        command({args: [], cmd: "repo", ext: false}, repoInfo, logger)
        expect(calledAuth).to.equal(5);
        expect(didRestrict).to.be.true;
      })
      describe("atlas repo --unsafe", function(){
        it("should not perform an authorized restriction of the clone's master branch", function(){
          let calledBind = 0, calledAuth = 0, github;
          const repoInfo = {gitRoot: "root", branch: "my-branch", name: "my-repo", remotes: {}}
          const logger = () => {};
          revert = command.__set__({
            bind: inst => {
              if (++calledBind === 2) github = inst;
              return inst;
            },
            Git: class Git {},
            Github: class Github {
              clearAuth(){}
              getAuth(){}
              setAuth(){}
              restrict(){}
            },
            Authorizer: class Authorizer {
              getConfig(){}
              createProvider(){
                return method => {
                  calledAuth++;
                  expect(method).to.not.equal(github.restrict);
                  return cb => cb();
                }
              }
            }
          })
          command({args: [], cmd: "repo", ext: false, unsafe: true}, repoInfo, logger)
          expect(calledAuth).to.equal(4);
        })
      })
    })
  })
})
