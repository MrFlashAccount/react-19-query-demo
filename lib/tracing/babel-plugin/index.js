/**
 * Babel plugin for automatic function tracing.
 * Wraps functions with span creation/ending, preserving parent-child relationships.
 *
 * @example
 * // Input:
 * function fetchUser(id) {
 *   return api.get(`/users/${id}`);
 * }
 *
 * // Output:
 * import { runInSpan } from "@lib/tracing/asynccontext";
 * function fetchUser(id) {
 *   return runInSpan((span) => {
 *     return api.get(`/users/${id}`);
 *   }, "fetchUser", { description: "src/api.ts:10" });
 * }
 */

/**
 * @typedef {Object} TracingPluginOptions
 * @property {string} [tracingModule] - Import path for tracing module. Default: "@lib/tracing/asynccontext"
 * @property {string} [runInSpanFn] - Function to call for running in span. Default: "runInSpan"
 * @property {boolean} [includeLocation] - Include source location in span metadata. Default: true
 * @property {RegExp} [include] - Pattern to match files to transform. Default: all files
 * @property {RegExp} [exclude] - Pattern to exclude files. Default: node_modules
 * @property {number} [minStatements] - Minimum function body statement count to trace. Default: 0
 * @property {string[]} [skipFunctions] - Skip functions matching these names
 * @property {string[]} [onlyFunctions] - Only trace functions matching these names (if provided)
 * @property {string} [skipDirective] - Directive comment to skip tracing: "no-trace"
 * @property {string} [forceDirective] - Directive comment to force tracing: "trace"
 */

/** @type {Required<TracingPluginOptions>} */
const DEFAULT_OPTIONS = {
  tracingModule: "@lib/tracing/asynccontext",
  runInSpanFn: "runInSpan",
  includeLocation: true,
  include: /.*/,
  exclude: /node_modules/,
  minStatements: 0,
  skipFunctions: [],
  onlyFunctions: [],
  skipDirective: "no-trace",
  forceDirective: "trace",
};

// Marker to prevent double-wrapping
const TRACED_MARKER = Symbol("traced");

/**
 * @param {{ types: import("@babel/types") }} babel
 * @returns {import("@babel/core").PluginObj}
 */
