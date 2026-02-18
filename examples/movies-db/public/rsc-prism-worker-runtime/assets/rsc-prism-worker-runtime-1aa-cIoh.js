var e = Object.create,
  t = Object.defineProperty,
  n = Object.getOwnPropertyDescriptor,
  r = Object.getOwnPropertyNames,
  i = Object.getPrototypeOf,
  a = Object.prototype.hasOwnProperty,
  o = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports),
  s = (e, n) => {
    let r = {};
    for (var i in e) t(r, i, { get: e[i], enumerable: !0 });
    return (n && t(r, Symbol.toStringTag, { value: `Module` }), r);
  },
  c = (e, i, o, s) => {
    if ((i && typeof i == `object`) || typeof i == `function`)
      for (var c = r(i), l = 0, u = c.length, d; l < u; l++)
        ((d = c[l]),
          !a.call(e, d) &&
            d !== o &&
            t(e, d, {
              get: ((e) => i[e]).bind(null, d),
              enumerable: !(s = n(i, d)) || s.enumerable,
            }));
    return e;
  },
  l = (n, r, a) => (
    (a = n == null ? {} : e(i(n))),
    c(r || !n || !n.__esModule ? t(a, `default`, { value: n, enumerable: !0 }) : a, n)
  ),
  u = `modulepreload`,
  d = function (e) {
    return `/` + e;
  },
  f = {},
  p =
    globalThis.ReadableByteStreamController === void 0
      ? (function (e, t, n) {
          let r = Promise.resolve();
          if (t && t.length > 0) {
            let e = document.getElementsByTagName(`link`),
              i = document.querySelector(`meta[property=csp-nonce]`),
              a = i?.nonce || i?.getAttribute(`nonce`);
            function o(e) {
              return Promise.all(
                e.map((e) =>
                  Promise.resolve(e).then(
                    (e) => ({ status: `fulfilled`, value: e }),
                    (e) => ({ status: `rejected`, reason: e }),
                  ),
                ),
              );
            }
            r = o(
              t.map((t) => {
                if (((t = d(t, n)), t in f)) return;
                f[t] = !0;
                let r = t.endsWith(`.css`),
                  i = r ? `[rel="stylesheet"]` : ``;
                if (n)
                  for (let n = e.length - 1; n >= 0; n--) {
                    let i = e[n];
                    if (i.href === t && (!r || i.rel === `stylesheet`)) return;
                  }
                else if (document.querySelector(`link[href="${t}"]${i}`)) return;
                let o = document.createElement(`link`);
                if (
                  ((o.rel = r ? `stylesheet` : u),
                  r || (o.as = `script`),
                  (o.crossOrigin = ``),
                  (o.href = t),
                  a && o.setAttribute(`nonce`, a),
                  document.head.appendChild(o),
                  r)
                )
                  return new Promise((e, n) => {
                    (o.addEventListener(`load`, e),
                      o.addEventListener(`error`, () =>
                        n(Error(`Unable to preload CSS for ${t}`)),
                      ));
                  });
              }),
            );
          }
          function i(e) {
            let t = new Event(`vite:preloadError`, { cancelable: !0 });
            if (((t.payload = e), window.dispatchEvent(t), !t.defaultPrevented)) throw e;
          }
          return r.then((t) => {
            for (let e of t || []) e.status === `rejected` && i(e.reason);
            return e().catch(i);
          });
        })(async () => {
          let { ReadableStream: e } = await import(`./ponyfill-CQowD7TC.js`);
          return { ReadableStream: e };
        }, []).then(({ ReadableStream: e }) => {
          globalThis.ReadableStream = e;
        })
      : Promise.resolve(),
  m = Symbol.for(`react.client.reference`),
  h = Symbol.for(`react.server.reference`);
