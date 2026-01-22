import type { StandardSchemaV1 } from "./standard-schema";
import type { BrandValue } from "./types";
import { describe, it, expect, expectTypeOf } from "vitest";

import { brand } from "./brand";

describe("brand", () => {
  describe("brand()", () => {
    it("should create a nominal type constructor", () => {
      const UserId = brand<string, "UserId">();
      expect(UserId).toBeTypeOf("function");
    });

    it("should brand values", () => {
      const UserId = brand<string, "UserId">();
      const userId = UserId("user-123");
      expect(userId).toBe("user-123");
    });

    it("should preserve value type at runtime", () => {
      const Count = brand<number, "Count">();
      const count = Count(42);
      expect(count).toBe(42);
      expect(typeof count).toBe("number");
    });

    it("should expose is/to helpers", () => {
      const UserId = brand<string, "UserId">();
      expect(UserId.is).toBeTypeOf("function");
      expect(UserId.to).toBeTypeOf("function");
    });

    it("should expose as helper", () => {
      const UserId = brand<string, "UserId">();
      expect(UserId.as).toBeTypeOf("function");
      expect(UserId.as("any-value")).toBe("any-value");
    });

    it("should throw when validator fails", () => {
      const isPositive = (v: unknown): v is number => typeof v === "number" && v > 0;
      const PositiveNumber = brand<number, "PositiveNumber">({
        validator: isPositive,
      });

      expect(() => PositiveNumber.to(-5)).toThrow("Brand invariant violation");
    });

    it("should pass when validator succeeds", () => {
      const isPositive = (v: unknown): v is number => typeof v === "number" && v > 0;
      const PositiveNumber = brand<number, "PositiveNumber">({
        validator: isPositive,
      });

      expect(() => PositiveNumber.to(5)).not.toThrow();
      expect(PositiveNumber.to(5)).toBe(5);
    });

    it("should work without validator", () => {
      const Tag = brand<string, "Tag">();
      expect(() => Tag("test")).not.toThrow();
    });

    it("should handle complex value types", () => {
      type UserData = { id: string; name: string };
      const User = brand<UserData, "User">();

      const user = User({ id: "1", name: "John" });
      expect(user.id).toBe("1");
      expect(user.name).toBe("John");
    });

    it("should support standard schema validators", () => {
      const validator: StandardSchemaV1<unknown, number> = {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: (value: unknown) =>
            typeof value === "number" && value > 0
              ? { value }
              : { issues: [{ message: "Expected positive number" }] },
        },
      };
      const PositiveNumber = brand<number, "PositiveNumber">({ validator });

      expect(PositiveNumber.is(3)).toBe(true);
      expect(PositiveNumber.is(-1)).toBe(false);
      expect(PositiveNumber.to(3)).toBe(3);
      expect(() => PositiveNumber.to(-1)).toThrow("Brand invariant violation");
    });
  });

  describe("brand.generic()", () => {
    it("should create a generic branding function", () => {
      const Id = brand.generic<"Id">();
      expect(Id).toBeTypeOf("function");
    });

    it("should expose is/to/as helpers", () => {
      const Id = brand.generic<"Id">();
      expect(Id<string>().is).toBeTypeOf("function");
      expect(Id<number>()).toBeTypeOf("function");
      expect(Id<string>().as).toBeTypeOf("function");
    });

    it("should brand values of any type", () => {
      const Id = brand.generic<"Id">();

      const stringId = Id<string>()("abc");
      const numberId = Id<number>()(123);
      const objectId = Id<{ key: string }>()({ key: "value" });

      expect(stringId).toBe("abc");
      expect(numberId).toBe(123);
      expect(objectId).toEqual({ key: "value" });
    });

    it("should preserve literal types", () => {
      const Literal = brand.generic<"Literal">();
      const value = Literal<"specific">()("specific");
      expect(value).toBe("specific");
    });

    it("should support standard schema validators", () => {
      const schema: StandardSchemaV1<unknown, unknown> = {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: (value: unknown) =>
            typeof value === "string" ? { value } : { issues: [{ message: "Expected string" }] },
        },
      };
      const Id = brand.generic<"Id">()({
        validator: schema,
      });

      expect(Id.is("ok")).toBe(true);
      expect(Id.is(123)).toBe(false);
      expect(Id.to("ok")).toBe("ok");
      expect(() => Id.to(123)).toThrow("Brand invariant violation");
    });
  });
});