module.exports = function tracingPlugin(babel) {
  const { types: t } = babel;

  /** @type {import("@babel/types").Identifier | null} */
  let runInSpanId = null;

  /**
   * @param {TracingPluginOptions} opts
   * @returns {Required<TracingPluginOptions>}
   */
  const getOptions = (opts) => ({
    ...DEFAULT_OPTIONS,
    ...opts,
  });

  /**
   * Check if a function should be traced based on options and directives.
   * @param {import("@babel/traverse").NodePath} path
   * @param {string} name
   * @param {Required<TracingPluginOptions>} options
   * @returns {boolean}
   */
  function shouldTrace(path, name, options) {
    // Already traced
    if (path.node[TRACED_MARKER]) {
      return false;
    }

    // Check for directive comments
    const leadingComments = path.node.leadingComments || [];
    const hasSkipDirective = leadingComments.some(
      (c) =>
        c.value.includes(options.skipDirective) ||
        c.value.includes("@" + options.skipDirective)
    );
    const hasForceDirective = leadingComments.some(
      (c) =>
        c.value.includes(options.forceDirective) ||
        c.value.includes("@" + options.forceDirective)
    );

    if (hasSkipDirective) return false;
    if (hasForceDirective) return true;

    // Check skip list
    if (options.skipFunctions.includes(name)) {
      return false;
    }

    // Check only list (if provided)
    if (
      options.onlyFunctions.length > 0 &&
      !options.onlyFunctions.includes(name)
    ) {
      return false;
    }

    // Check minimum statements
    const body = path.node.body;
    if (t.isBlockStatement(body)) {
      if (body.body.length < options.minStatements) {
        return false;
      }
    } else if (options.minStatements > 1) {
      // Arrow function with expression body = 1 statement
      return false;
    }

    return true;
  }

  /**
   * Get function name from various contexts.
   * @param {import("@babel/traverse").NodePath} path
   * @returns {string}
   */
  function getFunctionName(path) {
    const node = path.node;

    // Function declaration: function foo() {}
    if (t.isFunctionDeclaration(node) && node.id) {
      return node.id.name;
    }

    // Function expression or arrow in variable: const foo = () => {}
    if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
      return path.parent.id.name;
    }

    // Object method: { foo() {} } or { foo: () => {} }
    if (t.isObjectProperty(path.parent) && t.isIdentifier(path.parent.key)) {
      return path.parent.key.name;
    }

    if (t.isObjectMethod(path.parent) && t.isIdentifier(path.parent.key)) {
      return path.parent.key.name;
    }

    // Class method
    if (t.isClassMethod(path.parent) && t.isIdentifier(path.parent.key)) {
      return path.parent.key.name;
    }

    // Assignment: module.exports.foo = () => {}
    if (t.isAssignmentExpression(path.parent)) {
      if (t.isMemberExpression(path.parent.left)) {
        const prop = path.parent.left.property;
        if (t.isIdentifier(prop)) {
          return prop.name;
        }
      }
    }

    return "<anonymous>";
  }

  /**
   * Get source location string.
   * @param {import("@babel/traverse").NodePath} path
   * @param {string | undefined} filename
   * @returns {string | null}
   */
  function getLocation(path, filename) {
    const loc = path.node.loc;
    if (!loc) return null;

    const file = filename
      ? filename.replace(/.*[/\\]/, "") // Just filename
      : "unknown";
    return `${file}:${loc.start.line}`;
  }

  /**
   * Ensure tracing import exists, add if needed.
   * @param {import("@babel/traverse").NodePath<import("@babel/types").Program>} programPath
   * @param {Required<TracingPluginOptions>} options
   * @returns {import("@babel/types").Identifier}
   */
  function ensureImport(programPath, options) {
    if (runInSpanId) return runInSpanId;

    // Check if import already exists
    const existingImport = programPath.node.body.find((node) => {
      if (!t.isImportDeclaration(node)) return false;
      if (node.source.value !== options.tracingModule) return false;
      return node.specifiers.some(
        (s) =>
          t.isImportSpecifier(s) &&
          t.isIdentifier(s.imported) &&
          s.imported.name === options.runInSpanFn
      );
    });

    if (existingImport && t.isImportDeclaration(existingImport)) {
      const spec = existingImport.specifiers.find(
        (s) =>
          t.isImportSpecifier(s) &&
          t.isIdentifier(s.imported) &&
          s.imported.name === options.runInSpanFn
      );
      if (spec && t.isImportSpecifier(spec)) {
        runInSpanId = spec.local;
        return runInSpanId;
      }
    }

    // Create unique identifier
    runInSpanId = programPath.scope.generateUidIdentifier(options.runInSpanFn);

    // Add import
    const importDecl = t.importDeclaration(
      [t.importSpecifier(runInSpanId, t.identifier(options.runInSpanFn))],
      t.stringLiteral(options.tracingModule)
    );

    programPath.unshiftContainer("body", importDecl);

    return runInSpanId;
  }

  /**
   * Create the span wrapper call.
   * @param {import("@babel/types").Identifier} runInSpanId
   * @param {import("@babel/types").BlockStatement | import("@babel/types").Expression} body
   * @param {string} spanName
   * @param {string | null} location
   * @param {boolean} isAsync
   * @param {Required<TracingPluginOptions>} options
   * @returns {import("@babel/types").CallExpression}
   */
  function createSpanWrapper(
    runInSpanId,
    body,
    spanName,
    location,
    isAsync,
    options
  ) {
    // Create the callback: (span) => { ... } or (span) => expression
    const spanParam = t.identifier("__span");

    /** @type {import("@babel/types").BlockStatement | import("@babel/types").Expression} */
    let callbackBody;
    if (t.isBlockStatement(body)) {
      callbackBody = body;
    } else {
      // Arrow with expression body -> wrap in return
      callbackBody = t.blockStatement([t.returnStatement(body)]);
    }

    const callback = t.arrowFunctionExpression([spanParam], callbackBody);
    callback.async = isAsync;

    // Build meta object
    /** @type {import("@babel/types").ObjectProperty[]} */
    const metaProps = [];
    if (options.includeLocation && location) {
      metaProps.push(
        t.objectProperty(t.identifier("description"), t.stringLiteral(location))
      );
    }

    const metaArg =
      metaProps.length > 0
        ? t.objectExpression(metaProps)
        : t.identifier("undefined");

    // runInSpan(callback, name, meta)
    return t.callExpression(runInSpanId, [
      callback,
      t.stringLiteral(spanName),
      metaArg,
    ]);
  }

  /**
   * Wrap a function body with span tracing.
   * @param {import("@babel/traverse").NodePath} path
   * @param {import("@babel/traverse").NodePath<import("@babel/types").Program>} programPath
   * @param {Required<TracingPluginOptions>} options
   * @param {string | undefined} filename
   */
  function wrapFunction(path, programPath, options, filename) {
    const name = getFunctionName(path);

    if (!shouldTrace(path, name, options)) {
      return;
    }

    // Mark as traced
    path.node[TRACED_MARKER] = true;

    const importId = ensureImport(programPath, options);
    const location = options.includeLocation ? getLocation(path, filename) : null;
    const isAsync = path.node.async;
    const body = path.node.body;

    const spanCall = createSpanWrapper(
      importId,
      body,
      name,
      location,
      isAsync,
      options
    );

    // Replace body
    if (t.isBlockStatement(body)) {
      // function foo() { ... } -> function foo() { return runInSpan(...) }
      const newBody = t.blockStatement([t.returnStatement(spanCall)]);
      path.node.body = newBody;
    } else {
      // Arrow: () => expr -> () => runInSpan(...)
      path.node.body = spanCall;
    }
  }

  return {
    name: "tracing-plugin",

    pre() {
      runInSpanId = null;
    },

    visitor: {
      Program(programPath, state) {
        const options = getOptions(state.opts || {});
        const filename = state.filename;

        // File filtering
        if (filename) {
          if (!options.include.test(filename)) return;
          if (options.exclude.test(filename)) return;
        }

        // Process all functions in this file
        programPath.traverse({
          FunctionDeclaration(path) {
            wrapFunction(path, programPath, options, filename);
          },
          FunctionExpression(path) {
            wrapFunction(path, programPath, options, filename);
          },
          ArrowFunctionExpression(path) {
            wrapFunction(path, programPath, options, filename);
          },
        });
      },
    },
  };
};

// ESM compat
module.exports.default = module.exports;