function g(e, t) {
  let n = e;
  return ((n.$$typeof = m), (n.$$id = t), n);
}
function _(e, t) {
  let n = e;
  return ((n.$$typeof = h), (n.$$id = t), (n.$$bound = null), n);
}
function v(e) {
  return new Proxy(
    {},
    {
      get(t, n) {
        if (typeof n == `string`) return n === `__esModule` ? !0 : g({}, `${e}#${n}`);
      },
    },
  );
}
var y = o((e) => {
    (function () {
      function t() {}
      function n(e) {
        return typeof e != `object` || !e
          ? null
          : ((e = (R && e[R]) || e[`@@iterator`]), typeof e == `function` ? e : null);
      }
      function r(e) {
        return `` + e;
      }
      function i(e) {
        try {
          r(e);
          var t = !1;
        } catch {
          t = !0;
        }
        if (t) {
          t = console;
          var n = t.error,
            i =
              (typeof Symbol == `function` && Symbol.toStringTag && e[Symbol.toStringTag]) ||
              e.constructor.name ||
              `Object`;
          return (
            n.call(
              t,
              `The provided key is an unsupported type %s. This value must be coerced to a string before using it here.`,
              i,
            ),
            r(e)
          );
        }
      }
      function a(e) {
        if (e == null) return null;
        if (typeof e == `function`)
          return e.$$typeof === ne ? null : e.displayName || e.name || null;
        if (typeof e == `string`) return e;
        switch (e) {
          case O:
            return `Fragment`;
          case A:
            return `Profiler`;
          case k:
            return `StrictMode`;
          case P:
            return `Suspense`;
          case F:
            return `SuspenseList`;
          case te:
            return `Activity`;
        }
        if (typeof e == `object`)
          switch (
            (typeof e.tag == `number` &&
              console.error(
                `Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.`,
              ),
            e.$$typeof)
          ) {
            case D:
              return `Portal`;
            case M:
              return e.displayName || `Context`;
            case j:
              return (e._context.displayName || `Context`) + `.Consumer`;
            case N:
              var t = e.render;
              return (
                (e = e.displayName),
                (e ||=
                  ((e = t.displayName || t.name || ``),
                  e === `` ? `ForwardRef` : `ForwardRef(` + e + `)`)),
                e
              );
            case I:
              return ((t = e.displayName || null), t === null ? a(e.type) || `Memo` : t);
            case L:
              ((t = e._payload), (e = e._init));
              try {
                return a(e(t));
              } catch {}
          }
        return null;
      }
      function o(e) {
        if (e === O) return `<>`;
        if (typeof e == `object` && e && e.$$typeof === L) return `<...>`;
        try {
          var t = a(e);
          return t ? `<` + t + `>` : `<...>`;
        } catch {
          return `<...>`;
        }
      }
      function s() {
        var e = w.A;
        return e === null ? null : e.getOwner();
      }
      function c() {
        return Error(`react-stack-top-frame`);
      }
      function l(e) {
        if (z.call(e, `key`)) {
          var t = Object.getOwnPropertyDescriptor(e, `key`).get;
          if (t && t.isReactWarning) return !1;
        }
        return e.key !== void 0;
      }
      function u(e, t) {
        function n() {
          H ||
            ((H = !0),
            console.error(
              "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
              t,
            ));
        }
        ((n.isReactWarning = !0), Object.defineProperty(e, `key`, { get: n, configurable: !0 }));
      }
      function d() {
        var e = a(this.type);
        return (
          W[e] ||
            ((W[e] = !0),
            console.error(
              `Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release.`,
            )),
          (e = this.props.ref),
          e === void 0 ? null : e
        );
      }
      function f(e, t, n, r, i, a) {
        var o = n.ref;
        return (
          (e = { $$typeof: E, type: e, key: t, props: n, _owner: r }),
          (o === void 0 ? null : o) === null
            ? Object.defineProperty(e, `ref`, { enumerable: !1, value: null })
            : Object.defineProperty(e, `ref`, { enumerable: !1, get: d }),
          (e._store = {}),
          Object.defineProperty(e._store, `validated`, {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0,
          }),
          Object.defineProperty(e, `_debugInfo`, {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null,
          }),
          Object.defineProperty(e, `_debugStack`, {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: i,
          }),
          Object.defineProperty(e, `_debugTask`, {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: a,
          }),
          Object.freeze && (Object.freeze(e.props), Object.freeze(e)),
          e
        );
      }
      function p(e, t) {
        return (
          (t = f(e.type, t, e.props, e._owner, e._debugStack, e._debugTask)),
          e._store && (t._store.validated = e._store.validated),
          t
        );
      }
      function m(e) {
        h(e)
          ? e._store && (e._store.validated = 1)
          : typeof e == `object` &&
            e &&
            e.$$typeof === L &&
            (e._payload.status === `fulfilled`
              ? h(e._payload.value) &&
                e._payload.value._store &&
                (e._payload.value._store.validated = 1)
              : e._store && (e._store.validated = 1));
      }
      function h(e) {
        return typeof e == `object` && !!e && e.$$typeof === E;
      }
      function g(e) {
        var t = { "=": `=0`, ":": `=2` };
        return (
          `$` +
          e.replace(/[=:]/g, function (e) {
            return t[e];
          })
        );
      }
      function _(e, t) {
        return typeof e == `object` && e && e.key != null
          ? (i(e.key), g(`` + e.key))
          : t.toString(36);
      }
      function v(e) {
        switch (e.status) {
          case `fulfilled`:
            return e.value;
          case `rejected`:
            throw e.reason;
          default:
            switch (
              (typeof e.status == `string`
                ? e.then(t, t)
                : ((e.status = `pending`),
                  e.then(
                    function (t) {
                      e.status === `pending` && ((e.status = `fulfilled`), (e.value = t));
                    },
                    function (t) {
                      e.status === `pending` && ((e.status = `rejected`), (e.reason = t));
                    },
                  )),
              e.status)
            ) {
              case `fulfilled`:
                return e.value;
              case `rejected`:
                throw e.reason;
            }
        }
        throw e;
      }
      function y(e, t, r, a, o) {
        var s = typeof e;
        (s === `undefined` || s === `boolean`) && (e = null);
        var c = !1;
        if (e === null) c = !0;
        else
          switch (s) {
            case `bigint`:
            case `string`:
            case `number`:
              c = !0;
              break;
            case `object`:
              switch (e.$$typeof) {
                case E:
                case D:
                  c = !0;
                  break;
                case L:
                  return ((c = e._init), y(c(e._payload), t, r, a, o));
              }
          }
        if (c) {
          ((c = e), (o = o(c)));
          var l = a === `` ? `.` + _(c, 0) : a;
          return (
            T(o)
              ? ((r = ``),
                l != null && (r = l.replace(K, `$&/`) + `/`),
                y(o, t, r, ``, function (e) {
                  return e;
                }))
              : o != null &&
                (h(o) &&
                  (o.key != null && ((c && c.key === o.key) || i(o.key)),
                  (r = p(
                    o,
                    r +
                      (o.key == null || (c && c.key === o.key)
                        ? ``
                        : (`` + o.key).replace(K, `$&/`) + `/`) +
                      l,
                  )),
                  a !== `` &&
                    c != null &&
                    h(c) &&
                    c.key == null &&
                    c._store &&
                    !c._store.validated &&
                    (r._store.validated = 2),
                  (o = r)),
                t.push(o)),
            1
          );
        }
        if (((c = 0), (l = a === `` ? `.` : a + `:`), T(e)))
          for (var u = 0; u < e.length; u++)
            ((a = e[u]), (s = l + _(a, u)), (c += y(a, t, r, s, o)));
        else if (((u = n(e)), typeof u == `function`))
          for (
            u === e.entries &&
              (G ||
                console.warn(
                  `Using Maps as children is not supported. Use an array of keyed ReactElements instead.`,
                ),
              (G = !0)),
              e = u.call(e),
              u = 0;
            !(a = e.next()).done;
          )
            ((a = a.value), (s = l + _(a, u++)), (c += y(a, t, r, s, o)));
        else if (s === `object`) {
          if (typeof e.then == `function`) return y(v(e), t, r, a, o);
          throw (
            (t = String(e)),
            Error(
              `Objects are not valid as a React child (found: ` +
                (t === `[object Object]`
                  ? `object with keys {` + Object.keys(e).join(`, `) + `}`
                  : t) +
                `). If you meant to render a collection of children, use an array instead.`,
            )
          );
        }
        return c;
      }
      function b(e, t, n) {
        if (e == null) return e;
        var r = [],
          i = 0;
        return (
          y(e, r, ``, ``, function (e) {
            return t.call(n, e, i++);
          }),
          r
        );
      }
      function x() {
        var e = w.H;
        return (
          e === null &&
            console.error(`Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`),
          e
        );
      }
      function ee(e) {
        if (e._status === -1) {
          var t = e._ioInfo;
          (t != null && (t.start = t.end = performance.now()), (t = e._result));
          var n = t();
          if (
            (n.then(
              function (t) {
                if (e._status === 0 || e._status === -1) {
                  ((e._status = 1), (e._result = t));
                  var r = e._ioInfo;
                  (r != null && (r.end = performance.now()),
                    n.status === void 0 && ((n.status = `fulfilled`), (n.value = t)));
                }
              },
              function (t) {
                if (e._status === 0 || e._status === -1) {
                  ((e._status = 2), (e._result = t));
                  var r = e._ioInfo;
                  (r != null && (r.end = performance.now()),
                    n.status === void 0 && ((n.status = `rejected`), (n.reason = t)));
                }
              },
            ),
            (t = e._ioInfo),
            t != null)
          ) {
            t.value = n;
            var r = n.displayName;
            typeof r == `string` && (t.name = r);
          }
          e._status === -1 && ((e._status = 0), (e._result = n));
        }
        if (e._status === 1)
          return (
            (t = e._result),
            t === void 0 &&
              console.error(
                `lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))

Did you accidentally put curly braces around the import?`,
                t,
              ),
            `default` in t ||
              console.error(
                `lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))`,
                t,
              ),
            t.default
          );
        throw e._result;
      }
      function S() {
        return new WeakMap();
      }
      function C() {
        return { s: 0, v: void 0, o: null, p: null };
      }
      var w = { H: null, A: null, getCurrentStack: null, recentlyCreatedOwnerStacks: 0 },
        T = Array.isArray,
        E = Symbol.for(`react.transitional.element`),
        D = Symbol.for(`react.portal`),
        O = Symbol.for(`react.fragment`),
        k = Symbol.for(`react.strict_mode`),
        A = Symbol.for(`react.profiler`),
        j = Symbol.for(`react.consumer`),
        M = Symbol.for(`react.context`),
        N = Symbol.for(`react.forward_ref`),
        P = Symbol.for(`react.suspense`),
        F = Symbol.for(`react.suspense_list`),
        I = Symbol.for(`react.memo`),
        L = Symbol.for(`react.lazy`),
        te = Symbol.for(`react.activity`),
        R = Symbol.iterator,
        ne = Symbol.for(`react.client.reference`),
        z = Object.prototype.hasOwnProperty,
        re = Object.assign,
        B = console.createTask
          ? console.createTask
          : function () {
              return null;
            },
        V = {
          react_stack_bottom_frame: function (e) {
            return e();
          },
        },
        H,
        U,
        W = {},
        ie = V.react_stack_bottom_frame.bind(V, c)(),
        ae = B(o(c)),
        G = !1,
        K = /\/+/g;
      ((e.Children = {
        map: b,
        forEach: function (e, t, n) {
          b(
            e,
            function () {
              t.apply(this, arguments);
            },
            n,
          );
        },
        count: function (e) {
          var t = 0;
          return (
            b(e, function () {
              t++;
            }),
            t
          );
        },
        toArray: function (e) {
          return (
            b(e, function (e) {
              return e;
            }) || []
          );
        },
        only: function (e) {
          if (!h(e))
            throw Error(`React.Children.only expected to receive a single React element child.`);
          return e;
        },
      }),
        (e.Fragment = O),
        (e.Profiler = A),
        (e.StrictMode = k),
        (e.Suspense = P),
        (e.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = w),
        (e.cache = function (e) {
          return function () {
            var t = w.A;
            if (!t) return e.apply(null, arguments);
            var n = t.getCacheForType(S);
            ((t = n.get(e)), t === void 0 && ((t = C()), n.set(e, t)), (n = 0));
            for (var r = arguments.length; n < r; n++) {
              var i = arguments[n];
              if (typeof i == `function` || (typeof i == `object` && i)) {
                var a = t.o;
                (a === null && (t.o = a = new WeakMap()),
                  (t = a.get(i)),
                  t === void 0 && ((t = C()), a.set(i, t)));
              } else
                ((a = t.p),
                  a === null && (t.p = a = new Map()),
                  (t = a.get(i)),
                  t === void 0 && ((t = C()), a.set(i, t)));
            }
            if (t.s === 1) return t.v;
            if (t.s === 2) throw t.v;
            try {
              var o = e.apply(null, arguments);
              return ((n = t), (n.s = 1), (n.v = o));
            } catch (e) {
              throw ((o = t), (o.s = 2), (o.v = e), e);
            }
          };
        }),
        (e.cacheSignal = function () {
          var e = w.A;
          return e ? e.cacheSignal() : null;
        }),
        (e.captureOwnerStack = function () {
          var e = w.getCurrentStack;
          return e === null ? null : e();
        }),
        (e.cloneElement = function (e, t, n) {
          if (e == null)
            throw Error(`The argument must be a React element, but you passed ` + e + `.`);
          var r = re({}, e.props),
            a = e.key,
            o = e._owner;
          if (t != null) {
            var c;
            a: {
              if (
                z.call(t, `ref`) &&
                (c = Object.getOwnPropertyDescriptor(t, `ref`).get) &&
                c.isReactWarning
              ) {
                c = !1;
                break a;
              }
              c = t.ref !== void 0;
            }
            for (u in (c && (o = s()), l(t) && (i(t.key), (a = `` + t.key)), t))
              !z.call(t, u) ||
                u === `key` ||
                u === `__self` ||
                u === `__source` ||
                (u === `ref` && t.ref === void 0) ||
                (r[u] = t[u]);
          }
          var u = arguments.length - 2;
          if (u === 1) r.children = n;
          else if (1 < u) {
            c = Array(u);
            for (var d = 0; d < u; d++) c[d] = arguments[d + 2];
            r.children = c;
          }
          for (
            r = f(e.type, a, r, o, e._debugStack, e._debugTask), a = 2;
            a < arguments.length;
            a++
          )
            m(arguments[a]);
          return r;
        }),
        (e.createElement = function (e, t, n) {
          for (var r = 2; r < arguments.length; r++) m(arguments[r]);
          r = {};
          var a = null;
          if (t != null)
            for (h in (U ||
              !(`__self` in t) ||
              `key` in t ||
              ((U = !0),
              console.warn(
                `Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform`,
              )),
            l(t) && (i(t.key), (a = `` + t.key)),
            t))
              z.call(t, h) && h !== `key` && h !== `__self` && h !== `__source` && (r[h] = t[h]);
          var c = arguments.length - 2;
          if (c === 1) r.children = n;
          else if (1 < c) {
            for (var d = Array(c), p = 0; p < c; p++) d[p] = arguments[p + 2];
            (Object.freeze && Object.freeze(d), (r.children = d));
          }
          if (e && e.defaultProps)
            for (h in ((c = e.defaultProps), c)) r[h] === void 0 && (r[h] = c[h]);
          a && u(r, typeof e == `function` ? e.displayName || e.name || `Unknown` : e);
          var h = 1e4 > w.recentlyCreatedOwnerStacks++;
          return f(e, a, r, s(), h ? Error(`react-stack-top-frame`) : ie, h ? B(o(e)) : ae);
        }),
        (e.createRef = function () {
          var e = { current: null };
          return (Object.seal(e), e);
        }),
        (e.forwardRef = function (e) {
          (e != null && e.$$typeof === I
            ? console.error(
                "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).",
              )
            : typeof e == `function`
              ? e.length !== 0 &&
                e.length !== 2 &&
                console.error(
                  `forwardRef render functions accept exactly two parameters: props and ref. %s`,
                  e.length === 1
                    ? `Did you forget to use the ref parameter?`
                    : `Any additional parameter will be undefined.`,
                )
              : console.error(
                  `forwardRef requires a render function but was given %s.`,
                  e === null ? `null` : typeof e,
                ),
            e != null &&
              e.defaultProps != null &&
              console.error(
                `forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?`,
              ));
          var t = { $$typeof: N, render: e },
            n;
          return (
            Object.defineProperty(t, `displayName`, {
              enumerable: !1,
              configurable: !0,
              get: function () {
                return n;
              },
              set: function (t) {
                ((n = t),
                  e.name ||
                    e.displayName ||
                    (Object.defineProperty(e, `name`, { value: t }), (e.displayName = t)));
              },
            }),
            t
          );
        }),
        (e.isValidElement = h),
        (e.lazy = function (e) {
          e = { _status: -1, _result: e };
          var t = { $$typeof: L, _payload: e, _init: ee },
            n = {
              name: `lazy`,
              start: -1,
              end: -1,
              value: null,
              owner: null,
              debugStack: Error(`react-stack-top-frame`),
              debugTask: console.createTask ? console.createTask(`lazy()`) : null,
            };
          return ((e._ioInfo = n), (t._debugInfo = [{ awaited: n }]), t);
        }),
        (e.memo = function (e, t) {
          (e ??
            console.error(
              `memo: The first argument must be a component. Instead received: %s`,
              e === null ? `null` : typeof e,
            ),
            (t = { $$typeof: I, type: e, compare: t === void 0 ? null : t }));
          var n;
          return (
            Object.defineProperty(t, `displayName`, {
              enumerable: !1,
              configurable: !0,
              get: function () {
                return n;
              },
              set: function (t) {
                ((n = t),
                  e.name ||
                    e.displayName ||
                    (Object.defineProperty(e, `name`, { value: t }), (e.displayName = t)));
              },
            }),
            t
          );
        }),
        (e.use = function (e) {
          return x().use(e);
        }),
        (e.useCallback = function (e, t) {
          return x().useCallback(e, t);
        }),
        (e.useDebugValue = function (e, t) {
          return x().useDebugValue(e, t);
        }),
        (e.useId = function () {
          return x().useId();
        }),
        (e.useMemo = function (e, t) {
          return x().useMemo(e, t);
        }),
        (e.version = `19.2.0`));
    })();
  }),
  b = o((e, t) => {
    t.exports = y();
  }),
  x = l(b(), 1),
  ee = Symbol.for(`react.client.reference`),
  S = Symbol.for(`react.server.reference`),
  C = Symbol.for(`react.transitional.element`),
  w = Symbol.for(`react.element`),
  T = Symbol.for(`react.fragment`);
