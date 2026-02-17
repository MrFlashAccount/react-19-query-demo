import path from "path";
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { parse, type ParserPlugin } from "@babel/parser";
import {
  createFilter,
  normalizePath,
  type FilterPattern,
  type Plugin,
  type ResolvedConfig,
  type UserConfig,
} from "vite";
import { build as viteBuild } from "vite";
import react from "@vitejs/plugin-react";
import {
  MAIN_THREAD_MODULES_GLOBAL_KEY,
  WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY,
} from "./runtime-globals";

const DEFAULT_DIRECTIVES = ["use main", "use client"] as const;
const DEFAULT_WORKER_DIRECTIVES = ["use worker"] as const;
const WORKER_ACTION_DIRECTIVE = "use worker";
const INTERNAL_WORKER_RUNTIME_ASSET_NAME = "rsc-prism-worker-runtime";
const DEFAULT_MAIN_VIRTUAL_ID = "virtual:rsc-prism/main-thread-modules";
const RESOLVED_MAIN_VIRTUAL_ID = "\0rsc-prism:main-thread-modules";
const DEFAULT_WORKER_BOOTSTRAP_VIRTUAL_ID = "virtual:rsc-prism/worker-bootstrap";
const RESOLVED_WORKER_BOOTSTRAP_VIRTUAL_ID = "\0rsc-prism:worker-bootstrap";
const WORKER_PROXY_VIRTUAL_ID_PREFIX = "\0rsc-prism:worker-proxy:";
const MAIN_WORKER_REF_VIRTUAL_ID_PREFIX = "\0rsc-prism:main-worker-ref:";
const MAIN_WORKER_ACTION_REF_VIRTUAL_ID_PREFIX = "\0rsc-prism:main-worker-action-ref:";

const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".turbo",
  ".sw-cache",
  ".vite",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
]);

const IDENTIFIER_PATTERN = /^[$A-Z_][0-9A-Z_$]*$/i;
const PARSER_PLUGINS: ParserPlugin[] = [
  "jsx",
  "typescript",
  "importAttributes",
  "decorators-legacy",
];

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
  actionExports: string[];
}

interface MainThreadModuleEntry {
  moduleId: string;
  importPath: string;
  exportsInfo: ParsedModuleExports;
}

interface WorkerRuntimeModuleEntry extends MainThreadModuleEntry {
  exportsInfo: ParsedModuleExports;
  isWorkerDirectiveModule: boolean;
}

export interface RscPrismWorkerRuntimeOptions {
  enabled?: boolean;
  endpoint?: string;
  outDir?: string;
  aliases?: NonNullable<UserConfig["resolve"]>["alias"];
}

export interface RscPrismVitePluginOptions {
  directives?: Array<(typeof DEFAULT_DIRECTIVES)[number]>;
  workerDirectives?: Array<(typeof DEFAULT_WORKER_DIRECTIVES)[number]>;
  include?: FilterPattern;
  exclude?: FilterPattern;
  mainVirtualId?: string;
  workerBootstrapVirtualId?: string;
  workerRuntime?: RscPrismWorkerRuntimeOptions;
  moduleId?: (absolutePath: string, config: ResolvedConfig) => string;
}

interface RscPrismInternalPluginOptions extends RscPrismVitePluginOptions {
  mode: "main" | "worker";
}

function isSupportedFile(absolutePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(absolutePath));
}

