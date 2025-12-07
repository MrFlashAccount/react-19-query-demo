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