describe("brand types", () => {
  describe("BrandValue type", () => {
    it("should preserve original value type", () => {
      const UserId = brand<string, "UserId">();
      const userId = UserId("test");

      expectTypeOf(userId).toExtend<string>();
    });

    it("should be assignable to original type", () => {
      const UserId = brand<string, "UserId">();
      const userId = UserId("test");

      // Branded values should be usable where base type is expected
      const fn = (s: string) => s.length;
      expectTypeOf(fn(userId)).toBeNumber();
    });

    it("should not be assignable from plain type", () => {
      type BrandedString = BrandValue<string, "Branded">;

      // This is the key feature - plain strings can't be used as branded
      expectTypeOf<string>().not.toExtend<BrandedString>();
    });
  });

  describe("Nominal type", () => {
    it("should be callable", () => {
      const UserId = brand<string, "UserId">();
      expectTypeOf(UserId).toBeCallableWith("test");
    });

    it("should have is/to helpers", () => {
      const UserId = brand<string, "UserId">();
      expectTypeOf(UserId.is).toBeFunction();
      expectTypeOf(UserId.to).toBeFunction();
    });

    it("should have as helper", () => {
      const UserId = brand<string, "UserId">();
      expectTypeOf(UserId.as).toBeFunction();
    });

    it("should return branded value", () => {
      const UserId = brand<string, "UserId">();
      const result = UserId("test");

      expectTypeOf(result).toExtend<BrandValue<string, "UserId">>();
    });
  });

  describe("GenericNominal type", () => {
    it("should accept any value type", () => {
      const Id = brand.generic<"Id">();

      expectTypeOf(Id<string>()).toBeCallableWith("string");
      expectTypeOf(Id<number>()).toBeCallableWith(123);
      expectTypeOf(Id<{ obj: boolean }>()).toBeCallableWith({ obj: true });
    });

    it("should infer value type from input", () => {
      const Id = brand.generic<"Id">();

      const stringId = Id<string>()("abc");
      const numberId = Id<number>()(123);

      expectTypeOf(stringId).toExtend<BrandValue<string, "Id">>();
      expectTypeOf(numberId).toExtend<BrandValue<number, "Id">>();
    });
  });

  describe("brand.Generic type", () => {
    it("should create branded type alias", () => {
      type UserId = brand.Generic<"UserId", string>;

      expectTypeOf<UserId>().toExtend<string>();
      expectTypeOf<string>().not.toExtend<UserId>();
    });
  });

  describe("extracting branded type", () => {
    it("should work with typeof .type property", () => {
      const UserId = brand<string, "UserId">();
      type UserIdType = typeof UserId.type;

      expectTypeOf<UserIdType>().toExtend<BrandValue<string, "UserId">>();
    });

    it("should work with ReturnType utility", () => {
      const UserId = brand<string, "UserId">();
      type UserIdType = ReturnType<typeof UserId>;

      expectTypeOf<UserIdType>().toExtend<BrandValue<string, "UserId">>();
    });
  });

  describe("type discrimination", () => {
    it("should prevent mixing different branded types", () => {
      const UserId = brand<string, "UserId">();
      const PostId = brand<string, "PostId">();

      type UserIdType = ReturnType<typeof UserId>;
      type PostIdType = ReturnType<typeof PostId>;

      // Different brands should not be assignable to each other
      expectTypeOf<UserIdType>().not.toExtend<PostIdType>();
      expectTypeOf<PostIdType>().not.toExtend<UserIdType>();
    });

    it("should allow same brand types to be compatible", () => {
      const UserId1 = brand<string, "UserId">();
      const UserId2 = brand<string, "UserId">();

      type Type1 = ReturnType<typeof UserId1>;
      type Type2 = ReturnType<typeof UserId2>;

      // Same brand name makes types compatible at type level
      expectTypeOf<Type1>().toExtend<Type2>();
    });
  });
});