function E(e) {
  if (typeof e != `object` || !e) return !1;
  let t = Object.getPrototypeOf(e);
  return t === Object.prototype || t === null;
}
function D(e) {
  let t = ``;
  for (let n of e) t += String.fromCharCode(n);
  return btoa(t);
}
function O(e) {
  let t = atob(e),
    n = new Uint8Array(t.length);
  for (let e = 0; e < t.length; e += 1) n[e] = t.charCodeAt(e);
  return n;
}
function k(e) {
  return e instanceof Uint8Array
    ? { kind: `Uint8Array`, bytes: e }
    : e instanceof Int8Array
      ? { kind: `Int8Array`, bytes: new Uint8Array(e.buffer) }
      : e instanceof Uint8ClampedArray
        ? { kind: `Uint8ClampedArray`, bytes: new Uint8Array(e.buffer) }
        : e instanceof Int16Array
          ? { kind: `Int16Array`, bytes: new Uint8Array(e.buffer) }
          : e instanceof Uint16Array
            ? { kind: `Uint16Array`, bytes: new Uint8Array(e.buffer) }
            : e instanceof Int32Array
              ? { kind: `Int32Array`, bytes: new Uint8Array(e.buffer) }
              : e instanceof Uint32Array
                ? { kind: `Uint32Array`, bytes: new Uint8Array(e.buffer) }
                : e instanceof Float32Array
                  ? { kind: `Float32Array`, bytes: new Uint8Array(e.buffer) }
                  : e instanceof Float64Array
                    ? { kind: `Float64Array`, bytes: new Uint8Array(e.buffer) }
                    : e instanceof BigInt64Array
                      ? { kind: `BigInt64Array`, bytes: new Uint8Array(e.buffer) }
                      : e instanceof BigUint64Array
                        ? { kind: `BigUint64Array`, bytes: new Uint8Array(e.buffer) }
                        : e instanceof DataView
                          ? { kind: `DataView`, bytes: new Uint8Array(e.buffer) }
                          : null;
}
function A(e, t) {
  switch (e) {
    case `Uint8Array`:
      return t;
    case `Int8Array`:
      return new Int8Array(t.buffer.slice(0));
    case `Uint8ClampedArray`:
      return new Uint8ClampedArray(t.buffer.slice(0));
    case `Int16Array`:
      return new Int16Array(t.buffer.slice(0));
    case `Uint16Array`:
      return new Uint16Array(t.buffer.slice(0));
    case `Int32Array`:
      return new Int32Array(t.buffer.slice(0));
    case `Uint32Array`:
      return new Uint32Array(t.buffer.slice(0));
    case `Float32Array`:
      return new Float32Array(t.buffer.slice(0));
    case `Float64Array`:
      return new Float64Array(t.buffer.slice(0));
    case `BigInt64Array`:
      return new BigInt64Array(t.buffer.slice(0));
    case `BigUint64Array`:
      return new BigUint64Array(t.buffer.slice(0));
    case `DataView`:
      return new DataView(t.buffer.slice(0));
    default:
      throw Error(`Unsupported typed array kind "${e}"`);
  }
}
function j(e) {
  if (!(0, x.isValidElement)(e)) return !1;
  let t = e;
  return t.$$typeof === C || t.$$typeof === w;
}
function M(e) {
  if (typeof e != `function` && (typeof e != `object` || !e)) return !1;
  let t = e;
  return t.$$typeof === ee && typeof t.$$id == `string`;
}
function N(e) {
  if (typeof e != `function` && (typeof e != `object` || !e)) return !1;
  let t = e;
  return t.$$typeof === S && typeof t.$$id == `string`;
}
function P(e) {
  if (typeof e == `string`) return { $t: `host`, v: e };
  if (e === T || e === x.Fragment) return { $t: `fragment` };
  if (M(e)) return { $t: `client`, id: e.$$id };
  throw Error(`Unsupported element type in minimal runtime.`);
}
function F(e, t) {
  switch (e.$t) {
    case `host`:
      return e.v;
    case `fragment`:
      return x.Fragment;
    case `client`:
      return t(String(e.id));
    default:
      throw Error(`Unsupported encoded element type "${String(e.$t)}"`);
  }
}
function I(e, t = new WeakSet()) {
  if (e === void 0) return { $t: `undef` };
  if (typeof e == `string` || typeof e == `number` || typeof e == `boolean` || e == null) return e;
  if (typeof e == `bigint`) return { $t: `bigint`, v: e.toString() };
  if (typeof e == `symbol`) throw Error(`Symbols are not supported by the minimal Flight runtime.`);
  if (typeof e == `function`) {
    if (M(e)) return { $t: `clientRef`, id: e.$$id };
    if (N(e)) return { $t: `serverRef`, id: e.$$id };
    throw Error(`Functions are not supported by the minimal Flight runtime.`);
  }
  if (t.has(e)) throw Error(`Circular structures are not supported by the minimal Flight runtime.`);
  if ((t.add(e), e instanceof Date)) return { $t: `date`, v: e.toISOString() };
  if (e instanceof URLSearchParams) return { $t: `search`, v: e.toString() };
  if (e instanceof FormData) {
    let n = [];
    for (let [r, i] of e.entries()) {
      if ((typeof File < `u` && i instanceof File) || (typeof Blob < `u` && i instanceof Blob))
        throw Error(
          `File and Blob FormData values are not supported by the minimal Flight runtime.`,
        );
      n.push([r, I(i, t)]);
    }
    return { $t: `formdata`, v: n };
  }
  if (e instanceof Map)
    return { $t: `map`, v: Array.from(e.entries()).map(([e, n]) => [I(e, t), I(n, t)]) };
  if (e instanceof Set) return { $t: `set`, v: Array.from(e.values()).map((e) => I(e, t)) };
  if (e instanceof ArrayBuffer) return { $t: `arrayBuffer`, v: D(new Uint8Array(e)) };
  let n = k(e);
  if (n != null) return { $t: `typed`, k: n.kind, v: D(n.bytes) };
  if (Array.isArray(e)) return e.map((e) => I(e, t));
  if (j(e)) return { $t: `element`, ty: P(e.type), props: I(e.props, t), key: e.key };
  if (M(e)) return { $t: `clientRef`, id: e.$$id };
  if (N(e)) return { $t: `serverRef`, id: e.$$id };
  if (!E(e)) throw Error(`Only plain objects are serializable by the minimal Flight runtime.`);
  let r = {};
  for (let [n, i] of Object.entries(e)) r[n] = I(i, t);
  return r;
}
function L(e, t) {
  if (typeof e != `object` || !e) return e;
  if (Array.isArray(e)) return e.map((e) => L(e, t));
  let n = e,
    r = n.$t;
  if (typeof r != `string`) {
    let e = {};
    for (let [r, i] of Object.entries(n)) e[r] = L(i, t);
    return e;
  }
  switch (r) {
    case `undef`:
      return;
    case `bigint`:
      return BigInt(String(n.v));
    case `date`:
      return new Date(String(n.v));
    case `search`:
      return new URLSearchParams(String(n.v));
    case `arrayBuffer`:
      return O(String(n.v)).buffer;
    case `typed`:
      return A(String(n.k), O(String(n.v)));
    case `map`:
      return new Map(
        (n.v ?? []).map((e) => {
          let n = e ?? [];
          return [L(n[0], t), L(n[1], t)];
        }),
      );
    case `set`:
      return new Set((n.v ?? []).map((e) => L(e, t)));
    case `formdata`: {
      let e = new FormData();
      for (let r of n.v ?? []) {
        let [n, i] = r ?? [];
        e.append(String(n), String(L(i, t)));
      }
      return e;
    }
    case `clientRef`:
      return t(String(n.id));
    case `serverRef`:
      return { $$typeof: S, $$id: String(n.id), $$bound: null };
    case `element`: {
      let e = F(n.ty, t),
        r = L(n.props, t),
        i = n.key;
      return (0, x.createElement)(e, i == null ? r : { ...r, key: i });
    }
    default:
      throw Error(`Unknown wire tag "${r}"`);
  }
}
var te = Symbol.for(`react.client.reference`),
  R = Symbol.for(`react.transitional.element`),
  ne = Symbol.for(`react.element`),
  z = Symbol.for(`react.fragment`);
