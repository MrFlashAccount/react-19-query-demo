import { describe, expect, it } from "vitest";

import { http } from "../src/http";

describe("http helpers in browser", () => {
  it("creates method route definitions", () => {
    const get = http.get("/a", () => new Response("a"));
    const post = http.post("/a", () => new Response("b"));

    expect(get.method).toBe("GET");
    expect(post.method).toBe("POST");
    expect(get.path).toBe("/a");
  });

  it("creates all-method route list", () => {
    const routes = http.all("/all", () => new Response("ok"));

    expect(routes).toHaveLength(7);
    expect(routes.map((x) => x.method)).toEqual([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
    ]);
  });
});
