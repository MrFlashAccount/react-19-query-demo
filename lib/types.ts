type Nominal<Value, Type extends string> = (
  value: Value
) => BrandValue<Value, Type>;

export function brand<Value, const Type extends string>(): Nominal<
  Value,
  Type
> {
  const brand = Symbol();
  function nominal<const S extends Value>(value: S): BrandValue<S, Type> {
    return value as unknown as BrandValue<S, Type>;
  }

  Object.defineProperty(nominal, "$$brand", {
    value: brand,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return nominal;
}

function nominalBrand<Value, const Type extends string>(
  nominal: Nominal<Value, Type>
): Type {
  return (nominal as any).$$brand as Type;
}

function valueBrand<Value, const Type extends string>(value: Value): Type {
  return (value as any).$$brand as Type;
}

type Brand<Type extends string> = {
  readonly $$brand: Type;
};

type BrandValue<Value, Type extends string> = Value & Brand<Type>;

export function isBrand<Value, Type extends string>(
  nominal: Nominal<Value, Type>,
  value: unknown
): value is BrandValue<Value, Type> {
  return nominalBrand(nominal) === valueBrand(value);
}

export namespace brand {
  /**
   * Creates a generic branding function with a fixed brand name.
   * The value type remains generic at call site.
   *
   * Usage:
   * ```ts
   * const Id = brand.generic<"Id">();
   * const stringId = Id("abc");  // BrandValue<"abc", "Id">
   * const numberId = Id(123);    // BrandValue<123, "Id">
   * ```
   */
  export function generic<const Type extends string>() {
    const brandSymbol = Symbol();
    const fn = <T>(value: T): BrandValue<T, Type> => {
      return value as BrandValue<T, Type>;
    };

    Object.defineProperty(fn, "$$brand", {
      value: brandSymbol,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return fn;
  }

  /**
   * Type-level generic brand. Creates a branded type alias.
   *
   * Usage:
   * ```ts
   * type Id<T> = brand.Generic<"Id", T>;
   * type StringId = Id<string>;  // BrandValue<string, "Id">
   * ```
   */
  export type Generic<Type extends string, T> = BrandValue<T, Type>;

  /**
   * Extracts the branded return type from a Nominal function.
   * Usage: `type MyType = brand.infer<typeof myBrandedValue>`
   */
  export type infer<T> = T extends Nominal<infer V, infer Type>
    ? BrandValue<V, Type>
    : never;
}
