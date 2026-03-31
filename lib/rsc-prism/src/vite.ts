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
  CLIENT_REF_TABLE_GLOBAL_KEY,
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
const MAIN_WORKER_DIRECTIVE_REF_VIRTUAL_ID_PREFIX = "\0rsc-prism:main-worker-directive-ref:";
const ORIGINAL_MODULE_BYPASS_QUERY = "rsc-prism-original";
const LOCAL_MAIN_COMPONENT_EXPORT_PREFIX = "__rscPrismLocalClient_";

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
  componentExports: string[];
}

interface DiscoveredWorkerComponent {
  localName: string;
  exportName: string | null;
  componentId: string;
  declarationType: "function-declaration" | "variable-function" | "rsc-call";
  sourceStart: number;
  sourceEnd: number;
  replacementKind: "declaration" | "initializer" | "rsc-arg";
  replacementStart: number;
  replacementEnd: number;
}

interface TopLevelComponentBinding {
  localName: string;
  hasFirstLineUseWorker: boolean;
}

interface WorkerRuntimeComponentBinding {
  componentId: string;
  importPath: string;
  exportName: string;
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
  outDir?: string;
  aliases?: NonNullable<UserConfig["resolve"]>["alias"];
}

export interface RscPrismExperimentalOptions {
  componentLevelDirectives?: boolean;
  actionBatchRefresh?: boolean;
}

export interface RscPrismVitePluginOptions {
  directives?: Array<(typeof DEFAULT_DIRECTIVES)[number]>;
  workerDirectives?: Array<(typeof DEFAULT_WORKER_DIRECTIVES)[number]>;
  include?: FilterPattern;
  exclude?: FilterPattern;
  mainVirtualId?: string;
  workerBootstrapVirtualId?: string;
  workerRuntime?: RscPrismWorkerRuntimeOptions;
  experimental?: RscPrismExperimentalOptions;
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

function withBypassQuery(id: string): string {
  return id.includes("?")
    ? `${id}&${ORIGINAL_MODULE_BYPASS_QUERY}`
    : `${id}?${ORIGINAL_MODULE_BYPASS_QUERY}`;
}

function dedupeItems<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function buildLocalMainComponentExportName(localName: string): string {
  return `${LOCAL_MAIN_COMPONENT_EXPORT_PREFIX}${localName}`;
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

function getNodeRange(node: unknown): { start: number; end: number } | null {
  if (typeof node !== "object" || node == null) {
    return null;
  }
  const start = (node as { start?: unknown }).start;
  const end = (node as { end?: unknown }).end;
  if (typeof start !== "number" || typeof end !== "number") {
    return null;
  }
  return { start, end };
}

function walkNode(
  node: unknown,
  visit: (current: ParsedNode, parent: ParsedNode | null) => void,
  parent: ParsedNode | null = null,
): void {
  if (typeof node !== "object" || node == null) {
    return;
  }

  const parsed = node as ParsedNode;
  if (typeof parsed.type === "string") {
    visit(parsed, parent);
  }

  for (const value of Object.values(parsed)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        walkNode(item, visit, parsed);
      }
      continue;
    }
    walkNode(value, visit, parsed);
  }
}

function isPascalCaseName(name: string | null): boolean {
  return name != null && /^[A-Z]/.test(name);
}

function isFunctionLikeNode(node: unknown): boolean {
  if (typeof node !== "object" || node == null) {
    return false;
  }
  const type = (node as { type?: string }).type;
  return (
    type === "FunctionDeclaration" ||
    type === "FunctionExpression" ||
    type === "ArrowFunctionExpression"
  );
}

function functionContainsJSXOrCreateElement(node: unknown): boolean {
  if (!isFunctionLikeNode(node)) {
    return false;
  }

  const functionNode = node as ParsedNode;
  if (functionNode.type === "ArrowFunctionExpression") {
    const body = (functionNode as { body?: unknown }).body;
    const bodyType = (body as { type?: string } | null | undefined)?.type;
    if (bodyType === "JSXElement" || bodyType === "JSXFragment") {
      return true;
    }
  }

  let hasComponentReturn = false;
  walkNode(node, (current, parent) => {
    if (hasComponentReturn) {
      return;
    }

    if (current.type === "JSXElement" || current.type === "JSXFragment") {
      hasComponentReturn = true;
      return;
    }

    if (current.type !== "CallExpression") {
      return;
    }

    const callee = (current as { callee?: unknown }).callee;
    if (typeof callee !== "object" || callee == null) {
      return;
    }

    const member = callee as {
      type?: string;
      object?: { type?: string; name?: string };
      property?: { type?: string; name?: string };
    };
    if (
      member.type === "MemberExpression" &&
      member.object?.type === "Identifier" &&
      member.object.name === "React" &&
      member.property?.type === "Identifier" &&
      member.property.name === "createElement"
    ) {
      hasComponentReturn = true;
      return;
    }

    if (
      parent?.type === "ReturnStatement" &&
      (callee as { type?: string }).type === "Identifier" &&
      (callee as { name?: string }).name === "createElement"
    ) {
      hasComponentReturn = true;
    }
  });

  return hasComponentReturn;
}

function isTopLevelWorkerComponentFunction(
  node: unknown,
  localName: string | null,
  experimentalComponentLevelDirectives: boolean,
): boolean {
  if (!isFunctionLikeNode(node) || !hasWorkerActionFunctionDirective(node)) {
    return false;
  }
  if (!experimentalComponentLevelDirectives) {
    return false;
  }

  if (isPascalCaseName(localName)) {
    return true;
  }
  return functionContainsJSXOrCreateElement(node);
}

function isRscCallExpression(node: unknown): boolean {
  if (typeof node !== "object" || node == null) {
    return false;
  }
  const call = node as { type?: string; callee?: unknown };
  if (call.type !== "CallExpression") {
    return false;
  }
  const callee = call.callee as { type?: string; name?: string } | null | undefined;
  return callee?.type === "Identifier" && callee.name === "rsc";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyTextReplacements(code: string, replacements: TextReplacement[]): string {
  if (replacements.length === 0) {
    return code;
  }
  const sorted = [...replacements].sort((left, right) => right.start - left.start);
  let output = code;
  for (const replacement of sorted) {
    output = output.slice(0, replacement.start) + replacement.text + output.slice(replacement.end);
  }
  return output;
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

function collectRuntimeExports(
  ast: ParsedFile,
  id: string,
  options: { experimentalComponentLevelDirectives?: boolean } = {},
): ParsedModuleExports {
  const experimentalComponentLevelDirectives =
    options.experimentalComponentLevelDirectives === true;
  const named = new Set<string>();
  const actionExports = new Set<string>();
  const componentExports = new Set<string>();
  const workerDirectiveInfo = collectTopLevelWorkerDirectiveInfo(ast, {
    experimentalComponentLevelDirectives,
  });
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
          const localName = readExportedName((declaration as { id?: unknown }).id);
          if (localName != null && workerDirectiveInfo.componentBindings.has(localName)) {
            componentExports.add("default");
          } else {
            actionExports.add("default");
          }
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
              if (workerDirectiveInfo.componentBindings.has(declarationName)) {
                componentExports.add(declarationName);
              } else {
                actionExports.add(declarationName);
              }
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
              if (workerDirectiveInfo.allBindings.has(name)) {
                if (workerDirectiveInfo.componentBindings.has(name)) {
                  componentExports.add(name);
                } else {
                  actionExports.add(name);
                }
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
        if (localName != null && workerDirectiveInfo.allBindings.has(localName)) {
          if (workerDirectiveInfo.componentBindings.has(localName)) {
            componentExports.add("default");
          } else {
            actionExports.add("default");
          }
        }
        continue;
      }

      assertNamedExportIdentifier(exported, id);
      named.add(exported);
      const localName = readExportedName((specifier as { local?: unknown }).local);
      if (localName != null && workerDirectiveInfo.allBindings.has(localName)) {
        if (workerDirectiveInfo.componentBindings.has(localName)) {
          componentExports.add(exported);
        } else {
          actionExports.add(exported);
        }
      }
    }
  }

  return {
    hasDefault,
    named: [...named],
    actionExports: [...actionExports],
    componentExports: [...componentExports],
  };
}

function collectTopLevelWorkerDirectiveInfo(
  ast: ParsedFile,
  options: { experimentalComponentLevelDirectives?: boolean } = {},
): { allBindings: Set<string>; componentBindings: Set<string> } {
  const experimentalComponentLevelDirectives =
    options.experimentalComponentLevelDirectives === true;
  const allBindings = new Set<string>();
  const componentBindings = new Set<string>();

  for (const statement of ast.program.body) {
    const maybeFunctionDeclaration =
      statement.type === "ExportNamedDeclaration"
        ? (statement as { declaration?: ParsedNode }).declaration
        : statement;

    if (maybeFunctionDeclaration?.type === "FunctionDeclaration") {
      const localName = readExportedName((maybeFunctionDeclaration as { id?: unknown }).id);
      if (localName == null || !hasWorkerActionFunctionDirective(maybeFunctionDeclaration)) {
        continue;
      }
      allBindings.add(localName);
      if (
        isTopLevelWorkerComponentFunction(
          maybeFunctionDeclaration,
          localName,
          experimentalComponentLevelDirectives,
        )
      ) {
        componentBindings.add(localName);
      }
      continue;
    }

    const maybeVariableDeclaration =
      statement.type === "ExportNamedDeclaration"
        ? (statement as { declaration?: ParsedNode }).declaration
        : statement;
    if (maybeVariableDeclaration?.type !== "VariableDeclaration") {
      continue;
    }

    const declarations =
      (maybeVariableDeclaration as { declarations?: Array<{ id?: unknown; init?: unknown }> })
        .declarations ?? [];

    for (const declarator of declarations) {
      if (!hasWorkerActionFunctionDirective(declarator.init)) {
        continue;
      }
      const names = new Set<string>();
      pushBindingNames(names, declarator.id);
      for (const name of names) {
        allBindings.add(name);
        if (
          isTopLevelWorkerComponentFunction(
            declarator.init,
            name,
            experimentalComponentLevelDirectives,
          )
        ) {
          componentBindings.add(name);
        }
      }
    }
  }

  return { allBindings, componentBindings };
}