function re(e) {
  if (typeof e != `function` && (typeof e != `object` || !e)) return !1;
  let t = e;
  return t.$$typeof === te && typeof t.$$id == `string`;
}
function B(e) {
  if (typeof e != `object` || !e) return !1;
  let t = e;
  return t.$$typeof === R || t.$$typeof === ne;
}
function V(e) {
  return typeof e == `object` && !!e && `then` in e;
}
function H(e, t) {
  return new TextEncoder().encode(`${e}:${JSON.stringify(t)}\n`);
}
async function U(e, t) {
  if (V(e)) {
    let n = t.allocateRowId();
    return (
      t.queueDeferred(
        (async () => {
          let r = await U(await e, t);
          t.emitRow(n, r);
        })(),
      ),
      { $t: `rowRef`, id: n }
    );
  }
  if (Array.isArray(e)) {
    let n = [];
    for (let r of e) n.push(await U(r, t));
    return n;
  }
  if (!B(e)) return I(e);
  let n = e.type;
  if (typeof n == `function` && !re(n)) return U(n(e.props), t);
  if (n === z) return U(e.props.children, t);
  let r = {};
  for (let [n, i] of Object.entries(e.props)) r[n] = await U(i, t);
  return I({ ...e, props: r });
}
async function W(e, t, n) {
  return new ReadableStream({
    async start(t) {
      let r = n?.signal;
      if (r?.aborted) {
        t.error(r.reason);
        return;
      }
      let i = !1,
        a = () => {
          i || ((i = !0), t.error(r?.reason));
        };
      r?.addEventListener(`abort`, a, { once: !0 });
      try {
        let n = 1,
          r = new Set(),
          a = await U(e, {
            queueDeferred: (e) => {
              (r.add(e),
                e.finally(() => {
                  r.delete(e);
                }));
            },
            allocateRowId: () => {
              let e = n;
              return ((n += 1), e);
            },
            emitRow: (e, n) => {
              i || t.enqueue(H(e, n));
            },
          });
        if (i) return;
        for (t.enqueue(H(0, a)); r.size > 0; ) if ((await Promise.race(r), i)) return;
        (t.close(), (i = !0));
      } catch (e) {
        i || ((i = !0), t.error(e));
      } finally {
        r?.removeEventListener(`abort`, a);
      }
    },
  });
}
async function ie(e, t, n) {
  let r;
  return (
    (r = typeof e == `string` ? e : (e.get(`0`)?.toString() ?? `null`)),
    L(JSON.parse(r), (e) => v(e))
  );
}
function ae(e, t, n = null) {
  return _(e, t);
}
var G = `__rscPrismMainThreadModules`;
function K() {
  let e = globalThis[G];
  return typeof e != `object` || !e ? {} : e;
}
function oe(e, t) {
  let n = t?.[e],
    r = n == null ? e : `${n.id}#${n.name}`,
    i = r.lastIndexOf(`#`),
    a = i === -1 ? r : r.slice(0, i),
    o = i === -1 ? `default` : r.slice(i + 1),
    s = K()[a];
  if (s == null) throw Error(`[rsc-prism] Unknown client module "${a}" in minimal Flight runtime.`);
  if (o === `*`) return s;
  if (!(o in s)) throw Error(`[rsc-prism] Unknown client export "${r}" in minimal Flight runtime.`);
  return s[o];
}
function se(e) {
  let t = e?.manifest;
  return t == null || typeof t == `string` ? null : t;
}
function ce(e) {
  let t = se(e);
  return (e) => oe(e, t);
}
function le(e) {
  let t = e.indexOf(`:`);
  return t === -1
    ? { id: null, payload: JSON.parse(e) }
    : { id: e.slice(0, t).trim(), payload: JSON.parse(e.slice(t + 1)) };
}
function q(e, t, n, r) {
  if (typeof e != `object` || !e) return;
  if (Array.isArray(e)) {
    for (let i of e) q(i, t, n, r);
    return;
  }
  let i = e;
  if (i.$t === `rowRef`) {
    let e = String(i.id),
      a = t.get(e);
    if (a == null) {
      n.add(e);
      return;
    }
    if (r.has(e)) return;
    (r.add(e), q(a, t, n, r), r.delete(e));
    return;
  }
  for (let e of Object.values(i)) q(e, t, n, r);
}
function J(e, t, n) {
  if (typeof e != `object` || !e) return e;
  if (Array.isArray(e)) return e.map((e) => J(e, t, n));
  let r = e;
  if (r.$t === `rowRef`) {
    let e = String(r.id);
    if (n.has(e)) throw Error(`[rsc-prism] Circular row reference "${e}" in Flight payload.`);
    let i = t.get(e);
    if (i == null) throw Error(`[rsc-prism] Missing row "${e}" in Flight payload.`);
    n.add(e);
    let a = J(i, t, n);
    return (n.delete(e), a);
  }
  let i = {};
  for (let [e, a] of Object.entries(r)) i[e] = J(a, t, n);
  return i;
}
async function ue(e) {
  let t = e.getReader(),
    n = new TextDecoder(`utf-8`, { fatal: !1 }),
    r = ``,
    i = null,
    a = !1,
    o = new Map(),
    s = null,
    c = !1,
    l = null,
    u = !1,
    d = () => {
      if (!(!c || s == null)) {
        if (l == null) {
          let e = new Set();
          (q(s, o, e, new Set()), (l = e));
        }
        if (l.size === 0) return J(s, o, new Set());
      }
    },
    f = (e) => {
      let t = e.trim();
      if (t.length === 0) return;
      let n = le(t);
      if (((a ||= ((i = n.payload), !0)), n.id == null)) return n.payload;
      if ((o.set(n.id, n.payload), n.id === `0`))
        return ((s = n.payload), (c = !0), (l = null), d());
      if (l != null && l.has(n.id)) return ((l = null), d());
    };
  try {
    for (;;) {
      let { done: e, value: i } = await t.read();
      if (e) break;
      for (r += n.decode(i, { stream: !0 }); ; ) {
        let e = r.indexOf(`
`);
        if (e === -1) break;
        let t = f(r.slice(0, e));
        if (((r = r.slice(e + 1)), t !== void 0)) return ((u = !0), t);
      }
    }
    if (((r += n.decode()), r.length > 0)) {
      let e = f(r);
      if (e !== void 0) return ((u = !0), e);
    }
  } finally {
    if (u)
      try {
        await t.cancel();
      } catch {}
    t.releaseLock();
  }
  let p = d();
  return p === void 0 ? (a ? i : null) : p;
}
async function de(e, t) {
  return L(await ue(e), ce(t));
}
async function fe(e) {
  return JSON.stringify(I(e));
}
var Y = {
    renderStream(e, t, n) {
      return W(e, t, n);
    },
    consumeStream(e, t, n) {
      return de(e, { manifest: t, callServer: n });
    },
    async encodeActionArgs(e) {
      let t = await fe(e);
      return t instanceof FormData ? { type: `formdata`, data: t } : { type: `string`, data: t };
    },
    decodeActionArgs(e, t) {
      return ie(
        e.type === `formdata`
          ? e.data instanceof FormData
            ? e.data
            : (() => {
                let t = new FormData();
                for (let [n, r] of new URLSearchParams(e.data)) t.append(n, r);
                return t;
              })()
          : e.data,
        t,
        {},
      );
    },
  },
  pe = `__RSC_PRISM_CLIENT_MANIFEST__`,
  me = `/`;
