/**
 * Shared utilities for tracing Babel plugins.
 */

/**
 * Check if a node has a specific directive comment.
 * @param {import("@babel/types").Node} node
 * @param {string} directive
 * @returns {boolean}
 */
function hasDirective(node, directive) {
  const comments = node.leadingComments || [];
  return comments.some(
    (c) => c.value.includes(directive) || c.value.includes("@" + directive)
  );
}

/**
 * Get function name from path context.
 * @param {import("@babel/traverse").NodePath} path
 * @param {import("@babel/types")} types
 * @returns {string}
 */
function getFunctionName(path, types) {
  const node = path.node;

  // function foo() {}
  if (types.isFunctionDeclaration(node) && node.id) {
    return node.id.name;
  }

  // const foo = () => {} or const foo = function() {}
  if (
    types.isVariableDeclarator(path.parent) &&
    types.isIdentifier(path.parent.id)
  ) {
    return path.parent.id.name;
  }

  // { foo() {} } or { foo: () => {} }
  if (
    types.isObjectProperty(path.parent) &&
    types.isIdentifier(path.parent.key)
  ) {
    return path.parent.key.name;
  }

  if (types.isObjectMethod(path.parent) && types.isIdentifier(path.parent.key)) {
    return path.parent.key.name;
  }

  // class { foo() {} }
  if (types.isClassMethod(path.parent) && types.isIdentifier(path.parent.key)) {
    return path.parent.key.name;
  }

  // Class property: foo = () => {}
  if (
    types.isClassProperty(path.parent) &&
    types.isIdentifier(path.parent.key)
  ) {
    return path.parent.key.name;
  }

  // module.exports.foo = () => {}
  if (types.isAssignmentExpression(path.parent)) {
    if (types.isMemberExpression(path.parent.left)) {
      const prop = path.parent.left.property;
      if (types.isIdentifier(prop)) {
        return prop.name;
      }
    }
  }

  return "<anonymous>";
}

/**
 * Get source location as string.
 * @param {import("@babel/traverse").NodePath} path
 * @param {string | undefined} filename
 * @param {{ relativePath?: boolean }} [options]
 * @returns {string | null}
 */
function getLocation(path, filename, options = {}) {
  const loc = path.node.loc;
  if (!loc) return null;

  let file = "unknown";
  if (filename) {
    file = options.relativePath ? filename : filename.replace(/.*[/\\]/, "");
  }

  return `${file}:${loc.start.line}`;
}

/**
 * Check if function is a React component (starts with uppercase, returns JSX).
 * @param {import("@babel/traverse").NodePath} path
 * @param {import("@babel/types")} types
 * @returns {boolean}
 */
function isReactComponent(path, types) {
  const name = getFunctionName(path, types);

  // React components start with uppercase
  if (!/^[A-Z]/.test(name)) {
    return false;
  }

  // Check if body contains JSX
  let hasJSX = false;
  path.traverse({
    JSXElement() {
      hasJSX = true;
    },
    JSXFragment() {
      hasJSX = true;
    },
  });

  return hasJSX;
}

/**
 * Check if function is an event handler (starts with "on" or "handle").
 * @param {string} name
 * @returns {boolean}
 */
function isEventHandler(name) {
  return /^(on|handle)[A-Z]/.test(name);
}

/**
 * Check if this is a hook (starts with "use").
 * @param {string} name
 * @returns {boolean}
 */
function isHook(name) {
  return /^use[A-Z]/.test(name);
}

/**
 * Check if function should be skipped based on common patterns.
 * @param {string} name
 * @param {{ skipComponents?: boolean, skipHooks?: boolean, skipEventHandlers?: boolean, skipGetters?: boolean, skipSetters?: boolean }} [patterns]
 * @returns {boolean}
 */
function shouldSkipByPattern(name, patterns = {}) {
  if (patterns.skipHooks && isHook(name)) {
    return true;
  }

  if (patterns.skipEventHandlers && isEventHandler(name)) {
    return true;
  }

  if (patterns.skipGetters && /^get[A-Z]/.test(name)) {
    return true;
  }

  if (patterns.skipSetters && /^set[A-Z]/.test(name)) {
    return true;
  }

  return false;
}

module.exports = {
  hasDirective,
  getFunctionName,
  getLocation,
  isReactComponent,
  isEventHandler,
  isHook,
  shouldSkipByPattern,
};

