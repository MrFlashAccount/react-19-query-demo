import type {
  Nominal,
  BrandValue,
  BrandOptions,
  BrandValidator,
} from "./types";
import type { StandardSchemaV1 } from "./standard-schema";

type ValidationResult<ValueType, BrandName> =
  | { ok: true; value: BrandValue<ValueType, BrandName> }
  | { ok: false };

const normalizeStandardResult = <ValueType, BrandName>(
  result: StandardSchemaV1.Result<ValueType>
): ValidationResult<ValueType, BrandName> => {
  if (result && "issues" in result && result.issues != null) {
    return { ok: false };
  }
  if (result && "value" in result) {
    return {
      ok: true,
      value: result.value as BrandValue<ValueType, BrandName>,
    };
  }
  return { ok: false };
};

const invalidError = (value: unknown) =>
  new Error(`Brand invariant violation: Invalid value for type ${value}`);

const getStandardValidator = <ValueType>(
  value: StandardSchemaV1<unknown, ValueType>
) => {
  const standard = value?.["~standard"];
  if (!standard || typeof standard.validate !== "function") {
    return null;
  }
  return standard.validate.bind(standard);
};

const validateValue = <ValueType, BrandName>(
  value: unknown,
  validator?: BrandValidator<ValueType>
): ValidationResult<ValueType, BrandName> => {
  if (!validator) {
    return { ok: true, value: value as BrandValue<ValueType, BrandName> };
  }
  if (typeof validator === "function") {
    return validator(value)
      ? { ok: true, value: value as BrandValue<ValueType, BrandName> }
      : { ok: false };
  }
  const standardValidator = getStandardValidator(validator);
  if (!standardValidator) {
    return { ok: false };
  }
  try {
    const standardResult = standardValidator(value);
    if (
      standardResult &&
      typeof (standardResult as Promise<StandardSchemaV1.Result<ValueType>>)
        .then === "function"
    ) {
      return { ok: false };
    }
    return normalizeStandardResult<ValueType, BrandName>(
      standardResult as StandardSchemaV1.Result<ValueType>
    );
  } catch {
    return { ok: false };
  }
};

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
export function brand<ValueType = never, const BrandName = never>(
  options: BrandOptions<ValueType> = {}
): Nominal<ValueType, BrandName> {
  const { validator } = options;

  const is = <ValueType, BrandName>(
    value: unknown
  ): value is BrandValue<ValueType, BrandName> => {
    return validateValue(value, validator).ok;
  };

  const to = (value: unknown) => {
    const result = validateValue(value, validator);
    if (!result.ok) {
      throw invalidError(value);
    }
    return result.value as BrandValue<ValueType, BrandName>;
  };

  function nominal<const S extends ValueType>(
    value: S
  ): BrandValue<S, BrandName> {
    return to(value) as BrandValue<S, BrandName>;
  }

  Object.defineProperty(nominal, "as", {
    value: (value: unknown) => value as BrandValue<ValueType, BrandName>,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  Object.defineProperty(nominal, "is", {
    value: is,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  Object.defineProperty(nominal, "to", {
    value: to,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return nominal as unknown as Nominal<ValueType, BrandName>;
}

export namespace brand {
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
  export function generic<const BrandName = never>() {
    return <const ValueType = never>(options: BrandOptions<ValueType> = {}) =>
      brand<ValueType, BrandName>(options);
  }

  /**
   * Type-level generic brand. Creates a branded type alias.
   *
   * @example
   * ```ts
   * type Id<T> = brand.Generic<"Id", T>;
   * type StringId = Id<string>;  // BrandValue<string, "Id">
   * ```
   */
  export type Generic<BrandName, ValueType> = BrandValue<ValueType, BrandName>;
}

export type {
  Brand,
  BrandValue,
  Nominal,
  GenericNominal,
  BrandOptions,
  BrandValidator,
} from "./types";
export type { StandardSchemaV1 } from "./standard-schema";