function he() {
  return globalThis;
}
function ge() {
  return he()[pe];
}
function _e(e) {
  if (e != null) return e;
  let t = ge();
  return (typeof t == `object` && t) || (typeof t == `string` && t.length > 0) ? t : me;
}
function ve(e) {
  return { manifest: _e(e), actions: new Map() };
}
async function ye(e, t) {
  for (let [n, r] of Object.entries(t)) {
    let t = ae(r, n, n);
    e.actions.set(n, { fn: t, id: n });
  }
}
function be(e, t) {
  let n = {};
  for (let [r, i] of Object.entries(t))
    typeof i == `function` && (r.startsWith(`__rscPrism`) || (n[`${e}#${r}`] = i));
  return n;
}
async function xe(e, t, n) {
  await ye(e, be(t, n));
}
async function Se(e, t, n) {
  return Y.renderStream(e, t.manifest, {
    onError:
      n?.onError ??
      ((e) => (
        console.error(`[rsc-sw-bff] Render error:`, e), `An error occurred during server rendering.`
      )),
    signal: n?.signal,
  });
}
async function Ce(e) {
  let t = _e(),
    n = await Y.decodeActionArgs(e, t);
  return Array.isArray(n) ? n : [n];
}
async function we(e, t, n, r) {
  let i = e.actions.get(t);
  if (!i) {
    let n = Array.from(e.actions.keys()).join(`, `) || `(none)`;
    throw Error(`Action "${t}" not found. Available: ${n}`);
  }
  let a = await Ce(n),
    o = await i.fn(...a);
  return Y.renderStream(o, e.manifest, { onError: r?.onError, signal: r?.signal });
}
function Te(e) {
  return e.headers.get(`rsc-action`) ?? e.headers.get(`x-rsc-action`) ?? null;
}
var Ee = `text/x-component`;
function X(e) {
  let t = new Headers(e);
  return (
    t.set(`Content-Type`, Ee),
    t.set(`Cache-Control`, `no-cache, no-store, must-revalidate`),
    t.set(`X-Content-Type-Options`, `nosniff`),
    t
  );
}
async function De(e, t, n, r) {
  let i = await Se({ __rscPrismError: !0, message: t, status: n }, e, { onError: r?.onError });
  return new Response(i, { status: n, headers: X(r?.headers) });
}
async function Oe(e, t, n) {
  await p;
  let r = await Se(e, t, { onError: n?.onError });
  return new Response(r, { status: n?.status ?? 200, headers: X(n?.headers) });
}
async function ke(e, t, n) {
  await p;
  let r = Te(e);
  if (!r) return De(t, `Missing action ID`, 400, n);
  let i = (e.headers.get(`Content-Type`) ?? ``).includes(`form`)
    ? { type: `formdata`, data: await e.formData() }
    : { type: `string`, data: await e.text() };
  try {
    let e = await we(t, r, i, { onError: n?.onError });
    return new Response(e, { status: n?.status ?? 200, headers: X(n?.headers) });
  } catch (e) {
    let r = e instanceof Error ? e.message : String(e);
    return (console.error(`[rsc-sw-bff] Action error:`, e), De(t, r, 500, n));
  }
}
function Ae(e) {
  let t = ve(e.manifest),
    n = (async () => {
      if ((await p, e.actions && (await ye(t, e.actions)), e.actionModules))
        for (let n of e.actionModules) await xe(t, n.moduleId, n.moduleExports);
    })();
  return {
    ctx: t,
    async render(r, i) {
      return (await n, Oe(r, t, { onError: e.onError, ...i }));
    },
    async action(r, i) {
      return (await n, ke(r, t, { onError: e.onError, ...i }));
    },
    ready: n,
  };
}
var je = `rsc.transport.request`,
  Me = `rsc.transport.response`;
