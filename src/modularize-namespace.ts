import fs = require('fs');
import path = require('path');

let anyErrors = false;

const validNamespace = /^([a-zA-Z_][a-zA-Z_0-9]*)(?:\.([a-zA-Z_][a-zA-Z_0-9]*))*$/;
const jstExt = /\.js$/;

interface Arguments {
    input: {
        fileJs:     string;
        fileDTs:    string;
        watch:      boolean;
    }

    output: {
        fileJs:    string;
        fileDTs:   string;
    }

    namespace: string;

    verbose: boolean;
}

function debug (message: string) {
    process.stderr.write("DEBUG: ");
    process.stderr.write(message);
    process.stderr.write("\n");
}

function error (message: string) {
    process.stderr.write("ERROR: ");
    process.stderr.write(message);
    process.stderr.write("\n");
    anyErrors = true;
}

function printUsage () {
    process.stderr.write(`Usage:\r\n${process.argv0} global.js --output module.js --namespace namespace.to.export`);
}

function parseArguments (args: string[] = process.argv): Arguments | undefined {
    let nextParse : (arg: string) => void;

    let a_input     : Arguments["input"] | undefined;
    let a_output    : Arguments["output"] | undefined;
    let a_namespace : Arguments["namespace"] | undefined;
    let verbose = false;

    function parseArg (arg: string) {
        switch (arg.toLowerCase()) {
            case "--watch":
                if (a_input !== undefined) error("Already specified input");
                nextParse = function watch (arg) {
                    if (!jstExt.test(arg)) error(`--watch target must be a .js file`);
                    if (!fs.existsSync(arg)) error(`--watch target ${JSON.stringify(arg)} does not exist`);
                    a_input = {
                        fileJs:     arg,
                        fileDTs:    arg.replace(jstExt, ".d.ts"),
                        watch:      true,
                    };
                    nextParse = parseArg;
                };
                break;

            case "--output":
                if (a_output !== undefined) error("Already specified --output");
                nextParse = function output (arg) {
                    if (!jstExt.test(arg)) error(`--output target must be a .js file`);
                    let dir = path.dirname(arg);
                    if (!fs.existsSync(dir)) error(`--output directory ${JSON.stringify(dir)} does not exist`);
                    a_output = {
                        fileJs: arg,
                        fileDTs: arg.replace(jstExt, ".d.ts"),
                    };
                    nextParse = parseArg;
                };
                break;

            case "--namespace":
                if (a_namespace !== undefined) error("Already specified --namespace");
                nextParse = function namespace (arg) {
                    if (!validNamespace.test(arg)) error(`--namespace should have the format "foo.bar"`);
                    a_namespace = arg;
                    nextParse = parseArg;
                };
                break;

            case "--help":
                printUsage();
                process.exit(0);
                break;

            case "--verbose":
                verbose = true;
                break;

            default:
                if (/^(--|\/)/.test(arg)) {
                    error(`Unrecognized flag: ${arg}`);
                }
                else if (a_input === undefined) {
                    if (!jstExt.test(arg)) error(`input ${JSON.stringify(arg)} must be a .js file`);
                    if (!fs.existsSync(arg)) error(`input ${JSON.stringify(arg)} does not exist`);
                    a_input = {
                        fileJs:     arg,
                        fileDTs:    arg.replace(jstExt, ".d.ts"),
                        watch:      true,
                    };
                }
                else {
                    error(`Unexpected positional argument: ${arg}`);
                }
                break;
        }
    }

    nextParse = function ignoreInitialArgs (arg) {
        if (/(^|[\\/])node(\.exe|\.cmd)?$/.test(arg)) return;
        if (/bin[\\/]modularize-namespace$/.test(arg)) return;
        nextParse = parseArg;
        parseArg(arg);
    };

    for (var arg of args) nextParse(arg);
    if (nextParse !== parseArg) error(`Expected another argument for ${nextParse.name}`);
    if (!a_input) { error('Expected an input file'); return undefined; }
    if (!a_output) { error('Expected an output file'); return undefined; }
    if (!a_namespace) { error('Expected a namespace to wrap'); return undefined; }
    if (anyErrors) return undefined;

    return {
        input: a_input,
        output: a_output,
        namespace: a_namespace,
        verbose,
    };
}

interface FindSourceMapResult {
    before:     string;
    after:      string;
    comment:    string;
    url:        string;
}

function findSourceMap (input: string): FindSourceMapResult | undefined {
    let mSourceMap = /^\/\/# sourceMappingURL=(.+(?:\.js\.map|\.d\.ts\.map))$/mi.exec(input);
    if (!mSourceMap) return undefined;

    return {
        before:     input.substr(0, mSourceMap.index),
        after:      input.substr(mSourceMap.index + mSourceMap[0].length),
        comment:    mSourceMap[0],
        url:        mSourceMap[1]
    };
}

function inferEol (input: string): string { return /\r\n/.test(input) ? '\r\n' : '\n'; }

const jsPreamble = `(function(root){`;

function jsPostamble (namespace: string, eol: string): string {
    return `
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['exports'], function (exports) {
            exports.default = ${namespace};
            Object.keys(${namespace}).forEach(function (key) {
                exports[key] = ${namespace}[key];
            });
        });
    } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
        // CommonJS
        Object.keys(${namespace}).forEach(function (key) {
            exports[key] = ${namespace}[key];
        });
    }
})(this);
`.replace('\r\n','\n').replace('\n',eol);
}

function rewriteFileJs (args: Arguments) {
    if (!args.input) return;
    if (!args.output) return;
    if (!args.namespace) return;

    let inputJs = fs.readFileSync(args.input.fileJs, "utf8");
    let eol = inferEol(inputJs);
    let sourceMap = findSourceMap(inputJs) || { before: inputJs, after: "", comment: "", url: "" };
    if (args.verbose) debug(`js sourceMap: ${JSON.stringify(sourceMap)}`);

    // We intentionally format this to keep the line numbers before the source map the same.
    let outputJs = `${jsPreamble}${sourceMap.before}${jsPostamble(args.namespace, eol)}${sourceMap.comment}${sourceMap.after}`;

    fs.writeFileSync(args.output.fileJs, outputJs);
}

function rewriteDefTs (args: Arguments) {
    if (!args.input) return;
    if (!args.output) return;
    if (!args.namespace) return;
    if (!fs.existsSync(args.input.fileDTs)) return;

    let inputDTs = fs.readFileSync(args.input.fileDTs, "utf8");
    let eol = inferEol(inputDTs);
    let sourceMap = findSourceMap(inputDTs) || { before: inputDTs, after: "", comment: "", url: "" };
    if (args.verbose) debug(`d.ts sourceMap: ${JSON.stringify(sourceMap)}`);

    // We intentionally format this to keep the line numbers before the source map the same.
    let outputDTs = `${sourceMap.before}${eol}export = ${args.namespace};${eol}${sourceMap.comment}${sourceMap.after}`;

    fs.writeFileSync(args.output.fileDTs, outputDTs);
}

function main () {
    let args = parseArguments(process.argv);
    if (args === undefined) { process.exit(1); return; }

    rewriteFileJs(args);
    rewriteDefTs(args);
}

main();
