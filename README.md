# atlas-github-init

A CLI tool for seamlessly uploading local projects to Github and cloning/forking existing Github projects.

---

## install

```
npm install -g atlas-github-init
```

## why

I like making npm packages, and a lot of the initialization tasks are the same for each new package:

 1. Finish a new npm package locally.
 2. Create a blank Github repository.
 3. Set the origin remote.
 4. Push my new package to the new Github repository.
 5. Optionally, I'll want to fork *and* clone a Github repository to my local machine.

Initially, I wanted to include the option to set pre-defined git hooks, but I decided later that this would be outside the scope of this package. I also wanted to try and create my own semantics for pushing and merging to promote a feature-branch-based workflow, but decided not to. The existing `git` subcommands are already fairly concise and expressive and didn't really need to be repackaged at the expense of freedom.

## examples

Print usage information: 

```
atlas
```

#### subcommands

Clear your cached login token and metadata:

```
atlas logout
```

If you are in a repository, you can initialize and upload it to your Github with:

```
atlas repo
```

You can clone a repository from Github by specifying an owner and repo:

```
atlas repo atlassubbed atlas-npm-init --ext
```

The name of your repo is derived from your folder name. The `--ext` (external) flag indicates that you want to fork the repo to your own Github, in addition to cloning it to your local machine. The remotes will be set correctly. In this example, the repo would be created at: `./atlassubbed/atlas-npm-init`. Note that none of these folders need to exist beforehand; they will be created on-the-fly if they don't exist.

By default, the CLI tool will automatically enable certain `master` branch restrictions and pull-request checks on your newly created (either new or forked) repository. You can disable this with a flag:

```
atlas repo --unsafe
```

Note that cloning a repo you already own (e.g. no `--ext` flag) will not attempt to change these security restrictions, so the `--unsafe` flag is not necessary:

```
atlas repo atlassubbed atlas-github-init
```

#### debugging

The `--debug` flag on any subcommand will print more information on failures or errors:

```
atlas repo octocat Spoon-Knife --ext --debug
```

#### travis-ci support

If you're using `atlas-npm-init` to initialize your project, you will have travis-ci placeholder badge at the top of your `README.md` file. This will automatically be filled in when you initialize your new Github repository with `atlas repo`. If the placeholder isn't present, then no travis-related content will be added to your `README.md`.

## todo

#### password for git

When pushing to Github, you can use a personal access token as your password when `git` prompts you. I haven't yet found a good way to supply a password to git running in a subshell via stdin. A different way to do this is by embedding the token in the remote URL like this:

```
https://your-username:your-token@github.com/your-username/your-repo.git
```

Overall, this seems like a pretty bad idea! I'm sure it can be done a different way, maybe with a private key or by writing to stdin on-the-fly?

#### command scope

I'd like to have a global executable called `atlas` which has the following sub-commands:

  1. `npm`: generates a minimal npm starter app.
  2. `webpack`: generates a minimal webpack starter app.
  3. `repo`: automatically sync your project to github or fork/clone existing projects.
  4. `logout`
  5. `whoami`
  6. ~~`login`~~: Not needed, thanks to `atlas-recursive-auth`

As of right now, the `atlas` command only has subcommands 3 and 4 above. `atlas-npm-init` and `altas-webpack-init` are their own commands, but I'd like to turn them into 1 and 2 above, respectively. The `atlas` command should then be responsible for initializing pretty much everything in a new project.

## caveats

While the CLI tool will cache your login token for Github so you don't need to enter your credentials more than once, you will have to enter your password again when `git` is running for certain tasks. Git has its own way of caching your creds, so you will only have to "enter your password twice" once. Please configure Git on your local machine to enable caching if you don't wanna keep entering your creds for Git.