import { describe, it, expect } from "vitest";
import * as babel from "@babel/core";
import plugin from "../explicit-parent.js";

/**
 * Helper to transform code with the plugin
 * @param {string} code
 * @param {import("../explicit-parent.js").ExplicitParentPluginOptions} options
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

describe("explicit-parent-tracing-plugin", () => {
  describe("function declarations", () => {
    it("should wrap function declaration with traced HOF", () => {
      const input = `
        function fetchUser(id) {
          return api.get(id);
        }
      `;

      const output = transform(input);

      expect(output).toContain("import { traced as");
      expect(output).toContain("const fetchUser = ");
      expect(output).toContain('"fetchUser"');
    });

    it("should add __parentSpan parameter", () => {
      const input = `
        function fetchUser(id) {
          return api.get(id);
        }
      `;

      const output = transform(input);

      expect(output).toContain("__parentSpan");
    });

    it("should preserve existing parameters", () => {
      const input = `
        function process(a, b, c) {
          return a + b + c;
        }
      `;

      const output = transform(input);

      expect(output).toMatch(/function process\(a, b, c, __parentSpan\)/);
    });

    it("should wrap async function", () => {
      const input = `
        async function fetchData(url) {
          return await fetch(url);
        }
      `;

      const output = transform(input);

      expect(output).toContain("async function fetchData");
      expect(output).toContain("__parentSpan");
    });
  });

  describe("arrow functions", () => {
    it("should wrap arrow function", () => {
      const input = `
        const fetchUser = (id) => {
          return api.get(id);
        };
      `;

      const output = transform(input);

      expect(output).toContain("traced");
      expect(output).toContain("__parentSpan");
      expect(output).toContain('"fetchUser"');
    });

    it("should convert expression body to block body", () => {
      const input = `
        const double = (x) => x * 2;
      `;

      const output = transform(input);

      // Should have return statement now
      expect(output).toContain("return x * 2");
      expect(output).toContain("__parentSpan");
    });

    it("should wrap async arrow function", () => {
      const input = `
        const getData = async (url) => {
          const res = await fetch(url);
          return res.json();
        };
      `;

      const output = transform(input);

      expect(output).toContain("async");
      expect(output).toContain("__parentSpan");
    });
  });

  describe("function expressions", () => {
    it("should wrap named function expression", () => {
      const input = `
        const handler = function processData(data) {
          return transform(data);
        };
      `;

      const output = transform(input);

      expect(output).toContain("traced");
      expect(output).toContain("__parentSpan");
    });

    it("should wrap anonymous function expression", () => {
      const input = `
        const handler = function(data) {
          return transform(data);
        };
      `;

      const output = transform(input);

      expect(output).toContain("traced");
      expect(output).toContain('"handler"');
    });
  });

  describe("traced HOF structure", () => {
    it("should produce: traced(fn, name, payload, meta)", () => {
      const input = `
        function test(a) {
          return a;
        }
      `;

      const output = transform(input, { includeLocation: true });

      // traced(function, "name", {}, { description: "..." })
      expect(output).toContain("traced");
      expect(output).toContain('"test"');
      expect(output).toContain("{}"); // empty payload
      expect(output).toContain("description:");
    });

    it("should use undefined for meta when location disabled", () => {
      const input = `
        function test() {
          return 1;
        }
      `;

      const output = transform(input, { includeLocation: false });

      expect(output).toContain("undefined");
    });
  });

  describe("options", () => {
    it("should use custom tracingModule", () => {
      const input = `
        function test() { return 1; }
      `;

      const output = transform(input, {
        tracingModule: "./custom-tracing",
      });

      expect(output).toContain('from "./custom-tracing"');
    });

    it("should use custom tracedFn name", () => {
      const input = `
        function test() { return 1; }
      `;

      const output = transform(input, {
        tracedFn: "wrapWithSpan",
      });

      expect(output).toContain("import { wrapWithSpan as");
    });

    it("should respect skipFunctions", () => {
      const input = `
        function helper() { return 1; }
        function main() { return helper(); }
      `;

      const output = transform(input, { skipFunctions: ["helper"] });

      expect(output).toContain("function helper()");
      expect(output).not.toContain('"helper"');
      expect(output).toContain('"main"');
    });

    it("should respect minStatements", () => {
      const input = `
        function tiny() { return 1; }
        function big() {
          const a = 1;
          const b = 2;
          return a + b;
        }
      `;

      const output = transform(input, { minStatements: 2 });

      expect(output).not.toContain('"tiny"');
      expect(output).toContain('"big"');
    });

    it("should respect skipDirective", () => {
      const input = `
        // @no-trace
        function helper() { return 1; }
      `;

      const output = transform(input);

      expect(output).not.toContain("traced");
    });
  });

  describe("file filtering", () => {
    it("should skip files not matching include", () => {
      const input = `function test() { return 1; }`;

      const result = babel.transformSync(input, {
        plugins: [[plugin, { include: /\.tsx$/ }]],
        parserOpts: { sourceType: "module" },
        filename: "test.ts",
      });

      expect(result?.code).not.toContain("traced");
    });

    it("should skip files matching exclude", () => {
      const input = `function test() { return 1; }`;

      const result = babel.transformSync(input, {
        plugins: [[plugin, { exclude: /node_modules/ }]],
        parserOpts: { sourceType: "module" },
        filename: "node_modules/lib/index.js",
      });

      expect(result?.code).not.toContain("traced");
    });
  });

  describe("edge cases", () => {
    it("should handle functions with no params", () => {
      const input = `
        function noParams() {
          return 42;
        }
      `;

      const output = transform(input);

      expect(output).toMatch(/function noParams\(__parentSpan\)/);
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

    it("should handle class methods", () => {
      const input = `
        class Service {
          getData(id) {
            return this.repo.find(id);
          }
        }
      `;

      const output = transform(input);

      expect(output).toContain("__parentSpan");
      expect(output).toContain('"getData"');
    });

    it("should handle object method shorthand", () => {
      const input = `
        const api = {
          fetch(url) {
            return request(url);
          }
        };
      `;

      const output = transform(input);

      expect(output).toContain('"fetch"');
    });

    it("should preserve function body", () => {
      const input = `
        function complex(data) {
          const validated = validate(data);
          const transformed = transform(validated);
          log(transformed);
          return transformed;
        }
      `;

      const output = transform(input);

      expect(output).toContain("const validated = validate(data)");
      expect(output).toContain("const transformed = transform(validated)");
      expect(output).toContain("log(transformed)");
      expect(output).toContain("return transformed");
    });
  });

  describe("import handling", () => {
    it("should add single import for multiple functions", () => {
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
});