function discoverWorkerComponents(
  ast: ParsedFile,
  _source: string,
  moduleId: string,
  options: { experimentalComponentLevelDirectives?: boolean } = {},
): DiscoveredWorkerComponent[] {
  const experimentalComponentLevelDirectives =
    options.experimentalComponentLevelDirectives === true;
  if (!experimentalComponentLevelDirectives) {
    return [];
  }

  const discovered: DiscoveredWorkerComponent[] = [];
  const localToExportNames = new Map<string, string>();

  const pushDiscovered = (entry: Omit<DiscoveredWorkerComponent, "componentId" | "exportName">) => {
    discovered.push({
      ...entry,
      exportName: null,
      componentId: "",
    });
  };

  for (const statement of ast.program.body) {
    if (statement.type === "ExportNamedDeclaration") {
      const exportDeclaration = statement as {
        declaration?: ParsedNode;
        specifiers?: Array<{ local?: unknown; exported?: unknown; exportKind?: string }>;
      };

      if (exportDeclaration.declaration != null) {
        const declaration = exportDeclaration.declaration;
        if (declaration.type === "FunctionDeclaration") {
          const localName = readExportedName((declaration as { id?: unknown }).id);
          if (
            localName != null &&
            isTopLevelWorkerComponentFunction(
              declaration,
              localName,
              experimentalComponentLevelDirectives,
            )
          ) {
            const declarationRange = getNodeRange(statement);
            const functionRange = getNodeRange(declaration);
            if (declarationRange != null && functionRange != null) {
              pushDiscovered({
                localName,
                declarationType: "function-declaration",
                sourceStart: functionRange.start,
                sourceEnd: functionRange.end,
                replacementKind: "declaration",
                replacementStart: declarationRange.start,
                replacementEnd: declarationRange.end,
              });
              localToExportNames.set(localName, localName);
            }
          }
        } else if (declaration.type === "VariableDeclaration") {
          const declarations =
            (declaration as { declarations?: Array<{ id?: unknown; init?: unknown }> })
              .declarations ?? [];
          for (const declarator of declarations) {
            const localName = readExportedName(declarator.id);
            if (localName == null) {
              continue;
            }

            if (
              isTopLevelWorkerComponentFunction(
                declarator.init,
                localName,
                experimentalComponentLevelDirectives,
              )
            ) {
              const initRange = getNodeRange(declarator.init);
              if (initRange != null) {
                pushDiscovered({
                  localName,
                  declarationType: "variable-function",
                  sourceStart: initRange.start,
                  sourceEnd: initRange.end,
                  replacementKind: "initializer",
                  replacementStart: initRange.start,
                  replacementEnd: initRange.end,
                });
                localToExportNames.set(localName, localName);
              }
              continue;
            }

            if (isRscCallExpression(declarator.init)) {
              const args = (declarator.init as { arguments?: unknown[] }).arguments ?? [];
              const firstArg = args[0];
              if (
                isTopLevelWorkerComponentFunction(
                  firstArg,
                  localName,
                  experimentalComponentLevelDirectives,
                )
              ) {
                const argRange = getNodeRange(firstArg);
                if (argRange != null) {
                  pushDiscovered({
                    localName,
                    declarationType: "rsc-call",
                    sourceStart: argRange.start,
                    sourceEnd: argRange.end,
                    replacementKind: "rsc-arg",
                    replacementStart: argRange.start,
                    replacementEnd: argRange.end,
                  });
                  localToExportNames.set(localName, localName);
                }
              }
            }
          }
        }
      }

      for (const specifier of exportDeclaration.specifiers ?? []) {
        if (specifier.exportKind === "type") {
          continue;
        }
        const localName = readExportedName(specifier.local);
        const exportedName = readExportedName(specifier.exported);
        if (localName == null || exportedName == null) {
          continue;
        }
        localToExportNames.set(localName, exportedName);
      }
      continue;
    }

    if (statement.type === "ExportDefaultDeclaration") {
      const declaration = (statement as { declaration?: ParsedNode }).declaration;
      if (
        declaration != null &&
        isTopLevelWorkerComponentFunction(
          declaration,
          readExportedName((declaration as { id?: unknown }).id) ?? "default",
          experimentalComponentLevelDirectives,
        )
      ) {
        const declarationRange = getNodeRange(statement);
        const functionRange = getNodeRange(declaration);
        if (declarationRange != null && functionRange != null) {
          const localName =
            readExportedName((declaration as { id?: unknown }).id) ?? "__rscPrismDefaultWorker";
          pushDiscovered({
            localName,
            declarationType: "function-declaration",
            sourceStart: functionRange.start,
            sourceEnd: functionRange.end,
            replacementKind: "declaration",
            replacementStart: declarationRange.start,
            replacementEnd: declarationRange.end,
          });
          localToExportNames.set(localName, "default");
        }
      }
      continue;
    }

    if (statement.type === "FunctionDeclaration") {
      const localName = readExportedName((statement as { id?: unknown }).id);
      if (
        localName != null &&
        isTopLevelWorkerComponentFunction(
          statement,
          localName,
          experimentalComponentLevelDirectives,
        )
      ) {
        const declarationRange = getNodeRange(statement);
        if (declarationRange != null) {
          pushDiscovered({
            localName,
            declarationType: "function-declaration",
            sourceStart: declarationRange.start,
            sourceEnd: declarationRange.end,
            replacementKind: "declaration",
            replacementStart: declarationRange.start,
            replacementEnd: declarationRange.end,
          });
        }
      }
      continue;
    }

    if (statement.type !== "VariableDeclaration") {
      continue;
    }

    const declarations =
      (statement as { declarations?: Array<{ id?: unknown; init?: unknown }> }).declarations ?? [];
    for (const declarator of declarations) {
      const localName = readExportedName(declarator.id);
      if (localName == null) {
        continue;
      }

      if (
        isTopLevelWorkerComponentFunction(
          declarator.init,
          localName,
          experimentalComponentLevelDirectives,
        )
      ) {
        const initRange = getNodeRange(declarator.init);
        if (initRange != null) {
          pushDiscovered({
            localName,
            declarationType: "variable-function",
            sourceStart: initRange.start,
            sourceEnd: initRange.end,
            replacementKind: "initializer",
            replacementStart: initRange.start,
            replacementEnd: initRange.end,
          });
        }
        continue;
      }

      if (isRscCallExpression(declarator.init)) {
        const args = (declarator.init as { arguments?: unknown[] }).arguments ?? [];
        const firstArg = args[0];
        if (
          isTopLevelWorkerComponentFunction(
            firstArg,
            localName,
            experimentalComponentLevelDirectives,
          )
        ) {
          const argRange = getNodeRange(firstArg);
          if (argRange != null) {
            pushDiscovered({
              localName,
              declarationType: "rsc-call",
              sourceStart: argRange.start,
              sourceEnd: argRange.end,
              replacementKind: "rsc-arg",
              replacementStart: argRange.start,
              replacementEnd: argRange.end,
            });
          }
        }
      }
    }
  }

  for (const entry of discovered) {
    entry.exportName = localToExportNames.get(entry.localName) ?? null;
    const exportSuffix = entry.exportName ?? `@local:${entry.localName}`;
    entry.componentId = `${moduleId}#${exportSuffix}`;
  }

  return discovered.filter((entry) => entry.sourceEnd > entry.sourceStart);
}

function collectTopLevelComponentBindings(ast: ParsedFile): Map<string, TopLevelComponentBinding> {
  const bindings = new Map<string, TopLevelComponentBinding>();

  const registerBinding = (localName: string, node: unknown): void => {
    if (!isFunctionLikeNode(node)) {
      return;
    }
    const isComponent = isPascalCaseName(localName) || functionContainsJSXOrCreateElement(node);
    if (!isComponent) {
      return;
    }
    const hasFirstLineUseWorker = hasWorkerActionFunctionDirective(node);
    const existing = bindings.get(localName);
    if (existing == null || (!existing.hasFirstLineUseWorker && hasFirstLineUseWorker)) {
      bindings.set(localName, { localName, hasFirstLineUseWorker });
    }
  };

  for (const statement of ast.program.body) {
    const maybeFunctionDeclaration =
      statement.type === "ExportNamedDeclaration"
        ? (statement as { declaration?: ParsedNode }).declaration
        : statement;
    if (maybeFunctionDeclaration?.type === "FunctionDeclaration") {
      const localName = readExportedName((maybeFunctionDeclaration as { id?: unknown }).id);
      if (localName != null) {
        registerBinding(localName, maybeFunctionDeclaration);
      }
      continue;
    }

    const maybeVariableDeclaration =
      statement.type === "ExportNamedDeclaration"
        ? (statement as { declaration?: ParsedNode }).declaration
        : statement;
    if (maybeVariableDeclaration?.type !== "VariableDeclaration") {
      continue;
    }
    const declarations =
      (maybeVariableDeclaration as { declarations?: Array<{ id?: unknown; init?: unknown }> })
        .declarations ?? [];
    for (const declarator of declarations) {
      const localName = readExportedName(declarator.id);
      if (localName == null) {
        continue;
      }
      registerBinding(localName, declarator.init);
    }
  }

  return bindings;
}