function Ne(e) {
  return `${e}.head`;
}
function Pe(e) {
  return `${e}.next`;
}
function Fe(e) {
  return `${e}.done`;
}
function Ie(e) {
  return `${e}.error`;
}
function Le(e) {
  if (e.byteLength === 0) return;
  let t = e.buffer;
  if (t instanceof ArrayBuffer) return [t];
}
function Re(e, t, n) {
  if (n != null && n.length > 0)
    try {
      e.postMessage(t, n);
      return;
    } catch {}
  e.postMessage(t);
}
function ze(e) {
  let t = e.currentTarget;
  if (t?.postMessage) {
    let e = t;
    return { postMessage: (t, n) => Re(e, t, n) };
  }
  let n = globalThis;
  if (typeof n.postMessage == `function`) {
    let e = n;
    return { postMessage: (t, n) => Re(e, t, n) };
  }
  return null;
}
function Be(e, t = {}) {
  let n = t.requestType ?? je,
    r = t.responseType ?? Me;
  return async (t) => {
    let i = t.data;
    if (i == null || i.type !== n || i.id == null) return;
    let a = ze(t);
    if (a != null)
      try {
        let t = await e(i);
        if (
          (a.postMessage({
            type: Ne(r),
            id: i.id,
            status: t.status,
            headers: [...t.headers.entries()],
          }),
          t.body != null)
        ) {
          let e = t.body.getReader();
          try {
            for (;;) {
              let { done: t, value: n } = await e.read();
              if (t) break;
              let o = Le(n);
              a.postMessage({ type: Pe(r), id: i.id, chunk: n }, o);
            }
          } finally {
            e.releaseLock();
          }
        }
        a.postMessage({ type: Fe(r), id: i.id });
      } catch (e) {
        let t = e instanceof Error ? e.message : String(e);
        a.postMessage({ type: Ie(r), id: i.id, error: t });
      }
  };
}
async function Ve(e, t) {
  if (!e.ok) throw Error(`${t}: ${e.status}`);
  return await e.json();
}
async function He(e, t) {
  let n = new URLSearchParams({ query: e, limit: String(t) });
  return Ve(await fetch(`/api/movies/search?${n}`), `Failed to load movies`);
}
async function Ue(e, t) {
  return Ve(
    await fetch(`/api/movies/${encodeURIComponent(e)}/rating`, {
      method: `PATCH`,
      headers: { "Content-Type": `application/json` },
      body: JSON.stringify({ rating: t }),
    }),
    `Failed to update movie rating`,
  );
}
var We = s({ updateRating: () => Z }, 1);
async function Z(e, t) {
  "use worker";
  return Ue(e, t);
}
var Ge = Symbol.for(`react.client.reference`),
  Ke = ((e) => ({ $$typeof: Ge, $$id: e }))(
    `/src/components/RSCMoviesTab/client-components.tsx#RatingStars`,
  ),
  qe = o((e) => {
    (function () {
      function t(e) {
        if (e == null) return null;
        if (typeof e == `function`)
          return e.$$typeof === O ? null : e.displayName || e.name || null;
        if (typeof e == `string`) return e;
        switch (e) {
          case _:
            return `Fragment`;
          case y:
            return `Profiler`;
          case v:
            return `StrictMode`;
          case C:
            return `Suspense`;
          case w:
            return `SuspenseList`;
          case D:
            return `Activity`;
        }
        if (typeof e == `object`)
          switch (
            (typeof e.tag == `number` &&
              console.error(
                `Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.`,
              ),
            e.$$typeof)
          ) {
            case g:
              return `Portal`;
            case ee:
              return e.displayName || `Context`;
            case x:
              return (e._context.displayName || `Context`) + `.Consumer`;
            case S:
              var n = e.render;
              return (
                (e = e.displayName),
                (e ||=
                  ((e = n.displayName || n.name || ``),
                  e === `` ? `ForwardRef` : `ForwardRef(` + e + `)`)),
                e
              );
            case T:
              return ((n = e.displayName || null), n === null ? t(e.type) || `Memo` : n);
            case E:
              ((n = e._payload), (e = e._init));
              try {
                return t(e(n));
              } catch {}
          }
        return null;
      }
      function n(e) {
        return `` + e;
      }
      function r(e) {
        try {
          n(e);
          var t = !1;
        } catch {
          t = !0;
        }
        if (t) {
          t = console;
          var r = t.error,
            i =
              (typeof Symbol == `function` && Symbol.toStringTag && e[Symbol.toStringTag]) ||
              e.constructor.name ||
              `Object`;
          return (
            r.call(
              t,
              `The provided key is an unsupported type %s. This value must be coerced to a string before using it here.`,
              i,
            ),
            n(e)
          );
        }
      }
      function i(e) {
        if (e === _) return `<>`;
        if (typeof e == `object` && e && e.$$typeof === E) return `<...>`;
        try {
          var n = t(e);
          return n ? `<` + n + `>` : `<...>`;
        } catch {
          return `<...>`;
        }
      }
      function a() {
        var e = k.A;
        return e === null ? null : e.getOwner();
      }
      function o() {
        return Error(`react-stack-top-frame`);
      }
      function s(e) {
        if (A.call(e, `key`)) {
          var t = Object.getOwnPropertyDescriptor(e, `key`).get;
          if (t && t.isReactWarning) return !1;
        }
        return e.key !== void 0;
      }
      function c(e, t) {
        function n() {
          N ||
            ((N = !0),
            console.error(
              "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
              t,
            ));
        }
        ((n.isReactWarning = !0), Object.defineProperty(e, `key`, { get: n, configurable: !0 }));
      }
      function l() {
        var e = t(this.type);
        return (
          P[e] ||
            ((P[e] = !0),
            console.error(
              `Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release.`,
            )),
          (e = this.props.ref),
          e === void 0 ? null : e
        );
      }
      function u(e, t, n, r, i, a) {
        var o = n.ref;
        return (
          (e = { $$typeof: h, type: e, key: t, props: n, _owner: r }),
          (o === void 0 ? null : o) === null
            ? Object.defineProperty(e, `ref`, { enumerable: !1, value: null })
            : Object.defineProperty(e, `ref`, { enumerable: !1, get: l }),
          (e._store = {}),
          Object.defineProperty(e._store, `validated`, {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0,
          }),
          Object.defineProperty(e, `_debugInfo`, {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null,
          }),
          Object.defineProperty(e, `_debugStack`, {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: i,
          }),
          Object.defineProperty(e, `_debugTask`, {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: a,
          }),
          Object.freeze && (Object.freeze(e.props), Object.freeze(e)),
          e
        );
      }
      function d(e, n, i, o, l, d) {
        var p = n.children;
        if (p !== void 0)
          if (o)
            if (j(p)) {
              for (o = 0; o < p.length; o++) f(p[o]);
              Object.freeze && Object.freeze(p);
            } else
              console.error(
                `React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.`,
              );
          else f(p);
        if (A.call(n, `key`)) {
          p = t(e);
          var m = Object.keys(n).filter(function (e) {
            return e !== `key`;
          });
          ((o = 0 < m.length ? `{key: someKey, ` + m.join(`: ..., `) + `: ...}` : `{key: someKey}`),
            L[p + o] ||
              ((m = 0 < m.length ? `{` + m.join(`: ..., `) + `: ...}` : `{}`),
              console.error(
                `A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`,
                o,
                p,
                m,
                p,
              ),
              (L[p + o] = !0)));
        }
        if (
          ((p = null),
          i !== void 0 && (r(i), (p = `` + i)),
          s(n) && (r(n.key), (p = `` + n.key)),
          `key` in n)
        )
          for (var h in ((i = {}), n)) h !== `key` && (i[h] = n[h]);
        else i = n;
        return (
          p && c(i, typeof e == `function` ? e.displayName || e.name || `Unknown` : e),
          u(e, p, i, a(), l, d)
        );
      }
      function f(e) {
        p(e)
          ? e._store && (e._store.validated = 1)
          : typeof e == `object` &&
            e &&
            e.$$typeof === E &&
            (e._payload.status === `fulfilled`
              ? p(e._payload.value) &&
                e._payload.value._store &&
                (e._payload.value._store.validated = 1)
              : e._store && (e._store.validated = 1));
      }
      function p(e) {
        return typeof e == `object` && !!e && e.$$typeof === h;
      }
      var m = b(),
        h = Symbol.for(`react.transitional.element`),
        g = Symbol.for(`react.portal`),
        _ = Symbol.for(`react.fragment`),
        v = Symbol.for(`react.strict_mode`),
        y = Symbol.for(`react.profiler`),
        x = Symbol.for(`react.consumer`),
        ee = Symbol.for(`react.context`),
        S = Symbol.for(`react.forward_ref`),
        C = Symbol.for(`react.suspense`),
        w = Symbol.for(`react.suspense_list`),
        T = Symbol.for(`react.memo`),
        E = Symbol.for(`react.lazy`),
        D = Symbol.for(`react.activity`),
        O = Symbol.for(`react.client.reference`),
        k = m.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      if (!k)
        throw Error(
          `The "react" package in this environment is not configured correctly. The "react-server" condition must be enabled in any environment that runs React Server Components.`,
        );
      var A = Object.prototype.hasOwnProperty,
        j = Array.isArray,
        M = console.createTask
          ? console.createTask
          : function () {
              return null;
            };
      m = {
        react_stack_bottom_frame: function (e) {
          return e();
        },
      };
      var N,
        P = {},
        F = m.react_stack_bottom_frame.bind(m, o)(),
        I = M(i(o)),
        L = {};
      ((e.Fragment = _),
        (e.jsx = function (e, t, n) {
          var r = 1e4 > k.recentlyCreatedOwnerStacks++;
          return d(e, t, n, !1, r ? Error(`react-stack-top-frame`) : F, r ? M(i(e)) : I);
        }),
        (e.jsxDEV = function (e, t, n, r) {
          var a = 1e4 > k.recentlyCreatedOwnerStacks++;
          return d(e, t, n, r, a ? Error(`react-stack-top-frame`) : F, a ? M(i(e)) : I);
        }),
        (e.jsxs = function (e, t, n) {
          var r = 1e4 > k.recentlyCreatedOwnerStacks++;
          return d(e, t, n, !0, r ? Error(`react-stack-top-frame`) : F, r ? M(i(e)) : I);
        }));
    })();
  }),
  Q = o((e, t) => {
    t.exports = qe();
  })(),
  $ = `/Users/sergeygarin/Projects/react-19-query-demo/examples/movies-db/src/components/RSCMoviesTab/worker-components.tsx`,
  Je = `140px`;
