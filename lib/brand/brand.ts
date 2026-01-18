import type {
  Nominal,
  BrandValue,
  GenericNominal,
  BrandOptions,
} from "./types";
import type { StandardSchemaV1 } from "./standard-schema";

type ValidationResult<Value> = { ok: true; value: Value } | { ok: false };

const normalizeStandardResult = <Value>(
  result: StandardSchemaV1.Result<Value>
): ValidationResult<Value> => {
  if (result && "issues" in result && result.issues != null) {
    return { ok: false };
  }
  if (result && "value" in result) {
    return { ok: true, value: result.value as Value };
  }
  return { ok: false };
};

const invalidError = (value: unknown) =>
  new Error(`Brand invariant violation: Invalid value for type ${value}`);

const getStandardValidator = <Value>(
  value: StandardSchemaV1<unknown, Value>
) => {
  const standard = value?.["~standard"];
  if (!standard || typeof standard.validate !== "function") {
    return null;
  }
  return standard.validate.bind(standard);
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
export function brand<Value, const Type extends string>(
  options: BrandOptions<Value> = {}
): Nominal<Value, Type> {
  const { validator } = options;

  const validateValue = (value: unknown): ValidationResult<Value> => {
    if (!validator) {
      return { ok: true, value: value as Value };
    }
    if (typeof validator === "function") {
      return validator(value)
        ? { ok: true, value: value as Value }
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
        typeof (standardResult as Promise<StandardSchemaV1.Result<Value>>)
          .then === "function"
      ) {
        return { ok: false };
      }
      return normalizeStandardResult<Value>(
        standardResult as StandardSchemaV1.Result<Value>
      );
    } catch {
      return { ok: false };
    }
  };

  const is = (value: unknown): value is BrandValue<Value, Type> => {
    return validateValue(value).ok;
  };

  const to = (value: unknown): BrandValue<Value, Type> => {
    const result = validateValue(value);
    if (!result.ok) {
      throw invalidError(value);
    }
    return result.value as BrandValue<Value, Type>;
  };

  function nominal<const S extends Value>(value: S): BrandValue<S, Type> {
    return to(value) as BrandValue<S, Type>;
  }

  Object.defineProperty(nominal, "as", {
    value: (value: unknown) => value as BrandValue<Value, Type>,
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

  return nominal as Nominal<Value, Type>;
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
  export function generic<const Type extends string>(
    options: BrandOptions<unknown> = {}
  ): GenericNominal<Type> {
    const { validator } = options;

    const validateValue = (value: unknown): ValidationResult<unknown> => {
      if (!validator) {
        return { ok: true, value };
      }
      if (typeof validator === "function") {
        return validator(value) ? { ok: true, value } : { ok: false };
      }
      const standardValidator = getStandardValidator(validator);
      if (!standardValidator) {
        return { ok: false };
      }
      try {
        const standardResult = standardValidator(value);
        if (
          standardResult &&
          typeof (standardResult as Promise<StandardSchemaV1.Result<unknown>>)
            .then === "function"
        ) {
          return { ok: false };
        }
        return normalizeStandardResult<unknown>(
          standardResult as StandardSchemaV1.Result<unknown>
        );
      } catch {
        return { ok: false };
      }
    };

    const is = (value: unknown): value is BrandValue<unknown, Type> => {
      return validateValue(value).ok;
    };

    const to = (value: unknown): BrandValue<unknown, Type> => {
      const result = validateValue(value);
      if (!result.ok) {
        throw invalidError(value);
      }
      return result.value as BrandValue<unknown, Type>;
    };

    const fn = <T>(value: T): BrandValue<T, Type> => {
      return to(value) as BrandValue<T, Type>;
    };

    Object.defineProperty(fn, "as", {
      value: (value: unknown) => value as BrandValue<unknown, Type>,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    Object.defineProperty(fn, "is", {
      value: is,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    Object.defineProperty(fn, "to", {
      value: to,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return fn as GenericNominal<Type>;
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
  export type Generic<Type extends string, T> = BrandValue<T, Type>;
}
