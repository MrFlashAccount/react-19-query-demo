import path from "path";
import { readdir, readFile } from "fs/promises";
import { parse, type ParserPlugin } from "@babel/parser";
import {
  createFilter,
  normalizePath,
  type FilterPattern,
  type Plugin,
  type ResolvedConfig,
  type UserConfig,
} from "vite";

const DEFAULT_DIRECTIVES = ["use main", "use client"] as const;
const DEFAULT_WORKER_DIRECTIVES = ["use worker"] as const;
const DEFAULT_MAIN_VIRTUAL_ID = "virtual:rsc-prism/main-thread-modules";
const RESOLVED_MAIN_VIRTUAL_ID = "\0rsc-prism:main-thread-modules";
const WORKER_PROXY_VIRTUAL_ID_PREFIX = "\0rsc-prism:worker-proxy:";
const MAIN_WORKER_REF_VIRTUAL_ID_PREFIX = "\0rsc-prism:main-worker-ref:";

const SUPPORTED_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".turbo",
  ".sw-cache",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
]);

const IDENTIFIER_PATTERN = /^[$A-Z_][0-9A-Z_$]*$/i;
const PARSER_PLUGINS: ParserPlugin[] = ["jsx", "typescript", "importAttributes", "decorators-legacy"];

interface ParsedDirective {
  value?: { value?: string };
}

interface ParsedNode {
  type?: string;
  [key: string]: unknown;
}

interface ParsedProgram {
  directives?: ParsedDirective[];
  body: ParsedNode[];
}

interface ParsedFile {
  program: ParsedProgram;
}

interface ParsedModuleExports {
  hasDefault: boolean;
  named: string[];
}

interface MainThreadModuleEntry {
  moduleId: string;
  importPath: string;
}

export interface RscPrismVitePluginOptions {
  mode: "main" | "worker";
  directives?: Array<(typeof DEFAULT_DIRECTIVES)[number]>;
  workerDirectives?: Array<(typeof DEFAULT_WORKER_DIRECTIVES)[number]>;
  include?: FilterPattern;
  exclude?: FilterPattern;
  mainVirtualId?: string;
  moduleId?: (absolutePath: string, config: ResolvedConfig) => string;
}

function isSupportedFile(absolutePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(absolutePath));
}

function normalizeModuleId(absolutePath: string, config: ResolvedConfig): string {
  const relativePath = path.relative(config.root, absolutePath);
  if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return normalizePath(relativePath);
  }

  return normalizePath(absolutePath);
}

function toAbsolutePath(id: string): string {
  const resolved = id.split("?", 1)[0]!;
  if (resolved.startsWith("/@fs/")) {
    return resolved.slice(4);
  }
  return resolved;
}

