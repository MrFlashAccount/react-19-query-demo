import { jsx, jsxs } from "react/jsx-runtime";
import * as React from "react";
import React__default, { useState, useTransition } from "react";
var compilerRuntime$1 = { exports: {} };
var reactCompilerRuntime_production$1 = {};
/**
 * @license React
 * react-compiler-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactCompilerRuntime_production$1;
function requireReactCompilerRuntime_production$1() {
  if (hasRequiredReactCompilerRuntime_production$1) return reactCompilerRuntime_production$1;
  hasRequiredReactCompilerRuntime_production$1 = 1;
  var ReactSharedInternals = React__default.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  reactCompilerRuntime_production$1.c = function(size) {
    return ReactSharedInternals.H.useMemoCache(size);
  };
  return reactCompilerRuntime_production$1;
}
var reactCompilerRuntime_development$1 = {};
/**
 * @license React
 * react-compiler-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactCompilerRuntime_development$1;
function requireReactCompilerRuntime_development$1() {
  if (hasRequiredReactCompilerRuntime_development$1) return reactCompilerRuntime_development$1;
  hasRequiredReactCompilerRuntime_development$1 = 1;
  "production" !== process.env.NODE_ENV && (function() {
    var ReactSharedInternals = React__default.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    reactCompilerRuntime_development$1.c = function(size) {
      var dispatcher = ReactSharedInternals.H;
      null === dispatcher && console.error(
        "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
      );
      return dispatcher.useMemoCache(size);
    };
  })();
  return reactCompilerRuntime_development$1;
}
var hasRequiredCompilerRuntime$1;
function requireCompilerRuntime$1() {
  if (hasRequiredCompilerRuntime$1) return compilerRuntime$1.exports;
  hasRequiredCompilerRuntime$1 = 1;
  if (process.env.NODE_ENV === "production") {
    compilerRuntime$1.exports = requireReactCompilerRuntime_production$1();
  } else {
    compilerRuntime$1.exports = requireReactCompilerRuntime_development$1();
  }
  return compilerRuntime$1.exports;
}
var compilerRuntimeExports$1 = requireCompilerRuntime$1();
var Subscribable = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set();
    this.subscribe = this.subscribe.bind(this);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    this.onSubscribe();
    return () => {
      this.listeners.delete(listener);
      this.onUnsubscribe();
    };
  }
  hasListeners() {
    return this.listeners.size > 0;
  }
  onSubscribe() {
  }
  onUnsubscribe() {
  }
};
var defaultTimeoutProvider = {
  // We need the wrapper function syntax below instead of direct references to
  // global setTimeout etc.
  //
  // BAD: `setTimeout: setTimeout`
  // GOOD: `setTimeout: (cb, delay) => setTimeout(cb, delay)`
  //
  // If we use direct references here, then anything that wants to spy on or
  // replace the global setTimeout (like tests) won't work since we'll already
  // have a hard reference to the original implementation at the time when this
  // file was imported.
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timeoutId) => clearTimeout(timeoutId),
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (intervalId) => clearInterval(intervalId)
};
var TimeoutManager = class {
  // We cannot have TimeoutManager<T> as we must instantiate it with a concrete
  // type at app boot; and if we leave that type, then any new timer provider
  // would need to support ReturnType<typeof setTimeout>, which is infeasible.
  //
  // We settle for type safety for the TimeoutProvider type, and accept that
  // this class is unsafe internally to allow for extension.
  #provider = defaultTimeoutProvider;
  #providerCalled = false;
  setTimeoutProvider(provider) {
    if (process.env.NODE_ENV !== "production") {
      if (this.#providerCalled && provider !== this.#provider) {
        console.error(`[timeoutManager]: Switching provider after calls to previous provider might result in unexpected behavior.`, {
          previous: this.#provider,
          provider
        });
      }
    }
    this.#provider = provider;
    if (process.env.NODE_ENV !== "production") {
      this.#providerCalled = false;
    }
  }
  setTimeout(callback, delay) {
    if (process.env.NODE_ENV !== "production") {
      this.#providerCalled = true;
    }
    return this.#provider.setTimeout(callback, delay);
  }
  clearTimeout(timeoutId) {
    this.#provider.clearTimeout(timeoutId);
  }
  setInterval(callback, delay) {
    if (process.env.NODE_ENV !== "production") {
      this.#providerCalled = true;
    }
    return this.#provider.setInterval(callback, delay);
  }
  clearInterval(intervalId) {
    this.#provider.clearInterval(intervalId);
  }
};
var timeoutManager = new TimeoutManager();
function systemSetTimeoutZero(callback) {
  setTimeout(callback, 0);
}
var isServer = typeof window === "undefined" || "Deno" in globalThis;
function noop() {
}
function functionalUpdate(updater, input) {
  return typeof updater === "function" ? updater(input) : updater;
}
function isValidTimeout(value) {
  return typeof value === "number" && value >= 0 && value !== Infinity;
}
function timeUntilStale(updatedAt, staleTime) {
  return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0);
}
function resolveStaleTime(staleTime, query) {
  return typeof staleTime === "function" ? staleTime(query) : staleTime;
}
function resolveEnabled(enabled, query) {
  return typeof enabled === "function" ? enabled(query) : enabled;
}
function matchQuery(filters, query) {
  const {
    type = "all",
    exact,
    fetchStatus,
    predicate,
    queryKey,
    stale
  } = filters;
  if (queryKey) {
    if (exact) {
      if (query.queryHash !== hashQueryKeyByOptions(queryKey, query.options)) {
        return false;
      }
    } else if (!partialMatchKey(query.queryKey, queryKey)) {
      return false;
    }
  }
  if (type !== "all") {
    const isActive = query.isActive();
    if (type === "active" && !isActive) {
      return false;
    }
    if (type === "inactive" && isActive) {
      return false;
    }
  }
  if (typeof stale === "boolean" && query.isStale() !== stale) {
    return false;
  }
  if (fetchStatus && fetchStatus !== query.state.fetchStatus) {
    return false;
  }
  if (predicate && !predicate(query)) {
    return false;
  }
  return true;
}
function matchMutation(filters, mutation) {
  const {
    exact,
    status,
    predicate,
    mutationKey
  } = filters;
  if (mutationKey) {
    if (!mutation.options.mutationKey) {
      return false;
    }
    if (exact) {
      if (hashKey(mutation.options.mutationKey) !== hashKey(mutationKey)) {
        return false;
      }
    } else if (!partialMatchKey(mutation.options.mutationKey, mutationKey)) {
      return false;
    }
  }
  if (status && mutation.state.status !== status) {
    return false;
  }
  if (predicate && !predicate(mutation)) {
    return false;
  }
  return true;
}
function hashQueryKeyByOptions(queryKey, options) {
  const hashFn = options?.queryKeyHashFn || hashKey;
  return hashFn(queryKey);
}
function hashKey(queryKey) {
  return JSON.stringify(queryKey, (_, val) => isPlainObject(val) ? Object.keys(val).sort().reduce((result, key) => {
    result[key] = val[key];
    return result;
  }, {}) : val);
}
function partialMatchKey(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    return Object.keys(b).every((key) => partialMatchKey(a[key], b[key]));
  }
  return false;
}
var hasOwn = Object.prototype.hasOwnProperty;
function replaceEqualDeep(a, b) {
  if (a === b) {
    return a;
  }
  const array = isPlainArray(a) && isPlainArray(b);
  if (!array && !(isPlainObject(a) && isPlainObject(b))) return b;
  const aItems = array ? a : Object.keys(a);
  const aSize = aItems.length;
  const bItems = array ? b : Object.keys(b);
  const bSize = bItems.length;
  const copy = array ? new Array(bSize) : {};
  let equalItems = 0;
  for (let i = 0; i < bSize; i++) {
    const key = array ? i : bItems[i];
    const aItem = a[key];
    const bItem = b[key];
    if (aItem === bItem) {
      copy[key] = aItem;
      if (array ? i < aSize : hasOwn.call(a, key)) equalItems++;
      continue;
    }
    if (aItem === null || bItem === null || typeof aItem !== "object" || typeof bItem !== "object") {
      copy[key] = bItem;
      continue;
    }
    const v = replaceEqualDeep(aItem, bItem);
    copy[key] = v;
    if (v === aItem) equalItems++;
  }
  return aSize === bSize && equalItems === aSize ? a : copy;
}
function shallowEqualObjects(a, b) {
  if (!b || Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }
  for (const key in a) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}
function isPlainArray(value) {
  return Array.isArray(value) && value.length === Object.keys(value).length;
}
function isPlainObject(o) {
  if (!hasObjectPrototype(o)) {
    return false;
  }
  const ctor = o.constructor;
  if (ctor === void 0) {
    return true;
  }
  const prot = ctor.prototype;
  if (!hasObjectPrototype(prot)) {
    return false;
  }
  if (!prot.hasOwnProperty("isPrototypeOf")) {
    return false;
  }
  if (Object.getPrototypeOf(o) !== Object.prototype) {
    return false;
  }
  return true;
}
function hasObjectPrototype(o) {
  return Object.prototype.toString.call(o) === "[object Object]";
}
function sleep(timeout) {
  return new Promise((resolve) => {
    timeoutManager.setTimeout(resolve, timeout);
  });
}
function replaceData(prevData, data, options) {
  if (typeof options.structuralSharing === "function") {
    return options.structuralSharing(prevData, data);
  } else if (options.structuralSharing !== false) {
    if (process.env.NODE_ENV !== "production") {
      try {
        return replaceEqualDeep(prevData, data);
      } catch (error) {
        console.error(`Structural sharing requires data to be JSON serializable. To fix this, turn off structuralSharing or return JSON-serializable data from your queryFn. [${options.queryHash}]: ${error}`);
        throw error;
      }
    }
    return replaceEqualDeep(prevData, data);
  }
  return data;
}
function addToEnd(items, item, max = 0) {
  const newItems = [...items, item];
  return max && newItems.length > max ? newItems.slice(1) : newItems;
}
function addToStart(items, item, max = 0) {
  const newItems = [item, ...items];
  return max && newItems.length > max ? newItems.slice(0, -1) : newItems;
}
var skipToken = Symbol();
function ensureQueryFn(options, fetchOptions) {
  if (process.env.NODE_ENV !== "production") {
    if (options.queryFn === skipToken) {
      console.error(`Attempted to invoke queryFn when set to skipToken. This is likely a configuration error. Query hash: '${options.queryHash}'`);
    }
  }
  if (!options.queryFn && fetchOptions?.initialPromise) {
    return () => fetchOptions.initialPromise;
  }
  if (!options.queryFn || options.queryFn === skipToken) {
    return () => Promise.reject(new Error(`Missing queryFn: '${options.queryHash}'`));
  }
  return options.queryFn;
}
function shouldThrowError(throwOnError, params) {
  if (typeof throwOnError === "function") {
    return throwOnError(...params);
  }
  return !!throwOnError;
}
var FocusManager = class extends Subscribable {
  #focused;
  #cleanup;
  #setup;
  constructor() {
    super();
    this.#setup = (onFocus) => {
      if (!isServer && window.addEventListener) {
        const listener = () => onFocus();
        window.addEventListener("visibilitychange", listener, false);
        return () => {
          window.removeEventListener("visibilitychange", listener);
        };
      }
      return;
    };
  }
  onSubscribe() {
    if (!this.#cleanup) {
      this.setEventListener(this.#setup);
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.#cleanup?.();
      this.#cleanup = void 0;
    }
  }
  setEventListener(setup) {
    this.#setup = setup;
    this.#cleanup?.();
    this.#cleanup = setup((focused) => {
      if (typeof focused === "boolean") {
        this.setFocused(focused);
      } else {
        this.onFocus();
      }
    });
  }
  setFocused(focused) {
    const changed = this.#focused !== focused;
    if (changed) {
      this.#focused = focused;
      this.onFocus();
    }
  }
  onFocus() {
    const isFocused = this.isFocused();
    this.listeners.forEach((listener) => {
      listener(isFocused);
    });
  }
  isFocused() {
    if (typeof this.#focused === "boolean") {
      return this.#focused;
    }
    return globalThis.document?.visibilityState !== "hidden";
  }
};
var focusManager = new FocusManager();
function pendingThenable() {
  let resolve;
  let reject;
  const thenable = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  thenable.status = "pending";
  thenable.catch(() => {
  });
  function finalize(data) {
    Object.assign(thenable, data);
    delete thenable.resolve;
    delete thenable.reject;
  }
  thenable.resolve = (value) => {
    finalize({
      status: "fulfilled",
      value
    });
    resolve(value);
  };
  thenable.reject = (reason) => {
    finalize({
      status: "rejected",
      reason
    });
    reject(reason);
  };
  return thenable;
}
var defaultScheduler = systemSetTimeoutZero;
function createNotifyManager() {
  let queue = [];
  let transactions = 0;
  let notifyFn = (callback) => {
    callback();
  };
  let batchNotifyFn = (callback) => {
    callback();
  };
  let scheduleFn = defaultScheduler;
  const schedule = (callback) => {
    if (transactions) {
      queue.push(callback);
    } else {
      scheduleFn(() => {
        notifyFn(callback);
      });
    }
  };
  const flush = () => {
    const originalQueue = queue;
    queue = [];
    if (originalQueue.length) {
      scheduleFn(() => {
        batchNotifyFn(() => {
          originalQueue.forEach((callback) => {
            notifyFn(callback);
          });
        });
      });
    }
  };
  return {
    batch: (callback) => {
      let result;
      transactions++;
      try {
        result = callback();
      } finally {
        transactions--;
        if (!transactions) {
          flush();
        }
      }
      return result;
    },
    /**
     * All calls to the wrapped function will be batched.
     */
    batchCalls: (callback) => {
      return (...args) => {
        schedule(() => {
          callback(...args);
        });
      };
    },
    schedule,
    /**
     * Use this method to set a custom notify function.
     * This can be used to for example wrap notifications with `React.act` while running tests.
     */
    setNotifyFunction: (fn) => {
      notifyFn = fn;
    },
    /**
     * Use this method to set a custom function to batch notifications together into a single tick.
     * By default React Query will use the batch function provided by ReactDOM or React Native.
     */
    setBatchNotifyFunction: (fn) => {
      batchNotifyFn = fn;
    },
    setScheduler: (fn) => {
      scheduleFn = fn;
    }
  };
}
var notifyManager = createNotifyManager();
var OnlineManager = class extends Subscribable {
  #online = true;
  #cleanup;
  #setup;
  constructor() {
    super();
    this.#setup = (onOnline) => {
      if (!isServer && window.addEventListener) {
        const onlineListener = () => onOnline(true);
        const offlineListener = () => onOnline(false);
        window.addEventListener("online", onlineListener, false);
        window.addEventListener("offline", offlineListener, false);
        return () => {
          window.removeEventListener("online", onlineListener);
          window.removeEventListener("offline", offlineListener);
        };
      }
      return;
    };
  }
  onSubscribe() {
    if (!this.#cleanup) {
      this.setEventListener(this.#setup);
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.#cleanup?.();
      this.#cleanup = void 0;
    }
  }
  setEventListener(setup) {
    this.#setup = setup;
    this.#cleanup?.();
    this.#cleanup = setup(this.setOnline.bind(this));
  }
  setOnline(online) {
    const changed = this.#online !== online;
    if (changed) {
      this.#online = online;
      this.listeners.forEach((listener) => {
        listener(online);
      });
    }
  }
  isOnline() {
    return this.#online;
  }
};
var onlineManager = new OnlineManager();
function defaultRetryDelay(failureCount) {
  return Math.min(1e3 * 2 ** failureCount, 3e4);
}
function canFetch(networkMode) {
  return (networkMode ?? "online") === "online" ? onlineManager.isOnline() : true;
}
var CancelledError = class extends Error {
  constructor(options) {
    super("CancelledError");
    this.revert = options?.revert;
    this.silent = options?.silent;
  }
};
function createRetryer(config) {
  let isRetryCancelled = false;
  let failureCount = 0;
  let continueFn;
  const thenable = pendingThenable();
  const isResolved = () => thenable.status !== "pending";
  const cancel = (cancelOptions) => {
    if (!isResolved()) {
      const error = new CancelledError(cancelOptions);
      reject(error);
      config.onCancel?.(error);
    }
  };
  const cancelRetry = () => {
    isRetryCancelled = true;
  };
  const continueRetry = () => {
    isRetryCancelled = false;
  };
  const canContinue = () => focusManager.isFocused() && (config.networkMode === "always" || onlineManager.isOnline()) && config.canRun();
  const canStart = () => canFetch(config.networkMode) && config.canRun();
  const resolve = (value) => {
    if (!isResolved()) {
      continueFn?.();
      thenable.resolve(value);
    }
  };
  const reject = (value) => {
    if (!isResolved()) {
      continueFn?.();
      thenable.reject(value);
    }
  };
  const pause = () => {
    return new Promise((continueResolve) => {
      continueFn = (value) => {
        if (isResolved() || canContinue()) {
          continueResolve(value);
        }
      };
      config.onPause?.();
    }).then(() => {
      continueFn = void 0;
      if (!isResolved()) {
        config.onContinue?.();
      }
    });
  };
  const run = () => {
    if (isResolved()) {
      return;
    }
    let promiseOrValue;
    const initialPromise = failureCount === 0 ? config.initialPromise : void 0;
    try {
      promiseOrValue = initialPromise ?? config.fn();
    } catch (error) {
      promiseOrValue = Promise.reject(error);
    }
    Promise.resolve(promiseOrValue).then(resolve).catch((error) => {
      if (isResolved()) {
        return;
      }
      const retry = config.retry ?? (isServer ? 0 : 3);
      const retryDelay = config.retryDelay ?? defaultRetryDelay;
      const delay = typeof retryDelay === "function" ? retryDelay(failureCount, error) : retryDelay;
      const shouldRetry = retry === true || typeof retry === "number" && failureCount < retry || typeof retry === "function" && retry(failureCount, error);
      if (isRetryCancelled || !shouldRetry) {
        reject(error);
        return;
      }
      failureCount++;
      config.onFail?.(failureCount, error);
      sleep(delay).then(() => {
        return canContinue() ? void 0 : pause();
      }).then(() => {
        if (isRetryCancelled) {
          reject(error);
        } else {
          run();
        }
      });
    });
  };
  return {
    promise: thenable,
    status: () => thenable.status,
    cancel,
    continue: () => {
      continueFn?.();
      return thenable;
    },
    cancelRetry,
    continueRetry,
    canStart,
    start: () => {
      if (canStart()) {
        run();
      } else {
        pause().then(run);
      }
      return thenable;
    }
  };
}
var Removable = class {
  constructor() {
    this.gcMarkedAt = null;
  }
  /**
   * Clean up resources when destroyed
   */
  destroy() {
    this.clearGcMark();
  }
  /**
   * Mark this item as eligible for garbage collection.
   * Sets gcMarkedAt to the current time.
   *
   * Called when:
   * - Last observer unsubscribes
   * - Fetch completes (queries)
   * - Item is constructed with no observers
   */
  markForGc() {
    if (isValidTimeout(this.gcTime)) {
      this.gcMarkedAt = Date.now();
      this.getGcManager().trackEligibleItem(this);
    } else {
      this.clearGcMark();
    }
  }
  /**
   * Clear the GC mark, making this item ineligible for collection.
   *
   * Called when:
   * - An observer subscribes
   * - Item becomes active again
   */
  clearGcMark() {
    this.gcMarkedAt = null;
    this.getGcManager().untrackEligibleItem(this);
  }
  /**
   * Check if this item is eligible for garbage collection.
   *
   * An item is eligible if:
   * 1. It has been marked (gcMarkedAt is not null)
   * 2. Current time has passed the marked time plus gcTime
   *
   * @returns true if eligible for GC
   */
  isEligibleForGc() {
    if (this.gcMarkedAt === null) {
      return false;
    }
    if (this.gcTime === Infinity) {
      return false;
    }
    return Date.now() >= this.gcMarkedAt + this.gcTime;
  }
  getGcAtTimestamp() {
    if (this.gcMarkedAt === null) {
      return null;
    }
    if (this.gcTime === Infinity) {
      return Infinity;
    }
    return this.gcMarkedAt + this.gcTime;
  }
  /**
   * Update the garbage collection time.
   * Uses the maximum of the current gcTime and the new gcTime.
   *
   * Defaults to 5 minutes on client, Infinity on server.
   *
   * @param newGcTime - New garbage collection time in milliseconds
   */
  updateGcTime(newGcTime) {
    this.gcTime = Math.max(this.gcTime || 0, newGcTime ?? (isServer ? Infinity : 5 * 60 * 1e3));
  }
};
var Query = class extends Removable {
  #initialState;
  #revertState;
  #cache;
  #client;
  #retryer;
  #gcManager;
  #defaultOptions;
  #abortSignalConsumed;
  constructor(config) {
    super();
    this.#client = config.client;
    this.#gcManager = config.client.getGcManager();
    this.#cache = this.#client.getQueryCache();
    this.#abortSignalConsumed = false;
    this.#defaultOptions = config.defaultOptions;
    this.observers = [];
    this.setOptions(config.options);
    this.queryKey = config.queryKey;
    this.queryHash = config.queryHash;
    this.#initialState = getDefaultState$1(this.options);
    this.state = config.state ?? this.#initialState;
    this.markForGc();
  }
  get meta() {
    return this.options.meta;
  }
  get promise() {
    return this.#retryer?.promise;
  }
  getGcManager() {
    return this.#gcManager;
  }
  setOptions(options) {
    this.options = {
      ...this.#defaultOptions,
      ...options
    };
    this.updateGcTime(this.options.gcTime);
    if (this.state && this.state.data === void 0) {
      const defaultState = getDefaultState$1(this.options);
      if (defaultState.data !== void 0) {
        this.setData(defaultState.data, {
          updatedAt: defaultState.dataUpdatedAt,
          manual: true
        });
        this.#initialState = defaultState;
      }
    }
  }
  optionalRemove() {
    if (this.isSafeToRemove()) {
      this.#cache.remove(this);
      return true;
    } else {
      this.clearGcMark();
    }
    return false;
  }
  isSafeToRemove() {
    return this.observers.length === 0 && this.state.fetchStatus === "idle";
  }
  setData(newData, options) {
    const data = replaceData(this.state.data, newData, this.options);
    this.#dispatch({
      data,
      type: "success",
      dataUpdatedAt: options?.updatedAt,
      manual: options?.manual
    });
    return data;
  }
  setState(state, setStateOptions) {
    this.#dispatch({
      type: "setState",
      state,
      setStateOptions
    });
  }
  cancel(options) {
    const promise = this.#retryer?.promise;
    this.#retryer?.cancel(options);
    return promise ? promise.then(noop).catch(noop) : Promise.resolve();
  }
  destroy() {
    super.destroy();
    this.cancel({
      silent: true
    });
  }
  reset() {
    this.destroy();
    this.setState(this.#initialState);
  }
  isActive() {
    return this.observers.some((observer) => resolveEnabled(observer.options.enabled, this) !== false);
  }
  isDisabled() {
    if (this.getObserversCount() > 0) {
      return !this.isActive();
    }
    return this.options.queryFn === skipToken || this.state.dataUpdateCount + this.state.errorUpdateCount === 0;
  }
  isStatic() {
    if (this.getObserversCount() > 0) {
      return this.observers.some((observer) => resolveStaleTime(observer.options.staleTime, this) === "static");
    }
    return false;
  }
  isStale() {
    if (this.getObserversCount() > 0) {
      return this.observers.some((observer) => observer.getCurrentResult().isStale);
    }
    return this.state.data === void 0 || this.state.isInvalidated;
  }
  isStaleByTime(staleTime = 0) {
    if (this.state.data === void 0) {
      return true;
    }
    if (staleTime === "static") {
      return false;
    }
    if (this.state.isInvalidated) {
      return true;
    }
    return !timeUntilStale(this.state.dataUpdatedAt, staleTime);
  }
  onFocus() {
    const observer = this.observers.find((x) => x.shouldFetchOnWindowFocus());
    observer?.refetch({
      cancelRefetch: false
    });
    this.#retryer?.continue();
  }
  onOnline() {
    const observer = this.observers.find((x) => x.shouldFetchOnReconnect());
    observer?.refetch({
      cancelRefetch: false
    });
    this.#retryer?.continue();
  }
  addObserver(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      this.clearGcMark();
      this.#cache.notify({
        type: "observerAdded",
        query: this,
        observer
      });
    }
  }
  removeObserver(observer) {
    if (this.observers.includes(observer)) {
      this.observers = this.observers.filter((x) => x !== observer);
      if (!this.observers.length) {
        if (this.#retryer) {
          if (this.#abortSignalConsumed) {
            this.#retryer.cancel({
              revert: true
            });
          } else {
            this.#retryer.cancelRetry();
          }
        }
        if (this.isSafeToRemove()) {
          this.markForGc();
        }
      }
      this.#cache.notify({
        type: "observerRemoved",
        query: this,
        observer
      });
    }
  }
  getObserversCount() {
    return this.observers.length;
  }
  invalidate() {
    if (!this.state.isInvalidated) {
      this.#dispatch({
        type: "invalidate"
      });
    }
  }
  async fetch(options, fetchOptions) {
    if (this.state.fetchStatus !== "idle" && // If the promise in the retryer is already rejected, we have to definitely
    // re-start the fetch; there is a chance that the query is still in a
    // pending state when that happens
    this.#retryer?.status() !== "rejected") {
      if (this.state.data !== void 0 && fetchOptions?.cancelRefetch) {
        this.cancel({
          silent: true
        });
      } else if (this.#retryer) {
        this.#retryer.continueRetry();
        return this.#retryer.promise;
      }
    }
    if (options) {
      this.setOptions(options);
    }
    if (!this.options.queryFn) {
      const observer = this.observers.find((x) => x.options.queryFn);
      if (observer) {
        this.setOptions(observer.options);
      }
    }
    if (process.env.NODE_ENV !== "production") {
      if (!Array.isArray(this.options.queryKey)) {
        console.error(`As of v4, queryKey needs to be an Array. If you are using a string like 'repoData', please change it to an Array, e.g. ['repoData']`);
      }
    }
    const abortController = new AbortController();
    const addSignalProperty = (object) => {
      Object.defineProperty(object, "signal", {
        enumerable: true,
        get: () => {
          this.#abortSignalConsumed = true;
          return abortController.signal;
        }
      });
    };
    const fetchFn = () => {
      const queryFn = ensureQueryFn(this.options, fetchOptions);
      const createQueryFnContext = () => {
        const queryFnContext2 = {
          client: this.#client,
          queryKey: this.queryKey,
          meta: this.meta
        };
        addSignalProperty(queryFnContext2);
        return queryFnContext2;
      };
      const queryFnContext = createQueryFnContext();
      this.#abortSignalConsumed = false;
      if (this.options.persister) {
        return this.options.persister(queryFn, queryFnContext, this);
      }
      return queryFn(queryFnContext);
    };
    const createFetchContext = () => {
      const context2 = {
        fetchOptions,
        options: this.options,
        queryKey: this.queryKey,
        client: this.#client,
        state: this.state,
        fetchFn
      };
      addSignalProperty(context2);
      return context2;
    };
    const context = createFetchContext();
    this.options.behavior?.onFetch(context, this);
    this.#revertState = this.state;
    if (this.state.fetchStatus === "idle" || this.state.fetchMeta !== context.fetchOptions?.meta) {
      this.#dispatch({
        type: "fetch",
        meta: context.fetchOptions?.meta
      });
    }
    this.#retryer = createRetryer({
      initialPromise: fetchOptions?.initialPromise,
      fn: context.fetchFn,
      onCancel: (error) => {
        if (error instanceof CancelledError && error.revert) {
          this.setState({
            ...this.#revertState,
            fetchStatus: "idle"
          });
        }
        abortController.abort();
      },
      onFail: (failureCount, error) => {
        this.#dispatch({
          type: "failed",
          failureCount,
          error
        });
      },
      onPause: () => {
        this.#dispatch({
          type: "pause"
        });
      },
      onContinue: () => {
        this.#dispatch({
          type: "continue"
        });
      },
      retry: context.options.retry,
      retryDelay: context.options.retryDelay,
      networkMode: context.options.networkMode,
      canRun: () => true
    });
    try {
      const data = await this.#retryer.start();
      if (data === void 0) {
        if (process.env.NODE_ENV !== "production") {
          console.error(`Query data cannot be undefined. Please make sure to return a value other than undefined from your query function. Affected query key: ${this.queryHash}`);
        }
        throw new Error(`${this.queryHash} data is undefined`);
      }
      this.setData(data);
      this.#cache.config.onSuccess?.(data, this);
      this.#cache.config.onSettled?.(data, this.state.error, this);
      return data;
    } catch (error) {
      if (error instanceof CancelledError) {
        if (error.silent) {
          return this.#retryer.promise;
        } else if (error.revert) {
          if (this.state.data === void 0) {
            throw error;
          }
          return this.state.data;
        }
      }
      this.#dispatch({
        type: "error",
        error
      });
      this.#cache.config.onError?.(error, this);
      this.#cache.config.onSettled?.(this.state.data, error, this);
      throw error;
    } finally {
      if (this.isSafeToRemove()) {
        this.markForGc();
      }
    }
  }
  #dispatch(action) {
    const reducer = (state) => {
      switch (action.type) {
        case "failed":
          return {
            ...state,
            fetchFailureCount: action.failureCount,
            fetchFailureReason: action.error
          };
        case "pause":
          return {
            ...state,
            fetchStatus: "paused"
          };
        case "continue":
          return {
            ...state,
            fetchStatus: "fetching"
          };
        case "fetch":
          return {
            ...state,
            ...fetchState(state.data, this.options),
            fetchMeta: action.meta ?? null
          };
        case "success":
          const newState = {
            ...state,
            data: action.data,
            dataUpdateCount: state.dataUpdateCount + 1,
            dataUpdatedAt: action.dataUpdatedAt ?? Date.now(),
            error: null,
            isInvalidated: false,
            status: "success",
            ...!action.manual && {
              fetchStatus: "idle",
              fetchFailureCount: 0,
              fetchFailureReason: null
            }
          };
          this.#revertState = action.manual ? newState : void 0;
          return newState;
        case "error":
          const error = action.error;
          return {
            ...state,
            error,
            errorUpdateCount: state.errorUpdateCount + 1,
            errorUpdatedAt: Date.now(),
            fetchFailureCount: state.fetchFailureCount + 1,
            fetchFailureReason: error,
            fetchStatus: "idle",
            status: "error"
          };
        case "invalidate":
          return {
            ...state,
            isInvalidated: true
          };
        case "setState":
          return {
            ...state,
            ...action.state
          };
      }
    };
    this.state = reducer(this.state);
    notifyManager.batch(() => {
      this.observers.forEach((observer) => {
        observer.onQueryUpdate();
      });
      this.#cache.notify({
        query: this,
        type: "updated",
        action
      });
    });
  }
};
function fetchState(data, options) {
  return {
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchStatus: canFetch(options.networkMode) ? "fetching" : "paused",
    ...data === void 0 && {
      error: null,
      status: "pending"
    }
  };
}
function getDefaultState$1(options) {
  const data = typeof options.initialData === "function" ? options.initialData() : options.initialData;
  const hasData = data !== void 0;
  const initialDataUpdatedAt = hasData ? typeof options.initialDataUpdatedAt === "function" ? options.initialDataUpdatedAt() : options.initialDataUpdatedAt : 0;
  return {
    data,
    dataUpdateCount: 0,
    dataUpdatedAt: hasData ? initialDataUpdatedAt ?? Date.now() : 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: false,
    status: hasData ? "success" : "pending",
    fetchStatus: "idle"
  };
}
var QueryObserver = class extends Subscribable {
  constructor(client, options) {
    super();
    this.options = options;
    this.#client = client;
    this.#selectError = null;
    this.#currentThenable = pendingThenable();
    this.bindMethods();
    this.setOptions(options);
  }
  #client;
  #currentQuery = void 0;
  #currentQueryInitialState = void 0;
  #currentResult = void 0;
  #currentResultState;
  #currentResultOptions;
  #currentThenable;
  #selectError;
  #selectFn;
  #selectResult;
  // This property keeps track of the last query with defined data.
  // It will be used to pass the previous data and query to the placeholder function between renders.
  #lastQueryWithDefinedData;
  #staleTimeoutId;
  #refetchIntervalId;
  #currentRefetchInterval;
  #trackedProps = /* @__PURE__ */ new Set();
  bindMethods() {
    this.refetch = this.refetch.bind(this);
  }
  onSubscribe() {
    if (this.listeners.size === 1) {
      this.#currentQuery.addObserver(this);
      if (shouldFetchOnMount(this.#currentQuery, this.options)) {
        this.#executeFetch();
      } else {
        this.updateResult();
      }
      this.#updateTimers();
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.destroy();
    }
  }
  shouldFetchOnReconnect() {
    return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnReconnect);
  }
  shouldFetchOnWindowFocus() {
    return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnWindowFocus);
  }
  destroy() {
    this.listeners = /* @__PURE__ */ new Set();
    this.#clearStaleTimeout();
    this.#clearRefetchInterval();
    this.#currentQuery.removeObserver(this);
  }
  setOptions(options) {
    const prevOptions = this.options;
    const prevQuery = this.#currentQuery;
    this.options = this.#client.defaultQueryOptions(options);
    if (this.options.enabled !== void 0 && typeof this.options.enabled !== "boolean" && typeof this.options.enabled !== "function" && typeof resolveEnabled(this.options.enabled, this.#currentQuery) !== "boolean") {
      throw new Error("Expected enabled to be a boolean or a callback that returns a boolean");
    }
    this.#updateQuery();
    this.#currentQuery.setOptions(this.options);
    if (prevOptions._defaulted && !shallowEqualObjects(this.options, prevOptions)) {
      this.#client.getQueryCache().notify({
        type: "observerOptionsUpdated",
        query: this.#currentQuery,
        observer: this
      });
    }
    const mounted = this.hasListeners();
    if (mounted && shouldFetchOptionally(this.#currentQuery, prevQuery, this.options, prevOptions)) {
      this.#executeFetch();
    }
    this.updateResult();
    if (mounted && (this.#currentQuery !== prevQuery || resolveEnabled(this.options.enabled, this.#currentQuery) !== resolveEnabled(prevOptions.enabled, this.#currentQuery) || resolveStaleTime(this.options.staleTime, this.#currentQuery) !== resolveStaleTime(prevOptions.staleTime, this.#currentQuery))) {
      this.#updateStaleTimeout();
    }
    const nextRefetchInterval = this.#computeRefetchInterval();
    if (mounted && (this.#currentQuery !== prevQuery || resolveEnabled(this.options.enabled, this.#currentQuery) !== resolveEnabled(prevOptions.enabled, this.#currentQuery) || nextRefetchInterval !== this.#currentRefetchInterval)) {
      this.#updateRefetchInterval(nextRefetchInterval);
    }
  }
  getOptimisticResult(options) {
    const query = this.#client.getQueryCache().build(this.#client, options);
    const result = this.createResult(query, options);
    if (shouldAssignObserverCurrentProperties(this, result)) {
      this.#currentResult = result;
      this.#currentResultOptions = this.options;
      this.#currentResultState = this.#currentQuery.state;
    }
    return result;
  }
  getCurrentResult() {
    return this.#currentResult;
  }
  trackResult(result, onPropTracked) {
    return new Proxy(result, {
      get: (target, key) => {
        this.trackProp(key);
        onPropTracked?.(key);
        if (key === "promise") {
          this.trackProp("data");
          if (!this.options.experimental_prefetchInRender && this.#currentThenable.status === "pending") {
            this.#currentThenable.reject(new Error("experimental_prefetchInRender feature flag is not enabled"));
          }
        }
        return Reflect.get(target, key);
      }
    });
  }
  trackProp(key) {
    this.#trackedProps.add(key);
  }
  getCurrentQuery() {
    return this.#currentQuery;
  }
  refetch({
    ...options
  } = {}) {
    return this.fetch({
      ...options
    });
  }
  fetchOptimistic(options) {
    const defaultedOptions = this.#client.defaultQueryOptions(options);
    const query = this.#client.getQueryCache().build(this.#client, defaultedOptions);
    return query.fetch().then(() => this.createResult(query, defaultedOptions));
  }
  fetch(fetchOptions) {
    return this.#executeFetch({
      ...fetchOptions,
      cancelRefetch: fetchOptions.cancelRefetch ?? true
    }).then(() => {
      this.updateResult();
      return this.#currentResult;
    });
  }
  #executeFetch(fetchOptions) {
    this.#updateQuery();
    let promise = this.#currentQuery.fetch(this.options, fetchOptions);
    if (!fetchOptions?.throwOnError) {
      promise = promise.catch(noop);
    }
    return promise;
  }
  #updateStaleTimeout() {
    this.#clearStaleTimeout();
    const staleTime = resolveStaleTime(this.options.staleTime, this.#currentQuery);
    if (isServer || this.#currentResult.isStale || !isValidTimeout(staleTime)) {
      return;
    }
    const time = timeUntilStale(this.#currentResult.dataUpdatedAt, staleTime);
    const timeout = time + 1;
    this.#staleTimeoutId = timeoutManager.setTimeout(() => {
      if (!this.#currentResult.isStale) {
        this.updateResult();
      }
    }, timeout);
  }
  #computeRefetchInterval() {
    return (typeof this.options.refetchInterval === "function" ? this.options.refetchInterval(this.#currentQuery) : this.options.refetchInterval) ?? false;
  }
  #updateRefetchInterval(nextInterval) {
    this.#clearRefetchInterval();
    this.#currentRefetchInterval = nextInterval;
    if (isServer || resolveEnabled(this.options.enabled, this.#currentQuery) === false || !isValidTimeout(this.#currentRefetchInterval) || this.#currentRefetchInterval === 0) {
      return;
    }
    this.#refetchIntervalId = timeoutManager.setInterval(() => {
      if (this.options.refetchIntervalInBackground || focusManager.isFocused()) {
        this.#executeFetch();
      }
    }, this.#currentRefetchInterval);
  }
  #updateTimers() {
    this.#updateStaleTimeout();
    this.#updateRefetchInterval(this.#computeRefetchInterval());
  }
  #clearStaleTimeout() {
    if (this.#staleTimeoutId) {
      timeoutManager.clearTimeout(this.#staleTimeoutId);
      this.#staleTimeoutId = void 0;
    }
  }
  #clearRefetchInterval() {
    if (this.#refetchIntervalId) {
      timeoutManager.clearInterval(this.#refetchIntervalId);
      this.#refetchIntervalId = void 0;
    }
  }
  createResult(query, options) {
    const prevQuery = this.#currentQuery;
    const prevOptions = this.options;
    const prevResult = this.#currentResult;
    const prevResultState = this.#currentResultState;
    const prevResultOptions = this.#currentResultOptions;
    const queryChange = query !== prevQuery;
    const queryInitialState = queryChange ? query.state : this.#currentQueryInitialState;
    const {
      state
    } = query;
    let newState = {
      ...state
    };
    let isPlaceholderData = false;
    let data;
    if (options._optimisticResults) {
      const mounted = this.hasListeners();
      const fetchOnMount = !mounted && shouldFetchOnMount(query, options);
      const fetchOptionally = mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions);
      if (fetchOnMount || fetchOptionally) {
        newState = {
          ...newState,
          ...fetchState(state.data, query.options)
        };
      }
      if (options._optimisticResults === "isRestoring") {
        newState.fetchStatus = "idle";
      }
    }
    let {
      error,
      errorUpdatedAt,
      status
    } = newState;
    data = newState.data;
    let skipSelect = false;
    if (options.placeholderData !== void 0 && data === void 0 && status === "pending") {
      let placeholderData;
      if (prevResult?.isPlaceholderData && options.placeholderData === prevResultOptions?.placeholderData) {
        placeholderData = prevResult.data;
        skipSelect = true;
      } else {
        placeholderData = typeof options.placeholderData === "function" ? options.placeholderData(this.#lastQueryWithDefinedData?.state.data, this.#lastQueryWithDefinedData) : options.placeholderData;
      }
      if (placeholderData !== void 0) {
        status = "success";
        data = replaceData(prevResult?.data, placeholderData, options);
        isPlaceholderData = true;
      }
    }
    if (options.select && data !== void 0 && !skipSelect) {
      if (prevResult && data === prevResultState?.data && options.select === this.#selectFn) {
        data = this.#selectResult;
      } else {
        try {
          this.#selectFn = options.select;
          data = options.select(data);
          data = replaceData(prevResult?.data, data, options);
          this.#selectResult = data;
          this.#selectError = null;
        } catch (selectError) {
          this.#selectError = selectError;
        }
      }
    }
    if (this.#selectError) {
      error = this.#selectError;
      data = this.#selectResult;
      errorUpdatedAt = Date.now();
      status = "error";
    }
    const isFetching = newState.fetchStatus === "fetching";
    const isPending = status === "pending";
    const isError = status === "error";
    const isLoading = isPending && isFetching;
    const hasData = data !== void 0;
    const result = {
      status,
      fetchStatus: newState.fetchStatus,
      isPending,
      isSuccess: status === "success",
      isError,
      isInitialLoading: isLoading,
      isLoading,
      data,
      dataUpdatedAt: newState.dataUpdatedAt,
      error,
      errorUpdatedAt,
      failureCount: newState.fetchFailureCount,
      failureReason: newState.fetchFailureReason,
      errorUpdateCount: newState.errorUpdateCount,
      isFetched: newState.dataUpdateCount > 0 || newState.errorUpdateCount > 0,
      isFetchedAfterMount: newState.dataUpdateCount > queryInitialState.dataUpdateCount || newState.errorUpdateCount > queryInitialState.errorUpdateCount,
      isFetching,
      isRefetching: isFetching && !isPending,
      isLoadingError: isError && !hasData,
      isPaused: newState.fetchStatus === "paused",
      isPlaceholderData,
      isRefetchError: isError && hasData,
      isStale: isStale(query, options),
      refetch: this.refetch,
      promise: this.#currentThenable,
      isEnabled: resolveEnabled(options.enabled, query) !== false
    };
    const nextResult = result;
    if (this.options.experimental_prefetchInRender) {
      const finalizeThenableIfPossible = (thenable) => {
        if (nextResult.status === "error") {
          thenable.reject(nextResult.error);
        } else if (nextResult.data !== void 0) {
          thenable.resolve(nextResult.data);
        }
      };
      const recreateThenable = () => {
        const pending = this.#currentThenable = nextResult.promise = pendingThenable();
        finalizeThenableIfPossible(pending);
      };
      const prevThenable = this.#currentThenable;
      switch (prevThenable.status) {
        case "pending":
          if (query.queryHash === prevQuery.queryHash) {
            finalizeThenableIfPossible(prevThenable);
          }
          break;
        case "fulfilled":
          if (nextResult.status === "error" || nextResult.data !== prevThenable.value) {
            recreateThenable();
          }
          break;
        case "rejected":
          if (nextResult.status !== "error" || nextResult.error !== prevThenable.reason) {
            recreateThenable();
          }
          break;
      }
    }
    return nextResult;
  }
  updateResult() {
    const prevResult = this.#currentResult;
    const nextResult = this.createResult(this.#currentQuery, this.options);
    this.#currentResultState = this.#currentQuery.state;
    this.#currentResultOptions = this.options;
    if (this.#currentResultState.data !== void 0) {
      this.#lastQueryWithDefinedData = this.#currentQuery;
    }
    if (shallowEqualObjects(nextResult, prevResult)) {
      return;
    }
    this.#currentResult = nextResult;
    const shouldNotifyListeners = () => {
      if (!prevResult) {
        return true;
      }
      const {
        notifyOnChangeProps
      } = this.options;
      const notifyOnChangePropsValue = typeof notifyOnChangeProps === "function" ? notifyOnChangeProps() : notifyOnChangeProps;
      if (notifyOnChangePropsValue === "all" || !notifyOnChangePropsValue && !this.#trackedProps.size) {
        return true;
      }
      const includedProps = new Set(notifyOnChangePropsValue ?? this.#trackedProps);
      if (this.options.throwOnError) {
        includedProps.add("error");
      }
      return Object.keys(this.#currentResult).some((key) => {
        const typedKey = key;
        const changed = this.#currentResult[typedKey] !== prevResult[typedKey];
        return changed && includedProps.has(typedKey);
      });
    };
    this.#notify({
      listeners: shouldNotifyListeners()
    });
  }
  #updateQuery() {
    const query = this.#client.getQueryCache().build(this.#client, this.options);
    if (query === this.#currentQuery) {
      return;
    }
    const prevQuery = this.#currentQuery;
    this.#currentQuery = query;
    this.#currentQueryInitialState = query.state;
    if (this.hasListeners()) {
      prevQuery?.removeObserver(this);
      query.addObserver(this);
    }
  }
  onQueryUpdate() {
    this.updateResult();
    if (this.hasListeners()) {
      this.#updateTimers();
    }
  }
  #notify(notifyOptions) {
    notifyManager.batch(() => {
      if (notifyOptions.listeners) {
        this.listeners.forEach((listener) => {
          listener(this.#currentResult);
        });
      }
      this.#client.getQueryCache().notify({
        query: this.#currentQuery,
        type: "observerResultsUpdated"
      });
    });
  }
};
function shouldLoadOnMount(query, options) {
  return resolveEnabled(options.enabled, query) !== false && query.state.data === void 0 && !(query.state.status === "error" && options.retryOnMount === false);
}
function shouldFetchOnMount(query, options) {
  return shouldLoadOnMount(query, options) || query.state.data !== void 0 && shouldFetchOn(query, options, options.refetchOnMount);
}
function shouldFetchOn(query, options, field) {
  if (resolveEnabled(options.enabled, query) !== false && resolveStaleTime(options.staleTime, query) !== "static") {
    const value = typeof field === "function" ? field(query) : field;
    return value === "always" || value !== false && isStale(query, options);
  }
  return false;
}
function shouldFetchOptionally(query, prevQuery, options, prevOptions) {
  return (query !== prevQuery || resolveEnabled(prevOptions.enabled, query) === false) && (!options.suspense || query.state.status !== "error") && isStale(query, options);
}
function isStale(query, options) {
  return resolveEnabled(options.enabled, query) !== false && query.isStaleByTime(resolveStaleTime(options.staleTime, query));
}
function shouldAssignObserverCurrentProperties(observer, optimisticResult) {
  if (!shallowEqualObjects(observer.getCurrentResult(), optimisticResult)) {
    return true;
  }
  return false;
}
function infiniteQueryBehavior(pages) {
  return {
    onFetch: (context, query) => {
      const options = context.options;
      const direction = context.fetchOptions?.meta?.fetchMore?.direction;
      const oldPages = context.state.data?.pages || [];
      const oldPageParams = context.state.data?.pageParams || [];
      let result = {
        pages: [],
        pageParams: []
      };
      let currentPage = 0;
      const fetchFn = async () => {
        let cancelled = false;
        const addSignalProperty = (object) => {
          Object.defineProperty(object, "signal", {
            enumerable: true,
            get: () => {
              if (context.signal.aborted) {
                cancelled = true;
              } else {
                context.signal.addEventListener("abort", () => {
                  cancelled = true;
                });
              }
              return context.signal;
            }
          });
        };
        const queryFn = ensureQueryFn(context.options, context.fetchOptions);
        const fetchPage = async (data, param, previous) => {
          if (cancelled) {
            return Promise.reject();
          }
          if (param == null && data.pages.length) {
            return Promise.resolve(data);
          }
          const createQueryFnContext = () => {
            const queryFnContext2 = {
              client: context.client,
              queryKey: context.queryKey,
              pageParam: param,
              direction: previous ? "backward" : "forward",
              meta: context.options.meta
            };
            addSignalProperty(queryFnContext2);
            return queryFnContext2;
          };
          const queryFnContext = createQueryFnContext();
          const page = await queryFn(queryFnContext);
          const {
            maxPages
          } = context.options;
          const addTo = previous ? addToStart : addToEnd;
          return {
            pages: addTo(data.pages, page, maxPages),
            pageParams: addTo(data.pageParams, param, maxPages)
          };
        };
        if (direction && oldPages.length) {
          const previous = direction === "backward";
          const pageParamFn = previous ? getPreviousPageParam : getNextPageParam;
          const oldData = {
            pages: oldPages,
            pageParams: oldPageParams
          };
          const param = pageParamFn(options, oldData);
          result = await fetchPage(oldData, param, previous);
        } else {
          const remainingPages = pages ?? oldPages.length;
          do {
            const param = currentPage === 0 ? oldPageParams[0] ?? options.initialPageParam : getNextPageParam(options, result);
            if (currentPage > 0 && param == null) {
              break;
            }
            result = await fetchPage(result, param);
            currentPage++;
          } while (currentPage < remainingPages);
        }
        return result;
      };
      if (context.options.persister) {
        context.fetchFn = () => {
          return context.options.persister?.(fetchFn, {
            client: context.client,
            queryKey: context.queryKey,
            meta: context.options.meta,
            signal: context.signal
          }, query);
        };
      } else {
        context.fetchFn = fetchFn;
      }
    }
  };
}
function getNextPageParam(options, {
  pages,
  pageParams
}) {
  const lastIndex = pages.length - 1;
  return pages.length > 0 ? options.getNextPageParam(pages[lastIndex], pages, pageParams[lastIndex], pageParams) : void 0;
}
function getPreviousPageParam(options, {
  pages,
  pageParams
}) {
  return pages.length > 0 ? options.getPreviousPageParam?.(pages[0], pages, pageParams[0], pageParams) : void 0;
}
var Mutation = class extends Removable {
  #client;
  #observers;
  #mutationCache;
  #retryer;
  constructor(config) {
    super();
    this.#client = config.client;
    this.mutationId = config.mutationId;
    this.#mutationCache = config.mutationCache;
    this.#observers = [];
    this.state = config.state || getDefaultState();
    this.setOptions(config.options);
    this.markForGc();
  }
  setOptions(options) {
    this.options = options;
    this.updateGcTime(this.options.gcTime);
  }
  get meta() {
    return this.options.meta;
  }
  getGcManager() {
    return this.#client.getGcManager();
  }
  addObserver(observer) {
    if (!this.#observers.includes(observer)) {
      this.#observers.push(observer);
      this.clearGcMark();
      this.#mutationCache.notify({
        type: "observerAdded",
        mutation: this,
        observer
      });
    }
  }
  removeObserver(observer) {
    this.#observers = this.#observers.filter((x) => x !== observer);
    if (this.isSafeToRemove()) {
      this.markForGc();
    }
    this.#mutationCache.notify({
      type: "observerRemoved",
      mutation: this,
      observer
    });
  }
  isSafeToRemove() {
    return this.state.status !== "pending" && this.#observers.length === 0;
  }
  optionalRemove() {
    if (!this.#observers.length) {
      if (this.state.status === "pending") {
        this.markForGc();
      } else {
        this.#mutationCache.remove(this);
        return true;
      }
    }
    return false;
  }
  continue() {
    return this.#retryer?.continue() ?? // continuing a mutation assumes that variables are set, mutation must have been dehydrated before
    this.execute(this.state.variables);
  }
  async execute(variables) {
    const onContinue = () => {
      this.#dispatch({
        type: "continue"
      });
    };
    const mutationFnContext = {
      client: this.#client,
      meta: this.options.meta,
      mutationKey: this.options.mutationKey
    };
    this.#retryer = createRetryer({
      fn: () => {
        if (!this.options.mutationFn) {
          return Promise.reject(new Error("No mutationFn found"));
        }
        return this.options.mutationFn(variables, mutationFnContext);
      },
      onFail: (failureCount, error) => {
        this.#dispatch({
          type: "failed",
          failureCount,
          error
        });
      },
      onPause: () => {
        this.#dispatch({
          type: "pause"
        });
      },
      onContinue,
      retry: this.options.retry ?? 0,
      retryDelay: this.options.retryDelay,
      networkMode: this.options.networkMode,
      canRun: () => this.#mutationCache.canRun(this)
    });
    const restored = this.state.status === "pending";
    const isPaused = !this.#retryer.canStart();
    try {
      if (restored) {
        onContinue();
      } else {
        this.#dispatch({
          type: "pending",
          variables,
          isPaused
        });
        await this.#mutationCache.config.onMutate?.(variables, this, mutationFnContext);
        const context = await this.options.onMutate?.(variables, mutationFnContext);
        if (context !== this.state.context) {
          this.#dispatch({
            type: "pending",
            context,
            variables,
            isPaused
          });
        }
      }
      const data = await this.#retryer.start();
      await this.#mutationCache.config.onSuccess?.(data, variables, this.state.context, this, mutationFnContext);
      await this.options.onSuccess?.(data, variables, this.state.context, mutationFnContext);
      await this.#mutationCache.config.onSettled?.(data, null, this.state.variables, this.state.context, this, mutationFnContext);
      await this.options.onSettled?.(data, null, variables, this.state.context, mutationFnContext);
      this.#dispatch({
        type: "success",
        data
      });
      return data;
    } catch (error) {
      try {
        await this.#mutationCache.config.onError?.(error, variables, this.state.context, this, mutationFnContext);
        await this.options.onError?.(error, variables, this.state.context, mutationFnContext);
        await this.#mutationCache.config.onSettled?.(void 0, error, this.state.variables, this.state.context, this, mutationFnContext);
        await this.options.onSettled?.(void 0, error, variables, this.state.context, mutationFnContext);
        throw error;
      } finally {
        this.#dispatch({
          type: "error",
          error
        });
      }
    } finally {
      this.#mutationCache.runNext(this);
    }
  }
  #dispatch(action) {
    const reducer = (state) => {
      switch (action.type) {
        case "failed":
          return {
            ...state,
            failureCount: action.failureCount,
            failureReason: action.error
          };
        case "pause":
          return {
            ...state,
            isPaused: true
          };
        case "continue":
          return {
            ...state,
            isPaused: false
          };
        case "pending":
          return {
            ...state,
            context: action.context,
            data: void 0,
            failureCount: 0,
            failureReason: null,
            error: null,
            isPaused: action.isPaused,
            status: "pending",
            variables: action.variables,
            submittedAt: Date.now()
          };
        case "success":
          return {
            ...state,
            data: action.data,
            failureCount: 0,
            failureReason: null,
            error: null,
            status: "success",
            isPaused: false
          };
        case "error":
          return {
            ...state,
            data: void 0,
            error: action.error,
            failureCount: state.failureCount + 1,
            failureReason: action.error,
            isPaused: false,
            status: "error"
          };
      }
    };
    this.state = reducer(this.state);
    if (this.isSafeToRemove()) {
      this.markForGc();
    }
    notifyManager.batch(() => {
      this.#observers.forEach((observer) => {
        observer.onMutationUpdate(action);
      });
      this.#mutationCache.notify({
        mutation: this,
        type: "updated",
        action
      });
    });
  }
};
function getDefaultState() {
  return {
    context: void 0,
    data: void 0,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    status: "idle",
    variables: void 0,
    submittedAt: 0
  };
}
var MutationCache = class extends Subscribable {
  constructor(config = {}) {
    super();
    this.config = config;
    this.#mutations = /* @__PURE__ */ new Set();
    this.#scopes = /* @__PURE__ */ new Map();
    this.#mutationId = 0;
  }
  #mutations;
  #scopes;
  #mutationId;
  build(client, options, state) {
    const mutation = new Mutation({
      client,
      mutationCache: this,
      mutationId: ++this.#mutationId,
      options: client.defaultMutationOptions(options),
      state
    });
    this.add(mutation);
    return mutation;
  }
  add(mutation) {
    this.#mutations.add(mutation);
    const scope = scopeFor(mutation);
    if (typeof scope === "string") {
      const scopedMutations = this.#scopes.get(scope);
      if (scopedMutations) {
        scopedMutations.push(mutation);
      } else {
        this.#scopes.set(scope, [mutation]);
      }
    }
    this.notify({
      type: "added",
      mutation
    });
  }
  remove(mutation) {
    if (this.#mutations.delete(mutation)) {
      const scope = scopeFor(mutation);
      if (typeof scope === "string") {
        const scopedMutations = this.#scopes.get(scope);
        if (scopedMutations) {
          if (scopedMutations.length > 1) {
            const index = scopedMutations.indexOf(mutation);
            if (index !== -1) {
              scopedMutations.splice(index, 1);
            }
          } else if (scopedMutations[0] === mutation) {
            this.#scopes.delete(scope);
          }
        }
      }
    }
    this.notify({
      type: "removed",
      mutation
    });
  }
  canRun(mutation) {
    const scope = scopeFor(mutation);
    if (typeof scope === "string") {
      const mutationsWithSameScope = this.#scopes.get(scope);
      const firstPendingMutation = mutationsWithSameScope?.find((m) => m.state.status === "pending");
      return !firstPendingMutation || firstPendingMutation === mutation;
    } else {
      return true;
    }
  }
  runNext(mutation) {
    const scope = scopeFor(mutation);
    if (typeof scope === "string") {
      const foundMutation = this.#scopes.get(scope)?.find((m) => m !== mutation && m.state.isPaused);
      return foundMutation?.continue() ?? Promise.resolve();
    } else {
      return Promise.resolve();
    }
  }
  clear() {
    notifyManager.batch(() => {
      this.#mutations.forEach((mutation) => {
        this.notify({
          type: "removed",
          mutation
        });
      });
      this.#mutations.clear();
      this.#scopes.clear();
    });
  }
  getAll() {
    return Array.from(this.#mutations);
  }
  find(filters) {
    const defaultedFilters = {
      exact: true,
      ...filters
    };
    return this.getAll().find((mutation) => matchMutation(defaultedFilters, mutation));
  }
  findAll(filters = {}) {
    return this.getAll().filter((mutation) => matchMutation(filters, mutation));
  }
  notify(event) {
    notifyManager.batch(() => {
      this.listeners.forEach((listener) => {
        listener(event);
      });
    });
  }
  resumePausedMutations() {
    const pausedMutations = this.getAll().filter((x) => x.state.isPaused);
    return notifyManager.batch(() => Promise.all(pausedMutations.map((mutation) => mutation.continue().catch(noop))));
  }
};
function scopeFor(mutation) {
  return mutation.options.scope?.id;
}
var MutationObserver = class extends Subscribable {
  #client;
  #currentResult = void 0;
  #currentMutation;
  #mutateOptions;
  constructor(client, options) {
    super();
    this.#client = client;
    this.setOptions(options);
    this.bindMethods();
    this.#updateResult();
  }
  bindMethods() {
    this.mutate = this.mutate.bind(this);
    this.reset = this.reset.bind(this);
  }
  setOptions(options) {
    const prevOptions = this.options;
    this.options = this.#client.defaultMutationOptions(options);
    if (!shallowEqualObjects(this.options, prevOptions)) {
      this.#client.getMutationCache().notify({
        type: "observerOptionsUpdated",
        mutation: this.#currentMutation,
        observer: this
      });
    }
    if (prevOptions?.mutationKey && this.options.mutationKey && hashKey(prevOptions.mutationKey) !== hashKey(this.options.mutationKey)) {
      this.reset();
    } else if (this.#currentMutation?.state.status === "pending") {
      this.#currentMutation.setOptions(this.options);
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.#currentMutation?.removeObserver(this);
    }
  }
  onMutationUpdate(action) {
    this.#updateResult();
    this.#notify(action);
  }
  getCurrentResult() {
    return this.#currentResult;
  }
  reset() {
    this.#currentMutation?.removeObserver(this);
    this.#currentMutation = void 0;
    this.#updateResult();
    this.#notify();
  }
  mutate(variables, options) {
    this.#mutateOptions = options;
    this.#currentMutation?.removeObserver(this);
    this.#currentMutation = this.#client.getMutationCache().build(this.#client, this.options);
    this.#currentMutation.addObserver(this);
    return this.#currentMutation.execute(variables);
  }
  #updateResult() {
    const state = this.#currentMutation?.state ?? getDefaultState();
    this.#currentResult = {
      ...state,
      isPending: state.status === "pending",
      isSuccess: state.status === "success",
      isError: state.status === "error",
      isIdle: state.status === "idle",
      mutate: this.mutate,
      reset: this.reset
    };
  }
  #notify(action) {
    notifyManager.batch(() => {
      if (this.#mutateOptions && this.hasListeners()) {
        const variables = this.#currentResult.variables;
        const onMutateResult = this.#currentResult.context;
        const context = {
          client: this.#client,
          meta: this.options.meta,
          mutationKey: this.options.mutationKey
        };
        if (action?.type === "success") {
          this.#mutateOptions.onSuccess?.(action.data, variables, onMutateResult, context);
          this.#mutateOptions.onSettled?.(action.data, null, variables, onMutateResult, context);
        } else if (action?.type === "error") {
          this.#mutateOptions.onError?.(action.error, variables, onMutateResult, context);
          this.#mutateOptions.onSettled?.(void 0, action.error, variables, onMutateResult, context);
        }
      }
      this.listeners.forEach((listener) => {
        listener(this.#currentResult);
      });
    });
  }
};
var GCManager = class {
  #isScanning = false;
  #forceDisable = false;
  #eligibleItems = /* @__PURE__ */ new Set();
  #scheduledScanTimeoutId = null;
  #isScheduledScan = false;
  constructor(config = {}) {
    this.#forceDisable = config.forceDisable ?? false;
  }
  #scheduleScan() {
    if (this.#forceDisable || this.#isScheduledScan) {
      return;
    }
    this.#isScheduledScan = true;
    queueMicrotask(() => {
      if (!this.#isScheduledScan) {
        return;
      }
      this.#isScheduledScan = false;
      let minTimeUntilGc = Infinity;
      for (const item of this.#eligibleItems) {
        const timeUntilGc = getTimeUntilGc(item);
        if (timeUntilGc < minTimeUntilGc) {
          minTimeUntilGc = timeUntilGc;
        }
      }
      if (minTimeUntilGc === Infinity) {
        return;
      }
      if (this.#scheduledScanTimeoutId !== null) {
        timeoutManager.clearTimeout(this.#scheduledScanTimeoutId);
      }
      this.#isScanning = true;
      this.#scheduledScanTimeoutId = timeoutManager.setTimeout(() => {
        this.#isScanning = false;
        this.#scheduledScanTimeoutId = null;
        this.#performScan();
        if (this.#eligibleItems.size > 0) {
          this.#scheduleScan();
        }
      }, minTimeUntilGc);
    });
  }
  /**
   * Stop periodic scanning. Safe to call multiple times.
   */
  stopScanning() {
    this.#isScanning = false;
    this.#isScheduledScan = false;
    if (this.#scheduledScanTimeoutId === null) {
      return;
    }
    timeoutManager.clearTimeout(this.#scheduledScanTimeoutId);
    this.#scheduledScanTimeoutId = null;
  }
  /**
   * Check if scanning is active
   */
  isScanning() {
    return this.#isScanning;
  }
  /**
   * Track an item that has been marked for garbage collection.
   * Automatically starts scanning if not already running.
   *
   * @param item - The query or mutation marked for GC
   */
  trackEligibleItem(item) {
    if (this.#forceDisable) {
      return;
    }
    if (this.#eligibleItems.has(item)) {
      return;
    }
    this.#eligibleItems.add(item);
    this.#scheduleScan();
  }
  /**
   * Untrack an item that is no longer eligible for garbage collection.
   * Automatically stops scanning if no items remain eligible.
   *
   * @param item - The query or mutation no longer eligible for GC
   */
  untrackEligibleItem(item) {
    if (this.#forceDisable) {
      return;
    }
    if (!this.#eligibleItems.has(item)) {
      return;
    }
    this.#eligibleItems.delete(item);
    if (this.isScanning()) {
      if (this.getEligibleItemCount() === 0) {
        this.stopScanning();
      } else {
        this.#scheduleScan();
      }
    }
  }
  /**
   * Get the number of items currently eligible for garbage collection.
   */
  getEligibleItemCount() {
    return this.#eligibleItems.size;
  }
  #performScan() {
    for (const item of this.#eligibleItems) {
      try {
        if (item.isEligibleForGc()) {
          const wasCollected = item.optionalRemove();
          if (wasCollected) {
            this.#eligibleItems.delete(item);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[GCManager] Error during garbage collection:", error);
        }
      }
    }
  }
  clear() {
    this.#eligibleItems.clear();
    this.stopScanning();
  }
};
function getTimeUntilGc(item) {
  const gcAt = item.getGcAtTimestamp();
  if (gcAt === null) {
    return Infinity;
  }
  return Math.max(0, gcAt - Date.now());
}
var QueryCache = class extends Subscribable {
  constructor(config = {}) {
    super();
    this.config = config;
    this.#queries = /* @__PURE__ */ new Map();
  }
  #queries;
  build(client, options, state) {
    const queryKey = options.queryKey;
    const queryHash = options.queryHash ?? hashQueryKeyByOptions(queryKey, options);
    let query = this.get(queryHash);
    if (!query) {
      query = new Query({
        client,
        queryKey,
        queryHash,
        options: client.defaultQueryOptions(options),
        state,
        defaultOptions: client.getQueryDefaults(queryKey)
      });
      this.add(query);
    }
    return query;
  }
  add(query) {
    if (!this.#queries.has(query.queryHash)) {
      this.#queries.set(query.queryHash, query);
      this.notify({
        type: "added",
        query
      });
    }
  }
  remove(query) {
    const queryInMap = this.#queries.get(query.queryHash);
    if (queryInMap) {
      query.destroy();
      if (queryInMap === query) {
        this.#queries.delete(query.queryHash);
      }
      this.notify({
        type: "removed",
        query
      });
    }
  }
  clear() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        this.remove(query);
      });
    });
  }
  get(queryHash) {
    return this.#queries.get(queryHash);
  }
  getAll() {
    return [...this.#queries.values()];
  }
  find(filters) {
    const defaultedFilters = {
      exact: true,
      ...filters
    };
    return this.getAll().find((query) => matchQuery(defaultedFilters, query));
  }
  findAll(filters = {}) {
    const queries = this.getAll();
    return Object.keys(filters).length > 0 ? queries.filter((query) => matchQuery(filters, query)) : queries;
  }
  notify(event) {
    notifyManager.batch(() => {
      this.listeners.forEach((listener) => {
        listener(event);
      });
    });
  }
  onFocus() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        query.onFocus();
      });
    });
  }
  onOnline() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        query.onOnline();
      });
    });
  }
};
var QueryClient = class {
  #gcManager;
  #queryCache;
  #mutationCache;
  #defaultOptions;
  #queryDefaults;
  #mutationDefaults;
  #mountCount;
  #unsubscribeFocus;
  #unsubscribeOnline;
  constructor(config = {}) {
    this.#queryCache = config.queryCache || new QueryCache();
    this.#mutationCache = config.mutationCache || new MutationCache();
    this.#defaultOptions = config.defaultOptions || {};
    this.#gcManager = new GCManager({
      forceDisable: isServer
    });
    this.#queryDefaults = /* @__PURE__ */ new Map();
    this.#mutationDefaults = /* @__PURE__ */ new Map();
    this.#mountCount = 0;
  }
  mount() {
    this.#mountCount++;
    if (this.#mountCount !== 1) return;
    this.#unsubscribeFocus = focusManager.subscribe(async (focused) => {
      if (focused) {
        await this.resumePausedMutations();
        this.#queryCache.onFocus();
      }
    });
    this.#unsubscribeOnline = onlineManager.subscribe(async (online) => {
      if (online) {
        await this.resumePausedMutations();
        this.#queryCache.onOnline();
      }
    });
  }
  unmount() {
    this.#mountCount--;
    if (this.#mountCount !== 0) return;
    this.#unsubscribeFocus?.();
    this.#unsubscribeFocus = void 0;
    this.#unsubscribeOnline?.();
    this.#unsubscribeOnline = void 0;
  }
  isFetching(filters) {
    return this.#queryCache.findAll({
      ...filters,
      fetchStatus: "fetching"
    }).length;
  }
  isMutating(filters) {
    return this.#mutationCache.findAll({
      ...filters,
      status: "pending"
    }).length;
  }
  /**
   * Imperative (non-reactive) way to retrieve data for a QueryKey.
   * Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
   *
   * Hint: Do not use this function inside a component, because it won't receive updates.
   * Use `useQuery` to create a `QueryObserver` that subscribes to changes.
   */
  getQueryData(queryKey) {
    const options = this.defaultQueryOptions({
      queryKey
    });
    return this.#queryCache.get(options.queryHash)?.state.data;
  }
  ensureQueryData(options) {
    const defaultedOptions = this.defaultQueryOptions(options);
    const query = this.#queryCache.build(this, defaultedOptions);
    const cachedData = query.state.data;
    if (cachedData === void 0) {
      return this.fetchQuery(options);
    }
    if (options.revalidateIfStale && query.isStaleByTime(resolveStaleTime(defaultedOptions.staleTime, query))) {
      void this.prefetchQuery(defaultedOptions);
    }
    return Promise.resolve(cachedData);
  }
  getQueriesData(filters) {
    return this.#queryCache.findAll(filters).map(({
      queryKey,
      state
    }) => {
      const data = state.data;
      return [queryKey, data];
    });
  }
  setQueryData(queryKey, updater, options) {
    const defaultedOptions = this.defaultQueryOptions({
      queryKey
    });
    const query = this.#queryCache.get(defaultedOptions.queryHash);
    const prevData = query?.state.data;
    const data = functionalUpdate(updater, prevData);
    if (data === void 0) {
      return void 0;
    }
    return this.#queryCache.build(this, defaultedOptions).setData(data, {
      ...options,
      manual: true
    });
  }
  setQueriesData(filters, updater, options) {
    return notifyManager.batch(() => this.#queryCache.findAll(filters).map(({
      queryKey
    }) => [queryKey, this.setQueryData(queryKey, updater, options)]));
  }
  getQueryState(queryKey) {
    const options = this.defaultQueryOptions({
      queryKey
    });
    return this.#queryCache.get(options.queryHash)?.state;
  }
  removeQueries(filters) {
    const queryCache = this.#queryCache;
    notifyManager.batch(() => {
      queryCache.findAll(filters).forEach((query) => {
        queryCache.remove(query);
      });
    });
  }
  resetQueries(filters, options) {
    const queryCache = this.#queryCache;
    return notifyManager.batch(() => {
      queryCache.findAll(filters).forEach((query) => {
        query.reset();
      });
      return this.refetchQueries({
        type: "active",
        ...filters
      }, options);
    });
  }
  cancelQueries(filters, cancelOptions = {}) {
    const defaultedCancelOptions = {
      revert: true,
      ...cancelOptions
    };
    const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).map((query) => query.cancel(defaultedCancelOptions)));
    return Promise.all(promises).then(noop).catch(noop);
  }
  invalidateQueries(filters, options = {}) {
    return notifyManager.batch(() => {
      this.#queryCache.findAll(filters).forEach((query) => {
        query.invalidate();
      });
      if (filters?.refetchType === "none") {
        return Promise.resolve();
      }
      return this.refetchQueries({
        ...filters,
        type: filters?.refetchType ?? filters?.type ?? "active"
      }, options);
    });
  }
  refetchQueries(filters, options = {}) {
    const fetchOptions = {
      ...options,
      cancelRefetch: options.cancelRefetch ?? true
    };
    const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).filter((query) => !query.isDisabled() && !query.isStatic()).map((query) => {
      let promise = query.fetch(void 0, fetchOptions);
      if (!fetchOptions.throwOnError) {
        promise = promise.catch(noop);
      }
      return query.state.fetchStatus === "paused" ? Promise.resolve() : promise;
    }));
    return Promise.all(promises).then(noop);
  }
  fetchQuery(options) {
    const defaultedOptions = this.defaultQueryOptions(options);
    if (defaultedOptions.retry === void 0) {
      defaultedOptions.retry = false;
    }
    const query = this.#queryCache.build(this, defaultedOptions);
    return query.isStaleByTime(resolveStaleTime(defaultedOptions.staleTime, query)) ? query.fetch(defaultedOptions) : Promise.resolve(query.state.data);
  }
  prefetchQuery(options) {
    return this.fetchQuery(options).then(noop).catch(noop);
  }
  fetchInfiniteQuery(options) {
    options.behavior = infiniteQueryBehavior(options.pages);
    return this.fetchQuery(options);
  }
  prefetchInfiniteQuery(options) {
    return this.fetchInfiniteQuery(options).then(noop).catch(noop);
  }
  ensureInfiniteQueryData(options) {
    options.behavior = infiniteQueryBehavior(options.pages);
    return this.ensureQueryData(options);
  }
  resumePausedMutations() {
    if (onlineManager.isOnline()) {
      return this.#mutationCache.resumePausedMutations();
    }
    return Promise.resolve();
  }
  getGcManager() {
    return this.#gcManager;
  }
  getQueryCache() {
    return this.#queryCache;
  }
  getMutationCache() {
    return this.#mutationCache;
  }
  getDefaultOptions() {
    return this.#defaultOptions;
  }
  setDefaultOptions(options) {
    this.#defaultOptions = options;
  }
  setQueryDefaults(queryKey, options) {
    this.#queryDefaults.set(hashKey(queryKey), {
      queryKey,
      defaultOptions: options
    });
  }
  getQueryDefaults(queryKey) {
    const defaults = [...this.#queryDefaults.values()];
    const result = {};
    defaults.forEach((queryDefault) => {
      if (partialMatchKey(queryKey, queryDefault.queryKey)) {
        Object.assign(result, queryDefault.defaultOptions);
      }
    });
    return result;
  }
  setMutationDefaults(mutationKey, options) {
    this.#mutationDefaults.set(hashKey(mutationKey), {
      mutationKey,
      defaultOptions: options
    });
  }
  getMutationDefaults(mutationKey) {
    const defaults = [...this.#mutationDefaults.values()];
    const result = {};
    defaults.forEach((queryDefault) => {
      if (partialMatchKey(mutationKey, queryDefault.mutationKey)) {
        Object.assign(result, queryDefault.defaultOptions);
      }
    });
    return result;
  }
  defaultQueryOptions(options) {
    if (options._defaulted) {
      return options;
    }
    const defaultedOptions = {
      ...this.#defaultOptions.queries,
      ...this.getQueryDefaults(options.queryKey),
      ...options,
      _defaulted: true
    };
    if (!defaultedOptions.queryHash) {
      defaultedOptions.queryHash = hashQueryKeyByOptions(defaultedOptions.queryKey, defaultedOptions);
    }
    if (defaultedOptions.refetchOnReconnect === void 0) {
      defaultedOptions.refetchOnReconnect = defaultedOptions.networkMode !== "always";
    }
    if (defaultedOptions.throwOnError === void 0) {
      defaultedOptions.throwOnError = !!defaultedOptions.suspense;
    }
    if (!defaultedOptions.networkMode && defaultedOptions.persister) {
      defaultedOptions.networkMode = "offlineFirst";
    }
    if (defaultedOptions.queryFn === skipToken) {
      defaultedOptions.enabled = false;
    }
    return defaultedOptions;
  }
  defaultMutationOptions(options) {
    if (options?._defaulted) {
      return options;
    }
    return {
      ...this.#defaultOptions.mutations,
      ...options?.mutationKey && this.getMutationDefaults(options.mutationKey),
      ...options,
      _defaulted: true
    };
  }
  clear() {
    this.#queryCache.clear();
    this.#mutationCache.clear();
    this.#gcManager.clear();
  }
};
var compilerRuntime = { exports: {} };
var reactCompilerRuntime_production = {};
/**
 * @license React
 * react-compiler-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactCompilerRuntime_production;
function requireReactCompilerRuntime_production() {
  if (hasRequiredReactCompilerRuntime_production) return reactCompilerRuntime_production;
  hasRequiredReactCompilerRuntime_production = 1;
  var ReactSharedInternals = React__default.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  reactCompilerRuntime_production.c = function(size) {
    return ReactSharedInternals.H.useMemoCache(size);
  };
  return reactCompilerRuntime_production;
}
var reactCompilerRuntime_development = {};
/**
 * @license React
 * react-compiler-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactCompilerRuntime_development;
function requireReactCompilerRuntime_development() {
  if (hasRequiredReactCompilerRuntime_development) return reactCompilerRuntime_development;
  hasRequiredReactCompilerRuntime_development = 1;
  "production" !== process.env.NODE_ENV && (function() {
    var ReactSharedInternals = React__default.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    reactCompilerRuntime_development.c = function(size) {
      var dispatcher = ReactSharedInternals.H;
      null === dispatcher && console.error(
        "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
      );
      return dispatcher.useMemoCache(size);
    };
  })();
  return reactCompilerRuntime_development;
}
var hasRequiredCompilerRuntime;
function requireCompilerRuntime() {
  if (hasRequiredCompilerRuntime) return compilerRuntime.exports;
  hasRequiredCompilerRuntime = 1;
  if (process.env.NODE_ENV === "production") {
    compilerRuntime.exports = requireReactCompilerRuntime_production();
  } else {
    compilerRuntime.exports = requireReactCompilerRuntime_development();
  }
  return compilerRuntime.exports;
}
var compilerRuntimeExports = requireCompilerRuntime();
var QueryClientContext = React.createContext(void 0);
var useQueryClient = (queryClient2) => {
  const client = React.useContext(QueryClientContext);
  if (!client) {
    throw new Error("No QueryClient set, use QueryClientProvider to set one");
  }
  return client;
};
var QueryClientProvider = (t0) => {
  const $ = compilerRuntimeExports.c(6);
  const {
    client,
    children
  } = t0;
  let t1;
  let t2;
  if ($[0] !== client) {
    t1 = () => {
      client.mount();
      return () => {
        client.unmount();
      };
    };
    t2 = [client];
    $[0] = client;
    $[1] = t1;
    $[2] = t2;
  } else {
    t1 = $[1];
    t2 = $[2];
  }
  React.useEffect(t1, t2);
  let t3;
  if ($[3] !== children || $[4] !== client) {
    t3 = jsx(QueryClientContext.Provider, {
      value: client,
      children
    });
    $[3] = children;
    $[4] = client;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  return t3;
};
var IsRestoringContext = React.createContext(false);
var useIsRestoring = () => {
  return React.useContext(IsRestoringContext);
};
IsRestoringContext.Provider;
function createValue() {
  let isReset = false;
  return {
    clearReset: () => {
      isReset = false;
    },
    reset: () => {
      isReset = true;
    },
    isReset: () => {
      return isReset;
    }
  };
}
var QueryErrorResetBoundaryContext = React.createContext(createValue());
var useQueryErrorResetBoundary = () => {
  return React.useContext(QueryErrorResetBoundaryContext);
};
var ensurePreventErrorBoundaryRetry = (options, errorResetBoundary) => {
  if (options.suspense || options.throwOnError || options.experimental_prefetchInRender) {
    if (!errorResetBoundary.isReset()) {
      options.retryOnMount = false;
    }
  }
};
var useClearResetErrorBoundary = (errorResetBoundary) => {
  const $ = compilerRuntimeExports.c(3);
  let t0;
  let t1;
  if ($[0] !== errorResetBoundary) {
    t0 = () => {
      errorResetBoundary.clearReset();
    };
    t1 = [errorResetBoundary];
    $[0] = errorResetBoundary;
    $[1] = t0;
    $[2] = t1;
  } else {
    t0 = $[1];
    t1 = $[2];
  }
  React.useEffect(t0, t1);
};
var getHasError = ({
  result,
  errorResetBoundary,
  throwOnError,
  query,
  suspense
}) => {
  return result.isError && !errorResetBoundary.isReset() && !result.isFetching && query && (suspense && result.data === void 0 || shouldThrowError(throwOnError, [result.error, query]));
};
var defaultThrowOnError = (_error, query) => query.state.data === void 0;
var ensureSuspenseTimers = (defaultedOptions) => {
  if (defaultedOptions.suspense) {
    const MIN_SUSPENSE_TIME_MS = 1e3;
    const clamp = (value) => value === "static" ? value : Math.max(value ?? MIN_SUSPENSE_TIME_MS, MIN_SUSPENSE_TIME_MS);
    const originalStaleTime = defaultedOptions.staleTime;
    defaultedOptions.staleTime = typeof originalStaleTime === "function" ? (...args) => clamp(originalStaleTime(...args)) : clamp(originalStaleTime);
    if (typeof defaultedOptions.gcTime === "number") {
      defaultedOptions.gcTime = Math.max(defaultedOptions.gcTime, MIN_SUSPENSE_TIME_MS);
    }
  }
};
var willFetch = (result, isRestoring) => result.isLoading && result.isFetching && !isRestoring;
var shouldSuspend = (defaultedOptions, result) => defaultedOptions?.suspense && result.isPending;
var fetchOptimistic = (defaultedOptions, observer, errorResetBoundary) => observer.fetchOptimistic(defaultedOptions).catch(() => {
  errorResetBoundary.clearReset();
});
function useBaseQuery(options, Observer, queryClient2) {
  const $ = compilerRuntimeExports.c(14);
  if (process.env.NODE_ENV !== "production") {
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new Error('Bad argument type. Starting with v5, only the "Object" form is allowed when calling query related functions. Please use the error stack to find the culprit call. More info here: https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5#supports-a-single-signature-one-object');
    }
  }
  const isRestoring = useIsRestoring();
  const errorResetBoundary = useQueryErrorResetBoundary();
  const client = useQueryClient();
  const defaultedOptions = client.defaultQueryOptions(options);
  client.getDefaultOptions().queries?._experimental_beforeQuery?.(defaultedOptions);
  if (process.env.NODE_ENV !== "production") {
    if (!defaultedOptions.queryFn) {
      console.error(`[${defaultedOptions.queryHash}]: No queryFn was passed as an option, and no default queryFn was found. The queryFn parameter is only optional when using a default queryFn. More info here: https://tanstack.com/query/latest/docs/framework/react/guides/default-query-function`);
    }
  }
  defaultedOptions._optimisticResults = isRestoring ? "isRestoring" : "optimistic";
  ensureSuspenseTimers(defaultedOptions);
  ensurePreventErrorBoundaryRetry(defaultedOptions, errorResetBoundary);
  useClearResetErrorBoundary(errorResetBoundary);
  const isNewCacheEntry = !client.getQueryCache().get(defaultedOptions.queryHash);
  let t0;
  if ($[0] !== Observer || $[1] !== client || $[2] !== defaultedOptions) {
    t0 = () => new Observer(client, defaultedOptions);
    $[0] = Observer;
    $[1] = client;
    $[2] = defaultedOptions;
    $[3] = t0;
  } else {
    t0 = $[3];
  }
  const [observer] = React.useState(t0);
  const result = observer.getOptimisticResult(defaultedOptions);
  const shouldSubscribe = !isRestoring && options.subscribed !== false;
  let t1;
  if ($[4] !== observer || $[5] !== shouldSubscribe) {
    t1 = (onStoreChange) => {
      const unsubscribe = shouldSubscribe ? observer.subscribe(notifyManager.batchCalls(onStoreChange)) : noop;
      observer.updateResult();
      return unsubscribe;
    };
    $[4] = observer;
    $[5] = shouldSubscribe;
    $[6] = t1;
  } else {
    t1 = $[6];
  }
  let t2;
  let t3;
  if ($[7] !== observer) {
    t2 = () => observer.getCurrentResult();
    t3 = () => observer.getCurrentResult();
    $[7] = observer;
    $[8] = t2;
    $[9] = t3;
  } else {
    t2 = $[8];
    t3 = $[9];
  }
  React.useSyncExternalStore(t1, t2, t3);
  let t4;
  let t5;
  if ($[10] !== defaultedOptions || $[11] !== observer) {
    t4 = () => {
      observer.setOptions(defaultedOptions);
    };
    t5 = [defaultedOptions, observer];
    $[10] = defaultedOptions;
    $[11] = observer;
    $[12] = t4;
    $[13] = t5;
  } else {
    t4 = $[12];
    t5 = $[13];
  }
  React.useEffect(t4, t5);
  if (shouldSuspend(defaultedOptions, result)) {
    throw fetchOptimistic(defaultedOptions, observer, errorResetBoundary);
  }
  if (getHasError({
    result,
    errorResetBoundary,
    throwOnError: defaultedOptions.throwOnError,
    query: client.getQueryCache().get(defaultedOptions.queryHash),
    suspense: defaultedOptions.suspense
  })) {
    throw result.error;
  }
  client.getDefaultOptions().queries?._experimental_afterQuery?.(defaultedOptions, result);
  if (defaultedOptions.experimental_prefetchInRender && !isServer && willFetch(result, isRestoring)) {
    const promise = isNewCacheEntry ? fetchOptimistic(defaultedOptions, observer, errorResetBoundary) : client.getQueryCache().get(defaultedOptions.queryHash)?.promise;
    promise?.catch(noop).finally(() => {
      observer.updateResult();
    });
  }
  return !defaultedOptions.notifyOnChangeProps ? observer.trackResult(result) : result;
}
function useQuery(options, queryClient2) {
  return useBaseQuery(options, QueryObserver);
}
function useSuspenseQuery(options, queryClient2) {
  const $ = compilerRuntimeExports.c(2);
  if (process.env.NODE_ENV !== "production") {
    if (options.queryFn === skipToken) {
      console.error("skipToken is not allowed for useSuspenseQuery");
    }
  }
  let t0;
  if ($[0] !== options) {
    t0 = {
      ...options,
      enabled: true,
      suspense: true,
      throwOnError: defaultThrowOnError,
      placeholderData: void 0
    };
    $[0] = options;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  return useBaseQuery(t0, QueryObserver);
}
function useMutation(options, queryClient2) {
  const $ = compilerRuntimeExports.c(17);
  const client = useQueryClient();
  let t0;
  if ($[0] !== client || $[1] !== options) {
    t0 = () => new MutationObserver(client, options);
    $[0] = client;
    $[1] = options;
    $[2] = t0;
  } else {
    t0 = $[2];
  }
  const [observer] = React.useState(t0);
  let t1;
  let t2;
  if ($[3] !== observer || $[4] !== options) {
    t1 = () => {
      observer.setOptions(options);
    };
    t2 = [observer, options];
    $[3] = observer;
    $[4] = options;
    $[5] = t1;
    $[6] = t2;
  } else {
    t1 = $[5];
    t2 = $[6];
  }
  React.useEffect(t1, t2);
  let t3;
  if ($[7] !== observer) {
    t3 = (onStoreChange) => observer.subscribe(notifyManager.batchCalls(onStoreChange));
    $[7] = observer;
    $[8] = t3;
  } else {
    t3 = $[8];
  }
  let t4;
  let t5;
  if ($[9] !== observer) {
    t4 = () => observer.getCurrentResult();
    t5 = () => observer.getCurrentResult();
    $[9] = observer;
    $[10] = t4;
    $[11] = t5;
  } else {
    t4 = $[10];
    t5 = $[11];
  }
  const result = React.useSyncExternalStore(t3, t4, t5);
  let t6;
  if ($[12] !== observer) {
    t6 = (variables, mutateOptions) => {
      observer.mutate(variables, mutateOptions).catch(noop);
    };
    $[12] = observer;
    $[13] = t6;
  } else {
    t6 = $[13];
  }
  const mutate = t6;
  if (result.error && shouldThrowError(observer.options.throwOnError, [result.error])) {
    throw result.error;
  }
  let t7;
  if ($[14] !== mutate || $[15] !== result) {
    t7 = {
      ...result,
      mutate,
      mutateAsync: result.mutate
    };
    $[14] = mutate;
    $[15] = result;
    $[16] = t7;
  } else {
    t7 = $[16];
  }
  return t7;
}
const MIN_LIMIT = 0;
const MAX_LIMIT = 2e3;
const LIMIT_OPTIONS = [100, 250, 500, 1e3, 1500, 2e3];
const GC_OPTIONS = [0, 5 * 60 * 1e3, Infinity];
const GC_OPTIONS_LABELS = ["0s", "5m", "∞"];
function Settings(t0) {
  const $ = compilerRuntimeExports$1.c(23);
  const {
    gcTimeout,
    onGcTimeoutChange,
    movieLimit,
    onMovieLimitChange,
    showDevtools,
    onShowDevtoolsChange
  } = t0;
  const [isOpen, setIsOpen] = useState(false);
  let t1;
  if ($[0] !== onMovieLimitChange) {
    t1 = (value) => {
      const numValue = parseInt(value, 10);
      if (numValue >= MIN_LIMIT && numValue <= MAX_LIMIT) {
        onMovieLimitChange(numValue);
      }
    };
    $[0] = onMovieLimitChange;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const handleLimitChange = t1;
  let t2;
  if ($[2] !== onGcTimeoutChange) {
    t2 = (value_0) => {
      if (value_0 < 0) {
        return;
      }
      onGcTimeoutChange(isNaN(value_0) ? 0 : value_0);
    };
    $[2] = onGcTimeoutChange;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  const handleGcTimeoutChange = t2;
  let t3;
  if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = /* @__PURE__ */ jsx("div", { className: "absolute -top-10 left-[20%] z-50 pointer-events-none", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx("div", { className: "bg-black text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap shadow-lg", children: "Try playing with settings!" }),
      /* @__PURE__ */ jsx("div", { className: "absolute left-2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black" })
    ] }) });
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  let t4;
  if ($[5] !== isOpen) {
    t4 = () => setIsOpen(!isOpen);
    $[5] = isOpen;
    $[6] = t4;
  } else {
    t4 = $[6];
  }
  let t5;
  if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
    t5 = /* @__PURE__ */ jsxs("svg", { className: "w-5 h-5 m-auto", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [
      /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
      /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
    ] });
    $[7] = t5;
  } else {
    t5 = $[7];
  }
  let t6;
  if ($[8] !== t4) {
    t6 = /* @__PURE__ */ jsx("button", { onClick: t4, className: "h-[48px] md:h-[52px] aspect-square px-3 rounded-xl border-2 border-gray-200 hover:border-black focus:outline-none focus:border-black transition-all duration-200 bg-white text-gray-700", "aria-label": "Settings", children: t5 });
    $[8] = t4;
    $[9] = t6;
  } else {
    t6 = $[9];
  }
  let t7;
  if ($[10] !== gcTimeout || $[11] !== handleGcTimeoutChange || $[12] !== handleLimitChange || $[13] !== isOpen || $[14] !== movieLimit || $[15] !== onGcTimeoutChange || $[16] !== onMovieLimitChange || $[17] !== onShowDevtoolsChange || $[18] !== showDevtools) {
    t7 = isOpen && /* @__PURE__ */ jsxs("div", { className: "absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border-2 border-gray-200 p-4 w-[400px] z-50", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold text-gray-900", children: "Settings" }),
        /* @__PURE__ */ jsx("button", { onClick: () => setIsOpen(false), className: "text-gray-500 hover:text-gray-700", "aria-label": "Close settings", children: /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { htmlFor: "movie-limit", className: "block text-sm font-medium text-gray-700 mb-2", children: "Number of movies to display" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("input", { id: "movie-limit", type: "range", min: MIN_LIMIT, max: MAX_LIMIT, value: movieLimit, onChange: (e) => handleLimitChange(e.target.value), className: "flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" }),
            /* @__PURE__ */ jsx("input", { type: "number", min: MIN_LIMIT, max: MAX_LIMIT, value: movieLimit, onChange: (e_0) => handleLimitChange(e_0.target.value), className: "w-20 px-2 py-1 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-gray-500 mt-1", children: [
            /* @__PURE__ */ jsx("span", { children: MIN_LIMIT }),
            /* @__PURE__ */ jsx("span", { children: MAX_LIMIT })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "pt-3", children: /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: LIMIT_OPTIONS.map((limit) => /* @__PURE__ */ jsx("button", { onClick: () => onMovieLimitChange(limit), className: `flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${movieLimit === limit ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`, children: limit }, limit)) }) }),
        /* @__PURE__ */ jsx("div", { className: "pt-3 border-t border-gray-200", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
          /* @__PURE__ */ jsxs("label", { className: "flex flex-col text-sm font-medium text-gray-700 w-full", children: [
            "GC Timeout",
            /* @__PURE__ */ jsx("input", { type: "number", inputMode: "decimal", min: 0, max: Infinity, value: gcTimeout, onChange: (e_1) => handleGcTimeoutChange(e_1.target.valueAsNumber), className: "w-full mt-2 px-2 py-1 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex justify-between text-xs gap-2 text-gray-500 self-start", children: GC_OPTIONS.map((option, index) => /* @__PURE__ */ jsx("button", { onClick: () => onGcTimeoutChange(option), className: `flex-1 px-3 py-2 text-sm rounded-lg transition-colors min-w-18 ${gcTimeout === option ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`, children: GC_OPTIONS_LABELS[index] }, option)) })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 pt-3 border-t border-gray-200", children: [
          /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: /* @__PURE__ */ jsx("label", { className: "flex flex-col text-sm font-medium text-gray-700 w-full", children: "Devtools visibility" }) }),
          /* @__PURE__ */ jsxs("button", { onClick: () => onShowDevtoolsChange(!showDevtools), className: `flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${showDevtools ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`, children: [
            showDevtools ? "Hide" : "Show",
            " Devtools"
          ] })
        ] })
      ] })
    ] });
    $[10] = gcTimeout;
    $[11] = handleGcTimeoutChange;
    $[12] = handleLimitChange;
    $[13] = isOpen;
    $[14] = movieLimit;
    $[15] = onGcTimeoutChange;
    $[16] = onMovieLimitChange;
    $[17] = onShowDevtoolsChange;
    $[18] = showDevtools;
    $[19] = t7;
  } else {
    t7 = $[19];
  }
  let t8;
  if ($[20] !== t6 || $[21] !== t7) {
    t8 = /* @__PURE__ */ jsxs("div", { className: "flex flex-none relative", children: [
      t3,
      t6,
      t7
    ] });
    $[20] = t6;
    $[21] = t7;
    $[22] = t8;
  } else {
    t8 = $[22];
  }
  return t8;
}
function MovieList(t0) {
  const $ = compilerRuntimeExports$1.c(9);
  const {
    moviesAmount,
    children
  } = t0;
  if (moviesAmount === 0) {
    let t12;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
      t12 = /* @__PURE__ */ jsxs("div", { className: "text-center py-12 md:py-20", children: [
        /* @__PURE__ */ jsx("div", { className: "text-4xl md:text-6xl mb-4", children: "🎬" }),
        /* @__PURE__ */ jsx("p", { className: "text-lg md:text-xl text-gray-600 mb-2", children: "No movies found" }),
        /* @__PURE__ */ jsx("p", { className: "text-xs md:text-sm text-gray-400", children: "Try a different search term" })
      ] });
      $[0] = t12;
    } else {
      t12 = $[0];
    }
    return t12;
  }
  const t1 = moviesAmount === 1 ? "movie" : "movies";
  let t2;
  if ($[1] !== moviesAmount || $[2] !== t1) {
    t2 = /* @__PURE__ */ jsx("div", { className: "mb-4 md:mb-6 text-center", children: /* @__PURE__ */ jsxs("p", { className: "text-xs md:text-sm text-gray-500", children: [
      "Found ",
      moviesAmount,
      " ",
      t1
    ] }) });
    $[1] = moviesAmount;
    $[2] = t1;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  let t3;
  if ($[4] !== children) {
    t3 = /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3 md:gap-4", children });
    $[4] = children;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  let t4;
  if ($[6] !== t2 || $[7] !== t3) {
    t4 = /* @__PURE__ */ jsxs("div", { children: [
      t2,
      t3
    ] });
    $[6] = t2;
    $[7] = t3;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  return t4;
}
function StarIcon(t0) {
  const $ = compilerRuntimeExports$1.c(6);
  const {
    filled,
    className: t1
  } = t0;
  const className = t1 === void 0 ? "" : t1;
  if (filled) {
    let t2;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
      t2 = /* @__PURE__ */ jsx("path", { d: "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" });
      $[0] = t2;
    } else {
      t2 = $[0];
    }
    let t3;
    if ($[1] !== className) {
      t3 = /* @__PURE__ */ jsx("svg", { className, fill: "currentColor", viewBox: "0 0 20 20", xmlns: "http://www.w3.org/2000/svg", children: t2 });
      $[1] = className;
      $[2] = t3;
    } else {
      t3 = $[2];
    }
    return t3;
  } else {
    let t2;
    if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
      t2 = /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" });
      $[3] = t2;
    } else {
      t2 = $[3];
    }
    let t3;
    if ($[4] !== className) {
      t3 = /* @__PURE__ */ jsx("svg", { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", children: t2 });
      $[4] = className;
      $[5] = t3;
    } else {
      t3 = $[5];
    }
    return t3;
  }
}
function MovieCard(t0) {
  const $ = compilerRuntimeExports$1.c(64);
  const {
    movie,
    onUpdateRating,
    isPending
  } = t0;
  const [hoveredStar, setHoveredStar] = useState(null);
  let t1;
  if ($[0] !== onUpdateRating) {
    t1 = (starIndex) => {
      onUpdateRating(starIndex * 2);
    };
    $[0] = onUpdateRating;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const handleStarClick = t1;
  const rating = movie.ratingsSummary.aggregateRating;
  const currentStars = Math.ceil(rating ?? 0);
  let t2;
  if ($[2] !== movie.principalCredits) {
    t2 = movie.principalCredits?.find(_temp)?.credits[0]?.name.nameText.text || "Unknown";
    $[2] = movie.principalCredits;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  const director = t2;
  let t3;
  if ($[4] !== movie.genres.genres) {
    t3 = movie.genres.genres.map(_temp2).join(", ");
    $[4] = movie.genres.genres;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  const genres = t3;
  const imageUrl = movie.primaryImage?.url || "https://via.placeholder.com/300x450?text=No+Image";
  let t4;
  if ($[6] !== imageUrl || $[7] !== movie.titleText.text) {
    t4 = /* @__PURE__ */ jsx("img", { src: imageUrl, alt: movie.titleText.text, loading: "lazy", decoding: "async", fetchPriority: "low", className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" });
    $[6] = imageUrl;
    $[7] = movie.titleText.text;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  let t5;
  if ($[9] !== rating) {
    t5 = rating?.toFixed(1) ?? "N/A";
    $[9] = rating;
    $[10] = t5;
  } else {
    t5 = $[10];
  }
  let t6;
  if ($[11] !== t5) {
    t6 = /* @__PURE__ */ jsx("div", { className: "absolute top-2 right-2", children: /* @__PURE__ */ jsx("span", { className: "px-2 py-0.5 text-xs font-bold bg-black text-white rounded-md shadow-lg", children: t5 }) });
    $[11] = t5;
    $[12] = t6;
  } else {
    t6 = $[12];
  }
  let t7;
  if ($[13] !== t4 || $[14] !== t6) {
    t7 = /* @__PURE__ */ jsxs("div", { className: "relative h-48 sm:h-36 md:h-40 w-full sm:w-auto sm:aspect-[1.5/1] flex-shrink-0 overflow-hidden bg-gray-100 sm:rounded-l-lg", children: [
      t4,
      t6
    ] });
    $[13] = t4;
    $[14] = t6;
    $[15] = t7;
  } else {
    t7 = $[15];
  }
  let t8;
  if ($[16] !== movie.titleText.text) {
    t8 = /* @__PURE__ */ jsx("h3", { className: "text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900", children: movie.titleText.text });
    $[16] = movie.titleText.text;
    $[17] = t8;
  } else {
    t8 = $[17];
  }
  let t9;
  if ($[18] !== isPending) {
    t9 = isPending && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 text-xs text-gray-500 flex-shrink-0", children: [
      /* @__PURE__ */ jsx("div", { className: "animate-spin h-3 w-3 border-2 border-gray-300 border-t-black rounded-full" }),
      /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Saving..." })
    ] });
    $[18] = isPending;
    $[19] = t9;
  } else {
    t9 = $[19];
  }
  let t10;
  if ($[20] !== t8 || $[21] !== t9) {
    t10 = /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
      t8,
      t9
    ] });
    $[20] = t8;
    $[21] = t9;
    $[22] = t10;
  } else {
    t10 = $[22];
  }
  let t11;
  if ($[23] === Symbol.for("react.memo_cache_sentinel")) {
    t11 = /* @__PURE__ */ jsx("svg", { className: "w-3 h-3", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx("path", { d: "M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" }) });
    $[23] = t11;
  } else {
    t11 = $[23];
  }
  const t12 = movie.releaseYear?.year ?? "N/A";
  let t13;
  if ($[24] !== t12) {
    t13 = /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
      t11,
      t12
    ] });
    $[24] = t12;
    $[25] = t13;
  } else {
    t13 = $[25];
  }
  let t14;
  if ($[26] === Symbol.for("react.memo_cache_sentinel")) {
    t14 = /* @__PURE__ */ jsx("span", { className: "text-gray-400", children: "•" });
    $[26] = t14;
  } else {
    t14 = $[26];
  }
  let t15;
  if ($[27] !== director) {
    t15 = /* @__PURE__ */ jsx("span", { className: "truncate max-w-[120px] sm:max-w-none", children: director });
    $[27] = director;
    $[28] = t15;
  } else {
    t15 = $[28];
  }
  let t16;
  if ($[29] === Symbol.for("react.memo_cache_sentinel")) {
    t16 = /* @__PURE__ */ jsx("span", { className: "text-gray-400", children: "•" });
    $[29] = t16;
  } else {
    t16 = $[29];
  }
  let t17;
  if ($[30] !== genres) {
    t17 = /* @__PURE__ */ jsx("span", { className: "px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md truncate max-w-[150px]", children: genres });
    $[30] = genres;
    $[31] = t17;
  } else {
    t17 = $[31];
  }
  let t18;
  if ($[32] !== t13 || $[33] !== t15 || $[34] !== t17) {
    t18 = /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-600", children: [
      t13,
      t14,
      t15,
      t16,
      t17
    ] });
    $[32] = t13;
    $[33] = t15;
    $[34] = t17;
    $[35] = t18;
  } else {
    t18 = $[35];
  }
  const t19 = `flex gap-0.5 ${isPending ? "opacity-75 cursor-not-allowed" : ""}`;
  let t20;
  let t21;
  if ($[36] === Symbol.for("react.memo_cache_sentinel")) {
    t20 = () => setHoveredStar(null);
    t21 = [1, 2, 3, 4, 5];
    $[36] = t20;
    $[37] = t21;
  } else {
    t20 = $[36];
    t21 = $[37];
  }
  let t22;
  if ($[38] !== currentStars || $[39] !== handleStarClick || $[40] !== hoveredStar || $[41] !== isPending) {
    t22 = t21.map((star) => {
      const displayStar = hoveredStar != null ? star <= hoveredStar : star <= currentStars;
      return /* @__PURE__ */ jsx("button", { onClick: () => {
        handleStarClick(star);
      }, onMouseEnter: () => setHoveredStar(star), disabled: isPending, className: `transition-all duration-150 ${displayStar ? "text-yellow-400" : "text-gray-300"} hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed`, children: /* @__PURE__ */ jsx(StarIcon, { filled: displayStar, className: "w-4 h-4 sm:w-5 sm:h-5" }) }, star);
    });
    $[38] = currentStars;
    $[39] = handleStarClick;
    $[40] = hoveredStar;
    $[41] = isPending;
    $[42] = t22;
  } else {
    t22 = $[42];
  }
  let t23;
  if ($[43] !== t19 || $[44] !== t22) {
    t23 = /* @__PURE__ */ jsx("div", { className: t19, onMouseLeave: t20, children: t22 });
    $[43] = t19;
    $[44] = t22;
    $[45] = t23;
  } else {
    t23 = $[45];
  }
  const t24 = hoveredStar != null ? `Rate ${hoveredStar} star${hoveredStar > 1 ? "s" : ""}` : "Click to rate";
  let t25;
  if ($[46] !== t24) {
    t25 = /* @__PURE__ */ jsx("span", { className: "text-xs text-gray-500 hidden sm:inline", children: t24 });
    $[46] = t24;
    $[47] = t25;
  } else {
    t25 = $[47];
  }
  const t26 = hoveredStar != null ? `${hoveredStar}★` : "Tap to rate";
  let t27;
  if ($[48] !== t26) {
    t27 = /* @__PURE__ */ jsx("span", { className: "text-xs text-gray-500 sm:hidden", children: t26 });
    $[48] = t26;
    $[49] = t27;
  } else {
    t27 = $[49];
  }
  let t28;
  if ($[50] !== t23 || $[51] !== t25 || $[52] !== t27) {
    t28 = /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      t23,
      t25,
      t27
    ] });
    $[50] = t23;
    $[51] = t25;
    $[52] = t27;
    $[53] = t28;
  } else {
    t28 = $[53];
  }
  let t29;
  if ($[54] !== movie.plot) {
    t29 = movie.plot?.plotText.plainText && /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-600 line-clamp-2", children: movie.plot.plotText.plainText });
    $[54] = movie.plot;
    $[55] = t29;
  } else {
    t29 = $[55];
  }
  let t30;
  if ($[56] !== t10 || $[57] !== t18 || $[58] !== t28 || $[59] !== t29) {
    t30 = /* @__PURE__ */ jsxs("div", { className: "p-3 sm:p-4 flex-1 flex flex-col gap-2", children: [
      t10,
      t18,
      t28,
      t29
    ] });
    $[56] = t10;
    $[57] = t18;
    $[58] = t28;
    $[59] = t29;
    $[60] = t30;
  } else {
    t30 = $[60];
  }
  let t31;
  if ($[61] !== t30 || $[62] !== t7) {
    t31 = /* @__PURE__ */ jsxs("div", { className: "[content-visibility:auto] [contain-intrinsic-size:160px] group bg-white border-2 border-gray-100 rounded-lg overflow-hidden hover:border-black hover:shadow-lg flex flex-col sm:flex-row max-w-3xl mx-auto w-full", children: [
      t7,
      t30
    ] });
    $[61] = t30;
    $[62] = t7;
    $[63] = t31;
  } else {
    t31 = $[63];
  }
  return t31;
}
function _temp2(g) {
  return g.text;
}
function _temp(credit) {
  return credit.category.id === "director";
}
function SearchBox(t0) {
  const $ = compilerRuntimeExports$1.c(28);
  const {
    gcTimeout,
    onGcTimeoutChange,
    movieLimit,
    onMovieLimitChange,
    searchQuery,
    onSearchQueryChange,
    isPending,
    showDevtools,
    onShowDevtoolsChange
  } = t0;
  let t1;
  if ($[0] !== gcTimeout) {
    t1 = () => {
      if (gcTimeout === Infinity) {
        return "forever";
      }
      if (gcTimeout === 0) {
        return "0 seconds";
      }
      if (gcTimeout < 6e4) {
        return "less than a minute";
      }
      return `${gcTimeout / 6e4} minutes`;
    };
    $[0] = gcTimeout;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const gcTimeoutReadable = t1;
  let t2;
  if ($[2] !== gcTimeout || $[3] !== movieLimit || $[4] !== onGcTimeoutChange || $[5] !== onMovieLimitChange || $[6] !== onShowDevtoolsChange || $[7] !== showDevtools) {
    t2 = /* @__PURE__ */ jsx(Settings, { gcTimeout, showDevtools, onShowDevtoolsChange, onGcTimeoutChange, movieLimit, onMovieLimitChange });
    $[2] = gcTimeout;
    $[3] = movieLimit;
    $[4] = onGcTimeoutChange;
    $[5] = onMovieLimitChange;
    $[6] = onShowDevtoolsChange;
    $[7] = showDevtools;
    $[8] = t2;
  } else {
    t2 = $[8];
  }
  let t3;
  if ($[9] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = /* @__PURE__ */ jsx("div", { className: "absolute inset-y-0 left-0 pl-3 md:pl-5 flex items-center pointer-events-none", children: /* @__PURE__ */ jsx("svg", { className: "w-4 h-4 md:w-5 md:h-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }) });
    $[9] = t3;
  } else {
    t3 = $[9];
  }
  let t4;
  if ($[10] !== onSearchQueryChange) {
    t4 = (e) => {
      onSearchQueryChange(e.target.value);
    };
    $[10] = onSearchQueryChange;
    $[11] = t4;
  } else {
    t4 = $[11];
  }
  let t5;
  if ($[12] !== searchQuery || $[13] !== t4) {
    t5 = /* @__PURE__ */ jsx("input", { type: "text", defaultValue: searchQuery, onChange: t4, placeholder: "Search by title, director, genre, or tags...", className: "w-full pl-10 pr-4 py-2.5 md:pl-12 md:pr-5 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black transition-all duration-200 placeholder-gray-400" });
    $[12] = searchQuery;
    $[13] = t4;
    $[14] = t5;
  } else {
    t5 = $[14];
  }
  let t6;
  if ($[15] !== isPending) {
    t6 = isPending && /* @__PURE__ */ jsx("div", { className: "absolute inset-y-0 right-0 pr-3 md:pr-5 flex items-center", children: /* @__PURE__ */ jsx("div", { className: "animate-spin h-4 w-4 md:h-5 md:w-5 border-2 border-gray-300 border-t-black rounded-full" }) });
    $[15] = isPending;
    $[16] = t6;
  } else {
    t6 = $[16];
  }
  let t7;
  if ($[17] !== t5 || $[18] !== t6) {
    t7 = /* @__PURE__ */ jsxs("div", { className: "relative flex-1", children: [
      t3,
      t5,
      t6
    ] });
    $[17] = t5;
    $[18] = t6;
    $[19] = t7;
  } else {
    t7 = $[19];
  }
  let t8;
  if ($[20] !== t2 || $[21] !== t7) {
    t8 = /* @__PURE__ */ jsxs("div", { className: "relative max-w-3xl mx-auto flex items-center gap-3", children: [
      t2,
      t7
    ] });
    $[20] = t2;
    $[21] = t7;
    $[22] = t8;
  } else {
    t8 = $[22];
  }
  const t9 = gcTimeoutReadable();
  let t10;
  if ($[23] !== t9) {
    t10 = /* @__PURE__ */ jsxs("div", { className: "mt-2 text-center text-xs text-gray-400", children: [
      "Cached for ",
      t9,
      " after last view"
    ] });
    $[23] = t9;
    $[24] = t10;
  } else {
    t10 = $[24];
  }
  let t11;
  if ($[25] !== t10 || $[26] !== t8) {
    t11 = /* @__PURE__ */ jsxs("div", { className: "w-full max-w-6xl mb-6 md:mb-8", children: [
      t8,
      t10
    ] });
    $[25] = t10;
    $[26] = t8;
    $[27] = t11;
  } else {
    t11 = $[27];
  }
  return t11;
}
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 0
    }
  }
});
function LocalTanStackQueryTab(t0) {
  const $ = compilerRuntimeExports$1.c(16);
  const {
    gcTimeout,
    onGcTimeoutChange,
    movieLimit,
    onMovieLimitChange,
    devtools: Devtools,
    api,
    searchQuery,
    onSearchQueryChange,
    showDevtools,
    onShowDevtoolsChange
  } = t0;
  let t1;
  if ($[0] !== Devtools || $[1] !== api || $[2] !== gcTimeout || $[3] !== movieLimit || $[4] !== onGcTimeoutChange || $[5] !== onMovieLimitChange || $[6] !== onSearchQueryChange || $[7] !== onShowDevtoolsChange || $[8] !== searchQuery || $[9] !== showDevtools) {
    t1 = /* @__PURE__ */ jsx(LocalTanStackQueryTabContent, { api, gcTimeout, onGcTimeoutChange, movieLimit, onMovieLimitChange, searchQuery, onSearchQueryChange, showDevtools, onShowDevtoolsChange, devtools: Devtools });
    $[0] = Devtools;
    $[1] = api;
    $[2] = gcTimeout;
    $[3] = movieLimit;
    $[4] = onGcTimeoutChange;
    $[5] = onMovieLimitChange;
    $[6] = onSearchQueryChange;
    $[7] = onShowDevtoolsChange;
    $[8] = searchQuery;
    $[9] = showDevtools;
    $[10] = t1;
  } else {
    t1 = $[10];
  }
  let t2;
  if ($[11] !== Devtools) {
    t2 = Devtools && /* @__PURE__ */ jsx(Devtools, { client: queryClient });
    $[11] = Devtools;
    $[12] = t2;
  } else {
    t2 = $[12];
  }
  let t3;
  if ($[13] !== t1 || $[14] !== t2) {
    t3 = /* @__PURE__ */ jsxs(QueryClientProvider, { client: queryClient, children: [
      t1,
      t2
    ] });
    $[13] = t1;
    $[14] = t2;
    $[15] = t3;
  } else {
    t3 = $[15];
  }
  return t3;
}
function LocalTanStackQueryTabContent(t0) {
  const $ = compilerRuntimeExports$1.c(42);
  const {
    gcTimeout,
    onGcTimeoutChange,
    movieLimit,
    onMovieLimitChange,
    showDevtools,
    onShowDevtoolsChange,
    searchQuery,
    onSearchQueryChange,
    api
  } = t0;
  const [isPending, startTransition] = useTransition();
  let t1;
  if ($[0] !== movieLimit || $[1] !== searchQuery) {
    t1 = ["movies", searchQuery, movieLimit];
    $[0] = movieLimit;
    $[1] = searchQuery;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  let t2;
  if ($[3] !== api || $[4] !== movieLimit || $[5] !== searchQuery) {
    t2 = () => api.searchMovies(searchQuery, movieLimit);
    $[3] = api;
    $[4] = movieLimit;
    $[5] = searchQuery;
    $[6] = t2;
  } else {
    t2 = $[6];
  }
  let t3;
  if ($[7] !== gcTimeout || $[8] !== t1 || $[9] !== t2) {
    t3 = {
      queryKey: t1,
      queryFn: t2,
      structuralSharing: false,
      gcTime: gcTimeout
    };
    $[7] = gcTimeout;
    $[8] = t1;
    $[9] = t2;
    $[10] = t3;
  } else {
    t3 = $[10];
  }
  const {
    data: movies
  } = useSuspenseQuery(t3);
  let t4;
  if ($[11] !== onSearchQueryChange) {
    t4 = (value) => {
      startTransition(() => {
        onSearchQueryChange(value);
      });
    };
    $[11] = onSearchQueryChange;
    $[12] = t4;
  } else {
    t4 = $[12];
  }
  const handleSearchChange = t4;
  let t5;
  if ($[13] !== onMovieLimitChange) {
    t5 = (value_0) => {
      startTransition(() => {
        onMovieLimitChange(value_0);
      });
    };
    $[13] = onMovieLimitChange;
    $[14] = t5;
  } else {
    t5 = $[14];
  }
  const handleMovieLimitChange = t5;
  let t6;
  if ($[15] !== onGcTimeoutChange) {
    t6 = (value_1) => {
      startTransition(() => {
        onGcTimeoutChange(value_1);
      });
    };
    $[15] = onGcTimeoutChange;
    $[16] = t6;
  } else {
    t6 = $[16];
  }
  const handleGcTimeoutChange = t6;
  let t7;
  if ($[17] !== onShowDevtoolsChange) {
    t7 = (value_2) => {
      startTransition(() => {
        onShowDevtoolsChange(value_2);
      });
    };
    $[17] = onShowDevtoolsChange;
    $[18] = t7;
  } else {
    t7 = $[18];
  }
  const handleShowDevtoolsChange = t7;
  let t8;
  if ($[19] !== gcTimeout || $[20] !== handleGcTimeoutChange || $[21] !== handleMovieLimitChange || $[22] !== handleSearchChange || $[23] !== handleShowDevtoolsChange || $[24] !== isPending || $[25] !== movieLimit || $[26] !== searchQuery || $[27] !== showDevtools) {
    t8 = /* @__PURE__ */ jsx(SearchBox, { gcTimeout, onGcTimeoutChange: handleGcTimeoutChange, movieLimit, onMovieLimitChange: handleMovieLimitChange, onSearchQueryChange: handleSearchChange, searchQuery, isPending, showDevtools, onShowDevtoolsChange: handleShowDevtoolsChange });
    $[19] = gcTimeout;
    $[20] = handleGcTimeoutChange;
    $[21] = handleMovieLimitChange;
    $[22] = handleSearchChange;
    $[23] = handleShowDevtoolsChange;
    $[24] = isPending;
    $[25] = movieLimit;
    $[26] = searchQuery;
    $[27] = showDevtools;
    $[28] = t8;
  } else {
    t8 = $[28];
  }
  const t9 = movies.length;
  let t10;
  if ($[29] !== api || $[30] !== gcTimeout || $[31] !== movies) {
    let t112;
    if ($[33] !== api || $[34] !== gcTimeout) {
      t112 = (movie) => /* @__PURE__ */ jsx(MovieCardLocalTanStack, { movie, api, gcTimeout }, movie.id);
      $[33] = api;
      $[34] = gcTimeout;
      $[35] = t112;
    } else {
      t112 = $[35];
    }
    t10 = movies.map(t112);
    $[29] = api;
    $[30] = gcTimeout;
    $[31] = movies;
    $[32] = t10;
  } else {
    t10 = $[32];
  }
  let t11;
  if ($[36] !== movies.length || $[37] !== t10) {
    t11 = /* @__PURE__ */ jsx("div", { className: "w-full max-w-6xl", children: /* @__PURE__ */ jsx(MovieList, { moviesAmount: t9, children: t10 }) });
    $[36] = movies.length;
    $[37] = t10;
    $[38] = t11;
  } else {
    t11 = $[38];
  }
  let t12;
  if ($[39] !== t11 || $[40] !== t8) {
    t12 = /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center min-h-screen px-4 pb-20 md:pb-60", children: [
      t8,
      t11
    ] });
    $[39] = t11;
    $[40] = t8;
    $[41] = t12;
  } else {
    t12 = $[41];
  }
  return t12;
}
function MovieCardLocalTanStack(t0) {
  const $ = compilerRuntimeExports$1.c(25);
  const {
    movie,
    api,
    gcTimeout
  } = t0;
  const [isPending, startTransition] = useTransition();
  const movieId = movie.id;
  const queryClient2 = useQueryClient();
  let t1;
  if ($[0] !== api || $[1] !== movieId) {
    t1 = (t22) => {
      const {
        rating
      } = t22;
      return api.updateMovieRating(movieId, rating);
    };
    $[0] = api;
    $[1] = movieId;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  let t2;
  if ($[3] !== movieId || $[4] !== queryClient2) {
    t2 = () => {
      queryClient2.invalidateQueries({
        queryKey: ["movies"]
      });
      queryClient2.invalidateQueries({
        queryKey: ["movie", movieId]
      });
    };
    $[3] = movieId;
    $[4] = queryClient2;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  let t3;
  if ($[6] !== gcTimeout || $[7] !== t1 || $[8] !== t2) {
    t3 = {
      mutationFn: t1,
      onSuccess: t2,
      gcTime: gcTimeout
    };
    $[6] = gcTimeout;
    $[7] = t1;
    $[8] = t2;
    $[9] = t3;
  } else {
    t3 = $[9];
  }
  const {
    mutateAsync: updateRating
  } = useMutation(t3);
  let t4;
  if ($[10] !== movieId) {
    t4 = ["movie", movieId];
    $[10] = movieId;
    $[11] = t4;
  } else {
    t4 = $[11];
  }
  let t5;
  if ($[12] !== api || $[13] !== movieId) {
    t5 = () => api.getMovieById(movieId);
    $[12] = api;
    $[13] = movieId;
    $[14] = t5;
  } else {
    t5 = $[14];
  }
  let t6;
  if ($[15] !== gcTimeout || $[16] !== t4 || $[17] !== t5) {
    t6 = {
      queryKey: t4,
      queryFn: t5,
      gcTime: gcTimeout
    };
    $[15] = gcTimeout;
    $[16] = t4;
    $[17] = t5;
    $[18] = t6;
  } else {
    t6 = $[18];
  }
  useQuery(t6);
  let t7;
  if ($[19] !== updateRating) {
    t7 = (starIndex) => {
      startTransition(async () => {
        await updateRating({
          rating: starIndex * 2
        });
      });
    };
    $[19] = updateRating;
    $[20] = t7;
  } else {
    t7 = $[20];
  }
  const handleStarClick = t7;
  let t8;
  if ($[21] !== handleStarClick || $[22] !== isPending || $[23] !== movie) {
    t8 = /* @__PURE__ */ jsx(MovieCard, { movie, onUpdateRating: handleStarClick, isPending });
    $[21] = handleStarClick;
    $[22] = isPending;
    $[23] = movie;
    $[24] = t8;
  } else {
    t8 = $[24];
  }
  return t8;
}
export {
  LocalTanStackQueryTab as default
};