function Ye({ movie: e }) {
  let t = e.rating,
    n = Math.ceil((t ?? 0) / 2),
    r = e.directors.join(`, `) || `Unknown`,
    i = e.genres.join(`, `) || `Unknown`;
  return (0, Q.jsxDEV)(
    `div`,
    {
      className: `group bg-white border border-gray-100 rounded-4xl [corner-shape:superellipse(1.33)] overflow-hidden hover:border-black hover:shadow-lg flex flex-col sm:flex-row max-w-3xl mx-auto w-full`,
      style: { height: Je },
      children: (0, Q.jsxDEV)(
        `div`,
        {
          className: `p-3 sm:p-4 flex-1 flex flex-col gap-2`,
          children: [
            (0, Q.jsxDEV)(
              `div`,
              {
                className: `flex items-start justify-between gap-2`,
                children: (0, Q.jsxDEV)(
                  `h3`,
                  {
                    className: `text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900`,
                    children: e.titleText,
                  },
                  void 0,
                  !1,
                  { fileName: $, lineNumber: 27, columnNumber: 11 },
                  this,
                ),
              },
              void 0,
              !1,
              { fileName: $, lineNumber: 26, columnNumber: 9 },
              this,
            ),
            (0, Q.jsxDEV)(
              `div`,
              {
                className: `flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-600`,
                children: [
                  (0, Q.jsxDEV)(
                    `span`,
                    {
                      className: `flex items-center gap-1`,
                      children: [
                        (0, Q.jsxDEV)(
                          `svg`,
                          {
                            className: `w-3 h-3`,
                            fill: `currentColor`,
                            viewBox: `0 0 20 20`,
                            children: (0, Q.jsxDEV)(
                              `path`,
                              {
                                d: `M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z`,
                              },
                              void 0,
                              !1,
                              { fileName: $, lineNumber: 35, columnNumber: 15 },
                              this,
                            ),
                          },
                          void 0,
                          !1,
                          { fileName: $, lineNumber: 34, columnNumber: 13 },
                          this,
                        ),
                        e.releaseYear ?? `N/A`,
                      ],
                    },
                    void 0,
                    !0,
                    { fileName: $, lineNumber: 33, columnNumber: 11 },
                    this,
                  ),
                  (0, Q.jsxDEV)(
                    `span`,
                    { className: `text-gray-400`, children: `•` },
                    void 0,
                    !1,
                    { fileName: $, lineNumber: 39, columnNumber: 11 },
                    this,
                  ),
                  (0, Q.jsxDEV)(
                    `span`,
                    {
                      className: `px-2 py-0.5 text-xs font-bold bg-black text-white rounded-md shadow-lg`,
                      children: t?.toFixed(1) ?? `N/A`,
                    },
                    void 0,
                    !1,
                    { fileName: $, lineNumber: 40, columnNumber: 11 },
                    this,
                  ),
                  (0, Q.jsxDEV)(
                    `span`,
                    { className: `text-gray-400`, children: `•` },
                    void 0,
                    !1,
                    { fileName: $, lineNumber: 43, columnNumber: 11 },
                    this,
                  ),
                  (0, Q.jsxDEV)(
                    `span`,
                    { className: `truncate max-w-[120px] sm:max-w-none`, children: r },
                    void 0,
                    !1,
                    { fileName: $, lineNumber: 44, columnNumber: 11 },
                    this,
                  ),
                  (0, Q.jsxDEV)(
                    `span`,
                    { className: `text-gray-400`, children: `•` },
                    void 0,
                    !1,
                    { fileName: $, lineNumber: 45, columnNumber: 11 },
                    this,
                  ),
                  (0, Q.jsxDEV)(
                    `span`,
                    {
                      className: `px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md truncate max-w-[150px]`,
                      children: i,
                    },
                    void 0,
                    !1,
                    { fileName: $, lineNumber: 46, columnNumber: 11 },
                    this,
                  ),
                ],
              },
              void 0,
              !0,
              { fileName: $, lineNumber: 32, columnNumber: 9 },
              this,
            ),
            (0, Q.jsxDEV)(
              `div`,
              {
                className: `flex items-center gap-2`,
                children: (0, Q.jsxDEV)(
                  Ke,
                  { movieId: e.id, currentStars: n },
                  void 0,
                  !1,
                  { fileName: $, lineNumber: 52, columnNumber: 11 },
                  this,
                ),
              },
              void 0,
              !1,
              { fileName: $, lineNumber: 51, columnNumber: 9 },
              this,
            ),
            e.plot &&
              (0, Q.jsxDEV)(
                `div`,
                { className: `text-xs text-gray-600 line-clamp-2`, children: e.plot },
                void 0,
                !1,
                { fileName: $, lineNumber: 55, columnNumber: 24 },
                this,
              ),
          ],
        },
        void 0,
        !0,
        { fileName: $, lineNumber: 25, columnNumber: 7 },
        this,
      ),
    },
    void 0,
    !1,
    { fileName: $, lineNumber: 21, columnNumber: 5 },
    this,
  );
}
function Xe({ movies: e }) {
  return e.length === 0
    ? (0, Q.jsxDEV)(
        `div`,
        {
          className: `text-center py-12 md:py-20`,
          children: [
            (0, Q.jsxDEV)(
              `div`,
              { className: `text-4xl md:text-6xl mb-4`, children: `🎬` },
              void 0,
              !1,
              { fileName: $, lineNumber: 65, columnNumber: 9 },
              this,
            ),
            (0, Q.jsxDEV)(
              `p`,
              { className: `text-lg md:text-xl text-gray-600 mb-2`, children: `No movies found` },
              void 0,
              !1,
              { fileName: $, lineNumber: 66, columnNumber: 9 },
              this,
            ),
            (0, Q.jsxDEV)(
              `p`,
              {
                className: `text-xs md:text-sm text-gray-400`,
                children: `Try a different search term`,
              },
              void 0,
              !1,
              { fileName: $, lineNumber: 67, columnNumber: 9 },
              this,
            ),
          ],
        },
        void 0,
        !0,
        { fileName: $, lineNumber: 64, columnNumber: 7 },
        this,
      )
    : (0, Q.jsxDEV)(
        `div`,
        {
          children: [
            (0, Q.jsxDEV)(
              `div`,
              {
                className: `mb-4 md:mb-6 text-center`,
                children: (0, Q.jsxDEV)(
                  `p`,
                  {
                    className: `text-xs md:text-sm text-gray-500`,
                    children: [`Found `, e.length, ` `, e.length === 1 ? `movie` : `movies`],
                  },
                  void 0,
                  !0,
                  { fileName: $, lineNumber: 75, columnNumber: 9 },
                  this,
                ),
              },
              void 0,
              !1,
              { fileName: $, lineNumber: 74, columnNumber: 7 },
              this,
            ),
            (0, Q.jsxDEV)(
              `div`,
              {
                className: `flex flex-col gap-3 md:gap-4`,
                children: e.map((e) =>
                  (0, Q.jsxDEV)(
                    Ye,
                    { movie: e },
                    e.id,
                    !1,
                    { fileName: $, lineNumber: 81, columnNumber: 11 },
                    this,
                  ),
                ),
              },
              void 0,
              !1,
              { fileName: $, lineNumber: 79, columnNumber: 7 },
              this,
            ),
          ],
        },
        void 0,
        !0,
        { fileName: $, lineNumber: 73, columnNumber: 5 },
        this,
      );
}
async function Ze({ searchQuery: e, limit: t }) {
  return (0, Q.jsxDEV)(
    Xe,
    { movies: await He(e, t) },
    void 0,
    !1,
    { fileName: $, lineNumber: 90, columnNumber: 10 },
    this,
  );
}
var Qe = new Map(),
  $e = new Map(),
  et = [];
