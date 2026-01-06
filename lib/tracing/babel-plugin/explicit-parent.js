/**
 * Babel plugin variant using explicit parent passing.
 * For environments without AsyncContext support.
 *
 * Adds optional `__parentSpan` as last parameter to all traced functions.
 *
 * @example
 * // Input:
 * function fetchUser(id) {
 *   return api.get(`/users/${id}`);
 * }
 *
 * // Output:
 * import { traced } from "@lib/tracing/helpers";
 * const fetchUser = traced(function fetchUser(id, __parentSpan) {
 *   return api.get(`/users/${id}`);
 * }, "fetchUser", {}, { description: "src/api.ts:10" });
 */

/**
 * @typedef {Object} ExplicitParentPluginOptions
 * @property {string} [tracingModule] - Import path for tracing module. Default: "@lib/tracing/helpers"
 * @property {string} [tracedFn] - HOF function name. Default: "traced"
 * @property {boolean} [includeLocation] - Include source location in span metadata. Default: true
 * @property {RegExp} [include] - Pattern to match files to transform
 * @property {RegExp} [exclude] - Pattern to exclude files. Default: node_modules
 * @property {number} [minStatements] - Minimum function body statement count to trace. Default: 0
 * @property {string[]} [skipFunctions] - Skip functions matching these names
 * @property {string} [skipDirective] - Directive comment to skip tracing
 */

/** @type {Required<ExplicitParentPluginOptions>} */
const DEFAULT_OPTIONS = {
  tracingModule: "@lib/tracing/helpers",
  tracedFn: "traced",
  includeLocation: true,
  include: /.*/,
  exclude: /node_modules/,
  minStatements: 0,
  skipFunctions: [],
  skipDirective: "no-trace",
};

const TRACED_MARKER = Symbol("traced");

/**
 * @param {{ types: import("@babel/types") }} babel
 * @returns {import("@babel/core").PluginObj}
 */