function dedupeItems<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function toArray(value: string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function parseModule(code: string, id: string): ParsedFile {
  return parse(code, {
    sourceType: "module",
    sourceFilename: id,
    plugins: PARSER_PLUGINS,
  }) as unknown as ParsedFile;
}

function hasDirective(ast: ParsedFile, directives: Set<string>): boolean {
  const astDirectives = ast.program.directives ?? [];
  if (
    astDirectives.some((directive) => {
      const value = directive.value?.value;
      return typeof value === "string" && directives.has(value);
    })
  ) {
    return true;
  }

  // Vite dev transforms can prepend imports/HMR code before directive literals,
  // causing Babel to stop populating program.directives. Fall back to scanning
  // top-level string literal expression statements.
  return ast.program.body.some((statement) => {
    if (statement.type !== "ExpressionStatement") {
      return false;
    }

    const expression = (statement as { expression?: unknown }).expression;
    if (typeof expression !== "object" || expression == null) {
      return false;
    }

    const literal = expression as { type?: string; value?: string };
    if (literal.type !== "StringLiteral" || typeof literal.value !== "string") {
      return false;
    }

    return directives.has(literal.value);
  });
}

function assertNamedExportIdentifier(name: string, id: string): void {
  if (!IDENTIFIER_PATTERN.test(name) || name === "default") {
    throw new Error(
      `[rsc-prism] Unsupported export name "${name}" in "${id}". "use main"/"use client" modules must use standard named/default exports.`,
    );
  }
}

function readExportedName(value: unknown): string | null {
  if (typeof value !== "object" || value == null) {
    return null;
  }

  const node = value as { type?: string; name?: string; value?: string };
  if (node.type === "Identifier" && typeof node.name === "string") {
    return node.name;
  }
  if (node.type === "StringLiteral" && typeof node.value === "string") {
    return node.value;
  }

  return null;
}

function pushBindingNames(target: Set<string>, pattern: unknown): void {
  if (typeof pattern !== "object" || pattern == null) {
    return;
  }

  const node = pattern as { type?: string; name?: string; properties?: unknown[]; elements?: unknown[]; argument?: unknown; left?: unknown };

  if (node.type === "Identifier" && typeof node.name === "string") {
    target.add(node.name);
    return;
  }

  if (node.type === "ObjectPattern") {
    for (const property of node.properties ?? []) {
      if (typeof property !== "object" || property == null) continue;
      const propertyNode = property as { type?: string; value?: unknown; argument?: unknown };
      if (propertyNode.type === "RestElement") {
        pushBindingNames(target, propertyNode.argument);
      } else {
        pushBindingNames(target, propertyNode.value);
      }
    }
    return;
  }

  if (node.type === "ArrayPattern") {
    for (const element of node.elements ?? []) {
      pushBindingNames(target, element);
    }
    return;
  }

  if (node.type === "AssignmentPattern") {
    pushBindingNames(target, node.left);
    return;
  }

  if (node.type === "RestElement") {
    pushBindingNames(target, node.argument);
  }
}

function collectRuntimeExports(ast: ParsedFile, id: string): ParsedModuleExports {
  const named = new Set<string>();
  let hasDefault = false;

  for (const statement of ast.program.body) {
    if (statement.type === "ExportAllDeclaration") {
      throw new Error(
        `[rsc-prism] Unsupported "export *" in "${id}". "use main"/"use client" modules must use explicit exports.`,
      );
    }

    if (statement.type === "ExportDefaultDeclaration") {
      const declaration = statement.declaration as { type?: string } | undefined;
      if (declaration?.type !== "TSInterfaceDeclaration" && declaration?.type !== "TSTypeAliasDeclaration") {
        hasDefault = true;
      }
      continue;
    }

    if (statement.type !== "ExportNamedDeclaration") {
      continue;
    }

    const exportStatement = statement as {
      exportKind?: string;
      declaration?: ParsedNode;
      specifiers?: Array<{
        type?: string;
        exportKind?: string;
        exported?: unknown;
      }>;
    };

    if (exportStatement.exportKind === "type") {
      continue;
    }

    const declaration = exportStatement.declaration;
    if (declaration != null) {
      switch (declaration.type) {
        case "FunctionDeclaration":
        case "ClassDeclaration":
        case "TSEnumDeclaration": {
          const declarationName = readExportedName((declaration as { id?: unknown }).id);
          if (declarationName != null) {
            assertNamedExportIdentifier(declarationName, id);
            named.add(declarationName);
          }
          break;
        }
        case "VariableDeclaration": {
          const declarations = (declaration as { declarations?: Array<{ id?: unknown }> }).declarations ?? [];
          for (const declarator of declarations) {
            const names = new Set<string>();
            pushBindingNames(names, declarator.id);
            for (const name of names) {
              assertNamedExportIdentifier(name, id);
              named.add(name);
            }
          }
          break;
        }
        default:
          break;
      }
    }

    for (const specifier of exportStatement.specifiers ?? []) {
      if (specifier.exportKind === "type") {
        continue;
      }

      const exported = readExportedName(specifier.exported);
      if (exported == null) {
        continue;
      }

      if (exported === "default") {
        hasDefault = true;
        continue;
      }

      assertNamedExportIdentifier(exported, id);
      named.add(exported);
    }
  }

  return {
    hasDefault,
    named: [...named],
  };
}

function buildWorkerProxyModuleCode(
  moduleId: string,
  exportsInfo: ParsedModuleExports,
): string {
  const lines: string[] = [];
  lines.push('import { registerAutoClientManifestEntry } from "@lib/rsc-prism/runtime/client-manifest";');
  lines.push("");
  lines.push('const __rscPrismClientReferenceSymbol = Symbol.for("react.client.reference");');
  lines.push(`const __rscPrismModuleId = ${JSON.stringify(moduleId)};`);
  lines.push(
    "const __rscPrismCreateClientRef = (id) => ({ $$typeof: __rscPrismClientReferenceSymbol, $$id: id, $$async: false });",
  );
  lines.push("");
  if (exportsInfo.hasDefault) {
    lines.push('registerAutoClientManifestEntry(__rscPrismModuleId, "default");');
    lines.push(`const __rscPrismDefault = __rscPrismCreateClientRef(${JSON.stringify(`${moduleId}#default`)});`);
    lines.push("export default __rscPrismDefault;");
  }
  exportsInfo.named.forEach((name, index) => {
    const localName = `__rscPrismExport${index}`;
    lines.push(`registerAutoClientManifestEntry(__rscPrismModuleId, ${JSON.stringify(name)});`);
    lines.push(`const ${localName} = __rscPrismCreateClientRef(${JSON.stringify(`${moduleId}#${name}`)});`);
    lines.push(`export { ${localName} as ${name} };`);
  });
  if (!exportsInfo.hasDefault && exportsInfo.named.length === 0) {
    lines.push("export {};");
  }

  return `${lines.join("\n")}\n`;
}

interface ParsedDirectiveModule {
  isDirectiveModule: boolean;
  type?: "main" | "worker";
  exportsInfo?: ParsedModuleExports;
}

function resolveDirectiveModuleType(
  ast: ParsedFile,
  mainDirectives: Set<string>,
  workerDirectives: Set<string>,
): "main" | "worker" | null {
  const hasMainDirective = hasDirective(ast, mainDirectives);
  const hasWorkerDirective = hasDirective(ast, workerDirectives);

  if (hasMainDirective && hasWorkerDirective) {
    throw new Error(
      '[rsc-prism] A module cannot mix "use worker" with "use main"/"use client". Pick a single execution directive.',
    );
  }

  if (hasMainDirective) {
    return "main";
  }

  if (hasWorkerDirective) {
    return "worker";
  }

  return null;
}

function buildMainWorkerReferenceModuleCode(moduleId: string, exportsInfo: ParsedModuleExports): string {
  const lines: string[] = [];
  lines.push('const __rscPrismWorkerReferenceSymbol = Symbol.for("rsc.worker.reference");');
  lines.push(`const __rscPrismModuleId = ${JSON.stringify(moduleId)};`);
  lines.push("const __rscPrismWorkerReferenceMap = {};");
  lines.push(
    'const __rscPrismCreateWorkerRef = (name) => { const ref = function() { throw new Error("[rsc-prism] Worker component references cannot render on the main thread. Pass the imported symbol to fetchRSC(...)."); }; ref.$$typeof = __rscPrismWorkerReferenceSymbol; ref.$$id = `${__rscPrismModuleId}#${name}`; ref.$$moduleId = __rscPrismModuleId; ref.$$name = name; return ref; };',
  );
  lines.push("");

  if (exportsInfo.hasDefault) {
    lines.push('const __rscPrismDefault = __rscPrismCreateWorkerRef("default");');
    lines.push('__rscPrismWorkerReferenceMap["default"] = __rscPrismDefault;');
    lines.push("export default __rscPrismDefault;");
  }

  exportsInfo.named.forEach((name, index) => {
    const localName = `__rscPrismWorkerExport${index}`;
    lines.push(`const ${localName} = __rscPrismCreateWorkerRef(${JSON.stringify(name)});`);
    lines.push(`__rscPrismWorkerReferenceMap[${JSON.stringify(name)}] = ${localName};`);
    lines.push(`export { ${localName} as ${name} };`);
  });

  lines.push("export { __rscPrismWorkerReferenceMap };");
  if (!exportsInfo.hasDefault && exportsInfo.named.length === 0) {
    lines.push("export {};");
  }

  return `${lines.join("\n")}\n`;
}

function shouldSkipDirectory(name: string): boolean {
  return SKIPPED_DIRECTORIES.has(name);
}

async function collectMainThreadModules(
  root: string,
  filter: (id: string) => boolean,
  directives: Set<string>,
  mapModuleId: (absolutePath: string) => string,
): Promise<MainThreadModuleEntry[]> {
  const collected: MainThreadModuleEntry[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile() || !isSupportedFile(absolutePath) || !filter(absolutePath)) {
        continue;
      }

      const code = await readFile(absolutePath, "utf8");
      const ast = parseModule(code, absolutePath);
      if (!hasDirective(ast, directives)) {
        continue;
      }

      collected.push({
        moduleId: mapModuleId(absolutePath),
        importPath: `/${normalizePath(path.relative(root, absolutePath))}`,
      });
    }
  }

  await visit(root);

  const deduped = new Map<string, MainThreadModuleEntry>();
  for (const entry of collected) {
    if (!deduped.has(entry.moduleId)) {
      deduped.set(entry.moduleId, entry);
    }
  }

  return [...deduped.values()].sort((left, right) => left.moduleId.localeCompare(right.moduleId));
}

function buildMainVirtualModuleCode(modules: MainThreadModuleEntry[]): string {
  const lines: string[] = [];
  lines.push('import { registerClientModule } from "@lib/rsc-prism/runtime/module-registry";');
  lines.push("");

  modules.forEach((entry, index) => {
    const importName = `__rscPrismModule${index}`;
    lines.push(`import * as ${importName} from ${JSON.stringify(entry.importPath)};`);
    lines.push(`registerClientModule(${JSON.stringify(entry.moduleId)}, ${importName});`);
  });

  lines.push("");
  lines.push("export {};");
  return `${lines.join("\n")}\n`;
}

export function rscPrism(options: RscPrismVitePluginOptions): Plugin {
  const mainDirectives = new Set(options.directives ?? DEFAULT_DIRECTIVES);
  const workerDirectives = new Set(options.workerDirectives ?? DEFAULT_WORKER_DIRECTIVES);
  const includeFilter = createFilter(options.include, options.exclude);
  const virtualId = options.mainVirtualId ?? DEFAULT_MAIN_VIRTUAL_ID;

  let config: ResolvedConfig | null = null;
  const parsedDirectiveModules = new Map<string, ParsedDirectiveModule>();

  const mapModuleId = (absolutePath: string): string => {
    if (config == null) {
      return normalizePath(absolutePath);
    }

    if (options.moduleId != null) {
      return options.moduleId(absolutePath, config);
    }

    return normalizeModuleId(absolutePath, config);
  };

  const shouldProcessFile = (id: string): boolean => {
    if (id.startsWith("\0")) {
      return false;
    }

    const absolutePath = toAbsolutePath(id);
    return isSupportedFile(absolutePath) && includeFilter(absolutePath);
  };

  const toProjectFilePath = (id: string): string => {
    const absolutePath = toAbsolutePath(id);
    if (config == null || !absolutePath.startsWith("/") || absolutePath.startsWith(config.root)) {
      return absolutePath;
    }

    // Vite can report resolved ids as root-relative URLs in dev (e.g. "/src/file.tsx").
    // Map those back to disk paths for directive parsing.
    if (
      absolutePath.startsWith("/node_modules/") ||
      absolutePath.startsWith("/Users/") ||
      absolutePath.startsWith("/private/") ||
      absolutePath.startsWith("/tmp/") ||
      absolutePath.startsWith("/var/") ||
      absolutePath.startsWith("/home/")
    ) {
      return absolutePath;
    }

    return path.join(config.root, absolutePath.slice(1));
  };

  const parseDirectiveModule = async (absolutePath: string): Promise<ParsedDirectiveModule> => {
    const cached = parsedDirectiveModules.get(absolutePath);
    if (cached != null) {
      return cached;
    }

    const source = await readFile(absolutePath, "utf8");
    const ast = parseModule(source, absolutePath);
    const directiveType = resolveDirectiveModuleType(ast, mainDirectives, workerDirectives);
    if (directiveType == null) {
      const result: ParsedDirectiveModule = { isDirectiveModule: false };
      parsedDirectiveModules.set(absolutePath, result);
      return result;
    }

    const result: ParsedDirectiveModule = {
      isDirectiveModule: true,
      type: directiveType,
      exportsInfo: collectRuntimeExports(ast, absolutePath),
    };
    parsedDirectiveModules.set(absolutePath, result);
    return result;
  };

  return {
    name: "rsc-prism",
    enforce: "pre",
    config() {
      return null;
    },
    configEnvironment(name, userConfig, env) {
      if (options.mode === "main" && name !== "worker") {
        const excludeDeps = dedupeItems([
          ...toArray(userConfig.optimizeDeps?.exclude),
          "react-server-dom-webpack/server",
          "react-server-dom-webpack/server.browser",
        ]);

        return {
          optimizeDeps: {
            exclude: excludeDeps,
          },
        };
      }

      if (options.mode !== "worker" || name !== "worker") {
        return null;
      }

      const existingConditions = toArray(userConfig.resolve?.conditions);
      const modeCondition = env.mode;

      const aliases: NonNullable<UserConfig["resolve"]>["alias"] extends infer T ? Exclude<T, undefined> : never = [
        { find: "react-server-dom-webpack/server", replacement: "react-server-dom-webpack/server.browser" },
        { find: "react-server-dom-webpack/client", replacement: "react-server-dom-webpack/client.browser" },
      ];

      const excludeDeps = dedupeItems([
        ...toArray(userConfig.optimizeDeps?.exclude),
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-server-dom-webpack/server",
        "react-server-dom-webpack/server.browser",
        "react-server-dom-webpack/client",
        "react-server-dom-webpack/client.browser",
      ]);

      return {
        resolve: {
          alias: aliases,
          conditions: dedupeItems([
            ...existingConditions,
            modeCondition,
            "react-server",
            "browser",
            "import",
            "default",
          ].filter((condition): condition is string => typeof condition === "string" && condition.length > 0)),
        },
        optimizeDeps: {
          exclude: excludeDeps,
        },
      };
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    transformIndexHtml(html) {
      if (options.mode !== "main") {
        return undefined;
      }

      if (html.includes(virtualId) || html.includes(RESOLVED_MAIN_VIRTUAL_ID)) {
        return undefined;
      }

      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              type: "module",
              src: `/@id/${virtualId}`,
            },
            injectTo: "head-prepend",
          },
        ],
      };
    },
    async resolveId(id, importer) {
      if (options.mode === "main" && id === virtualId) {
        return RESOLVED_MAIN_VIRTUAL_ID;
      }
      if (importer == null || id.startsWith("\0")) {
        return null;
      }

      const resolved = await this.resolve(id, importer, { skipSelf: true });
      if (resolved == null) {
        return null;
      }

      const absolutePath = toProjectFilePath(resolved.id);
      if (!shouldProcessFile(absolutePath)) {
        return null;
      }

      try {
        const directiveModule = await parseDirectiveModule(absolutePath);
        if (!directiveModule.isDirectiveModule || directiveModule.type == null) {
          return null;
        }
        if (options.mode === "worker") {
          if (directiveModule.type !== "main") {
            return null;
          }
          return `${WORKER_PROXY_VIRTUAL_ID_PREFIX}${normalizePath(absolutePath)}`;
        }

        if (directiveModule.type !== "worker") {
          return null;
        }
        return `${MAIN_WORKER_REF_VIRTUAL_ID_PREFIX}${normalizePath(absolutePath)}`;
      } catch {
        return null;
      }
    },
    async load(id) {
      const workerProxyBaseId = id.split("?", 1)[0]!;
      if (options.mode === "worker" && workerProxyBaseId.startsWith(WORKER_PROXY_VIRTUAL_ID_PREFIX)) {
        const absolutePath = workerProxyBaseId.slice(WORKER_PROXY_VIRTUAL_ID_PREFIX.length);
        const directiveModule = await parseDirectiveModule(absolutePath);
        if (!directiveModule.isDirectiveModule || directiveModule.type !== "main" || directiveModule.exportsInfo == null) {
          throw new Error(`[rsc-prism] Worker proxy requested for non-directive module "${absolutePath}".`);
        }
        const moduleId = mapModuleId(absolutePath);
        return buildWorkerProxyModuleCode(moduleId, directiveModule.exportsInfo);
      }

      if (options.mode === "main" && id.startsWith(MAIN_WORKER_REF_VIRTUAL_ID_PREFIX)) {
        const absolutePath = id.slice(MAIN_WORKER_REF_VIRTUAL_ID_PREFIX.length);
        const directiveModule = await parseDirectiveModule(absolutePath);
        if (!directiveModule.isDirectiveModule || directiveModule.type !== "worker" || directiveModule.exportsInfo == null) {
          throw new Error(`[rsc-prism] Main worker reference requested for non-worker module "${absolutePath}".`);
        }
        const moduleId = mapModuleId(absolutePath);
        return buildMainWorkerReferenceModuleCode(moduleId, directiveModule.exportsInfo);
      }

      if (options.mode !== "main" || id !== RESOLVED_MAIN_VIRTUAL_ID) {
        return null;
      }

      if (config == null) {
        throw new Error("[rsc-prism] Vite config is not resolved yet.");
      }

      const modules = await collectMainThreadModules(
        config.root,
        includeFilter,
        mainDirectives,
        mapModuleId,
      );
      return buildMainVirtualModuleCode(modules);
    },
    transform(code, id) {
      if (!shouldProcessFile(id)) {
        return null;
      }

      const absolutePath = toAbsolutePath(id);
      const projectFilePath = toProjectFilePath(absolutePath);
      const ast = parseModule(code, absolutePath);
      const directiveType = resolveDirectiveModuleType(ast, mainDirectives, workerDirectives);
      if (directiveType == null) {
        return null;
      }

      const exportsInfo = collectRuntimeExports(ast, absolutePath);
      const moduleId = mapModuleId(projectFilePath);
      let transformedCode: string | null = null;

      if (options.mode === "worker" && directiveType === "main") {
        transformedCode = buildWorkerProxyModuleCode(moduleId, exportsInfo);
      }

      if (options.mode === "main" && directiveType === "worker") {
        transformedCode = buildMainWorkerReferenceModuleCode(moduleId, exportsInfo);
      }

      if (transformedCode == null) {
        return null;
      }

      return {
        code: transformedCode,
        map: { mappings: "" },
      };
    },
    handleHotUpdate(context) {
      parsedDirectiveModules.delete(normalizePath(context.file));
      parsedDirectiveModules.delete(context.file);
    },
  };
}