(et.push({ moduleId: `/src/components/RSCMoviesTab/worker-actions.ts`, moduleExports: We }),
  typeof Z == `function` &&
    $e.set(`/src/components/RSCMoviesTab/worker-actions.ts#updateRating`, Z),
  Qe.set(`/src/components/RSCMoviesTab/worker-components.tsx#MoviesRSCView`, Ze));
function tt(e) {
  return typeof e != `string` || e.length === 0 ? null : (Qe.get(e) ?? null);
}
const nt = et;
($e.size, Qe.size);
var rt = `https://rsc.prism.local`,
  it = `/rsc/action`,
  at = Ae({ actionModules: nt });
function ot(e, t) {
  let n = new Headers(e.headers ?? []);
  return (
    e.actionId != null && n.set(`x-rsc-action`, e.actionId),
    e.contentType != null && n.set(`content-type`, e.contentType),
    new Request(t.toString(), { ...e.requestInit, method: `POST`, headers: n, body: e.body ?? `` })
  );
}
(self.addEventListener(
  `message`,
  Be(async (e) => {
    let t = new URL(e.endpoint, rt);
    if (e.operation === `fetch`) {
      if (t.pathname !== `/rsc/view`)
        return new Response(JSON.stringify({ error: `Unknown endpoint: ` + t.pathname }), {
          status: 404,
          headers: { "Content-Type": `application/json` },
        });
      let n = tt(e.componentId);
      return n == null
        ? new Response(
            JSON.stringify({ error: `Missing or unknown worker component reference.` }),
            { status: 400, headers: { "Content-Type": `application/json` } },
          )
        : at.render(n(e.componentProps ?? {}));
    }
    if (e.operation === `action`) {
      if (t.pathname !== it)
        return new Response(JSON.stringify({ error: `Unknown endpoint: ` + t.pathname }), {
          status: 404,
          headers: { "Content-Type": `application/json` },
        });
      let n = ot(e, t);
      return at.action(n, { status: 200 });
    }
    return new Response(JSON.stringify({ error: `Unsupported operation` }), {
      status: 400,
      headers: { "Content-Type": `application/json` },
    });
  }),
),
  self.postMessage({ type: `rsc.prism.worker.ready` }));
const st = !0;
export { st as __rscPrismWorkerRuntimeMarker };