module.exports = function explicitParentPlugin(babel) {
  const { types: t } = babel;

  /** @type {import("@babel/types").Identifier | null} */
  let tracedId = null;
  
  // Track processed nodes by their start position to avoid re-processing
  /** @type {Set<string>} */
  const processedNodes = new Set();

  /**
   * @param {ExplicitParentPluginOptions} opts
   * @returns {Required<ExplicitParentPluginOptions>}
   */
  const getOptions = (opts) => ({
    ...DEFAULT_OPTIONS,
    ...opts,
  });

  /**
   * Get a unique key for a node based on its location
   * @param {import("@babel/traverse").NodePath} path
   * @returns {string}
   */
  function getNodeKey(path) {
    const loc = path.node.loc;
    if (loc) {
      return `${loc.start.line}:${loc.start.column}`;
    }
    return '';
  }

  /**
   * Check if function is an IIFE (Immediately Invoked Function Expression)
   * @param {import("@babel/traverse").NodePath} path
   * @returns {boolean}
   */
  function isIIFE(path) {
    // Check if parent is a CallExpression and this function is the callee
    if (t.isCallExpression(path.parent) && path.parent.callee === path.node) {
      return true;
    }
    // Also check for (function() {})() pattern where function is wrapped in parens
    if (t.isParenthesizedExpression(path.parent)) {
      const grandParent = path.parentPath?.parent;
      if (t.isCallExpression(grandParent) && grandParent.callee === path.parent) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {import("@babel/traverse").NodePath} path
   * @param {string} name
   * @param {Required<ExplicitParentPluginOptions>} options
   * @returns {boolean}
   */
  function shouldTrace(path, name, options) {
    // Check marker on node
    if (path.node[TRACED_MARKER]) return false;
    
    // Check if we've already processed a node at this position
    const nodeKey = getNodeKey(path);
    if (nodeKey && processedNodes.has(nodeKey)) return false;
    
    // Skip IIFEs (TypeScript namespace/enum patterns)
    if (isIIFE(path)) {
      return false;
    }

    const comments = path.node.leadingComments || [];
    if (comments.some((c) => c.value.includes(options.skipDirective))) {
      return false;
    }

    if (options.skipFunctions.includes(name)) return false;

    const body = path.node.body;
    if (t.isBlockStatement(body) && body.body.length < options.minStatements) {
      return false;
    }

    return true;
  }

  /**
   * @param {import("@babel/traverse").NodePath} path
   * @returns {string}
   */
  function getFunctionName(path) {
    const node = path.node;

    if (t.isFunctionDeclaration(node) && node.id) {
      return node.id.name;
    }

    if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
      return path.parent.id.name;
    }

    if (t.isObjectProperty(path.parent) && t.isIdentifier(path.parent.key)) {
      return path.parent.key.name;
    }

    if (t.isClassMethod(path.parent) && t.isIdentifier(path.parent.key)) {
      return path.parent.key.name;
    }

    return "<anonymous>";
  }

  /**
   * @param {import("@babel/traverse").NodePath} path
   * @param {string | undefined} filename
   * @returns {string | null}
   */
  function getLocation(path, filename) {
    const loc = path.node.loc;
    if (!loc) return null;
    const file = filename ? filename.replace(/.*[/\\]/, "") : "unknown";
    return `${file}:${loc.start.line}`;
  }

  /**
   * @param {import("@babel/traverse").NodePath<import("@babel/types").Program>} programPath
   * @param {Required<ExplicitParentPluginOptions>} options
   * @returns {import("@babel/types").Identifier}
   */
  function ensureImport(programPath, options) {
    if (tracedId) return tracedId;

    tracedId = programPath.scope.generateUidIdentifier(options.tracedFn);

    const importDecl = t.importDeclaration(
      [t.importSpecifier(tracedId, t.identifier(options.tracedFn))],
      t.stringLiteral(options.tracingModule)
    );

    programPath.unshiftContainer("body", importDecl);
    return tracedId;
  }

  /**
   * Wrap function declaration.
   * @param {import("@babel/traverse").NodePath<import("@babel/types").FunctionDeclaration>} path
   * @param {import("@babel/traverse").NodePath<import("@babel/types").Program>} programPath
   * @param {Required<ExplicitParentPluginOptions>} options
   * @param {string | undefined} filename
   */
  function wrapFunctionDeclaration(path, programPath, options, filename) {
    const name = path.node.id?.name || "<anonymous>";

    if (!shouldTrace(path, name, options)) return;
    
    // Mark as processed
    path.node[TRACED_MARKER] = true;
    const nodeKey = getNodeKey(path);
    if (nodeKey) processedNodes.add(nodeKey);

    const importId = ensureImport(programPath, options);
    const location = options.includeLocation ? getLocation(path, filename) : null;

    // Add __parentSpan parameter
    const parentSpanParam = t.identifier("__parentSpan");
    path.node.params.push(parentSpanParam);

    // Create: traced(function foo(...) {...}, "foo", {}, meta)
    const funcExpr = t.functionExpression(
      path.node.id,
      path.node.params,
      path.node.body,
      path.node.generator,
      path.node.async
    );
    // Mark the new function expression to prevent re-processing
    funcExpr[TRACED_MARKER] = true;

    const metaArg = location
      ? t.objectExpression([
          t.objectProperty(t.identifier("description"), t.stringLiteral(location)),
        ])
      : t.identifier("undefined");

    const tracedCall = t.callExpression(importId, [
      funcExpr,
      t.stringLiteral(name),
      t.objectExpression([]), // empty payload
      metaArg,
    ]);

    // Check if this is an export default declaration
    const isExportDefault = t.isExportDefaultDeclaration(path.parent);
    
    if (isExportDefault) {
      // For: export default function foo() {}
      // Transform to: export default traced(function foo() {}, ...)
      path.replaceWith(tracedCall);
    } else {
      // Replace function declaration with const
      const varDecl = t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier(name), tracedCall),
      ]);
      path.replaceWith(varDecl);
    }
    
    // Stop traversal of the replaced node to prevent re-processing
    path.skip();
  }

  /**
   * Wrap arrow/function expression.
   * @param {import("@babel/traverse").NodePath} path
   * @param {import("@babel/traverse").NodePath<import("@babel/types").Program>} programPath
   * @param {Required<ExplicitParentPluginOptions>} options
   * @param {string | undefined} filename
   */
  function wrapFunctionExpression(path, programPath, options, filename) {
    const name = getFunctionName(path);

    if (!shouldTrace(path, name, options)) return;
    
    // Mark as processed
    path.node[TRACED_MARKER] = true;
    const nodeKey = getNodeKey(path);
    if (nodeKey) processedNodes.add(nodeKey);

    const importId = ensureImport(programPath, options);
    const location = options.includeLocation ? getLocation(path, filename) : null;

    // Add __parentSpan parameter
    const parentSpanParam = t.identifier("__parentSpan");
    path.node.params.push(parentSpanParam);

    // Ensure arrow has block body for consistency
    if (
      t.isArrowFunctionExpression(path.node) &&
      !t.isBlockStatement(path.node.body)
    ) {
      path.node.body = t.blockStatement([t.returnStatement(path.node.body)]);
    }

    const metaArg = location
      ? t.objectExpression([
          t.objectProperty(t.identifier("description"), t.stringLiteral(location)),
        ])
      : t.identifier("undefined");

    const tracedCall = t.callExpression(importId, [
      path.node,
      t.stringLiteral(name),
      t.objectExpression([]),
      metaArg,
    ]);

    path.replaceWith(tracedCall);
    
    // Stop traversal of the replaced node to prevent re-processing
    path.skip();
  }

  return {
    name: "explicit-parent-tracing-plugin",

    pre() {
      tracedId = null;
      processedNodes.clear();
    },

    visitor: {
      Program(programPath, state) {
        const options = getOptions(state.opts || {});
        const filename = state.filename;

        if (filename) {
          if (!options.include.test(filename)) return;
          if (options.exclude.test(filename)) return;
        }

        programPath.traverse({
          FunctionDeclaration(path) {
            wrapFunctionDeclaration(path, programPath, options, filename);
          },
          FunctionExpression(path) {
            wrapFunctionExpression(path, programPath, options, filename);
          },
          ArrowFunctionExpression(path) {
            wrapFunctionExpression(path, programPath, options, filename);
          },
        });
      },
    },
  };
};

// ESM compat
module.exports.default = module.exports;