function collectReferencedTopLevelMainComponentNames(
  ast: ParsedFile,
  workerComponents: DiscoveredWorkerComponent[],
  aggregateWorkerComponentSource: string,
): string[] {
  if (aggregateWorkerComponentSource.length === 0) {
    return [];
  }

  const componentBindings = collectTopLevelComponentBindings(ast);
  const workerComponentNames = new Set(workerComponents.map((component) => component.localName));
  const referencedNames = new Set<string>();

  for (const binding of componentBindings.values()) {
    if (binding.hasFirstLineUseWorker || workerComponentNames.has(binding.localName)) {
      continue;
    }
    const usage = findIdentifierUsage(aggregateWorkerComponentSource, binding.localName);
    if (usage.usedInJSX) {
      referencedNames.add(binding.localName);
    }
  }

  return [...referencedNames].sort((left, right) => left.localeCompare(right));
}

function buildWorkerProxyModuleCode(
  moduleId: string,
  exportsInfo: ParsedModuleExports,
  refIdMap: Map<string, number>,
): string {
  const getRefId = (referenceId: string): number => {
    const refId = refIdMap.get(referenceId);
    if (refId == null) {
      throw new Error(
        `[rsc-prism] Missing refId for "${referenceId}" in worker proxy. Ensure ref table is built.`,
      );
    }
    return refId;
  };
  const lines: string[] = [];
  lines.push(
    'import { createClientRef } from "@lib/rsc-prism/module-references/create-client-ref";',
  );
  lines.push("");
  if (exportsInfo.hasDefault) {
    const referenceId = `${moduleId}#default`;
    lines.push(
      `const __rscPrismDefault = createClientRef(${JSON.stringify(referenceId)}, ${getRefId(referenceId)});`,
    );
    lines.push("export default __rscPrismDefault;");
  }
  exportsInfo.named.forEach((name, index) => {
    const localName = `__rscPrismExport${index}`;
    const referenceId = `${moduleId}#${name}`;
    lines.push(
      `const ${localName} = createClientRef(${JSON.stringify(referenceId)}, ${getRefId(referenceId)});`,
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
  hasWorkerComponentExports?: boolean;
  hasLocalWorkerComponents?: boolean;
  workerComponents?: DiscoveredWorkerComponent[];
}

interface TextReplacement {
  start: number;
  end: number;
  text: string;
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

function buildActionIdMap(
  actionExports: Set<string>,
  getActionId: (name: string) => string,
): Record<string, string> {
  return Object.fromEntries(Array.from(actionExports).map((name) => [name, getActionId(name)]));
}

function buildMainWorkerReferenceModuleCode(
  moduleId: string,
  exportsInfo: ParsedModuleExports,
  actionShortIdMap: Map<string, string>,
): string {
  const lines: string[] = [];
  const actionExports = new Set(exportsInfo.actionExports);
  const getActionId = (name: string) =>
    actionShortIdMap.get(`${moduleId}#${name}`) ?? `${moduleId}#${name}`;
  const actionIdMap = buildActionIdMap(actionExports, getActionId);
  lines.push(
    'import { createWorkerRef } from "@lib/rsc-prism/module-references/create-worker-ref";',
  );
  lines.push(
    'import { createActionRef } from "@lib/rsc-prism/module-references/create-action-ref";',
  );
  lines.push("");
  lines.push(`const __rscPrismModuleId = ${JSON.stringify(moduleId)};`);
  lines.push("const __rscPrismWorkerReferenceMap = {};");
  lines.push("const __rscPrismActionReferenceMap = {};");
  lines.push(`const __rscPrismActionIdMap = ${JSON.stringify(actionIdMap)};`);
  lines.push("");

  if (exportsInfo.hasDefault) {
    lines.push(
      actionExports.has("default")
        ? `const __rscPrismDefault = createActionRef(__rscPrismActionIdMap["default"] ?? __rscPrismModuleId + "#default");`
        : `const __rscPrismDefault = createWorkerRef(__rscPrismModuleId + "#default", __rscPrismModuleId, "default");`,
    );
    if (actionExports.has("default")) {
      lines.push('__rscPrismActionReferenceMap["default"] = __rscPrismDefault;');
    } else {
      lines.push('__rscPrismWorkerReferenceMap["default"] = __rscPrismDefault;');
    }
    lines.push("export default __rscPrismDefault;");
  }

  exportsInfo.named.forEach((name, index) => {
    const localName = `__rscPrismWorkerExport${index}`;
    const refExpr = actionExports.has(name)
      ? `createActionRef(__rscPrismActionIdMap[${JSON.stringify(name)}] ?? __rscPrismModuleId + ${JSON.stringify("#" + name)})`
      : `createWorkerRef(__rscPrismModuleId + ${JSON.stringify("#" + name)}, __rscPrismModuleId, ${JSON.stringify(name)})`;
    lines.push(`const ${localName} = ${refExpr};`);
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
  actionShortIdMap: Map<string, string>,
): string {
  const lines: string[] = [];
  const actionExports = new Set(exportsInfo.actionExports);
  const getActionId = (name: string) =>
    actionShortIdMap.get(`${moduleId}#${name}`) ?? `${moduleId}#${name}`;
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
  const actionIdMap = buildActionIdMap(actionExports, getActionId);
  lines.push(
    'import { createActionRef } from "@lib/rsc-prism/module-references/create-action-ref";',
  );
  lines.push("");
  lines.push(`const __rscPrismModuleId = ${JSON.stringify(moduleId)};`);
  lines.push(`const __rscPrismActionIdMap = ${JSON.stringify(actionIdMap)};`);
  lines.push("");

  if (actionExports.has("default")) {
    lines.push(
      'const __rscPrismDefault = createActionRef(__rscPrismActionIdMap["default"] ?? __rscPrismModuleId + "#default");',
    );
    lines.push("export default __rscPrismDefault;");
  }

  exportsInfo.named.forEach((name, index) => {
    if (!actionExports.has(name)) {
      return;
    }
    const localName = `__rscPrismActionExport${index}`;
    lines.push(
      `const ${localName} = createActionRef(__rscPrismActionIdMap[${JSON.stringify(name)}] ?? __rscPrismModuleId + ${JSON.stringify("#" + name)});`,
    );
    lines.push(`export { ${localName} as ${name} };`);
  });

  if (
    !(actionExports.has("default") || exportsInfo.named.some((name) => actionExports.has(name)))
  ) {
    lines.push("export {};");
  }

  return `${lines.join("\n")}\n`;
}

function buildMainWorkerDirectiveReferenceModuleCode(
  moduleId: string,
  exportsInfo: ParsedModuleExports,
  sourceImportPath: string,
  actionShortIdMap: Map<string, string>,
): string {
  const lines: string[] = [];
  const actionExports = new Set(exportsInfo.actionExports);
  const componentExports = new Set(exportsInfo.componentExports);
  const getActionId = (name: string) =>
    actionShortIdMap.get(`${moduleId}#${name}`) ?? `${moduleId}#${name}`;
  const actionIdMap = buildActionIdMap(actionExports, getActionId);
  lines.push(
    'import { createWorkerRef } from "@lib/rsc-prism/module-references/create-worker-ref";',
  );
  lines.push(
    'import { createActionRef } from "@lib/rsc-prism/module-references/create-action-ref";',
  );
  lines.push(`import * as __rscPrismSourceModule from ${JSON.stringify(sourceImportPath)};`);
  lines.push("");
  lines.push(`const __rscPrismModuleId = ${JSON.stringify(moduleId)};`);
  lines.push("const __rscPrismWorkerReferenceMap = {};");
  lines.push("const __rscPrismActionReferenceMap = {};");
  lines.push(`const __rscPrismActionIdMap = ${JSON.stringify(actionIdMap)};`);
  lines.push("");

  const hasDefaultDirectiveExport =
    exportsInfo.hasDefault && (actionExports.has("default") || componentExports.has("default"));
  if (hasDefaultDirectiveExport) {
    lines.push(
      actionExports.has("default")
        ? `const __rscPrismDefault = createActionRef(__rscPrismActionIdMap["default"] ?? __rscPrismModuleId + "#default");`
        : `const __rscPrismDefault = createWorkerRef(__rscPrismModuleId + "#default", __rscPrismModuleId, "default");`,
    );
    if (actionExports.has("default")) {
      lines.push('__rscPrismActionReferenceMap["default"] = __rscPrismDefault;');
    } else {
      lines.push('__rscPrismWorkerReferenceMap["default"] = __rscPrismDefault;');
    }
    lines.push("export default __rscPrismDefault;");
  } else if (exportsInfo.hasDefault) {
    lines.push("const __rscPrismDefault = __rscPrismSourceModule.default;");
    lines.push("export default __rscPrismDefault;");
  }

  let exportIndex = 0;
  for (const name of exportsInfo.named) {
    if (!actionExports.has(name) && !componentExports.has(name)) {
      lines.push(
        `const __rscPrismPassthroughExport${exportIndex++} = __rscPrismSourceModule.${name};`,
      );
      lines.push(`export { __rscPrismPassthroughExport${exportIndex - 1} as ${name} };`);
      continue;
    }
    const localName = `__rscPrismWorkerDirectiveExport${exportIndex++}`;
    const refExpr = actionExports.has(name)
      ? `createActionRef(__rscPrismActionIdMap[${JSON.stringify(name)}] ?? __rscPrismModuleId + ${JSON.stringify("#" + name)})`
      : `createWorkerRef(__rscPrismModuleId + ${JSON.stringify("#" + name)}, __rscPrismModuleId, ${JSON.stringify(name)})`;
    lines.push(`const ${localName} = ${refExpr};`);
    if (actionExports.has(name)) {
      lines.push(`__rscPrismActionReferenceMap[${JSON.stringify(name)}] = ${localName};`);
    } else {
      lines.push(`__rscPrismWorkerReferenceMap[${JSON.stringify(name)}] = ${localName};`);
    }
    lines.push(`export { ${localName} as ${name} };`);
  }

  lines.push("export { __rscPrismWorkerReferenceMap };");
  lines.push("export { __rscPrismActionReferenceMap };");
  if (!exportsInfo.hasDefault && exportIndex === 0) {
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
  additionalModulePaths: Set<string> = new Set<string>(),
  options: { experimentalComponentLevelDirectives?: boolean } = {},
): Promise<MainThreadModuleEntry[]> {
  const collected: MainThreadModuleEntry[] = [];
  const experimentalComponentLevelDirectives =
    options.experimentalComponentLevelDirectives === true;

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
      const moduleId = mapModuleId(absolutePath);
      const workerComponents = discoverWorkerComponents(ast, code, moduleId, {
        experimentalComponentLevelDirectives,
      });
      const aggregateWorkerComponentSource = workerComponents
        .map((component) => code.slice(component.sourceStart, component.sourceEnd))
        .join("\n");
      const localMainComponentNames = collectReferencedTopLevelMainComponentNames(
        ast,
        workerComponents,
        aggregateWorkerComponentSource,
      );
      const shouldIncludeByDirective =
        sourceContainsAnyDirectiveLiteral(code, directives) && hasDirective(ast, directives);
      const shouldIncludeByInference = additionalModulePaths.has(normalizePath(absolutePath));
      const shouldIncludeBySyntheticClientExports = localMainComponentNames.length > 0;
      if (
        !shouldIncludeByDirective &&
        !shouldIncludeByInference &&
        !shouldIncludeBySyntheticClientExports
      ) {
        continue;
      }

      const exportsInfo = collectRuntimeExports(ast, absolutePath, {
        experimentalComponentLevelDirectives,
      });
      for (const localName of localMainComponentNames) {
        exportsInfo.named.push(buildLocalMainComponentExportName(localName));
      }
      exportsInfo.named = dedupeItems(exportsInfo.named).sort((left, right) =>
        left.localeCompare(right),
      );

      collected.push({
        moduleId,
        importPath: `/${normalizePath(path.relative(root, absolutePath))}`,
        exportsInfo,
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

function buildMainVirtualModuleCode(
  modules: MainThreadModuleEntry[],
  options: { includeWorkerBootstrapImport?: boolean } = {},
): string {
  const lines: string[] = [];
  if (options.includeWorkerBootstrapImport) {
    lines.push(`import ${JSON.stringify(DEFAULT_WORKER_BOOTSTRAP_VIRTUAL_ID)};`);
    lines.push("");
  }

  lines.push("const __rscPrismGlobalState = globalThis;");
  lines.push(
    `const __rscPrismMainThreadModules = (__rscPrismGlobalState[${JSON.stringify(
      MAIN_THREAD_MODULES_GLOBAL_KEY,
    )}] ??= Object.create(null));`,
  );
  lines.push(
    `const __rscPrismClientRefTable = (__rscPrismGlobalState[${JSON.stringify(
      CLIENT_REF_TABLE_GLOBAL_KEY,
    )}] ??= []);`,
  );
  lines.push(
    'const __rscPrismClientManifest = (__rscPrismGlobalState["__RSC_PRISM_CLIENT_MANIFEST__"] ??= Object.create(null));',
  );
  lines.push("__rscPrismClientRefTable.length = 0;");
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
      const accessExpr =
        exportName === "*"
          ? importName
          : exportName === "default"
            ? `${importName}.default`
            : `${importName}.${exportName}`;
      lines.push(`__rscPrismClientRefTable.push(${accessExpr});`);
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

function buildWorkerActionShortIdMap(modules: WorkerRuntimeModuleEntry[]): Map<string, string> {
  const actionShortIdMap = new Map<string, string>();
  let shortIdCounter = 0;
  const getShortId = (fullId: string): string => {
    let shortId = actionShortIdMap.get(fullId);
    if (shortId == null) {
      shortId = String(shortIdCounter++);
      actionShortIdMap.set(fullId, shortId);
    }
    return shortId;
  };

  for (let i = 0; i < modules.length; i += 1) {
    const entry = modules[i];
    const actionExports = new Set(entry.exportsInfo.actionExports);
    const exportNames: string[] = [];
    if (entry.exportsInfo.hasDefault) {
      exportNames.push("default");
    }
    exportNames.push(...entry.exportsInfo.named);
    for (let j = 0; j < exportNames.length; j += 1) {
      const exportName = exportNames[j];
      if (!actionExports.has(exportName)) {
        continue;
      }
      getShortId(`${entry.moduleId}#${exportName}`);
    }
  }

  return actionShortIdMap;
}

function buildWorkerComponentRegistryCode(
  modules: WorkerRuntimeModuleEntry[],
  componentBindings: WorkerRuntimeComponentBinding[],
): { code: string; actionShortIdMap: Map<string, string> } {
  const actionShortIdMap = buildWorkerActionShortIdMap(modules);

  const lines: string[] = [];
  lines.push("const componentRegistry = new Map();");
  lines.push("const actionRegistry = new Map();");
  lines.push("const actionModules = [];");
  lines.push("const workerActions = {};");
  lines.push("");
  modules.forEach((entry, index) => {
    const importName = `__rscPrismWorkerModule${index}`;
    lines.push(`import * as ${importName} from ${JSON.stringify(entry.importPath)};`);
    const actionExports = new Set(entry.exportsInfo.actionExports);
    const componentExports = new Set(entry.exportsInfo.componentExports);
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
        const fullId = `${entry.moduleId}#${exportName}`;
        const shortId = actionShortIdMap.get(fullId)!;
        lines.push(`if (typeof ${accessExpression} === "function") {`);
        lines.push(`  actionRegistry.set(${JSON.stringify(shortId)}, ${accessExpression});`);
        lines.push(`  workerActions[${JSON.stringify(shortId)}] = ${accessExpression};`);
        lines.push("}");
      } else if (entry.isWorkerDirectiveModule || componentExports.has(exportName)) {
        lines.push(
          `componentRegistry.set(${JSON.stringify(`${entry.moduleId}#${exportName}`)}, ${accessExpression});`,
        );
      }
    }
  });
  lines.push("");
  componentBindings.forEach((binding, index) => {
    const importName = `__rscPrismInlineComponent${index}`;
    lines.push(`import * as ${importName} from ${JSON.stringify(binding.importPath)};`);
    const accessExpression =
      binding.exportName === "default"
        ? `${importName}.default`
        : `${importName}.${binding.exportName}`;
    lines.push(
      `componentRegistry.set(${JSON.stringify(binding.componentId)}, ${accessExpression});`,
    );
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
  lines.push("export { workerActions };");
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
  return { code: `${lines.join("\n")}\n`, actionShortIdMap };
}

function buildGeneratedWorkerEntryCode(experimentalActionBatchRefresh: boolean): string {
  return `
import { createWorkerRowHandler } from "@lib/rsc-prism/server";
import { encodedArgsFromMessage } from "@lib/rsc-prism/actions";
import { createWorkerRowTransportMessageHandler } from "@lib/rsc-prism/transport";
import { flightDoneRow, flightErrorRow, flightModelRow } from "@lib/rsc-prism/flight-runtime/wire";
import { resolveWorkerComponent, workerActions } from "./worker-component-registry";

const ACTION_BATCH_REFRESH = ${experimentalActionBatchRefresh ? "true" : "false"};
const handler = await createWorkerRowHandler({ actions: workerActions });

async function renderRowsToArray(element) {
  const rows = [];
  await handler.renderRows(element, (row) => {
    rows.push(row);
  });
  return rows;
}

function resolveActionRows(actionValue) {
  if (actionValue === undefined) {
    return Promise.resolve([flightModelRow(0, undefined), flightDoneRow()]);
  }
  return renderRowsToArray(actionValue);
}

function splitTerminalRow(rows) {
  const lastRow = rows[rows.length - 1];
  if (lastRow != null && (lastRow.k === 2 || lastRow.k === 3)) {
    return {
      contentRows: rows.slice(0, -1),
      terminalRow: lastRow,
    };
  }
  return {
    contentRows: rows,
    terminalRow: { k: 2 },
  };
}

self.addEventListener(
  "message",
  createWorkerRowTransportMessageHandler(async (request, emit, controls) => {
    if (request.operation === "fetch") {
      const component = resolveWorkerComponent(request.componentId);
      if (component == null) {
        emit(flightErrorRow("Missing or unknown worker component reference."));
        return;
      }

      await handler.renderRows(component(request.componentProps ?? {}), emit);
      return;
    }

    if (request.operation === "action") {
      const actionId = request.actionId;
      const encodedArgs = encodedArgsFromMessage(request);
      if (!actionId) {
        emit(flightErrorRow("Missing action ID"));
        return;
      }
      const refreshTargets = Array.isArray(request.refreshTargets) ? request.refreshTargets : [];
      if (!ACTION_BATCH_REFRESH || refreshTargets.length === 0) {
        await handler.handleActionRows(actionId, encodedArgs, emit);
        return;
      }

      try {
        const actionValue = await handler.executeAction(actionId, encodedArgs);
        const actionRows = await resolveActionRows(actionValue);
        const { contentRows, terminalRow } = splitTerminalRow(actionRows);

        const entries = [];
        for (let i = 0; i < refreshTargets.length; i += 1) {
          const refreshTarget = refreshTargets[i];
          const targetKey = typeof refreshTarget?.targetKey === "string" ? refreshTarget.targetKey : "";
          const componentId =
            typeof refreshTarget?.componentId === "string" ? refreshTarget.componentId : "";
          const component = resolveWorkerComponent(componentId);
          if (component == null) {
            entries.push({
              targetKey,
              error: "Missing or unknown worker component reference: " + componentId,
            });
            continue;
          }
          try {
            const rows = await renderRowsToArray(component(refreshTarget.componentProps ?? {}));
            entries.push({ targetKey, rows });
          } catch (error) {
            entries.push({
              targetKey,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        controls.setActionRefreshBatch({
          seq: typeof request.refreshBatchSeq === "number" ? request.refreshBatchSeq : 0,
          entries,
        });
        for (let i = 0; i < contentRows.length; i += 1) {
          emit(contentRows[i]);
        }
        emit(terminalRow);
        return;
      } catch (error) {
        emit(flightErrorRow(error instanceof Error ? error.message : String(error)));
        return;
      }
    }

    throw new Error("Unsupported operation");
  }),
);
self.postMessage({ type: "rsc.prism.worker.ready" });
export const __rscPrismWorkerRuntimeMarker = true;
`;
}

function buildWorkerBootstrapCode(
  servePath: string,
  experimentalActionBatchRefresh: boolean,
): string {
  return `
import { createWorkerRowTransport } from "@lib/rsc-prism/transport";

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
      }, 10000);
      const cleanup = () => {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      };
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

  const transport = createWorkerRowTransport(worker, {
    experimentalActionBatchRefresh: ${experimentalActionBatchRefresh ? "true" : "false"},
  });
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

  const sortByRelativeDepthThenName = (left: string, right: string): number => {
    const leftRelative = normalizePath(path.relative(outDir, left));
    const rightRelative = normalizePath(path.relative(outDir, right));
    const leftDepth = leftRelative.split("/").length;
    const rightDepth = rightRelative.split("/").length;
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }
    return leftRelative.localeCompare(rightRelative);
  };

  const exactEntryCandidates = jsFiles.filter(
    (filePath) => path.basename(filePath) === `${INTERNAL_WORKER_RUNTIME_ASSET_NAME}.js`,
  );
  if (exactEntryCandidates.length > 0) {
    return exactEntryCandidates.sort(sortByRelativeDepthThenName)[0]!;
  }

  const entryCandidates = jsFiles.filter((filePath) =>
    path.basename(filePath).startsWith(`${INTERNAL_WORKER_RUNTIME_ASSET_NAME}-`),
  );
  if (entryCandidates.length > 0) {
    return entryCandidates.sort(sortByRelativeDepthThenName)[0]!;
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

function createDeterministicHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function toValidIdentifier(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_$]/g, "_");
  if (IDENTIFIER_PATTERN.test(sanitized)) {
    return sanitized;
  }
  return `_${sanitized}`;
}

function findIdentifierUsage(
  source: string,
  identifier: string,
): {
  used: boolean;
  called: boolean;
  usedInJSX: boolean;
} {
  const escaped = escapeRegExp(identifier);
  const used = new RegExp(`\\b${escaped}\\b`).test(source);
  const called = new RegExp(`\\b${escaped}\\s*\\(`).test(source);
  const usedInJSX =
    new RegExp(`<\\s*${escaped}(\\s|/|>)`).test(source) ||
    new RegExp(`</\\s*${escaped}\\s*>`).test(source);
  return { used, called, usedInJSX };
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
  const experimentalComponentLevelDirectives =
    options.experimental?.componentLevelDirectives === true;
  const experimentalActionBatchRefresh = options.experimental?.actionBatchRefresh === true;
  const workerRuntimeEnabled = options.mode === "main" && options.workerRuntime?.enabled === true;
  let config: ResolvedConfig | null = null;
  const parsedDirectiveModules = new Map<string, ParsedDirectiveModule>();
  let generatedWorkerOutDir: string | null = null;
  let generatedWorkerServeFile: string | null = null;
  let generatedWorkerServePublicPath: string | null = null;
  let generatedWorkerServeSourceDir: string | null = null;
  let generatedWorkerEntryPath: string | null = null;
  let generatedWorkerRegistryPath: string | null = null;
  let generatedWorkerInlineComponentsDir: string | null = null;
  let inferredClientModulePaths = new Set<string>();
  let actionShortIdMap = new Map<string, string>();
  let refIdMapCache: Map<string, number> | null = null;
  const workerActionDirectives = new Set([...workerDirectives, WORKER_ACTION_DIRECTIVE]);

  const ensureRefIdMap = async (): Promise<Map<string, number>> => {
    if (refIdMapCache != null) return refIdMapCache;
    if (config == null) {
      throw new Error("[rsc-prism] Config not resolved when building ref id map.");
    }
    const modules = await collectMainThreadModules(
      config.root,
      includeFilter,
      mainDirectives,
      mapModuleId,
      inferredClientModulePaths,
      { experimentalComponentLevelDirectives },
    );
    const map = new Map<string, number>();
    let refId = 0;
    for (const entry of modules) {
      const exportsList = entry.exportsInfo.hasDefault
        ? ["default", ...entry.exportsInfo.named]
        : [...entry.exportsInfo.named];
      exportsList.push("*");
      for (const exportName of exportsList) {
        map.set(`${entry.moduleId}#${exportName}`, refId++);
      }
    }
    refIdMapCache = map;
    return map;
  };

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

  const pathExists = async (absolutePath: string): Promise<boolean> => {
    try {
      await access(absolutePath);
      return true;
    } catch {
      return false;
    }
  };

  const resolveImportAbsolutePath = async (
    importerAbsolutePath: string,
    sourceSpecifier: string,
  ): Promise<string | null> => {
    if (config == null) {
      return null;
    }

    const resolveFromBase = async (basePath: string): Promise<string | null> => {
      const candidates: string[] = [basePath];
      for (const extension of SUPPORTED_EXTENSIONS) {
        candidates.push(`${basePath}${extension}`);
      }
      for (const extension of SUPPORTED_EXTENSIONS) {
        candidates.push(path.join(basePath, `index${extension}`));
      }

      for (const candidate of candidates) {
        if (await pathExists(candidate)) {
          return normalizePath(candidate);
        }
      }
      return null;
    };

    if (sourceSpecifier.startsWith(".")) {
      const basePath = path.resolve(path.dirname(importerAbsolutePath), sourceSpecifier);
      return resolveFromBase(basePath);
    }

    if (sourceSpecifier.startsWith("/")) {
      const basePath = path.resolve(config.root, sourceSpecifier.slice(1));
      return resolveFromBase(basePath);
    }

    return null;
  };

  const createMainWorkerReferenceExpression = (
    componentId: string,
    moduleId: string,
    localName: string,
  ): string => {
    return `createWorkerRef(${JSON.stringify(componentId)}, ${JSON.stringify(moduleId)}, ${JSON.stringify(localName)})`;
  };

  const buildLocalWorkerComponentTransform = (
    code: string,
    moduleId: string,
    workerComponents: DiscoveredWorkerComponent[],
    localMainComponentNames: string[],
  ): string | null => {
    if (workerComponents.length === 0) {
      return null;
    }

    const replacements: TextReplacement[] = [];

    for (const component of workerComponents) {
      const refExpression = createMainWorkerReferenceExpression(
        component.componentId,
        moduleId,
        component.localName,
      );

      if (component.declarationType === "rsc-call") {
        replacements.push({
          start: component.replacementStart,
          end: component.replacementEnd,
          text: refExpression,
        });
        continue;
      }

      if (component.replacementKind === "initializer") {
        replacements.push({
          start: component.replacementStart,
          end: component.replacementEnd,
          text: refExpression,
        });
        continue;
      }

      const declarationCode =
        component.exportName === "default"
          ? `const __rscPrismDefaultWorkerRef = ${refExpression};\nexport default __rscPrismDefaultWorkerRef;`
          : component.exportName != null
            ? `export const ${component.localName} = ${refExpression};`
            : `const ${component.localName} = ${refExpression};`;

      replacements.push({
        start: component.replacementStart,
        end: component.replacementEnd,
        text: declarationCode,
      });
    }

    if (replacements.length === 0) {
      return null;
    }

    const transformed = applyTextReplacements(code, replacements);
    const localMainExportLines = dedupeItems(localMainComponentNames).map(
      (localName) => `export { ${localName} as ${buildLocalMainComponentExportName(localName)} };`,
    );
    const helper = [
      'import { createWorkerRef } from "@lib/rsc-prism/module-references/create-worker-ref";',
      "",
    ].join("\n");

    if (localMainExportLines.length === 0) {
      return `${helper}${transformed}`;
    }

    return `${helper}${transformed}\n\n${localMainExportLines.join("\n")}\n`;
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
        hasWorkerComponentExports: false,
      };
      parsedDirectiveModules.set(absolutePath, result);
      return result;
    }
    const ast = parseModule(source, absolutePath);
    const directiveType = resolveDirectiveModuleType(ast, mainDirectives, workerDirectives);
    const moduleId = mapModuleId(absolutePath);
    const workerComponents = discoverWorkerComponents(ast, source, moduleId, {
      experimentalComponentLevelDirectives,
    });
    const exportsInfo = collectRuntimeExports(ast, absolutePath, {
      experimentalComponentLevelDirectives,
    });
    const hasWorkerActionExports = exportsInfo.actionExports.length > 0;
    const hasWorkerComponentExports = exportsInfo.componentExports.length > 0;
    const hasLocalWorkerComponents =
      workerComponents.filter((component) => component.exportName == null).length > 0 ||
      workerComponents.some((component) => component.declarationType === "rsc-call");
    if (directiveType == null) {
      const result: ParsedDirectiveModule = {
        isDirectiveModule: false,
        exportsInfo,
        hasWorkerActionExports,
        hasWorkerComponentExports,
        hasLocalWorkerComponents,
        workerComponents,
      };
      parsedDirectiveModules.set(absolutePath, result);
      return result;
    }

    const result: ParsedDirectiveModule = {
      isDirectiveModule: true,
      type: directiveType,
      exportsInfo,
      hasWorkerActionExports,
      hasWorkerComponentExports,
      hasLocalWorkerComponents,
      workerComponents,
    };
    parsedDirectiveModules.set(absolutePath, result);
    return result;
  };

  interface InlineWorkerComponentSource {
    componentId: string;
    fileName: string;
    sourceCode: string;
  }

  interface WorkerRuntimeCollectionResult {
    modules: WorkerRuntimeModuleEntry[];
    componentBindings: WorkerRuntimeComponentBinding[];
    inlineSources: InlineWorkerComponentSource[];
    inferredClientModules: Set<string>;
  }

  interface ImportBindingInfo {
    localName: string;
    importedName: string;
    sourceSpecifier: string;
    kind: "default" | "named" | "namespace";
    isTypeOnly: boolean;
    resolvedAbsolutePath: string | null;
  }

  const buildInlineWorkerComponentSource = async (
    absolutePath: string,
    source: string,
    ast: ParsedFile,
    rootComponent: DiscoveredWorkerComponent,
    allComponents: DiscoveredWorkerComponent[],
  ): Promise<{ sourceCode: string; inferredClientModules: Set<string> }> => {
    const sourceByComponentName = new Map<string, DiscoveredWorkerComponent>();
    for (const component of allComponents) {
      if (component.localName === rootComponent.localName) {
        continue;
      }
      sourceByComponentName.set(component.localName, component);
    }

    const includedComponents = new Map<string, DiscoveredWorkerComponent>();
    const componentQueue: string[] = [rootComponent.localName];
    const componentSourceLookup = (component: DiscoveredWorkerComponent): string =>
      source.slice(component.sourceStart, component.sourceEnd);

    while (componentQueue.length > 0) {
      const currentName = componentQueue.shift()!;
      const currentComponent =
        currentName === rootComponent.localName
          ? rootComponent
          : sourceByComponentName.get(currentName);
      if (currentComponent == null) {
        continue;
      }
      const currentSource = componentSourceLookup(currentComponent);
      for (const dependency of allComponents) {
        if (dependency.localName === currentName) {
          continue;
        }
        const usage = findIdentifierUsage(currentSource, dependency.localName);
        if (!usage.used) {
          continue;
        }
        if (!includedComponents.has(dependency.localName)) {
          includedComponents.set(dependency.localName, dependency);
          componentQueue.push(dependency.localName);
        }
      }
    }

    const localComponentSources: string[] = [];
    const sortedDependencies = [...includedComponents.values()].sort(
      (left, right) => left.sourceStart - right.sourceStart,
    );
    for (const dependency of sortedDependencies) {
      if (dependency.declarationType === "function-declaration") {
        localComponentSources.push(source.slice(dependency.sourceStart, dependency.sourceEnd));
      } else {
        localComponentSources.push(
          `const ${dependency.localName} = ${source.slice(dependency.sourceStart, dependency.sourceEnd)};`,
        );
      }
    }

    let rootDeclarationSource = "";
    if (rootComponent.declarationType === "function-declaration") {
      rootDeclarationSource = source.slice(rootComponent.sourceStart, rootComponent.sourceEnd);
    } else if (rootComponent.declarationType === "variable-function") {
      rootDeclarationSource = `const ${rootComponent.localName} = ${source.slice(
        rootComponent.sourceStart,
        rootComponent.sourceEnd,
      )};`;
    } else {
      rootDeclarationSource = `const ${rootComponent.localName} = ${source.slice(
        rootComponent.sourceStart,
        rootComponent.sourceEnd,
      )};`;
    }

    const aggregateComponentSource = `${localComponentSources.join("\n")}\n${rootDeclarationSource}`;
    const moduleId = mapModuleId(absolutePath);
    const localMainComponentNames = collectReferencedTopLevelMainComponentNames(
      ast,
      allComponents,
      aggregateComponentSource,
    );
    const importBindings: ImportBindingInfo[] = [];
    for (const statement of ast.program.body) {
      if (statement.type !== "ImportDeclaration") {
        continue;
      }
      const importDeclaration = statement as {
        source?: { value?: string };
        importKind?: string;
        specifiers?: Array<{
          type?: string;
          local?: unknown;
          imported?: unknown;
          importKind?: string;
        }>;
      };
      const sourceSpecifier = importDeclaration.source?.value;
      if (typeof sourceSpecifier !== "string") {
        continue;
      }

      const declarationTypeOnly = importDeclaration.importKind === "type";
      const resolvedAbsolutePath = await resolveImportAbsolutePath(absolutePath, sourceSpecifier);
      for (const specifier of importDeclaration.specifiers ?? []) {
        const localName = readExportedName(specifier.local);
        if (localName == null) {
          continue;
        }
        if (specifier.type === "ImportSpecifier") {
          const importedName = readExportedName(specifier.imported) ?? localName;
          importBindings.push({
            localName,
            importedName,
            sourceSpecifier,
            kind: "named",
            isTypeOnly: declarationTypeOnly || specifier.importKind === "type",
            resolvedAbsolutePath,
          });
        } else if (specifier.type === "ImportDefaultSpecifier") {
          importBindings.push({
            localName,
            importedName: "default",
            sourceSpecifier,
            kind: "default",
            isTypeOnly: declarationTypeOnly,
            resolvedAbsolutePath,
          });
        } else if (specifier.type === "ImportNamespaceSpecifier") {
          importBindings.push({
            localName,
            importedName: "*",
            sourceSpecifier,
            kind: "namespace",
            isTypeOnly: declarationTypeOnly,
            resolvedAbsolutePath,
          });
        }
      }
    }

    const inferredClientModules = new Set<string>();
    const realImportsBySource = new Map<string, string[]>();
    const clientRefLines: string[] = [];
    const actionRefLines: string[] = [];
    const pendingClientRefs: Array<{ localName: string; referenceId: string }> = [];

    if (localMainComponentNames.length > 0) {
      inferredClientModules.add(normalizePath(absolutePath));
      for (const localName of localMainComponentNames) {
        pendingClientRefs.push({
          localName,
          referenceId: `${moduleId}#${buildLocalMainComponentExportName(localName)}`,
        });
      }
    }

    for (const importBinding of importBindings) {
      if (importBinding.isTypeOnly) {
        continue;
      }
      const usage = findIdentifierUsage(aggregateComponentSource, importBinding.localName);
      if (!usage.used) {
        continue;
      }

      let isWorkerActionImport = false;
      if (
        importBinding.resolvedAbsolutePath != null &&
        importBinding.importedName !== "*" &&
        !usage.called
      ) {
        try {
          const importedDirectiveModule = await parseDirectiveModule(
            importBinding.resolvedAbsolutePath,
          );
          if (
            importedDirectiveModule.exportsInfo != null &&
            importedDirectiveModule.exportsInfo.actionExports.includes(importBinding.importedName)
          ) {
            isWorkerActionImport = true;
          }
        } catch {
          // fall back to non-action import classification
        }
      }

      if (usage.usedInJSX && importBinding.importedName !== "*") {
        const importedModuleId =
          importBinding.resolvedAbsolutePath != null
            ? mapModuleId(importBinding.resolvedAbsolutePath)
            : importBinding.sourceSpecifier;
        if (importBinding.resolvedAbsolutePath != null) {
          inferredClientModules.add(normalizePath(importBinding.resolvedAbsolutePath));
        }
        pendingClientRefs.push({
          localName: importBinding.localName,
          referenceId: `${importedModuleId}#${importBinding.importedName}`,
        });
        continue;
      }

      if (isWorkerActionImport && importBinding.importedName !== "*") {
        const importedModuleId =
          importBinding.resolvedAbsolutePath != null
            ? mapModuleId(importBinding.resolvedAbsolutePath)
            : importBinding.sourceSpecifier;
        const fullActionId = `${importedModuleId}#${importBinding.importedName}`;
        actionRefLines.push(
          `const ${importBinding.localName} = createActionRefStub(${JSON.stringify(
            actionShortIdMap.get(fullActionId) ?? fullActionId,
          )});`,
        );
        continue;
      }

      const importSource = importBinding.resolvedAbsolutePath ?? importBinding.sourceSpecifier;
      const importFragments = realImportsBySource.get(importSource) ?? [];
      if (importBinding.kind === "default") {
        importFragments.push(importBinding.localName);
      } else if (importBinding.kind === "named") {
        const importedName = importBinding.importedName;
        if (importedName === importBinding.localName) {
          importFragments.push(`{ ${importedName} }`);
        } else {
          importFragments.push(`{ ${importedName} as ${importBinding.localName} }`);
        }
      } else {
        importFragments.push(`* as ${importBinding.localName}`);
      }
      realImportsBySource.set(importSource, importFragments);
    }

    const getRefId = async (referenceId: string): Promise<number> => {
      let refId = refIdMapCache?.get(referenceId);
      if (refId != null) {
        return refId;
      }

      let hasNewInferredModules = false;
      for (const inferredModule of inferredClientModules) {
        if (!inferredClientModulePaths.has(inferredModule)) {
          inferredClientModulePaths.add(inferredModule);
          hasNewInferredModules = true;
        }
      }
      if (hasNewInferredModules) {
        refIdMapCache = null;
      }
      if (hasNewInferredModules || refIdMapCache == null) {
        await ensureRefIdMap();
      }

      refId = refIdMapCache?.get(referenceId);
      if (refId == null) {
        throw new Error(
          `[rsc-prism] Missing refId for "${referenceId}". Ensure ref table is built before transforming server components.`,
        );
      }
      return refId;
    };

    for (const pendingClientRef of pendingClientRefs) {
      const refId = await getRefId(pendingClientRef.referenceId);
      clientRefLines.push(
        `const ${pendingClientRef.localName} = createClientRef(${JSON.stringify(pendingClientRef.referenceId)}, ${refId});`,
      );
    }

    const importLines: string[] = [];
    if (clientRefLines.length > 0) {
      importLines.push(
        'import { createClientRef } from "@lib/rsc-prism/module-references/create-client-ref";',
      );
    }
    if (actionRefLines.length > 0) {
      importLines.push(
        'import { createActionRefStub } from "@lib/rsc-prism/module-references/create-action-ref-stub";',
      );
    }
    for (const [sourceSpecifier, fragments] of realImportsBySource) {
      const defaultImport = fragments.find(
        (fragment) => !fragment.startsWith("{") && !fragment.startsWith("* as "),
      );
      const namespaceImport = fragments.find((fragment) => fragment.startsWith("* as "));
      const namedImports = fragments
        .filter((fragment) => fragment.startsWith("{"))
        .map((fragment) => fragment.slice(1, -1).trim())
        .filter((fragment) => fragment.length > 0);

      const segments: string[] = [];
      if (defaultImport != null) {
        segments.push(defaultImport);
      }
      if (namespaceImport != null) {
        segments.push(namespaceImport);
      }
      if (namedImports.length > 0) {
        segments.push(`{ ${dedupeItems(namedImports).join(", ")} }`);
      }
      if (segments.length > 0) {
        importLines.push(`import ${segments.join(", ")} from ${JSON.stringify(sourceSpecifier)};`);
      }
    }

    const helperLines: string[] = [];

    const lines: string[] = [];
    lines.push(...importLines);
    if (importLines.length > 0) {
      lines.push("");
    }
    lines.push(...helperLines);
    lines.push(...clientRefLines);
    lines.push(...actionRefLines);
    if (clientRefLines.length > 0 || actionRefLines.length > 0) {
      lines.push("");
    }
    lines.push(...localComponentSources);
    if (localComponentSources.length > 0) {
      lines.push("");
    }
    lines.push(rootDeclarationSource);
    lines.push(`export { ${rootComponent.localName} as __rscPrismComponent };`);
    lines.push("");

    return {
      sourceCode: `${lines.join("\n")}\n`,
      inferredClientModules,
    };
  };

  const isWorkerRuntimeRelevantModule = (parsed: ParsedDirectiveModule): boolean => {
    return (
      (parsed.isDirectiveModule && parsed.type === "worker") ||
      parsed.hasWorkerActionExports === true ||
      parsed.hasWorkerComponentExports === true ||
      parsed.hasLocalWorkerComponents === true
    );
  };

  const collectWorkerModulesForRuntime = async (): Promise<WorkerRuntimeCollectionResult> => {
    if (config == null) {
      throw new Error("[rsc-prism] Vite config is not resolved yet.");
    }
    const root = config.root;

    const collected: WorkerRuntimeModuleEntry[] = [];
    const componentBindings: WorkerRuntimeComponentBinding[] = [];
    const inlineSources: InlineWorkerComponentSource[] = [];
    const inferredClientModules = new Set<string>();

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

        const source = await readFile(absolutePath, "utf8");
        const parsed = await parseDirectiveModule(absolutePath);
        if (parsed.exportsInfo == null) {
          continue;
        }
        const includeAsWorkerModule = parsed.isDirectiveModule && parsed.type === "worker";
        const includeAsActionModule = parsed.hasWorkerActionExports === true;
        const includeAsComponentDirectiveModule =
          parsed.hasWorkerComponentExports === true &&
          parsed.isDirectiveModule &&
          parsed.type === "worker";
        if (
          !includeAsWorkerModule &&
          !includeAsActionModule &&
          !includeAsComponentDirectiveModule &&
          !parsed.hasLocalWorkerComponents
        ) {
          continue;
        }

        if (includeAsWorkerModule || includeAsActionModule || includeAsComponentDirectiveModule) {
          collected.push({
            moduleId: mapModuleId(absolutePath),
            importPath: normalizePath(absolutePath),
            exportsInfo: parsed.exportsInfo,
            isWorkerDirectiveModule: includeAsWorkerModule,
          });
        }

        const shouldExtractWorkerComponents = !(
          parsed.isDirectiveModule && parsed.type === "worker"
        );
        const localWorkerComponents = shouldExtractWorkerComponents
          ? (parsed.workerComponents ?? [])
          : [];
        if (localWorkerComponents.length === 0) {
          continue;
        }

        const ast = parseModule(source, absolutePath);
        for (const localComponent of localWorkerComponents) {
          const inlineSource = await buildInlineWorkerComponentSource(
            absolutePath,
            source,
            ast,
            localComponent,
            parsed.workerComponents ?? [],
          );
          const fileHash = createDeterministicHash(`${absolutePath}:${localComponent.componentId}`);
          const fileName = `${toValidIdentifier(localComponent.localName)}-${fileHash}.tsx`;
          inlineSources.push({
            componentId: localComponent.componentId,
            fileName,
            sourceCode: inlineSource.sourceCode,
          });
          for (const inferredModule of inlineSource.inferredClientModules) {
            inferredClientModules.add(inferredModule);
          }
          componentBindings.push({
            componentId: localComponent.componentId,
            importPath: normalizePath(
              path.resolve(
                root,
                ".vite",
                "rsc-prism-worker-runtime-src",
                "inline-components",
                fileName,
              ),
            ),
            exportName: "__rscPrismComponent",
          });
        }
      }
    }

    await visit(root);

    const deduped = new Map<string, WorkerRuntimeModuleEntry>();
    for (const entry of collected) {
      if (!deduped.has(entry.moduleId)) {
        deduped.set(entry.moduleId, entry);
      }
    }

    return {
      modules: [...deduped.values()].sort((left, right) =>
        left.moduleId.localeCompare(right.moduleId),
      ),
      componentBindings,
      inlineSources,
      inferredClientModules,
    };
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
    const inlineComponentsDir = path.resolve(sourceDir, "inline-components");
    await mkdir(sourceDir, { recursive: true });
    await mkdir(inlineComponentsDir, { recursive: true });

    await ensureRefIdMap();
    let workerRuntimeCollection = await collectWorkerModulesForRuntime();
    actionShortIdMap = buildWorkerActionShortIdMap(workerRuntimeCollection.modules);
    // Inline worker component extraction can discover extra client modules.
    // Rebuild ref ids against that expanded set before writing inline sources,
    // or worker-side createClientRef() calls can drift from the main table.
    inferredClientModulePaths = workerRuntimeCollection.inferredClientModules;
    refIdMapCache = null;
    await ensureRefIdMap();
    workerRuntimeCollection = await collectWorkerModulesForRuntime();
    actionShortIdMap = buildWorkerActionShortIdMap(workerRuntimeCollection.modules);
    for (const inlineSource of workerRuntimeCollection.inlineSources) {
      const inlinePath = path.resolve(inlineComponentsDir, inlineSource.fileName);
      await writeFile(inlinePath, inlineSource.sourceCode, "utf8");
    }
    const { code: registryCode, actionShortIdMap: registryActionShortIdMap } =
      buildWorkerComponentRegistryCode(
        workerRuntimeCollection.modules,
        workerRuntimeCollection.componentBindings,
      );
    actionShortIdMap = registryActionShortIdMap;
    await writeFile(registryPath, registryCode, "utf8");
    await writeFile(
      entryPath,
      buildGeneratedWorkerEntryCode(experimentalActionBatchRefresh),
      "utf8",
    );

    generatedWorkerOutDir = outDir;
    generatedWorkerEntryPath = entryPath;
    generatedWorkerRegistryPath = registryPath;
    generatedWorkerInlineComponentsDir = inlineComponentsDir;
    inferredClientModulePaths = workerRuntimeCollection.inferredClientModules;
    refIdMapCache = null;

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
    const useStableAssetNames = config.command === "serve";

    await viteBuild({
      configFile: false,
      mode,
      root: config.root,
      publicDir: false,
      build: {
        write: true,
        outDir,
        emptyOutDir: true,
        modulePreload: false,
        rollupOptions: {
          input: entryPath,
          preserveEntrySignatures: "strict",
          treeshake: true,
          output: {
            format: "es",
            entryFileNames: useStableAssetNames
              ? `assets/${INTERNAL_WORKER_RUNTIME_ASSET_NAME}.js`
              : `assets/${INTERNAL_WORKER_RUNTIME_ASSET_NAME}-[hash].js`,
            chunkFileNames: useStableAssetNames ? "assets/[name].js" : "assets/[name]-[hash].js",
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
        }> = [];

        if (
          workerRuntimeEnabled &&
          config != null &&
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

        tags.push({
          tag: "script",
          attrs: {
            type: "module",
            src: mainVirtualSrc,
          },
          injectTo: "head-prepend",
        });

        return {
          html,
          tags,
        };
      },
    },
    async resolveId(id, importer) {
      if (id.includes(ORIGINAL_MODULE_BYPASS_QUERY)) {
        return null;
      }
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

        if (directiveModule.hasWorkerComponentExports) {
          return `${MAIN_WORKER_DIRECTIVE_REF_VIRTUAL_ID_PREFIX}${normalizePath(absolutePath)}`;
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
        const refIdMap = await ensureRefIdMap();
        return buildWorkerProxyModuleCode(moduleId, directiveModule.exportsInfo, refIdMap);
      }

      if (options.mode === "main" && id.startsWith(MAIN_WORKER_REF_VIRTUAL_ID_PREFIX)) {
        if (workerRuntimeEnabled && actionShortIdMap.size === 0) {
          await ensureGeneratedWorkerSources();
        }
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
        return buildMainWorkerReferenceModuleCode(
          moduleId,
          directiveModule.exportsInfo,
          actionShortIdMap,
        );
      }

      if (options.mode === "main" && id.startsWith(MAIN_WORKER_ACTION_REF_VIRTUAL_ID_PREFIX)) {
        if (workerRuntimeEnabled && actionShortIdMap.size === 0) {
          await ensureGeneratedWorkerSources();
        }
        const absolutePath = id.slice(MAIN_WORKER_ACTION_REF_VIRTUAL_ID_PREFIX.length);
        const directiveModule = await parseDirectiveModule(absolutePath);
        if (
          directiveModule.exportsInfo == null ||
          !directiveModule.hasWorkerActionExports ||
          directiveModule.hasWorkerComponentExports
        ) {
          throw new Error(
            `[rsc-prism] Main worker action reference requested for non-action module "${absolutePath}".`,
          );
        }
        const moduleId = mapModuleId(absolutePath);
        return buildMainWorkerActionReferenceModuleCode(
          moduleId,
          directiveModule.exportsInfo,
          actionShortIdMap,
        );
      }

      if (options.mode === "main" && id.startsWith(MAIN_WORKER_DIRECTIVE_REF_VIRTUAL_ID_PREFIX)) {
        if (workerRuntimeEnabled && actionShortIdMap.size === 0) {
          await ensureGeneratedWorkerSources();
        }
        const absolutePath = id.slice(MAIN_WORKER_DIRECTIVE_REF_VIRTUAL_ID_PREFIX.length);
        const directiveModule = await parseDirectiveModule(absolutePath);
        if (directiveModule.exportsInfo == null || !directiveModule.hasWorkerComponentExports) {
          throw new Error(
            `[rsc-prism] Main worker directive reference requested for non-component module "${absolutePath}".`,
          );
        }
        const moduleId = mapModuleId(absolutePath);
        return buildMainWorkerDirectiveReferenceModuleCode(
          moduleId,
          directiveModule.exportsInfo,
          withBypassQuery(normalizePath(absolutePath)),
          actionShortIdMap,
        );
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
          return buildWorkerBootstrapCode(
            generatedWorkerServePublicPath ?? fallbackWorkerPath,
            experimentalActionBatchRefresh,
          );
        }
        return null;
      }

      if (config == null) {
        throw new Error("[rsc-prism] Vite config is not resolved yet.");
      }

      if (workerRuntimeEnabled && inferredClientModulePaths.size === 0) {
        try {
          await ensureGeneratedWorkerSources();
        } catch {
          // Fall through and generate the default manifest surface.
        }
      }

      const modules = await collectMainThreadModules(
        config.root,
        includeFilter,
        mainDirectives,
        mapModuleId,
        inferredClientModulePaths,
        { experimentalComponentLevelDirectives },
      );
      return buildMainVirtualModuleCode(modules, {
        includeWorkerBootstrapImport: workerRuntimeEnabled,
      });
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

        const rawPath = (req.url ?? "").split("?", 1)[0]!;
        let requestPath: string;
        try {
          requestPath = decodeURIComponent(rawPath);
        } catch {
          requestPath = rawPath;
        }
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
          res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
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
    async transform(code, id) {
      if (id.includes(ORIGINAL_MODULE_BYPASS_QUERY)) {
        return null;
      }
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
      const moduleId = mapModuleId(projectFilePath);
      const workerComponents = discoverWorkerComponents(ast, code, moduleId, {
        experimentalComponentLevelDirectives,
      });
      const aggregateWorkerComponentSource = workerComponents
        .map((component) => code.slice(component.sourceStart, component.sourceEnd))
        .join("\n");
      const localMainComponentNames = collectReferencedTopLevelMainComponentNames(
        ast,
        workerComponents,
        aggregateWorkerComponentSource,
      );
      const hasLocalOnlyWorkerComponents = workerComponents.some(
        (component) => component.exportName == null || component.declarationType === "rsc-call",
      );
      if (options.mode === "worker" && directiveType !== "main") {
        return null;
      }
      if (
        options.mode === "main" &&
        directiveType !== "worker" &&
        !hasWorkerActionDirectiveLiteral &&
        !hasLocalOnlyWorkerComponents
      ) {
        return null;
      }
      const exportsInfo = collectRuntimeExports(ast, absolutePath, {
        experimentalComponentLevelDirectives,
      });
      const hasWorkerActionExports = exportsInfo.actionExports.length > 0;
      const hasWorkerComponentExports = exportsInfo.componentExports.length > 0;
      if (
        directiveType == null &&
        !hasWorkerActionExports &&
        !hasWorkerComponentExports &&
        !hasLocalOnlyWorkerComponents
      ) {
        return null;
      }
      if (
        options.mode === "main" &&
        workerRuntimeEnabled &&
        hasWorkerActionExports &&
        actionShortIdMap.size === 0
      ) {
        try {
          await ensureGeneratedWorkerSources();
        } catch {
          // Fall back to full-path refs when worker sources cannot be generated (e.g. virtual roots in tests)
        }
      }
      let transformedCode: string | null = null;

      if (options.mode === "worker" && directiveType === "main") {
        const refIdMap = await ensureRefIdMap();
        transformedCode = buildWorkerProxyModuleCode(moduleId, exportsInfo, refIdMap);
      }

      if (options.mode === "main" && directiveType === "worker") {
        transformedCode = buildMainWorkerReferenceModuleCode(
          moduleId,
          exportsInfo,
          actionShortIdMap,
        );
      }

      if (options.mode === "main" && directiveType == null && hasLocalOnlyWorkerComponents) {
        transformedCode = buildLocalWorkerComponentTransform(
          code,
          moduleId,
          workerComponents,
          localMainComponentNames,
        );
      } else if (options.mode === "main" && directiveType == null && hasWorkerComponentExports) {
        transformedCode = buildMainWorkerDirectiveReferenceModuleCode(
          moduleId,
          exportsInfo,
          withBypassQuery(normalizePath(projectFilePath)),
          actionShortIdMap,
        );
      } else if (options.mode === "main" && directiveType == null && hasWorkerActionExports) {
        transformedCode = buildMainWorkerActionReferenceModuleCode(
          moduleId,
          exportsInfo,
          actionShortIdMap,
        );
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
      if (
        generatedWorkerInlineComponentsDir != null &&
        normalizedFile.startsWith(normalizePath(generatedWorkerInlineComponentsDir))
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
    workerRuntime: {
      ...options.workerRuntime,
      enabled: options.workerRuntime?.enabled ?? true,
      outDir: options.workerRuntime?.outDir ?? ".vite/rsc-prism-worker-runtime",
      aliases: options.workerRuntime?.aliases ?? [],
    },
  });
}

function rscPrismWorker(options: Omit<RscPrismVitePluginOptions, "workerRuntime"> = {}): Plugin {
  return createRscPrismPlugin({
    ...options,
    mode: "worker",
  });
}
