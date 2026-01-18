/**
 * Brand symbol marker for nominal typing
 */
export type Brand<Type extends string> = {
  readonly $$brand: Type;
};

/**
 * A branded value combining the original value with brand metadata
 */
export type BrandValue<Value, Type extends string> = Value & Brand<Type>;

import type { StandardSchemaV1 } from "./standard-schema";

export type BrandValidator<Value> =
  | ((value: unknown) => value is Value)
  | StandardSchemaV1<unknown, Value>;

export type BrandOptions<Value> = {
  validator?: BrandValidator<Value>;
};

/**
 * Nominal type constructor - creates branded values of a fixed type
 */
export type Nominal<Value, Type extends string> = ((
  value: Value
) => BrandValue<Value, Type>) & {
  readonly type: BrandValue<Value, Type>;
  as: (value: unknown) => BrandValue<Value, Type>;
  is: (value: unknown) => value is BrandValue<Value, Type>;
  to: (value: unknown) => BrandValue<Value, Type>;
};

/**
 * Generic nominal type - creates branded values with variable value types
 */
export type GenericNominal<Type extends string> = {
  <T>(value: T): BrandValue<T, Type>;
  as: (value: unknown) => BrandValue<unknown, Type>;
  is: (value: unknown) => value is BrandValue<unknown, Type>;
  to: (value: unknown) => BrandValue<unknown, Type>;
};
