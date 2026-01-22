import type { StandardSchemaV1 } from "./standard-schema";

/**
 * Brand symbol marker for nominal typing
 */
export type Brand<BrandName> = {
  readonly $$brand: BrandName;
};

export interface TypeMarker<Value, Type> {
  readonly type: BrandValue<Value, Type>;
}

/**
 * A branded value combining the original value with brand metadata
 */
export type BrandValue<ValueType, BrandName> = ValueType & Brand<BrandName>;

export type BrandValidator<ValueType> =
  | ((value: unknown) => value is ValueType)
  | StandardSchemaV1<unknown, ValueType>;

export type BrandOptions<ValueType> = {
  validator?: BrandValidator<ValueType>;
};

export interface BrandMethods<ValueType, BrandName> {
  as: (value: unknown) => BrandValue<ValueType, BrandName>;
  is: (value: unknown) => value is BrandValue<ValueType, BrandName>;
  to: (value: unknown) => BrandValue<ValueType, BrandName>;
}

/**
 * Nominal type constructor - creates branded values of a fixed type
 */
export type Nominal<ValueType = never, BrandName = never> = ValidateBrandValueType<
  ValueType,
  BrandConstructor<ValueType, BrandName> &
    BrandMethods<ValueType, BrandName> &
    TypeMarker<ValueType, BrandName>
>;
/**
 * Generic nominal type - creates branded values with variable value types
 */
export interface GenericNominal<BrandName> {
  <ValueType>(): Nominal<ValueType, BrandName>;
}

export type BrandConstructor<ValueType = never, BrandName = never> = (
  value: ValueType,
) => BrandValue<ValueType, BrandName>;

type ValidateBrandValueType<ValueType, IfNormalType> = ValueType extends [never]
  ? "Brand value type cannot be unset, please provide a value type"
  : IfNormalType;
