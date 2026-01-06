import { describe, it, expect } from "vitest";
import * as babel from "@babel/core";
import plugin from "../index.js";

/**
 * Helper to transform code with the plugin
 * @param {string} code
 * @param {import("../index.js").TracingPluginOptions} options
 * @returns {string}
 */
function transform(code, options = {}) {
  const result = babel.transformSync(code, {
    plugins: [[plugin, options]],
    parserOpts: { sourceType: "module" },
    filename: "test.ts",
  });
  return result?.code || "";
}

/**
 * Normalize whitespace for comparison
 * @param {string} code
 * @returns {string}
 */
function normalize(code) {
  return code.replace(/\s+/g, " ").trim();
}

describe("tracing-babel-plugin", () => {
  describe("function declarations", () => {
    it("should wrap function declaration", () => {
      const input = `
        function fetchUser(id) {
          return api.get(id);
        }
      `;

      const output = transform(input);

      expect(output).toContain("import { runInSpan as");
      expect(output).toContain('"fetchUser"');
      expect(output).toContain("return api.get(id)");
    });

    it("should wrap async function declaration", () => {
      const input = `
        async function fetchUser(id) {
          return await api.get(id);
        }
      `;

      const output = transform(input);

      expect(output).toContain("async (__span)");
      expect(output).toContain('"fetchUser"');
    });

    it("should wrap generator function", () => {
      const input = `
        function* generateItems() {
          yield 1;
          yield 2;
        }
      `;

      const output = transform(input);

      expect(output).toContain('"generateItems"');
    });

    it("should preserve function name in span", () => {
      const input = `
        function myCustomFunction() {
          doSomething();
        }
      `;

      const output = transform(input);

      expect(output).toContain('"myCustomFunction"');
    });
  });

  describe("arrow functions", () => {
    it("should wrap arrow function with block body", () => {
      const input = `
        const fetchUser = (id) => {
          return api.get(id);
        };
      `;

      const output = transform(input);

      expect(output).toContain('"fetchUser"');
      expect(output).toContain("runInSpan");
    });

    it("should wrap arrow function with expression body", () => {
      const input = `
        const double = (x) => x * 2;
      `;

      const output = transform(input);

      expect(output).toContain('"double"');
      expect(output).toContain("return x * 2");
    });

    it("should wrap async arrow function", () => {
      const input = `
        const fetchData = async (url) => {
          const res = await fetch(url);
          return res.json();
        };
      `;

      const output = transform(input);

      expect(output).toContain("async (__span)");
      expect(output).toContain('"fetchData"');
    });

    it("should handle arrow function assigned to object property", () => {
      const input = `
        const api = {
          fetch: (url) => {
            return request(url);
          }
        };
      `;

      const output = transform(input);

      expect(output).toContain('"fetch"');
    });
  });

  describe("function expressions", () => {
    it("should wrap named function expression", () => {
      const input = `
        const handler = function handleClick() {
          doSomething();
        };
      `;

      const output = transform(input);

      // Uses variable name since that's the binding
      expect(output).toContain('"handler"');
    });

    it("should wrap anonymous function expression", () => {
      const input = `
        const handler = function() {
          doSomething();
        };
      `;

      const output = transform(input);

      expect(output).toContain('"handler"');
    });

    it("should handle IIFE", () => {
      const input = `
        (function() {
          setup();
        })();
      `;

      const output = transform(input);

      // Anonymous IIFE
      expect(output).toContain('"<anonymous>"');
    });
  });

  describe("object methods", () => {
    it("should wrap object method shorthand", () => {
      const input = `
        const obj = {
          getData() {
            return this.data;
          }
        };
      `;

      const output = transform(input);

      expect(output).toContain('"getData"');
    });

    it("should wrap object method with function value", () => {
      const input = `
        const obj = {
          getData: function() {
            return this.data;
          }
        };
      `;

      const output = transform(input);

      expect(output).toContain('"getData"');
    });
  });

  describe("class methods", () => {
    it("should wrap class method", () => {
      const input = `
        class UserService {
          getUser(id) {
            return this.repo.find(id);
          }
        }
      `;

      const output = transform(input);

      expect(output).toContain('"getUser"');
    });

    it("should wrap async class method", () => {
      const input = `
        class UserService {
          async fetchUser(id) {
            return await this.api.get(id);
          }
        }
      `;

      const output = transform(input);

      expect(output).toContain("async (__span)");
      expect(output).toContain('"fetchUser"');
    });

    it("should wrap class property arrow function", () => {
      const input = `
        class Component {
          handleClick = () => {
            this.setState({ clicked: true });
          };
        }
      `;

      const output = transform(input);

      expect(output).toContain('"handleClick"');
    });
  });

  describe("source location", () => {
    it("should include location in meta when enabled", () => {
      const input = `
        function test() {
          return 1;
        }
      `;

      const output = transform(input, { includeLocation: true });

      expect(output).toContain("description");
      expect(output).toContain("test.ts");
    });

    it("should exclude location when disabled", () => {
      const input = `
        function test() {
          return 1;
        }
      `;

      const output = transform(input, { includeLocation: false });

      expect(output).not.toContain("description");
    });
  });

  describe("directive comments", () => {
    it("should skip function with @no-trace comment", () => {
      const input = `
        // @no-trace
        function helper() {
          return 1;
        }
      `;

      const output = transform(input);

      expect(output).not.toContain("runInSpan");
      expect(output).toContain("function helper()");
    });

    it("should skip function with no-trace comment", () => {
      const input = `
        /* no-trace */
        function helper() {
          return 1;
        }
      `;

      const output = transform(input);

      expect(output).not.toContain("runInSpan");
    });

    it("should force trace with @trace comment when minStatements would skip", () => {
      const input = `
        // @trace
        function tiny() {
          return 1;
        }
      `;

      const output = transform(input, { minStatements: 5 });

      expect(output).toContain("runInSpan");
      expect(output).toContain('"tiny"');
    });

    it("should use custom skipDirective", () => {
      const input = `
        // @skip-tracing
        function helper() {
          return 1;
        }
      `;

      const output = transform(input, { skipDirective: "skip-tracing" });

      expect(output).not.toContain("runInSpan");
    });
  });

  describe("minStatements option", () => {
    it("should skip functions with fewer statements than minStatements", () => {
      const input = `
        function single() {
          return 1;
        }
      `;

      const output = transform(input, { minStatements: 2 });

      expect(output).not.toContain("runInSpan");
    });

    it("should trace functions meeting minStatements threshold", () => {
      const input = `
        function multi() {
          const x = 1;
          const y = 2;
          return x + y;
        }
      `;

      const output = transform(input, { minStatements: 2 });

      expect(output).toContain("runInSpan");
      expect(output).toContain('"multi"');
    });

    it("should skip arrow expression body when minStatements > 1", () => {
      const input = `
        const fn = (x) => x * 2;
      `;

      const output = transform(input, { minStatements: 2 });

      expect(output).not.toContain("runInSpan");
    });
  });

  describe("skipFunctions option", () => {
    it("should skip functions in skipFunctions list", () => {
      const input = `
        function helper() {
          return 1;
        }
        function main() {
          return helper();
        }
      `;

      const output = transform(input, { skipFunctions: ["helper"] });

      expect(output).toContain("function helper()");
      expect(output).not.toContain('"helper"');
      expect(output).toContain('"main"');
    });

    it("should skip multiple functions in list", () => {
      const input = `
        function a() { return 1; }
        function b() { return 2; }
        function c() { return 3; }
      `;

      const output = transform(input, { skipFunctions: ["a", "b"] });

      expect(output).not.toContain('"a"');
      expect(output).not.toContain('"b"');
      expect(output).toContain('"c"');
    });
  });

  describe("onlyFunctions option", () => {
    it("should only trace functions in onlyFunctions list", () => {
      const input = `
        function tracked() { return 1; }
        function ignored() { return 2; }
      `;

      const output = transform(input, { onlyFunctions: ["tracked"] });

      expect(output).toContain('"tracked"');
      expect(output).not.toContain('"ignored"');
    });

    it("should ignore onlyFunctions when empty array", () => {
      const input = `
        function a() { return 1; }
        function b() { return 2; }
      `;

      const output = transform(input, { onlyFunctions: [] });

      expect(output).toContain('"a"');
      expect(output).toContain('"b"');
    });
  });

  describe("file filtering", () => {
    it("should skip files not matching include pattern", () => {
      const input = `
        function test() { return 1; }
      `;

      const result = babel.transformSync(input, {
        plugins: [[plugin, { include: /\.tsx$/ }]],
        parserOpts: { sourceType: "module" },
        filename: "test.ts",
      });

      expect(result?.code).not.toContain("runInSpan");
    });

    it("should skip files matching exclude pattern", () => {
      const input = `
        function test() { return 1; }
      `;

      const result = babel.transformSync(input, {
        plugins: [[plugin, { exclude: /\.test\./ }]],
        parserOpts: { sourceType: "module" },
        filename: "utils.test.ts",
      });

      expect(result?.code).not.toContain("runInSpan");
    });

    it("should skip node_modules by default", () => {
      const input = `
        function test() { return 1; }
      `;

      const result = babel.transformSync(input, {
        plugins: [[plugin, {}]],
        parserOpts: { sourceType: "module" },
        filename: "node_modules/lodash/index.js",
      });

      expect(result?.code).not.toContain("runInSpan");
    });
  });

  describe("import handling", () => {
    it("should add import statement", () => {
      const input = `
        function test() { return 1; }
      `;

      const output = transform(input);

      expect(output).toMatch(/^import \{ runInSpan as/);
    });

    it("should reuse existing import if present", () => {
      const input = `
        import { runInSpan } from "@lib/tracing/asynccontext";
        function test() { return 1; }
      `;

      const output = transform(input);

      // Should only have one import line for runInSpan
      const imports = output.match(/import.*runInSpan/g);
      expect(imports).toHaveLength(1);
    });

    it("should use custom tracingModule", () => {
      const input = `
        function test() { return 1; }
      `;

      const output = transform(input, {
        tracingModule: "./my-tracer",
      });

      expect(output).toContain('from "./my-tracer"');
    });

    it("should use custom runInSpanFn name", () => {
      const input = `
        function test() { return 1; }
      `;

      const output = transform(input, {
        runInSpanFn: "withSpan",
      });

      expect(output).toContain("import { withSpan as");
    });

    it("should only add one import for multiple functions", () => {
      const input = `
        function a() { return 1; }
        function b() { return 2; }
        function c() { return 3; }
      `;

      const output = transform(input);

      const imports = output.match(/^import/gm);
      expect(imports).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should not double-wrap already traced functions", () => {
      const input = `
        function test() { return 1; }
      `;

      // Transform twice
      const first = transform(input);
      const second =
        babel.transformSync(first, {
          plugins: [[plugin, {}]],
          parserOpts: { sourceType: "module" },
          filename: "test.ts",
        })?.code || "";

      // Should not have nested runInSpan calls
      const runInSpanCount = (second.match(/runInSpan/g) || []).length;
      // One for import, one for call
      expect(runInSpanCount).toBeLessThanOrEqual(3);
    });

    it("should handle empty function body", () => {
      const input = `
        function noop() {}
      `;

      const output = transform(input);

      expect(output).toContain("runInSpan");
    });

    it("should handle function with only comments", () => {
      const input = `
        function commented() {
          // just a comment
        }
      `;

      const output = transform(input);

      // Should still wrap (has 0 statements but minStatements default is 0)
      expect(output).toContain('"commented"');
    });

    it("should handle nested functions", () => {
      const input = `
        function outer() {
          function inner() {
            return 1;
          }
          return inner();
        }
      `;

      const output = transform(input);

      expect(output).toContain('"outer"');
      expect(output).toContain('"inner"');
    });

    it("should handle functions with destructuring params", () => {
      const input = `
        function process({ name, value }) {
          return name + value;
        }
      `;

      const output = transform(input);

      expect(output).toContain('"process"');
      expect(output).toContain("{ name, value }");
    });

    it("should handle functions with rest params", () => {
      const input = `
        function collect(...args) {
          return args.join();
        }
      `;

      const output = transform(input);

      expect(output).toContain('"collect"');
      expect(output).toContain("...args");
    });

    it("should handle functions with default params", () => {
      const input = `
        function greet(name = "World") {
          return "Hello " + name;
        }
      `;

      const output = transform(input);

      expect(output).toContain('"greet"');
      expect(output).toContain('name = "World"');
    });
  });

  describe("output structure", () => {
    it("should produce valid runInSpan call structure", () => {
      const input = `
        function fetchData(url) {
          const response = fetch(url);
          return response.json();
        }
      `;

      const output = transform(input, { includeLocation: true });

      // Should have: runInSpan(callback, name, meta)
      expect(output).toContain("(__span) =>");
      expect(output).toContain('"fetchData"');
      expect(output).toContain("description:");
    });

    it("should preserve original function body in callback", () => {
      const input = `
        function calculate(a, b) {
          const sum = a + b;
          const product = a * b;
          return { sum, product };
        }
      `;

      const output = transform(input);

      expect(output).toContain("const sum = a + b");
      expect(output).toContain("const product = a * b");
      expect(output).toContain("return { sum, product }");
    });

    it("should handle this context correctly", () => {
      const input = `
        const obj = {
          value: 42,
          getValue() {
            return this.value;
          }
        };
      `;

      const output = transform(input);

      // Arrow function preserves this context
      expect(output).toContain("this.value");
    });
  });
});

describe("utils", () => {
  const utils = require("../utils.js");

  describe("isEventHandler", () => {
    it("should detect onClick handlers", () => {
      expect(utils.isEventHandler("onClick")).toBe(true);
      expect(utils.isEventHandler("onSubmit")).toBe(true);
      expect(utils.isEventHandler("onChange")).toBe(true);
    });

    it("should detect handleX handlers", () => {
      expect(utils.isEventHandler("handleClick")).toBe(true);
      expect(utils.isEventHandler("handleSubmit")).toBe(true);
    });

    it("should not match non-handlers", () => {
      expect(utils.isEventHandler("onclick")).toBe(false);
      expect(utils.isEventHandler("fetchOnClick")).toBe(false);
      expect(utils.isEventHandler("getHandler")).toBe(false);
    });
  });

  describe("isHook", () => {
    it("should detect React hooks", () => {
      expect(utils.isHook("useState")).toBe(true);
      expect(utils.isHook("useEffect")).toBe(true);
      expect(utils.isHook("useCustomHook")).toBe(true);
    });

    it("should not match non-hooks", () => {
      expect(utils.isHook("useless")).toBe(false);
      expect(utils.isHook("user")).toBe(false);
      expect(utils.isHook("getUseCase")).toBe(false);
    });
  });

  describe("shouldSkipByPattern", () => {
    it("should skip hooks when skipHooks is true", () => {
      expect(utils.shouldSkipByPattern("useEffect", { skipHooks: true })).toBe(
        true
      );
      expect(utils.shouldSkipByPattern("useEffect", { skipHooks: false })).toBe(
        false
      );
    });

    it("should skip event handlers when skipEventHandlers is true", () => {
      expect(
        utils.shouldSkipByPattern("onClick", { skipEventHandlers: true })
      ).toBe(true);
      expect(
        utils.shouldSkipByPattern("onClick", { skipEventHandlers: false })
      ).toBe(false);
    });

    it("should skip getters when skipGetters is true", () => {
      expect(utils.shouldSkipByPattern("getValue", { skipGetters: true })).toBe(
        true
      );
      expect(
        utils.shouldSkipByPattern("getValue", { skipGetters: false })
      ).toBe(false);
    });

    it("should skip setters when skipSetters is true", () => {
      expect(utils.shouldSkipByPattern("setValue", { skipSetters: true })).toBe(
        true
      );
      expect(
        utils.shouldSkipByPattern("setValue", { skipSetters: false })
      ).toBe(false);
    });

    it("should handle multiple patterns", () => {
      const patterns = { skipHooks: true, skipEventHandlers: true };
      expect(utils.shouldSkipByPattern("useEffect", patterns)).toBe(true);
      expect(utils.shouldSkipByPattern("onClick", patterns)).toBe(true);
      expect(utils.shouldSkipByPattern("fetchData", patterns)).toBe(false);
    });
  });
});