function normalizeModuleId(absolutePath: string, config: ResolvedConfig): string {
  const relativePath = path.relative(config.root, absolutePath);
  if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return `/${normalizePath(relativePath)}`;
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

function normalizeAliases(
  aliases: NonNullable<UserConfig["resolve"]>["alias"] | undefined,
): Array<{ find: string | RegExp; replacement: string }> {
  if (aliases == null) {
    return [];
  }
  const aliasArray = Array.isArray(aliases) ? aliases : [aliases];
  return aliasArray
    .map((entry) => {
      if (entry == null || typeof entry !== "object") return null;
      const aliasEntry = entry as { find?: string | RegExp; replacement?: string };
      if (aliasEntry.find == null || typeof aliasEntry.replacement !== "string") {
        return null;
      }
      return {
        find: aliasEntry.find,
        replacement: aliasEntry.replacement,
      };
    })
    .filter((entry): entry is { find: string | RegExp; replacement: string } => entry != null);
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

function sourceContainsDirectiveLiteral(source: string, directive: string): boolean {
  return source.includes(`"${directive}"`) || source.includes(`'${directive}'`);
}

function sourceContainsAnyDirectiveLiteral(source: string, directives: Set<string>): boolean {
  for (const directive of directives) {
    if (sourceContainsDirectiveLiteral(source, directive)) {
      return true;
    }
  }
  return false;
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

  const node = pattern as {
    type?: string;
    name?: string;
    properties?: unknown[];
    elements?: unknown[];
    argument?: unknown;
    left?: unknown;
  };

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

function hasWorkerActionFunctionDirective(node: unknown): boolean {
  if (typeof node !== "object" || node == null) {
    return false;
  }
  const body = (node as { body?: unknown }).body;
  if (typeof body !== "object" || body == null) {
    return false;
  }
  const bodyNode = body as { type?: string; body?: ParsedNode[]; directives?: ParsedDirective[] };
  if (bodyNode.type !== "BlockStatement") {
    return false;
  }

  const directives = bodyNode.directives ?? [];
  if (directives.length > 0) {
    const firstDirective = directives[0];
    return firstDirective?.value?.value === "use worker";
  }

  const statements = bodyNode.body ?? [];
  if (statements.length === 0) {
    return false;
  }
  const firstStatement = statements[0];
  if (firstStatement?.type !== "ExpressionStatement") {
    return false;
  }
  const expression = (firstStatement as { expression?: unknown }).expression;
  if (typeof expression !== "object" || expression == null) {
    return false;
  }
  const literal = expression as { type?: string; value?: string };
  return literal.type === "StringLiteral" && literal.value === "use worker";
}

function collectLocalActionBindings(ast: ParsedFile): Set<string> {
  const actionBindings = new Set<string>();
  for (const statement of ast.program.body) {
    if (statement.type === "FunctionDeclaration") {
      const functionName = readExportedName((statement as { id?: unknown }).id);
      if (functionName != null && hasWorkerActionFunctionDirective(statement)) {
        actionBindings.add(functionName);
      }
      continue;
    }

    if (statement.type !== "VariableDeclaration") {
      continue;
    }

    const declarations =
      (statement as { declarations?: Array<{ id?: unknown; init?: unknown }> }).declarations ?? [];
    for (const declarator of declarations) {
      if (!hasWorkerActionFunctionDirective(declarator.init)) {
        continue;
      }
      const names = new Set<string>();
      pushBindingNames(names, declarator.id);
      for (const name of names) {
        actionBindings.add(name);
      }
    }
  }
  return actionBindings;
}

function collectRuntimeExports(ast: ParsedFile, id: string): ParsedModuleExports {
  const named = new Set<string>();
  const actionExports = new Set<string>();
  const localActionBindings = collectLocalActionBindings(ast);
  let hasDefault = false;

  for (const statement of ast.program.body) {
    if (statement.type === "ExportAllDeclaration") {
      throw new Error(
        `[rsc-prism] Unsupported "export *" in "${id}". "use main"/"use client" modules must use explicit exports.`,
      );
    }

    if (statement.type === "ExportDefaultDeclaration") {
      const declaration = statement.declaration as { type?: string } | undefined;
      if (
        declaration?.type !== "TSInterfaceDeclaration" &&
        declaration?.type !== "TSTypeAliasDeclaration"
      ) {
        hasDefault = true;
        if (hasWorkerActionFunctionDirective(statement.declaration)) {
          actionExports.add("default");
        }
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
            if (
              declaration.type === "FunctionDeclaration" &&
              hasWorkerActionFunctionDirective(declaration)
            ) {
              actionExports.add(declarationName);
            }
          }
          break;
        }
        case "VariableDeclaration": {
          const declarations =
            (declaration as { declarations?: Array<{ id?: unknown }> }).declarations ?? [];
          for (const declarator of declarations) {
            const names = new Set<string>();
            pushBindingNames(names, declarator.id);
            for (const name of names) {
              assertNamedExportIdentifier(name, id);
              named.add(name);
              if (localActionBindings.has(name)) {
                actionExports.add(name);
              }
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
        const localName = readExportedName((specifier as { local?: unknown }).local);
        if (localName != null && localActionBindings.has(localName)) {
          actionExports.add("default");
        }
        continue;
      }

      assertNamedExportIdentifier(exported, id);
      named.add(exported);
      const localName = readExportedName((specifier as { local?: unknown }).local);
      if (localName != null && localActionBindings.has(localName)) {
        actionExports.add(exported);
      }
    }
  }

  return {
    hasDefault,
    named: [...named],
    actionExports: [...actionExports],
  };
}

function buildWorkerProxyModuleCode(moduleId: string, exportsInfo: ParsedModuleExports): string {
  const lines: string[] = [];
  lines.push('const __rscPrismClientReferenceSymbol = Symbol.for("react.client.reference");');
  lines.push(`const __rscPrismModuleId = ${JSON.stringify(moduleId)};`);
  lines.push(
    "const __rscPrismCreateClientRef = (id) => ({ $$typeof: __rscPrismClientReferenceSymbol, $$id: id });",
  );
  lines.push("");
  if (exportsInfo.hasDefault) {
    lines.push(
      `const __rscPrismDefault = __rscPrismCreateClientRef(${JSON.stringify(`${moduleId}#default`)});`,
    );
    lines.push("export default __rscPrismDefault;");
  }
  exportsInfo.named.forEach((name, index) => {
    const localName = `__rscPrismExport${index}`;
    lines.push(
      `const ${localName} = __rscPrismCreateClientRef(${JSON.stringify(`${moduleId}#${name}`)});`,
    );
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
  hasWorkerActionExports?: boolean;
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

function buildMainWorkerReferenceModuleCode(
  moduleId: string,
  exportsInfo: ParsedModuleExports,
): string {
  const lines: string[] = [];
  const actionExports = new Set(exportsInfo.actionExports);
  lines.push('const __rscPrismWorkerReferenceSymbol = Symbol.for("rsc.worker.reference");');
  lines.push('const __rscPrismServerReferenceSymbol = Symbol.for("react.server.reference");');
  lines.push(`const __rscPrismModuleId = ${JSON.stringify(moduleId)};`);
  lines.push("const __rscPrismWorkerReferenceMap = {};");
  lines.push("const __rscPrismActionReferenceMap = {};");
  lines.push(
    'const __rscPrismCreateWorkerRef = (name) => { const ref = function() { throw new Error("[rsc-prism] Worker component references cannot render on the main thread. Pass the imported symbol to fetchRSC(...)."); }; ref.$$typeof = __rscPrismWorkerReferenceSymbol; ref.$$id = `${__rscPrismModuleId}#${name}`; ref.$$moduleId = __rscPrismModuleId; ref.$$name = name; return ref; };',
  );
  lines.push(
    'const __rscPrismCreateActionRef = (name) => { const ref = function() { throw new Error("[rsc-prism] Worker action references cannot execute on the main thread directly. Use callAction(actionRef, args)."); }; ref.$$typeof = __rscPrismServerReferenceSymbol; ref.$$id = `${__rscPrismModuleId}#${name}`; ref.$$bound = null; return ref; };',
  );
  lines.push("");

  if (exportsInfo.hasDefault) {
    const defaultRefFactory = actionExports.has("default")
      ? "__rscPrismCreateActionRef"
      : "__rscPrismCreateWorkerRef";
    lines.push(`const __rscPrismDefault = ${defaultRefFactory}("default");`);
    if (actionExports.has("default")) {
      lines.push('__rscPrismActionReferenceMap["default"] = __rscPrismDefault;');
    } else {
      lines.push('__rscPrismWorkerReferenceMap["default"] = __rscPrismDefault;');
    }
    lines.push("export default __rscPrismDefault;");
  }

  exportsInfo.named.forEach((name, index) => {
    const localName = `__rscPrismWorkerExport${index}`;
    const refFactory = actionExports.has(name)
      ? "__rscPrismCreateActionRef"
      : "__rscPrismCreateWorkerRef";
    lines.push(`const ${localName} = ${refFactory}(${JSON.stringify(name)});`);
    if (actionExports.has(name)) {
      lines.push(`__rscPrismActionReferenceMap[${JSON.stringify(name)}] = ${localName};`);
    } else {
      lines.push(`__rscPrismWorkerReferenceMap[${JSON.stringify(name)}] = ${localName};`);
    }
    lines.push(`export { ${localName} as ${name} };`);
  });

  lines.push("export { __rscPrismWorkerReferenceMap };");
  lines.push("export { __rscPrismActionReferenceMap };");
  if (!exportsInfo.hasDefault && exportsInfo.named.length === 0) {
    lines.push("export {};");
  }

  return `${lines.join("\n")}\n`;
}

function buildMainWorkerActionReferenceModuleCode(
  moduleId: string,
  exportsInfo: ParsedModuleExports,
): string {
  const lines: string[] = [];
  const actionExports = new Set(exportsInfo.actionExports);
  const nonActionExports: string[] = [];
  if (exportsInfo.hasDefault && !actionExports.has("default")) {
    nonActionExports.push("default");
  }
  for (const namedExport of exportsInfo.named) {
    if (!actionExports.has(namedExport)) {
      nonActionExports.push(namedExport);
    }
  }
  if (nonActionExports.length > 0) {
    throw new Error(
      `[rsc-prism] Modules that export function-level "use worker" actions for main-thread imports must only export actions. Non-action exports in "${moduleId}": ${nonActionExports.join(", ")}.`,
    );
  }
  lines.push('const __rscPrismServerReferenceSymbol = Symbol.for("react.server.reference");');
  lines.push(`const __rscPrismModuleId = ${JSON.stringify(moduleId)};`);
  lines.push(
    'const __rscPrismCreateActionRef = (name) => { const ref = function() { throw new Error("[rsc-prism] Worker action references cannot execute on the main thread directly. Use callAction(actionRef, args)."); }; ref.$$typeof = __rscPrismServerReferenceSymbol; ref.$$id = `${__rscPrismModuleId}#${name}`; ref.$$bound = null; return ref; };',
  );
  lines.push("");

  if (actionExports.has("default")) {
    lines.push('const __rscPrismDefault = __rscPrismCreateActionRef("default");');
    lines.push("export default __rscPrismDefault;");
  }

  exportsInfo.named.forEach((name, index) => {
    if (!actionExports.has(name)) {
      return;
    }
    const localName = `__rscPrismActionExport${index}`;
    lines.push(`const ${localName} = __rscPrismCreateActionRef(${JSON.stringify(name)});`);
    lines.push(`export { ${localName} as ${name} };`);
  });

  if (
    !(actionExports.has("default") || exportsInfo.named.some((name) => actionExports.has(name)))
  ) {
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
      if (!sourceContainsAnyDirectiveLiteral(code, directives)) {
        continue;
      }
      const ast = parseModule(code, absolutePath);
      if (!hasDirective(ast, directives)) {
        continue;
      }

      collected.push({
        moduleId: mapModuleId(absolutePath),
        importPath: `/${normalizePath(path.relative(root, absolutePath))}`,
        exportsInfo: collectRuntimeExports(ast, absolutePath),
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

  lines.push("const __rscPrismGlobalState = globalThis;");
  lines.push(
    `const __rscPrismMainThreadModules = (__rscPrismGlobalState[${JSON.stringify(
      MAIN_THREAD_MODULES_GLOBAL_KEY,
    )}] ??= Object.create(null));`,
  );
  lines.push(
    'const __rscPrismClientManifest = (__rscPrismGlobalState["__RSC_PRISM_CLIENT_MANIFEST__"] ??= Object.create(null));',
  );
  lines.push("");

  modules.forEach((entry, index) => {
    const importName = `__rscPrismMainModule${index}`;
    lines.push(`import * as ${importName} from ${JSON.stringify(entry.importPath)};`);
    lines.push(`__rscPrismMainThreadModules[${JSON.stringify(entry.moduleId)}] = ${importName};`);

    const exportsList = entry.exportsInfo.hasDefault
      ? ["default", ...entry.exportsInfo.named]
      : [...entry.exportsInfo.named];
    exportsList.push("*");
    for (const exportName of exportsList) {
      const referenceId = `${entry.moduleId}#${exportName}`;
      lines.push(`__rscPrismClientManifest[${JSON.stringify(referenceId)}] = {`);
      lines.push(`  id: ${JSON.stringify(entry.moduleId)},`);
      lines.push(`  name: ${JSON.stringify(exportName)},`);
      lines.push("  chunks: [],");
      lines.push("  async: false,");
      lines.push("};");
    }
  });

  lines.push("");
  lines.push("export {};");
  return `${lines.join("\n")}\n`;
}

function buildWorkerComponentRegistryCode(modules: WorkerRuntimeModuleEntry[]): string {
  const lines: string[] = [];
  lines.push("const componentRegistry = new Map();");
  lines.push("const actionRegistry = new Map();");
  lines.push("const actionModules = [];");
  lines.push("");
  modules.forEach((entry, index) => {
    const importName = `__rscPrismWorkerModule${index}`;
    lines.push(`import * as ${importName} from ${JSON.stringify(entry.importPath)};`);
    const actionExports = new Set(entry.exportsInfo.actionExports);
    const exportNames: string[] = [];
    if (entry.exportsInfo.hasDefault) {
      exportNames.push("default");
    }
    exportNames.push(...entry.exportsInfo.named);

    if (actionExports.size > 0) {
      lines.push(
        `actionModules.push({ moduleId: ${JSON.stringify(entry.moduleId)}, moduleExports: ${importName} });`,
      );
    }

    for (const exportName of exportNames) {
      const accessExpression =
        exportName === "default" ? `${importName}.default` : `${importName}.${exportName}`;
      if (actionExports.has(exportName)) {
        lines.push(`if (typeof ${accessExpression} === "function") {`);
        lines.push(
          `  actionRegistry.set(${JSON.stringify(`${entry.moduleId}#${exportName}`)}, ${accessExpression});`,
        );
        lines.push("}");
      } else if (entry.isWorkerDirectiveModule) {
        lines.push(
          `componentRegistry.set(${JSON.stringify(`${entry.moduleId}#${exportName}`)}, ${accessExpression});`,
        );
      }
    }
  });
  lines.push("");
  lines.push("export function resolveWorkerComponent(componentId) {");
  lines.push("  if (typeof componentId !== 'string' || componentId.length === 0) return null;");
  lines.push("  return componentRegistry.get(componentId) ?? null;");
  lines.push("}");
  lines.push("");
  lines.push("export function resolveWorkerAction(actionId) {");
  lines.push("  if (typeof actionId !== 'string' || actionId.length === 0) return null;");
  lines.push("  return actionRegistry.get(actionId) ?? null;");
  lines.push("}");
  lines.push("");
  lines.push("export const workerActionModules = actionModules;");
  lines.push("");
  lines.push("export const workerActionCount = actionRegistry.size;");
  lines.push("");
  lines.push("export const workerComponentCount = componentRegistry.size;");
  lines.push("");
  lines.push("export const workerRegistry = { componentRegistry, actionRegistry };");
  lines.push("");
  lines.push("export function hasWorkerAction(actionId) {");
  lines.push("  return actionRegistry.has(actionId);");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function buildGeneratedWorkerEntryCode(endpoint: string): string {
  return `
import { createRSCHandler } from "@lib/rsc-prism/response";
import { createWorkerTransportMessageHandler } from "@lib/rsc-prism/transport";
import { resolveWorkerComponent, workerActionModules } from "./worker-component-registry";

const WORKER_ORIGIN = "https://rsc.prism.local";
const ACTION_ENDPOINT = "/rsc/action";
const handler = createRSCHandler({ actionModules: workerActionModules });

function toActionRequest(message, endpoint) {
  const headers = new Headers(message.headers ?? []);
  if (message.actionId != null) {
    headers.set("x-rsc-action", message.actionId);
  }
  if (message.contentType != null) {
    headers.set("content-type", message.contentType);
  }
  return new Request(endpoint.toString(), {
    ...message.requestInit,
    method: "POST",
    headers,
    body: message.body ?? "",
  });
}

self.addEventListener(
  "message",
  createWorkerTransportMessageHandler(async (request) => {
    const target = new URL(request.endpoint, WORKER_ORIGIN);

    if (request.operation === "fetch") {
      if (target.pathname !== ${JSON.stringify(endpoint)}) {
        return new Response(JSON.stringify({ error: "Unknown endpoint: " + target.pathname }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const component = resolveWorkerComponent(request.componentId);
      if (component == null) {
        return new Response(JSON.stringify({ error: "Missing or unknown worker component reference." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      return handler.render(component(request.componentProps ?? {}));
    }

    if (request.operation === "action") {
      if (target.pathname !== ACTION_ENDPOINT) {
        return new Response(JSON.stringify({ error: "Unknown endpoint: " + target.pathname }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      const actionRequest = toActionRequest(request, target);
      return handler.action(actionRequest, {
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported operation" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }),
);
self.postMessage({ type: "rsc.prism.worker.ready" });
export const __rscPrismWorkerRuntimeMarker = true;
`;
}

function buildWorkerBootstrapCode(servePath: string): string {
  return `
import { createWorkerTransport } from "@lib/rsc-prism/transport";

const __RSC_PRISM_BOOTSTRAP_GLOBAL_KEY = ${JSON.stringify(WORKER_RUNTIME_BOOTSTRAP_GLOBAL_KEY)};
let __rscPrismBootstrappedRuntime = null;
let __rscPrismBootstrapPromise = null;

async function initializeWorkerRuntime() {
  const worker = new Worker(${JSON.stringify(servePath)}, { type: "module" });
  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error("Worker runtime failed to initialize."));
      }, 1500);
      const cleanup = () => {
        clearTimeout(timeout);
        clearTimeout(fallbackReady);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      };
      const fallbackReady = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(undefined);
      }, 50);
      const onMessage = (event) => {
        if (event.data != null && event.data.type === "rsc.prism.worker.ready") {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(undefined);
        }
      };
      const onError = (event) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        const message =
          event != null &&
          typeof event === "object" &&
          "message" in event &&
          typeof event.message === "string" &&
          event.message.length > 0
            ? event.message
            : "Worker runtime failed to initialize.";
        reject(new Error(message));
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
    });
  } catch (error) {
    worker.terminate();
    throw error;
  }

  const transport = createWorkerTransport(worker);
  let isDisposed = false;
  const runtime = {
    worker,
    transport,
    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      worker.terminate();
      if (__rscPrismBootstrappedRuntime === runtime) {
        __rscPrismBootstrappedRuntime = null;
      }
      __rscPrismBootstrapPromise = null;
    },
  };
  return runtime;
}

export async function bootstrapWorkerRuntime() {
  if (__rscPrismBootstrappedRuntime != null) {
    return __rscPrismBootstrappedRuntime;
  }

  if (__rscPrismBootstrapPromise == null) {
    __rscPrismBootstrapPromise = initializeWorkerRuntime()
      .then((runtime) => {
        __rscPrismBootstrappedRuntime = runtime;
        return runtime;
      })
      .catch((error) => {
        __rscPrismBootstrapPromise = null;
        throw error;
      });
  }

  return __rscPrismBootstrapPromise;
}

globalThis[__RSC_PRISM_BOOTSTRAP_GLOBAL_KEY] = bootstrapWorkerRuntime;
`;
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildPublicPath(base: string, relativePath: string): string {
  const normalizedRelative = trimLeadingSlash(relativePath);
  const normalizedBase = trimTrailingSlash(base);
  if (normalizedBase.length === 0) {
    return `/${normalizedRelative}`;
  }
  return `${normalizedBase}/${normalizedRelative}`;
}

async function resolveNodeModuleFile(
  startDir: string,
  filePathFromNodeModules: string,
): Promise<string> {
  let currentDir = startDir;
  while (true) {
    const candidate = path.resolve(currentDir, "node_modules", filePathFromNodeModules);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continue searching upwards
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  throw new Error(
    `[rsc-prism] Unable to resolve node_modules/${filePathFromNodeModules} from ${startDir}`,
  );
}

async function collectJavaScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(absolutePath)));
      continue;
    }
    if (entry.isFile() && absolutePath.endsWith(".js")) {
      files.push(absolutePath);
    }
  }
  return files;
}

async function copyDirectoryContents(sourceDir: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.resolve(sourceDir, entry.name);
    const targetPath = path.resolve(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
}

async function pickWorkerServeFile(outDir: string): Promise<string> {
  const jsFiles = await collectJavaScriptFiles(outDir);
  if (jsFiles.length === 0) {
    throw new Error(
      `[rsc-prism] Generated worker runtime output has no JavaScript files: ${outDir}`,
    );
  }

  const entryCandidates = jsFiles.filter((filePath) =>
    path.basename(filePath).startsWith(`${INTERNAL_WORKER_RUNTIME_ASSET_NAME}-`),
  );
  if (entryCandidates.length > 0) {
    return entryCandidates.sort((left, right) => left.localeCompare(right))[0]!;
  }

  const withSize = await Promise.all(
    jsFiles.map(async (filePath) => ({
      filePath,
      size: (await stat(filePath)).size,
    })),
  );
  withSize.sort((left, right) => right.size - left.size);
  return withSize[0]!.filePath;
}

function createRscPrismPlugin(options: RscPrismInternalPluginOptions): Plugin {
  const legacyWorkerRuntimeEntry = (options.workerRuntime as { entry?: unknown } | undefined)
    ?.entry;
  if (options.mode === "main" && legacyWorkerRuntimeEntry != null) {
    throw new Error(
      '[rsc-prism] workerRuntime.entry has been removed. Delete "workerRuntime.entry" and rely on plugin-generated worker runtime from discovered "use worker" modules/actions.',
    );
  }
  const legacyWorkerRuntimeServePath = (
    options.workerRuntime as { servePath?: unknown } | undefined
  )?.servePath;
  if (options.mode === "main" && legacyWorkerRuntimeServePath != null) {
    throw new Error(
      '[rsc-prism] workerRuntime.servePath is now internal. Delete "workerRuntime.servePath" and rely on plugin-managed worker asset URLs.',
    );
  }
  const legacyWorkerRuntimeFileName = (options.workerRuntime as { fileName?: unknown } | undefined)
    ?.fileName;
  if (options.mode === "main" && legacyWorkerRuntimeFileName != null) {
    throw new Error(
      '[rsc-prism] workerRuntime.fileName is now internal. Delete "workerRuntime.fileName" and rely on plugin-managed worker asset URLs.',
    );
  }

  const mainDirectives = new Set(options.directives ?? DEFAULT_DIRECTIVES);
  const workerDirectives = new Set(options.workerDirectives ?? DEFAULT_WORKER_DIRECTIVES);
  const includeFilter = createFilter(options.include, options.exclude);
  const virtualId = options.mainVirtualId ?? DEFAULT_MAIN_VIRTUAL_ID;
  const workerBootstrapVirtualId =
    options.workerBootstrapVirtualId ?? DEFAULT_WORKER_BOOTSTRAP_VIRTUAL_ID;
  const workerRuntimeEnabled = options.mode === "main" && options.workerRuntime?.enabled === true;
  const workerEndpoint = options.workerRuntime?.endpoint ?? "/rsc/view";

  let config: ResolvedConfig | null = null;
  const parsedDirectiveModules = new Map<string, ParsedDirectiveModule>();
  let generatedWorkerOutDir: string | null = null;
  let generatedWorkerServeFile: string | null = null;
  let generatedWorkerServePublicPath: string | null = null;
  let generatedWorkerServeSourceDir: string | null = null;
  let generatedWorkerEntryPath: string | null = null;
  let generatedWorkerRegistryPath: string | null = null;
  const workerActionDirectives = new Set([...workerDirectives, WORKER_ACTION_DIRECTIVE]);

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
    const mayContainDirective =
      sourceContainsAnyDirectiveLiteral(source, mainDirectives) ||
      sourceContainsAnyDirectiveLiteral(source, workerActionDirectives);
    if (!mayContainDirective) {
      const result: ParsedDirectiveModule = {
        isDirectiveModule: false,
        hasWorkerActionExports: false,
      };
      parsedDirectiveModules.set(absolutePath, result);
      return result;
    }
    const ast = parseModule(source, absolutePath);
    const directiveType = resolveDirectiveModuleType(ast, mainDirectives, workerDirectives);
    const exportsInfo = collectRuntimeExports(ast, absolutePath);
    const hasWorkerActionExports = exportsInfo.actionExports.length > 0;
    if (directiveType == null) {
      const result: ParsedDirectiveModule = {
        isDirectiveModule: false,
        exportsInfo,
        hasWorkerActionExports,
      };
      parsedDirectiveModules.set(absolutePath, result);
      return result;
    }

    const result: ParsedDirectiveModule = {
      isDirectiveModule: true,
      type: directiveType,
      exportsInfo,
      hasWorkerActionExports,
    };
    parsedDirectiveModules.set(absolutePath, result);
    return result;
  };

  const isWorkerRuntimeRelevantModule = (parsed: ParsedDirectiveModule): boolean => {
    return (
      (parsed.isDirectiveModule && parsed.type === "worker") ||
      parsed.hasWorkerActionExports === true
    );
  };

  const collectWorkerModulesForRuntime = async (): Promise<WorkerRuntimeModuleEntry[]> => {
    if (config == null) {
      throw new Error("[rsc-prism] Vite config is not resolved yet.");
    }
    const root = config.root;

    const collected: WorkerRuntimeModuleEntry[] = [];

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

        if (!entry.isFile() || !isSupportedFile(absolutePath) || !includeFilter(absolutePath)) {
          continue;
        }

        const parsed = await parseDirectiveModule(absolutePath);
        if (parsed.exportsInfo == null) {
          continue;
        }
        const includeAsWorkerModule = parsed.isDirectiveModule && parsed.type === "worker";
        const includeAsActionModule = parsed.hasWorkerActionExports === true;
        if (!includeAsWorkerModule && !includeAsActionModule) {
          continue;
        }

        collected.push({
          moduleId: mapModuleId(absolutePath),
          importPath: normalizePath(absolutePath),
          exportsInfo: parsed.exportsInfo,
          isWorkerDirectiveModule: includeAsWorkerModule,
        });
      }
    }

    await visit(root);

    const deduped = new Map<string, WorkerRuntimeModuleEntry>();
    for (const entry of collected) {
      if (!deduped.has(entry.moduleId)) {
        deduped.set(entry.moduleId, entry);
      }
    }

    return [...deduped.values()].sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  };

  const ensureGeneratedWorkerSources = async (): Promise<{
    entryPath: string;
    registryPath: string;
    outDir: string;
  }> => {
    if (config == null) {
      throw new Error("[rsc-prism] Vite config is not resolved yet.");
    }

    const outDir =
      options.workerRuntime?.outDir != null
        ? path.resolve(config.root, options.workerRuntime.outDir)
        : path.resolve(config.root, ".vite", "rsc-prism-worker-runtime");
    const sourceDir = path.resolve(config.root, ".vite", "rsc-prism-worker-runtime-src");
    const entryPath = path.resolve(sourceDir, "generated.worker.ts");
    const registryPath = path.resolve(sourceDir, "worker-component-registry.ts");
    await mkdir(sourceDir, { recursive: true });

    const workerModules = await collectWorkerModulesForRuntime();
    await writeFile(registryPath, buildWorkerComponentRegistryCode(workerModules), "utf8");
    await writeFile(entryPath, buildGeneratedWorkerEntryCode(workerEndpoint), "utf8");

    generatedWorkerOutDir = outDir;
    generatedWorkerEntryPath = entryPath;
    generatedWorkerRegistryPath = registryPath;

    return { entryPath, registryPath, outDir };
  };

  const buildGeneratedWorkerRuntime = async (mode: string): Promise<void> => {
    if (!workerRuntimeEnabled) {
      return;
    }
    if (config == null) {
      throw new Error("[rsc-prism] Vite config is not resolved yet.");
    }

    generatedWorkerServeFile = null;
    generatedWorkerServePublicPath = null;
    generatedWorkerServeSourceDir = null;
    const reactServerEntry = await resolveNodeModuleFile(
      config.root,
      "react/react.react-server.js",
    );
    const reactServerJsxRuntimeEntry = await resolveNodeModuleFile(
      config.root,
      "react/jsx-runtime.react-server.js",
    );
    const reactServerJsxDevRuntimeEntry = await resolveNodeModuleFile(
      config.root,
      "react/jsx-dev-runtime.react-server.js",
    );
    const reactDomServerEntry = await resolveNodeModuleFile(
      config.root,
      "react-dom/react-dom.react-server.js",
    );
    const outDir =
      options.workerRuntime?.outDir != null
        ? path.resolve(config.root, options.workerRuntime.outDir)
        : path.resolve(config.root, ".vite", "rsc-prism-worker-runtime");
    const entryPath = (await ensureGeneratedWorkerSources()).entryPath;
    generatedWorkerOutDir = outDir;

    await viteBuild({
      configFile: false,
      mode,
      root: config.root,
      build: {
        write: true,
        outDir,
        emptyOutDir: true,
        rollupOptions: {
          input: entryPath,
          preserveEntrySignatures: "strict",
          treeshake: true,
          output: {
            format: "es",
            entryFileNames: `assets/${INTERNAL_WORKER_RUNTIME_ASSET_NAME}-[hash].js`,
            chunkFileNames: "assets/[name]-[hash].js",
          },
        },
      },
      resolve: {
        alias: [
          ...normalizeAliases(options.workerRuntime?.aliases ?? config.resolve?.alias),
          { find: /^react$/, replacement: reactServerEntry },
          { find: /^react\/jsx-runtime$/, replacement: reactServerJsxRuntimeEntry },
          { find: /^react\/jsx-dev-runtime$/, replacement: reactServerJsxDevRuntimeEntry },
          { find: /^react-dom$/, replacement: reactDomServerEntry },
        ],
        conditions: dedupeItems([mode, "react-server", "browser", "import", "default"]),
      },
      plugins: [rscPrismWorker(), react() as unknown as Plugin],
      define: { "process.env.NODE_ENV": JSON.stringify(mode) },
      experimental: {
        enableNativePlugin: false,
      },
    });
    generatedWorkerServeFile = await pickWorkerServeFile(outDir);
    const workerRelativePath = normalizePath(path.relative(outDir, generatedWorkerServeFile));
    generatedWorkerServeSourceDir = normalizePath(path.posix.dirname(workerRelativePath));
    generatedWorkerServePublicPath = buildPublicPath(config.base, workerRelativePath);
  };

  return {
    name: "rsc-prism",
    enforce: "pre",
    config() {
      return null;
    },
    configEnvironment(name, userConfig, env) {
      if (options.mode === "main" && name !== "worker") {
        const excludeDeps = dedupeItems([...toArray(userConfig.optimizeDeps?.exclude)]);

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

      const aliases: NonNullable<UserConfig["resolve"]>["alias"] extends infer T
        ? Exclude<T, undefined>
        : never = [];

      const excludeDeps = dedupeItems([
        ...toArray(userConfig.optimizeDeps?.exclude),
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
      ]);

      return {
        resolve: {
          alias: aliases,
          conditions: dedupeItems(
            [
              ...existingConditions,
              modeCondition,
              "react-server",
              "browser",
              "import",
              "default",
            ].filter(
              (condition): condition is string =>
                typeof condition === "string" && condition.length > 0,
            ),
          ),
        },
        optimizeDeps: {
          exclude: excludeDeps,
        },
      };
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async buildStart() {
      if (!workerRuntimeEnabled || config == null) {
        return;
      }
      await buildGeneratedWorkerRuntime(config.mode);
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (options.mode !== "main") {
          return undefined;
        }

        const useDevVirtualUrlPrefix = config?.command === "serve";
        const mainVirtualSrc = useDevVirtualUrlPrefix ? `/@id/${virtualId}` : virtualId;
        const workerBootstrapSrc = useDevVirtualUrlPrefix
          ? `/@id/${workerBootstrapVirtualId}`
          : workerBootstrapVirtualId;

        if (
          html.includes(virtualId) ||
          html.includes(RESOLVED_MAIN_VIRTUAL_ID) ||
          html.includes(mainVirtualSrc)
        ) {
          return undefined;
        }

        const tags: Array<{
          tag: string;
          attrs: Record<string, string>;
          injectTo: "head-prepend";
        }> = [
          {
            tag: "script",
            attrs: {
              type: "module",
              src: mainVirtualSrc,
            },
            injectTo: "head-prepend",
          },
        ];

        if (
          workerRuntimeEnabled &&
          !html.includes(workerBootstrapVirtualId) &&
          !html.includes(workerBootstrapSrc)
        ) {
          tags.push({
            tag: "script",
            attrs: {
              type: "module",
              src: workerBootstrapSrc,
            },
            injectTo: "head-prepend",
          });
        }

        return {
          html,
          tags,
        };
      },
    },
    async resolveId(id, importer) {
      if (options.mode === "main" && id === virtualId) {
        return RESOLVED_MAIN_VIRTUAL_ID;
      }
      if (options.mode === "main" && workerRuntimeEnabled && id === workerBootstrapVirtualId) {
        return RESOLVED_WORKER_BOOTSTRAP_VIRTUAL_ID;
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
        if (options.mode === "worker") {
          if (!directiveModule.isDirectiveModule || directiveModule.type == null) {
            return null;
          }
          if (directiveModule.type !== "main") {
            return null;
          }
          return `${WORKER_PROXY_VIRTUAL_ID_PREFIX}${normalizePath(absolutePath)}`;
        }

        if (directiveModule.isDirectiveModule && directiveModule.type === "worker") {
          return `${MAIN_WORKER_REF_VIRTUAL_ID_PREFIX}${normalizePath(absolutePath)}`;
        }

        if (directiveModule.hasWorkerActionExports) {
          return `${MAIN_WORKER_ACTION_REF_VIRTUAL_ID_PREFIX}${normalizePath(absolutePath)}`;
        }
        return null;
      } catch {
        return null;
      }
    },
    async load(id) {
      const workerProxyBaseId = id.split("?", 1)[0]!;
      if (
        options.mode === "worker" &&
        workerProxyBaseId.startsWith(WORKER_PROXY_VIRTUAL_ID_PREFIX)
      ) {
        const absolutePath = workerProxyBaseId.slice(WORKER_PROXY_VIRTUAL_ID_PREFIX.length);
        const directiveModule = await parseDirectiveModule(absolutePath);
        if (
          !directiveModule.isDirectiveModule ||
          directiveModule.type !== "main" ||
          directiveModule.exportsInfo == null
        ) {
          throw new Error(
            `[rsc-prism] Worker proxy requested for non-directive module "${absolutePath}".`,
          );
        }
        const moduleId = mapModuleId(absolutePath);
        return buildWorkerProxyModuleCode(moduleId, directiveModule.exportsInfo);
      }

      if (options.mode === "main" && id.startsWith(MAIN_WORKER_REF_VIRTUAL_ID_PREFIX)) {
        const absolutePath = id.slice(MAIN_WORKER_REF_VIRTUAL_ID_PREFIX.length);
        const directiveModule = await parseDirectiveModule(absolutePath);
        if (
          !directiveModule.isDirectiveModule ||
          directiveModule.type !== "worker" ||
          directiveModule.exportsInfo == null
        ) {
          throw new Error(
            `[rsc-prism] Main worker reference requested for non-worker module "${absolutePath}".`,
          );
        }
        const moduleId = mapModuleId(absolutePath);
        return buildMainWorkerReferenceModuleCode(moduleId, directiveModule.exportsInfo);
      }

      if (options.mode === "main" && id.startsWith(MAIN_WORKER_ACTION_REF_VIRTUAL_ID_PREFIX)) {
        const absolutePath = id.slice(MAIN_WORKER_ACTION_REF_VIRTUAL_ID_PREFIX.length);
        const directiveModule = await parseDirectiveModule(absolutePath);
        if (directiveModule.exportsInfo == null || !directiveModule.hasWorkerActionExports) {
          throw new Error(
            `[rsc-prism] Main worker action reference requested for non-action module "${absolutePath}".`,
          );
        }
        const moduleId = mapModuleId(absolutePath);
        return buildMainWorkerActionReferenceModuleCode(moduleId, directiveModule.exportsInfo);
      }

      if (options.mode !== "main" || id !== RESOLVED_MAIN_VIRTUAL_ID) {
        if (
          options.mode === "main" &&
          workerRuntimeEnabled &&
          id === RESOLVED_WORKER_BOOTSTRAP_VIRTUAL_ID
        ) {
          const fallbackWorkerPath = buildPublicPath(
            config?.base ?? "/",
            `assets/${INTERNAL_WORKER_RUNTIME_ASSET_NAME}.js`,
          );
          return buildWorkerBootstrapCode(generatedWorkerServePublicPath ?? fallbackWorkerPath);
        }
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
    configureServer(server) {
      if (!workerRuntimeEnabled) {
        return;
      }
      server.middlewares.use(async (req, res, next) => {
        if (
          generatedWorkerOutDir == null ||
          generatedWorkerServePublicPath == null ||
          generatedWorkerServeSourceDir == null
        ) {
          next();
          return;
        }

        const requestPath = (req.url ?? "").split("?", 1)[0]!;
        let targetFile: string | null = null;
        if (requestPath === generatedWorkerServePublicPath && generatedWorkerServeFile != null) {
          targetFile = generatedWorkerServeFile;
        } else {
          const workerServeDir = path.posix.dirname(generatedWorkerServePublicPath);
          const normalizedWorkerServeDir =
            workerServeDir.length > 1 ? trimTrailingSlash(workerServeDir) : workerServeDir;
          if (
            normalizedWorkerServeDir.length > 0 &&
            requestPath.startsWith(`${normalizedWorkerServeDir}/`)
          ) {
            const relative = requestPath.slice(normalizedWorkerServeDir.length + 1);
            targetFile = path.resolve(
              generatedWorkerOutDir,
              generatedWorkerServeSourceDir,
              relative,
            );
          }
        }

        if (targetFile == null) {
          next();
          return;
        }

        try {
          const content = await readFile(targetFile, "utf8");
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Cache-Control", "no-cache");
          res.end(content);
          return;
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      if (!workerRuntimeEnabled || config == null || config.command !== "build") {
        return;
      }
      if (
        generatedWorkerOutDir == null ||
        generatedWorkerServePublicPath == null ||
        generatedWorkerServeSourceDir == null
      ) {
        return;
      }

      const outDir = path.resolve(config.root, config.build.outDir);
      const serveDirectory = path.posix.dirname(generatedWorkerServePublicPath);
      const relativeServeDirectory =
        serveDirectory === "/" ? "" : serveDirectory.replace(/^\/+/, "");
      const workerTargetDir = path.resolve(outDir, relativeServeDirectory);
      const workerSourceDir = path.resolve(generatedWorkerOutDir, generatedWorkerServeSourceDir);

      await copyDirectoryContents(workerSourceDir, workerTargetDir);
    },
    transform(code, id) {
      if (!shouldProcessFile(id)) {
        return null;
      }

      const hasMainDirectiveLiteral = sourceContainsAnyDirectiveLiteral(code, mainDirectives);
      const hasWorkerDirectiveLiteral = sourceContainsAnyDirectiveLiteral(code, workerDirectives);
      const hasWorkerActionDirectiveLiteral = sourceContainsDirectiveLiteral(
        code,
        WORKER_ACTION_DIRECTIVE,
      );

      if (options.mode === "worker" && !hasMainDirectiveLiteral) {
        return null;
      }
      if (
        options.mode === "main" &&
        !hasWorkerDirectiveLiteral &&
        !hasWorkerActionDirectiveLiteral
      ) {
        return null;
      }

      const absolutePath = toAbsolutePath(id);
      const projectFilePath = toProjectFilePath(absolutePath);
      const ast = parseModule(code, absolutePath);
      const directiveType = resolveDirectiveModuleType(ast, mainDirectives, workerDirectives);
      if (options.mode === "worker" && directiveType !== "main") {
        return null;
      }
      if (
        options.mode === "main" &&
        directiveType !== "worker" &&
        !hasWorkerActionDirectiveLiteral
      ) {
        return null;
      }
      const exportsInfo = collectRuntimeExports(ast, absolutePath);
      const hasWorkerActionExports = exportsInfo.actionExports.length > 0;
      if (directiveType == null && !hasWorkerActionExports) {
        return null;
      }
      const moduleId = mapModuleId(projectFilePath);
      let transformedCode: string | null = null;

      if (options.mode === "worker" && directiveType === "main") {
        transformedCode = buildWorkerProxyModuleCode(moduleId, exportsInfo);
      }

      if (options.mode === "main" && directiveType === "worker") {
        transformedCode = buildMainWorkerReferenceModuleCode(moduleId, exportsInfo);
      }

      if (options.mode === "main" && directiveType == null && hasWorkerActionExports) {
        transformedCode = buildMainWorkerActionReferenceModuleCode(moduleId, exportsInfo);
      }

      if (transformedCode == null) {
        return null;
      }

      return {
        code: transformedCode,
        map: { mappings: "" },
      };
    },
    async handleHotUpdate(context) {
      if (!workerRuntimeEnabled || config == null) {
        return;
      }
      const normalizedFile = normalizePath(context.file);
      const previousParsed =
        parsedDirectiveModules.get(normalizedFile) ?? parsedDirectiveModules.get(context.file);
      parsedDirectiveModules.delete(normalizedFile);
      parsedDirectiveModules.delete(context.file);
      const normalizedOutDir = generatedWorkerOutDir ? normalizePath(generatedWorkerOutDir) : null;
      if (normalizedOutDir != null && normalizedFile.startsWith(normalizedOutDir)) {
        return;
      }
      if (
        generatedWorkerEntryPath != null &&
        generatedWorkerRegistryPath != null &&
        (normalizedFile === normalizePath(generatedWorkerEntryPath) ||
          normalizedFile === normalizePath(generatedWorkerRegistryPath))
      ) {
        return;
      }
      if (!shouldProcessFile(normalizedFile)) {
        return;
      }

      let nextParsed: ParsedDirectiveModule | null = null;
      try {
        nextParsed = await parseDirectiveModule(toProjectFilePath(normalizedFile));
      } catch {
        // Fall back to previous known state for deleted/temporarily invalid files.
      }
      const wasRelevant = previousParsed != null && isWorkerRuntimeRelevantModule(previousParsed);
      const isRelevant = nextParsed != null && isWorkerRuntimeRelevantModule(nextParsed);
      if (!wasRelevant && !isRelevant) {
        return;
      }

      await buildGeneratedWorkerRuntime(config.mode);
      context.server.ws.send({ type: "full-reload" });
    },
  };
}

export function rscPrism(options: RscPrismVitePluginOptions = {}): Plugin {
  return createRscPrismPlugin({
    ...options,
    mode: "main",
  });
}

export function rscPrismWorker(
  options: Omit<RscPrismVitePluginOptions, "workerRuntime"> = {},
): Plugin {
  return createRscPrismPlugin({
    ...options,
    mode: "worker",
  });
}
