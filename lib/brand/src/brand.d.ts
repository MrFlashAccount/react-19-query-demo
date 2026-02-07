import type { Nominal, BrandValue, BrandOptions } from "./types";
/**
 * Creates a nominal (branded) type constructor.
 * Useful for creating distinct types from primitive values.
 *
 * @example
 * ```ts
 * const UserId = brand<string, "UserId">({
 *   validator: (value: unknown): value is string => typeof value === "string",
 * });
 * const userId = UserId("user-123"); // BrandValue<string, "UserId">
 * ```
 */
export declare function brand<ValueType = never, const BrandName = never>(options?: BrandOptions<ValueType>): Nominal<ValueType, BrandName>;
export declare namespace brand {
    /**
     * Creates a generic branding function with a fixed brand name.
     * The value type remains generic at call site.
     *
     * @example
     * ```ts
     * const Id = brand.generic<"Id">();
     * const stringId = Id("abc");  // BrandValue<"abc", "Id">
     * const numberId = Id(123);    // BrandValue<123, "Id">
     * ```
     */
    function generic<const BrandName = never>(): <const ValueType = never>(options?: BrandOptions<ValueType>) => ValueType extends [never] ? "Brand value type cannot be unset, please provide a value type" : import("./types").BrandConstructor<ValueType, BrandName> & import("./types").BrandMethods<ValueType, BrandName> & import("./types").TypeMarker<ValueType, BrandName>;
    /**
     * Type-level generic brand. Creates a branded type alias.
     *
     * @example
     * ```ts
     * type Id<T> = brand.Generic<"Id", T>;
     * type StringId = Id<string>;  // BrandValue<string, "Id">
     * ```
     */
    type Generic<BrandName, ValueType> = BrandValue<ValueType, BrandName>;
}
export type { Brand, BrandValue, Nominal, GenericNominal, BrandOptions, BrandValidator, } from "./types";
export type { StandardSchemaV1 } from "./standard-schema";
//# sourceMappingURL=brand.d.ts.map