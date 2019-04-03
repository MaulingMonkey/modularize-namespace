# What?  Why?

I really like being able to author single-js file typescript libraries without modules.
The output of typedoc is way cleaner, files merge cleanly, can be used in non-module projects, etc.
Being able to consume libraries as modules is still nice, however, so this tool aims to provide that as an option.

* License:  [Apache 2.0](LICENSE.txt)
* Github:  [MaulingMonkey/modularize-namespace](https://github.com/MaulingMonkey/modularize-namespace)
* NPM:  [@maulingmonkey/modularize-namespace](https://www.npmjs.com/package/@maulingmonkey/modularize-namespace)

# Quick Start

* Grab [NPM](https://nodejs.org/en/)
* Option 1:  Install per-project, and convert once
  ```cmd
  cd my-project
  npm init
  npm install --save-dev @maulingmonkey/modularize-namespace
  node_modules/.bin/modularize-namespace namespaces.js --output module.js --namespace my.namespace
  ```
* Option 2:  Install globally, and convert once
  ```cmd
  npm install --global @maulingmonkey/modularize-namespace
  modularize-namespace namespaces.js --output module.js --namespace my.namespace
  ```

# Hacking on this

* Grab [NPM](https://nodejs.org/en/), [VS Code](https://code.visualstudio.com/)
* Fork https://github.com/MaulingMonkey/modularize-namespace
* `git clone [...your fork...]`
* `code your_fork`
* Make changes
* `Ctrl+Shift+B`
* Profit, commit, and push
* I might respond to [Pull requests](https://github.com/MaulingMonkey/modularize-namespace/pulls).  No promises!
