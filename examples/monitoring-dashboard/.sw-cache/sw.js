(function () {
  var e = Object.create,
    t = Object.defineProperty,
    n = Object.getOwnPropertyDescriptor,
    r = Object.getOwnPropertyNames,
    i = Object.getPrototypeOf,
    a = Object.prototype.hasOwnProperty,
    o = (e, t) => () => (e && (t = e((e = 0))), t),
    s = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports),
    c = (e, n) => {
      let r = {};
      for (var i in e) t(r, i, { get: e[i], enumerable: !0 });
      return (n && t(r, Symbol.toStringTag, { value: `Module` }), r);
    },
    l = (e, i, o, s) => {
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
    u = (n, r, a) => (
      (a = n == null ? {} : e(i(n))),
      l(r || !n || !n.__esModule ? t(a, `default`, { value: n, enumerable: !0 }) : a, n)
    );
  function d(e, t) {
    let n = new Headers(t?.headers);
    return (
      n.set(`Content-Type`, `application/json`),
      new Response(JSON.stringify(e), { ...t, headers: n })
    );
  }
  function f() {
    return new Response(null, { status: 204 });
  }
  function p(e, t = 500) {
    return d({ error: e }, { status: t });
  }
  var ee = s(() => {
      throw Error(
        "The React Server Writer cannot be used outside a react-server environment. You must configure Node.js using the `--conditions react-server` flag.",
      );
    }),
    te = c(
      {
        createClientProxy: () => ae,
        createRSC: () => fe,
        createRSCContext: () => ne,
        decodeActionArgs: () => se,
        getActionIdFromRequest: () => le,
        handleAction: () => ce,
        isActionRequest: () => ue,
        registerAction: () => re,
        registerActions: () => ie,
        renderRSC: () => oe,
      },
      1,
    );
  async function m() {
    if (!pe) {
      let e = await Promise.resolve().then(() => u(ee(), 1));
      ((pe = e.renderToReadableStream),
        (me = e.registerServerReference),
        (he = e.createClientModuleProxy),
        (ge = e.decodeReply));
    }
  }
  function ne(e) {
    return { manifest: e, actions: new Map() };
  }
  async function re(e, t, n) {
    await m();
    let r = me(n, t, t);
    e.actions.set(t, { fn: r, id: t });
  }
  async function ie(e, t) {
    await m();
    for (let [n, r] of Object.entries(t)) {
      let t = me(r, n, n);
      e.actions.set(n, { fn: t, id: n });
    }
  }
  async function ae(e) {
    return (await m(), he(e));
  }
  async function oe(e, t, n) {
    return (
      await m(),
      pe(e, t.manifest, {
        onError:
          n?.onError ??
          ((e) => (
            console.error(`[rsc-sw-bff] Render error:`, e),
            `An error occurred during server rendering.`
          )),
        signal: n?.signal,
      })
    );
  }
  async function se(e) {
    await m();
    let t;
    if (e.type === `formdata`) {
      t = new FormData();
      for (let [n, r] of new URLSearchParams(e.data)) t.append(n, r);
    } else t = e.data;
    let n = await ge(t, {});
    return Array.isArray(n) ? n : [n];
  }
  async function ce(e, t, n, r) {
    await m();
    let i = t.includes(`#`) ? (t.split(`#`)[1] ?? t) : t,
      a = e.actions.get(i);
    if (!a) {
      let t = Array.from(e.actions.keys()).join(`, `) || `(none)`;
      throw Error(`Action "${i}" not found. Available: ${t}`);
    }
    let o = await se(n),
      s = await a.fn(...o);
    return pe(s, e.manifest, { onError: r?.onError });
  }
  function le(e) {
    return e.headers.get(`rsc-action`) ?? e.headers.get(`x-rsc-action`) ?? null;
  }
  function ue(e) {
    return le(e) !== null;
  }
  function de(e) {
    let t = new Map();
    return new Proxy(
      {},
      {
        get(n, r) {
          if (t.has(r)) return t.get(r);
          let i = { $$typeof: _e, $$id: `${e}#${r}`, name: r };
          return (t.set(r, i), i);
        },
      },
    );
  }
  function fe(e) {
    let t = { [e.moduleId]: { id: e.moduleId, chunks: [], name: `*` } };
    for (let n of e.components) t[`${e.moduleId}#${n}`] = { id: e.moduleId, chunks: [], name: n };
    let n = ne(t);
    return {
      ctx: n,
      Client: de(e.moduleId),
      ready: (async () => {
        if (e.actions) {
          await m();
          for (let [t, r] of Object.entries(e.actions)) {
            let e = me(r, t, t);
            n.actions.set(t, { fn: e, id: t });
          }
        }
      })(),
    };
  }
  var pe,
    me,
    he,
    ge,
    _e,
    ve = o(() => {
      _e = Symbol.for(`react.client.reference`);
    });
  function h(e) {
    return function (t, n) {
      return { method: e, path: t, handler: n };
    };
  }
  var ye = {
      "Content-Type": `text/x-component; charset=utf-8`,
      "Cache-Control": `no-cache, no-store, must-revalidate`,
    },
    g = {
      get: h(`GET`),
      post: h(`POST`),
      put: h(`PUT`),
      patch: h(`PATCH`),
      delete: h(`DELETE`),
      head: h(`HEAD`),
      options: h(`OPTIONS`),
      all(e, t) {
        return [`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`].map((n) => ({
          method: n,
          path: e,
          handler: t,
        }));
      },
      rsc(e, t, n, r) {
        return {
          method: `GET`,
          path: e,
          handler: async ({ url: e, request: i, params: a }) => {
            let { renderRSC: o } = await Promise.resolve().then(() => (ve(), te));
            r?.ready && (await r.ready);
            let s = await o(await t({ url: e, request: i, params: a }), n);
            return new Response(s, { headers: { ...ye, ...r?.headers } });
          },
        };
      },
      action(e, t, n) {
        return {
          method: `POST`,
          path: e,
          handler: async ({ request: e }) => {
            let {
              handleAction: r,
              isActionRequest: i,
              getActionIdFromRequest: a,
            } = await Promise.resolve().then(() => (ve(), te));
            if ((n?.ready && (await n.ready), !i(e)))
              return d({ error: `Missing action header (x-rsc-action)` }, { status: 400 });
            let o = a(e),
              s = await e.text(),
              c = [];
            try {
              ((c = JSON.parse(s)), Array.isArray(c) || (c = [c]));
            } catch {
              c = s ? [s] : [];
            }
            let l = { type: `string`, data: JSON.stringify(c) };
            try {
              let e = await r(t, o, l);
              return new Response(e, { headers: { ...ye, ...n?.headers } });
            } catch (e) {
              let t = e instanceof Error ? e.message : String(e);
              return (
                console.error(`[rsc-sw-bff] Action error:`, t), d({ error: t }, { status: 500 })
              );
            }
          },
        };
      },
      rscRoutes(e, t, n, r) {
        return [this.rsc(e, t, n, r), this.action(e, n, r)];
      },
    };
  function be(e) {
    let t = new URLPattern({ pathname: e.path });
    return { method: e.method, pattern: t, handler: e.handler };
  }
  function xe(e, t, n) {
    for (let r of n) {
      if (r.method !== t) continue;
      let n = r.pattern.exec({ pathname: e });
      if (n) {
        let e = {},
          t = n.pathname.groups;
        for (let [n, r] of Object.entries(t)) r !== void 0 && (e[n] = decodeURIComponent(r));
        return { route: r, params: e };
      }
    }
    return null;
  }
  var Se = [],
    Ce = {};
  function we(e) {
    let t = new URL(e.request.url),
      { basePath: n = `` } = Ce;
    if (n && !t.pathname.startsWith(n)) return;
    let r = n ? t.pathname.slice(n.length) || `/` : t.pathname,
      i = e.request.method,
      a = xe(r, i, Se);
    if (!a) {
      Ce.fallback && e.respondWith(Promise.resolve(Ce.fallback(e.request)));
      return;
    }
    e.respondWith(
      (async () => {
        try {
          return await a.route.handler({ request: e.request, url: t, params: a.params });
        } catch (e) {
          return (
            console.error(`[sw-bff] Handler error:`, e),
            p(e instanceof Error ? e.message : String(e), 500)
          );
        }
      })(),
    );
  }
  function Te() {
    (self.addEventListener(`install`, (e) => {
      e.waitUntil(self.skipWaiting());
    }),
      self.addEventListener(`activate`, (e) => {
        e.waitUntil(self.clients.claim());
      }),
      self.addEventListener(`fetch`, we));
  }
  function Ee(e, t = {}) {
    ((Se = e.map(be)), (Ce = t), Te());
  }
  var De = (e, t) => t.some((t) => e instanceof t),
    Oe,
    ke;
  function Ae() {
    return (Oe ||= [IDBDatabase, IDBObjectStore, IDBIndex, IDBCursor, IDBTransaction]);
  }
  function je() {
    return (ke ||= [
      IDBCursor.prototype.advance,
      IDBCursor.prototype.continue,
      IDBCursor.prototype.continuePrimaryKey,
    ]);
  }
  var Me = new WeakMap(),
    Ne = new WeakMap(),
    Pe = new WeakMap();
  function Fe(e) {
    let t = new Promise((t, n) => {
      let r = () => {
          (e.removeEventListener(`success`, i), e.removeEventListener(`error`, a));
        },
        i = () => {
          (t(_(e.result)), r());
        },
        a = () => {
          (n(e.error), r());
        };
      (e.addEventListener(`success`, i), e.addEventListener(`error`, a));
    });
    return (Pe.set(t, e), t);
  }
  function Ie(e) {
    if (Me.has(e)) return;
    let t = new Promise((t, n) => {
      let r = () => {
          (e.removeEventListener(`complete`, i),
            e.removeEventListener(`error`, a),
            e.removeEventListener(`abort`, a));
        },
        i = () => {
          (t(), r());
        },
        a = () => {
          (n(e.error || new DOMException(`AbortError`, `AbortError`)), r());
        };
      (e.addEventListener(`complete`, i),
        e.addEventListener(`error`, a),
        e.addEventListener(`abort`, a));
    });
    Me.set(e, t);
  }
  var Le = {
    get(e, t, n) {
      if (e instanceof IDBTransaction) {
        if (t === `done`) return Me.get(e);
        if (t === `store`)
          return n.objectStoreNames[1] ? void 0 : n.objectStore(n.objectStoreNames[0]);
      }
      return _(e[t]);
    },
    set(e, t, n) {
      return ((e[t] = n), !0);
    },
    has(e, t) {
      return e instanceof IDBTransaction && (t === `done` || t === `store`) ? !0 : t in e;
    },
  };
  function Re(e) {
    Le = e(Le);
  }
  function ze(e) {
    return je().includes(e)
      ? function (...t) {
          return (e.apply(Ve(this), t), _(this.request));
        }
      : function (...t) {
          return _(e.apply(Ve(this), t));
        };
  }
  function Be(e) {
    return typeof e == `function`
      ? ze(e)
      : (e instanceof IDBTransaction && Ie(e), De(e, Ae()) ? new Proxy(e, Le) : e);
  }
  function _(e) {
    if (e instanceof IDBRequest) return Fe(e);
    if (Ne.has(e)) return Ne.get(e);
    let t = Be(e);
    return (t !== e && (Ne.set(e, t), Pe.set(t, e)), t);
  }
  var Ve = (e) => Pe.get(e);
  function He(e, t, { blocked: n, upgrade: r, blocking: i, terminated: a } = {}) {
    let o = indexedDB.open(e, t),
      s = _(o);
    return (
      r &&
        o.addEventListener(`upgradeneeded`, (e) => {
          r(_(o.result), e.oldVersion, e.newVersion, _(o.transaction), e);
        }),
      n && o.addEventListener(`blocked`, (e) => n(e.oldVersion, e.newVersion, e)),
      s
        .then((e) => {
          (a && e.addEventListener(`close`, () => a()),
            i && e.addEventListener(`versionchange`, (e) => i(e.oldVersion, e.newVersion, e)));
        })
        .catch(() => {}),
      s
    );
  }
  var Ue = [`get`, `getKey`, `getAll`, `getAllKeys`, `count`],
    We = [`put`, `add`, `delete`, `clear`],
    Ge = new Map();
  function Ke(e, t) {
    if (!(e instanceof IDBDatabase && !(t in e) && typeof t == `string`)) return;
    if (Ge.get(t)) return Ge.get(t);
    let n = t.replace(/FromIndex$/, ``),
      r = t !== n,
      i = We.includes(n);
    if (!(n in (r ? IDBIndex : IDBObjectStore).prototype) || !(i || Ue.includes(n))) return;
    let a = async function (e, ...t) {
      let a = this.transaction(e, i ? `readwrite` : `readonly`),
        o = a.store;
      return (r && (o = o.index(t.shift())), (await Promise.all([o[n](...t), i && a.done]))[0]);
    };
    return (Ge.set(t, a), a);
  }
  Re((e) => ({
    ...e,
    get: (t, n, r) => Ke(t, n) || e.get(t, n, r),
    has: (t, n) => !!Ke(t, n) || e.has(t, n),
  }));
  var qe = [`continue`, `continuePrimaryKey`, `advance`],
    Je = {},
    Ye = new WeakMap(),
    Xe = new WeakMap(),
    Ze = {
      get(e, t) {
        if (!qe.includes(t)) return e[t];
        let n = Je[t];
        return (
          (n ||= Je[t] =
            function (...e) {
              Ye.set(this, Xe.get(this)[t](...e));
            }),
          n
        );
      },
    };
  async function* Qe(...e) {
    let t = this;
    if ((t instanceof IDBCursor || (t = await t.openCursor(...e)), !t)) return;
    t = t;
    let n = new Proxy(t, Ze);
    for (Xe.set(n, t), Pe.set(n, Ve(t)); t; )
      (yield n, (t = await (Ye.get(n) || t.continue())), Ye.delete(n));
  }
  function $e(e, t) {
    return (
      (t === Symbol.asyncIterator && De(e, [IDBIndex, IDBObjectStore, IDBCursor])) ||
      (t === `iterate` && De(e, [IDBIndex, IDBObjectStore]))
    );
  }
  Re((e) => ({
    ...e,
    get(t, n, r) {
      return $e(t, n) ? Qe : e.get(t, n, r);
    },
    has(t, n) {
      return $e(t, n) || e.has(t, n);
    },
  }));
  var et = `monitoring-dashboard`,
    tt = 1,
    nt = null;
  function v() {
    return (
      (nt ||= He(et, tt, {
        upgrade(e) {
          if (!e.objectStoreNames.contains(`servers`)) {
            let t = e.createObjectStore(`servers`, { keyPath: `id` });
            (t.createIndex(`by-region`, `region`), t.createIndex(`by-status`, `status`));
          }
          if (!e.objectStoreNames.contains(`metrics`)) {
            let t = e.createObjectStore(`metrics`, { keyPath: `id` });
            (t.createIndex(`by-server-time`, [`serverId`, `timestamp`]),
              t.createIndex(`by-timestamp`, `timestamp`));
          }
          if (!e.objectStoreNames.contains(`logs`)) {
            let t = e.createObjectStore(`logs`, { keyPath: `id` });
            (t.createIndex(`by-timestamp`, `timestamp`),
              t.createIndex(`by-server-time`, [`serverId`, `timestamp`]),
              t.createIndex(`by-level`, `level`));
          }
          if (
            (e.objectStoreNames.contains(`alerts`) ||
              e.createObjectStore(`alerts`, { keyPath: `id` }).createIndex(`by-server`, `serverId`),
            !e.objectStoreNames.contains(`incidents`))
          ) {
            let t = e.createObjectStore(`incidents`, { keyPath: `id` });
            (t.createIndex(`by-alert-time`, [`alertId`, `startedAt`]),
              t.createIndex(`by-status`, `status`));
          }
          e.objectStoreNames.contains(`preferences`) ||
            e.createObjectStore(`preferences`, { keyPath: `key` });
        },
      })),
      nt
    );
  }
  async function rt(e) {
    await (await v()).put(`preferences`, { key: `lastMetricTime`, value: e });
  }
  var y;
  (function (e) {
    e.assertEqual = (e) => {};
    function t(e) {}
    e.assertIs = t;
    function n(e) {
      throw Error();
    }
    ((e.assertNever = n),
      (e.arrayToEnum = (e) => {
        let t = {};
        for (let n of e) t[n] = n;
        return t;
      }),
      (e.getValidEnumValues = (t) => {
        let n = e.objectKeys(t).filter((e) => typeof t[t[e]] != `number`),
          r = {};
        for (let e of n) r[e] = t[e];
        return e.objectValues(r);
      }),
      (e.objectValues = (t) =>
        e.objectKeys(t).map(function (e) {
          return t[e];
        })),
      (e.objectKeys =
        typeof Object.keys == `function`
          ? (e) => Object.keys(e)
          : (e) => {
              let t = [];
              for (let n in e) Object.prototype.hasOwnProperty.call(e, n) && t.push(n);
              return t;
            }),
      (e.find = (e, t) => {
        for (let n of e) if (t(n)) return n;
      }),
      (e.isInteger =
        typeof Number.isInteger == `function`
          ? (e) => Number.isInteger(e)
          : (e) => typeof e == `number` && Number.isFinite(e) && Math.floor(e) === e));
    function r(e, t = ` | `) {
      return e.map((e) => (typeof e == `string` ? `'${e}'` : e)).join(t);
    }
    ((e.joinValues = r),
      (e.jsonStringifyReplacer = (e, t) => (typeof t == `bigint` ? t.toString() : t)));
  })((y ||= {}));
  var it;
  (function (e) {
    e.mergeShapes = (e, t) => ({ ...e, ...t });
  })((it ||= {}));
  let b = y.arrayToEnum([
      `string`,
      `nan`,
      `number`,
      `integer`,
      `float`,
      `boolean`,
      `date`,
      `bigint`,
      `symbol`,
      `function`,
      `undefined`,
      `null`,
      `array`,
      `object`,
      `unknown`,
      `promise`,
      `void`,
      `never`,
      `map`,
      `set`,
    ]),
    x = (e) => {
      switch (typeof e) {
        case `undefined`:
          return b.undefined;
        case `string`:
          return b.string;
        case `number`:
          return Number.isNaN(e) ? b.nan : b.number;
        case `boolean`:
          return b.boolean;
        case `function`:
          return b.function;
        case `bigint`:
          return b.bigint;
        case `symbol`:
          return b.symbol;
        case `object`:
          return Array.isArray(e)
            ? b.array
            : e === null
              ? b.null
              : e.then && typeof e.then == `function` && e.catch && typeof e.catch == `function`
                ? b.promise
                : typeof Map < `u` && e instanceof Map
                  ? b.map
                  : typeof Set < `u` && e instanceof Set
                    ? b.set
                    : typeof Date < `u` && e instanceof Date
                      ? b.date
                      : b.object;
        default:
          return b.unknown;
      }
    },
    S = y.arrayToEnum([
      `invalid_type`,
      `invalid_literal`,
      `custom`,
      `invalid_union`,
      `invalid_union_discriminator`,
      `invalid_enum_value`,
      `unrecognized_keys`,
      `invalid_arguments`,
      `invalid_return_type`,
      `invalid_date`,
      `invalid_string`,
      `too_small`,
      `too_big`,
      `invalid_intersection_types`,
      `not_multiple_of`,
      `not_finite`,
    ]);
  var C = class e extends Error {
    get errors() {
      return this.issues;
    }
    constructor(e) {
      (super(),
        (this.issues = []),
        (this.addIssue = (e) => {
          this.issues = [...this.issues, e];
        }),
        (this.addIssues = (e = []) => {
          this.issues = [...this.issues, ...e];
        }));
      let t = new.target.prototype;
      (Object.setPrototypeOf ? Object.setPrototypeOf(this, t) : (this.__proto__ = t),
        (this.name = `ZodError`),
        (this.issues = e));
    }
    format(e) {
      let t =
          e ||
          function (e) {
            return e.message;
          },
        n = { _errors: [] },
        r = (e) => {
          for (let i of e.issues)
            if (i.code === `invalid_union`) i.unionErrors.map(r);
            else if (i.code === `invalid_return_type`) r(i.returnTypeError);
            else if (i.code === `invalid_arguments`) r(i.argumentsError);
            else if (i.path.length === 0) n._errors.push(t(i));
            else {
              let e = n,
                r = 0;
              for (; r < i.path.length; ) {
                let n = i.path[r];
                (r === i.path.length - 1
                  ? ((e[n] = e[n] || { _errors: [] }), e[n]._errors.push(t(i)))
                  : (e[n] = e[n] || { _errors: [] }),
                  (e = e[n]),
                  r++);
              }
            }
        };
      return (r(this), n);
    }
    static assert(t) {
      if (!(t instanceof e)) throw Error(`Not a ZodError: ${t}`);
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, y.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(e = (e) => e.message) {
      let t = {},
        n = [];
      for (let r of this.issues)
        if (r.path.length > 0) {
          let n = r.path[0];
          ((t[n] = t[n] || []), t[n].push(e(r)));
        } else n.push(e(r));
      return { formErrors: n, fieldErrors: t };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  C.create = (e) => new C(e);
  var w = (e, t) => {
      let n;
      switch (e.code) {
        case S.invalid_type:
          n =
            e.received === b.undefined
              ? `Required`
              : `Expected ${e.expected}, received ${e.received}`;
          break;
        case S.invalid_literal:
          n = `Invalid literal value, expected ${JSON.stringify(e.expected, y.jsonStringifyReplacer)}`;
          break;
        case S.unrecognized_keys:
          n = `Unrecognized key(s) in object: ${y.joinValues(e.keys, `, `)}`;
          break;
        case S.invalid_union:
          n = `Invalid input`;
          break;
        case S.invalid_union_discriminator:
          n = `Invalid discriminator value. Expected ${y.joinValues(e.options)}`;
          break;
        case S.invalid_enum_value:
          n = `Invalid enum value. Expected ${y.joinValues(e.options)}, received '${e.received}'`;
          break;
        case S.invalid_arguments:
          n = `Invalid function arguments`;
          break;
        case S.invalid_return_type:
          n = `Invalid function return type`;
          break;
        case S.invalid_date:
          n = `Invalid date`;
          break;
        case S.invalid_string:
          typeof e.validation == `object`
            ? `includes` in e.validation
              ? ((n = `Invalid input: must include "${e.validation.includes}"`),
                typeof e.validation.position == `number` &&
                  (n = `${n} at one or more positions greater than or equal to ${e.validation.position}`))
              : `startsWith` in e.validation
                ? (n = `Invalid input: must start with "${e.validation.startsWith}"`)
                : `endsWith` in e.validation
                  ? (n = `Invalid input: must end with "${e.validation.endsWith}"`)
                  : y.assertNever(e.validation)
            : (n = e.validation === `regex` ? `Invalid` : `Invalid ${e.validation}`);
          break;
        case S.too_small:
          n =
            e.type === `array`
              ? `Array must contain ${e.exact ? `exactly` : e.inclusive ? `at least` : `more than`} ${e.minimum} element(s)`
              : e.type === `string`
                ? `String must contain ${e.exact ? `exactly` : e.inclusive ? `at least` : `over`} ${e.minimum} character(s)`
                : e.type === `number` || e.type === `bigint`
                  ? `Number must be ${e.exact ? `exactly equal to ` : e.inclusive ? `greater than or equal to ` : `greater than `}${e.minimum}`
                  : e.type === `date`
                    ? `Date must be ${e.exact ? `exactly equal to ` : e.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(e.minimum))}`
                    : `Invalid input`;
          break;
        case S.too_big:
          n =
            e.type === `array`
              ? `Array must contain ${e.exact ? `exactly` : e.inclusive ? `at most` : `less than`} ${e.maximum} element(s)`
              : e.type === `string`
                ? `String must contain ${e.exact ? `exactly` : e.inclusive ? `at most` : `under`} ${e.maximum} character(s)`
                : e.type === `number`
                  ? `Number must be ${e.exact ? `exactly` : e.inclusive ? `less than or equal to` : `less than`} ${e.maximum}`
                  : e.type === `bigint`
                    ? `BigInt must be ${e.exact ? `exactly` : e.inclusive ? `less than or equal to` : `less than`} ${e.maximum}`
                    : e.type === `date`
                      ? `Date must be ${e.exact ? `exactly` : e.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(e.maximum))}`
                      : `Invalid input`;
          break;
        case S.custom:
          n = `Invalid input`;
          break;
        case S.invalid_intersection_types:
          n = `Intersection results could not be merged`;
          break;
        case S.not_multiple_of:
          n = `Number must be a multiple of ${e.multipleOf}`;
          break;
        case S.not_finite:
          n = `Number must be finite`;
          break;
        default:
          ((n = t.defaultError), y.assertNever(e));
      }
      return { message: n };
    },
    at = w;
  function ot() {
    return at;
  }
  let st = (e) => {
    let { data: t, path: n, errorMaps: r, issueData: i } = e,
      a = [...n, ...(i.path || [])],
      o = { ...i, path: a };
    if (i.message !== void 0) return { ...i, path: a, message: i.message };
    let s = ``,
      c = r
        .filter((e) => !!e)
        .slice()
        .reverse();
    for (let e of c) s = e(o, { data: t, defaultError: s }).message;
    return { ...i, path: a, message: s };
  };
  function T(e, t) {
    let n = ot(),
      r = st({
        issueData: t,
        data: e.data,
        path: e.path,
        errorMaps: [e.common.contextualErrorMap, e.schemaErrorMap, n, n === w ? void 0 : w].filter(
          (e) => !!e,
        ),
      });
    e.common.issues.push(r);
  }
  var E = class e {
    constructor() {
      this.value = `valid`;
    }
    dirty() {
      this.value === `valid` && (this.value = `dirty`);
    }
    abort() {
      this.value !== `aborted` && (this.value = `aborted`);
    }
    static mergeArray(e, t) {
      let n = [];
      for (let r of t) {
        if (r.status === `aborted`) return D;
        (r.status === `dirty` && e.dirty(), n.push(r.value));
      }
      return { status: e.value, value: n };
    }
    static async mergeObjectAsync(t, n) {
      let r = [];
      for (let e of n) {
        let t = await e.key,
          n = await e.value;
        r.push({ key: t, value: n });
      }
      return e.mergeObjectSync(t, r);
    }
    static mergeObjectSync(e, t) {
      let n = {};
      for (let r of t) {
        let { key: t, value: i } = r;
        if (t.status === `aborted` || i.status === `aborted`) return D;
        (t.status === `dirty` && e.dirty(),
          i.status === `dirty` && e.dirty(),
          t.value !== `__proto__` && (i.value !== void 0 || r.alwaysSet) && (n[t.value] = i.value));
      }
      return { status: e.value, value: n };
    }
  };
  let D = Object.freeze({ status: `aborted` }),
    ct = (e) => ({ status: `dirty`, value: e }),
    O = (e) => ({ status: `valid`, value: e }),
    lt = (e) => e.status === `aborted`,
    ut = (e) => e.status === `dirty`,
    k = (e) => e.status === `valid`,
    A = (e) => typeof Promise < `u` && e instanceof Promise;
  var j;
  (function (e) {
    ((e.errToObj = (e) => (typeof e == `string` ? { message: e } : e || {})),
      (e.toString = (e) => (typeof e == `string` ? e : e?.message)));
  })((j ||= {}));
  var M = class {
      constructor(e, t, n, r) {
        ((this._cachedPath = []),
          (this.parent = e),
          (this.data = t),
          (this._path = n),
          (this._key = r));
      }
      get path() {
        return (
          this._cachedPath.length ||
            (Array.isArray(this._key)
              ? this._cachedPath.push(...this._path, ...this._key)
              : this._cachedPath.push(...this._path, this._key)),
          this._cachedPath
        );
      }
    },
    dt = (e, t) => {
      if (k(t)) return { success: !0, data: t.value };
      if (!e.common.issues.length) throw Error(`Validation failed but no issues detected.`);
      return {
        success: !1,
        get error() {
          return ((this._error ||= new C(e.common.issues)), this._error);
        },
      };
    };
  function N(e) {
    if (!e) return {};
    let { errorMap: t, invalid_type_error: n, required_error: r, description: i } = e;
    if (t && (n || r))
      throw Error(
        `Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`,
      );
    return t
      ? { errorMap: t, description: i }
      : {
          errorMap: (t, i) => {
            let { message: a } = e;
            return t.code === `invalid_enum_value`
              ? { message: a ?? i.defaultError }
              : i.data === void 0
                ? { message: a ?? r ?? i.defaultError }
                : t.code === `invalid_type`
                  ? { message: a ?? n ?? i.defaultError }
                  : { message: i.defaultError };
          },
          description: i,
        };
  }
  var P = class {
      get description() {
        return this._def.description;
      }
      _getType(e) {
        return x(e.data);
      }
      _getOrReturnCtx(e, t) {
        return (
          t || {
            common: e.parent.common,
            data: e.data,
            parsedType: x(e.data),
            schemaErrorMap: this._def.errorMap,
            path: e.path,
            parent: e.parent,
          }
        );
      }
      _processInputParams(e) {
        return {
          status: new E(),
          ctx: {
            common: e.parent.common,
            data: e.data,
            parsedType: x(e.data),
            schemaErrorMap: this._def.errorMap,
            path: e.path,
            parent: e.parent,
          },
        };
      }
      _parseSync(e) {
        let t = this._parse(e);
        if (A(t)) throw Error(`Synchronous parse encountered promise.`);
        return t;
      }
      _parseAsync(e) {
        let t = this._parse(e);
        return Promise.resolve(t);
      }
      parse(e, t) {
        let n = this.safeParse(e, t);
        if (n.success) return n.data;
        throw n.error;
      }
      safeParse(e, t) {
        let n = {
          common: { issues: [], async: t?.async ?? !1, contextualErrorMap: t?.errorMap },
          path: t?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data: e,
          parsedType: x(e),
        };
        return dt(n, this._parseSync({ data: e, path: n.path, parent: n }));
      }
      "~validate"(e) {
        let t = {
          common: { issues: [], async: !!this[`~standard`].async },
          path: [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data: e,
          parsedType: x(e),
        };
        if (!this[`~standard`].async)
          try {
            let n = this._parseSync({ data: e, path: [], parent: t });
            return k(n) ? { value: n.value } : { issues: t.common.issues };
          } catch (e) {
            (e?.message?.toLowerCase()?.includes(`encountered`) && (this[`~standard`].async = !0),
              (t.common = { issues: [], async: !0 }));
          }
        return this._parseAsync({ data: e, path: [], parent: t }).then((e) =>
          k(e) ? { value: e.value } : { issues: t.common.issues },
        );
      }
      async parseAsync(e, t) {
        let n = await this.safeParseAsync(e, t);
        if (n.success) return n.data;
        throw n.error;
      }
      async safeParseAsync(e, t) {
        let n = {
            common: { issues: [], contextualErrorMap: t?.errorMap, async: !0 },
            path: t?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data: e,
            parsedType: x(e),
          },
          r = this._parse({ data: e, path: n.path, parent: n });
        return dt(n, await (A(r) ? r : Promise.resolve(r)));
      }
      refine(e, t) {
        let n = (e) =>
          typeof t == `string` || t === void 0 ? { message: t } : typeof t == `function` ? t(e) : t;
        return this._refinement((t, r) => {
          let i = e(t),
            a = () => r.addIssue({ code: S.custom, ...n(t) });
          return typeof Promise < `u` && i instanceof Promise
            ? i.then((e) => (e ? !0 : (a(), !1)))
            : i
              ? !0
              : (a(), !1);
        });
      }
      refinement(e, t) {
        return this._refinement((n, r) =>
          e(n) ? !0 : (r.addIssue(typeof t == `function` ? t(n, r) : t), !1),
        );
      }
      _refinement(e) {
        return new K({
          schema: this,
          typeName: Y.ZodEffects,
          effect: { type: `refinement`, refinement: e },
        });
      }
      superRefine(e) {
        return this._refinement(e);
      }
      constructor(e) {
        ((this.spa = this.safeParseAsync),
          (this._def = e),
          (this.parse = this.parse.bind(this)),
          (this.safeParse = this.safeParse.bind(this)),
          (this.parseAsync = this.parseAsync.bind(this)),
          (this.safeParseAsync = this.safeParseAsync.bind(this)),
          (this.spa = this.spa.bind(this)),
          (this.refine = this.refine.bind(this)),
          (this.refinement = this.refinement.bind(this)),
          (this.superRefine = this.superRefine.bind(this)),
          (this.optional = this.optional.bind(this)),
          (this.nullable = this.nullable.bind(this)),
          (this.nullish = this.nullish.bind(this)),
          (this.array = this.array.bind(this)),
          (this.promise = this.promise.bind(this)),
          (this.or = this.or.bind(this)),
          (this.and = this.and.bind(this)),
          (this.transform = this.transform.bind(this)),
          (this.brand = this.brand.bind(this)),
          (this.default = this.default.bind(this)),
          (this.catch = this.catch.bind(this)),
          (this.describe = this.describe.bind(this)),
          (this.pipe = this.pipe.bind(this)),
          (this.readonly = this.readonly.bind(this)),
          (this.isNullable = this.isNullable.bind(this)),
          (this.isOptional = this.isOptional.bind(this)),
          (this[`~standard`] = {
            version: 1,
            vendor: `zod`,
            validate: (e) => this[`~validate`](e),
          }));
      }
      optional() {
        return q.create(this, this._def);
      }
      nullable() {
        return J.create(this, this._def);
      }
      nullish() {
        return this.nullable().optional();
      }
      array() {
        return z.create(this);
      }
      promise() {
        return G.create(this, this._def);
      }
      or(e) {
        return H.create([this, e], this._def);
      }
      and(e) {
        return qt.create(this, e, this._def);
      }
      transform(e) {
        return new K({
          ...N(this._def),
          schema: this,
          typeName: Y.ZodEffects,
          effect: { type: `transform`, transform: e },
        });
      }
      default(e) {
        let t = typeof e == `function` ? e : () => e;
        return new rn({
          ...N(this._def),
          innerType: this,
          defaultValue: t,
          typeName: Y.ZodDefault,
        });
      }
      brand() {
        return new sn({ typeName: Y.ZodBranded, type: this, ...N(this._def) });
      }
      catch(e) {
        let t = typeof e == `function` ? e : () => e;
        return new an({ ...N(this._def), innerType: this, catchValue: t, typeName: Y.ZodCatch });
      }
      describe(e) {
        let t = this.constructor;
        return new t({ ...this._def, description: e });
      }
      pipe(e) {
        return cn.create(this, e);
      }
      readonly() {
        return ln.create(this);
      }
      isOptional() {
        return this.safeParse(void 0).success;
      }
      isNullable() {
        return this.safeParse(null).success;
      }
    },
    ft = /^c[^\s-]{8,}$/i,
    pt = /^[0-9a-z]+$/,
    mt = /^[0-9A-HJKMNP-TV-Z]{26}$/i,
    ht = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,
    gt = /^[a-z0-9_-]{21}$/i,
    _t = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
    vt =
      /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,
    yt = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,
    bt = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`,
    xt,
    St =
      /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
    Ct =
      /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
    wt =
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
    Tt =
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
    Et = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
    Dt = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
    Ot = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`,
    kt = RegExp(`^${Ot}$`);
  function At(e) {
    let t = `[0-5]\\d`;
    e.precision ? (t = `${t}\\.\\d{${e.precision}}`) : (e.precision ?? (t = `${t}(\\.\\d+)?`));
    let n = e.precision ? `+` : `?`;
    return `([01]\\d|2[0-3]):[0-5]\\d(:${t})${n}`;
  }
  function jt(e) {
    return RegExp(`^${At(e)}$`);
  }
  function Mt(e) {
    let t = `${Ot}T${At(e)}`,
      n = [];
    return (
      n.push(e.local ? `Z?` : `Z`),
      e.offset && n.push(`([+-]\\d{2}:?\\d{2})`),
      (t = `${t}(${n.join(`|`)})`),
      RegExp(`^${t}$`)
    );
  }
  function Nt(e, t) {
    return !!(((t === `v4` || !t) && St.test(e)) || ((t === `v6` || !t) && wt.test(e)));
  }
  function Pt(e, t) {
    if (!_t.test(e)) return !1;
    try {
      let [n] = e.split(`.`);
      if (!n) return !1;
      let r = n
          .replace(/-/g, `+`)
          .replace(/_/g, `/`)
          .padEnd(n.length + ((4 - (n.length % 4)) % 4), `=`),
        i = JSON.parse(atob(r));
      return !(
        typeof i != `object` ||
        !i ||
        (`typ` in i && i?.typ !== `JWT`) ||
        !i.alg ||
        (t && i.alg !== t)
      );
    } catch {
      return !1;
    }
  }
  function Ft(e, t) {
    return !!(((t === `v4` || !t) && Ct.test(e)) || ((t === `v6` || !t) && Tt.test(e)));
  }
  var It = class e extends P {
    _parse(e) {
      if ((this._def.coerce && (e.data = String(e.data)), this._getType(e) !== b.string)) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.string, received: t.parsedType }), D);
      }
      let t = new E(),
        n;
      for (let r of this._def.checks)
        if (r.kind === `min`)
          e.data.length < r.value &&
            ((n = this._getOrReturnCtx(e, n)),
            T(n, {
              code: S.too_small,
              minimum: r.value,
              type: `string`,
              inclusive: !0,
              exact: !1,
              message: r.message,
            }),
            t.dirty());
        else if (r.kind === `max`)
          e.data.length > r.value &&
            ((n = this._getOrReturnCtx(e, n)),
            T(n, {
              code: S.too_big,
              maximum: r.value,
              type: `string`,
              inclusive: !0,
              exact: !1,
              message: r.message,
            }),
            t.dirty());
        else if (r.kind === `length`) {
          let i = e.data.length > r.value,
            a = e.data.length < r.value;
          (i || a) &&
            ((n = this._getOrReturnCtx(e, n)),
            i
              ? T(n, {
                  code: S.too_big,
                  maximum: r.value,
                  type: `string`,
                  inclusive: !0,
                  exact: !0,
                  message: r.message,
                })
              : a &&
                T(n, {
                  code: S.too_small,
                  minimum: r.value,
                  type: `string`,
                  inclusive: !0,
                  exact: !0,
                  message: r.message,
                }),
            t.dirty());
        } else if (r.kind === `email`)
          yt.test(e.data) ||
            ((n = this._getOrReturnCtx(e, n)),
            T(n, { validation: `email`, code: S.invalid_string, message: r.message }),
            t.dirty());
        else if (r.kind === `emoji`)
          ((xt ||= new RegExp(bt, `u`)),
            xt.test(e.data) ||
              ((n = this._getOrReturnCtx(e, n)),
              T(n, { validation: `emoji`, code: S.invalid_string, message: r.message }),
              t.dirty()));
        else if (r.kind === `uuid`)
          ht.test(e.data) ||
            ((n = this._getOrReturnCtx(e, n)),
            T(n, { validation: `uuid`, code: S.invalid_string, message: r.message }),
            t.dirty());
        else if (r.kind === `nanoid`)
          gt.test(e.data) ||
            ((n = this._getOrReturnCtx(e, n)),
            T(n, { validation: `nanoid`, code: S.invalid_string, message: r.message }),
            t.dirty());
        else if (r.kind === `cuid`)
          ft.test(e.data) ||
            ((n = this._getOrReturnCtx(e, n)),
            T(n, { validation: `cuid`, code: S.invalid_string, message: r.message }),
            t.dirty());
        else if (r.kind === `cuid2`)
          pt.test(e.data) ||
            ((n = this._getOrReturnCtx(e, n)),
            T(n, { validation: `cuid2`, code: S.invalid_string, message: r.message }),
            t.dirty());
        else if (r.kind === `ulid`)
          mt.test(e.data) ||
            ((n = this._getOrReturnCtx(e, n)),
            T(n, { validation: `ulid`, code: S.invalid_string, message: r.message }),
            t.dirty());
        else if (r.kind === `url`)
          try {
            new URL(e.data);
          } catch {
            ((n = this._getOrReturnCtx(e, n)),
              T(n, { validation: `url`, code: S.invalid_string, message: r.message }),
              t.dirty());
          }
        else
          r.kind === `regex`
            ? ((r.regex.lastIndex = 0),
              r.regex.test(e.data) ||
                ((n = this._getOrReturnCtx(e, n)),
                T(n, { validation: `regex`, code: S.invalid_string, message: r.message }),
                t.dirty()))
            : r.kind === `trim`
              ? (e.data = e.data.trim())
              : r.kind === `includes`
                ? e.data.includes(r.value, r.position) ||
                  ((n = this._getOrReturnCtx(e, n)),
                  T(n, {
                    code: S.invalid_string,
                    validation: { includes: r.value, position: r.position },
                    message: r.message,
                  }),
                  t.dirty())
                : r.kind === `toLowerCase`
                  ? (e.data = e.data.toLowerCase())
                  : r.kind === `toUpperCase`
                    ? (e.data = e.data.toUpperCase())
                    : r.kind === `startsWith`
                      ? e.data.startsWith(r.value) ||
                        ((n = this._getOrReturnCtx(e, n)),
                        T(n, {
                          code: S.invalid_string,
                          validation: { startsWith: r.value },
                          message: r.message,
                        }),
                        t.dirty())
                      : r.kind === `endsWith`
                        ? e.data.endsWith(r.value) ||
                          ((n = this._getOrReturnCtx(e, n)),
                          T(n, {
                            code: S.invalid_string,
                            validation: { endsWith: r.value },
                            message: r.message,
                          }),
                          t.dirty())
                        : r.kind === `datetime`
                          ? Mt(r).test(e.data) ||
                            ((n = this._getOrReturnCtx(e, n)),
                            T(n, {
                              code: S.invalid_string,
                              validation: `datetime`,
                              message: r.message,
                            }),
                            t.dirty())
                          : r.kind === `date`
                            ? kt.test(e.data) ||
                              ((n = this._getOrReturnCtx(e, n)),
                              T(n, {
                                code: S.invalid_string,
                                validation: `date`,
                                message: r.message,
                              }),
                              t.dirty())
                            : r.kind === `time`
                              ? jt(r).test(e.data) ||
                                ((n = this._getOrReturnCtx(e, n)),
                                T(n, {
                                  code: S.invalid_string,
                                  validation: `time`,
                                  message: r.message,
                                }),
                                t.dirty())
                              : r.kind === `duration`
                                ? vt.test(e.data) ||
                                  ((n = this._getOrReturnCtx(e, n)),
                                  T(n, {
                                    validation: `duration`,
                                    code: S.invalid_string,
                                    message: r.message,
                                  }),
                                  t.dirty())
                                : r.kind === `ip`
                                  ? Nt(e.data, r.version) ||
                                    ((n = this._getOrReturnCtx(e, n)),
                                    T(n, {
                                      validation: `ip`,
                                      code: S.invalid_string,
                                      message: r.message,
                                    }),
                                    t.dirty())
                                  : r.kind === `jwt`
                                    ? Pt(e.data, r.alg) ||
                                      ((n = this._getOrReturnCtx(e, n)),
                                      T(n, {
                                        validation: `jwt`,
                                        code: S.invalid_string,
                                        message: r.message,
                                      }),
                                      t.dirty())
                                    : r.kind === `cidr`
                                      ? Ft(e.data, r.version) ||
                                        ((n = this._getOrReturnCtx(e, n)),
                                        T(n, {
                                          validation: `cidr`,
                                          code: S.invalid_string,
                                          message: r.message,
                                        }),
                                        t.dirty())
                                      : r.kind === `base64`
                                        ? Et.test(e.data) ||
                                          ((n = this._getOrReturnCtx(e, n)),
                                          T(n, {
                                            validation: `base64`,
                                            code: S.invalid_string,
                                            message: r.message,
                                          }),
                                          t.dirty())
                                        : r.kind === `base64url`
                                          ? Dt.test(e.data) ||
                                            ((n = this._getOrReturnCtx(e, n)),
                                            T(n, {
                                              validation: `base64url`,
                                              code: S.invalid_string,
                                              message: r.message,
                                            }),
                                            t.dirty())
                                          : y.assertNever(r);
      return { status: t.value, value: e.data };
    }
    _regex(e, t, n) {
      return this.refinement((t) => e.test(t), {
        validation: t,
        code: S.invalid_string,
        ...j.errToObj(n),
      });
    }
    _addCheck(t) {
      return new e({ ...this._def, checks: [...this._def.checks, t] });
    }
    email(e) {
      return this._addCheck({ kind: `email`, ...j.errToObj(e) });
    }
    url(e) {
      return this._addCheck({ kind: `url`, ...j.errToObj(e) });
    }
    emoji(e) {
      return this._addCheck({ kind: `emoji`, ...j.errToObj(e) });
    }
    uuid(e) {
      return this._addCheck({ kind: `uuid`, ...j.errToObj(e) });
    }
    nanoid(e) {
      return this._addCheck({ kind: `nanoid`, ...j.errToObj(e) });
    }
    cuid(e) {
      return this._addCheck({ kind: `cuid`, ...j.errToObj(e) });
    }
    cuid2(e) {
      return this._addCheck({ kind: `cuid2`, ...j.errToObj(e) });
    }
    ulid(e) {
      return this._addCheck({ kind: `ulid`, ...j.errToObj(e) });
    }
    base64(e) {
      return this._addCheck({ kind: `base64`, ...j.errToObj(e) });
    }
    base64url(e) {
      return this._addCheck({ kind: `base64url`, ...j.errToObj(e) });
    }
    jwt(e) {
      return this._addCheck({ kind: `jwt`, ...j.errToObj(e) });
    }
    ip(e) {
      return this._addCheck({ kind: `ip`, ...j.errToObj(e) });
    }
    cidr(e) {
      return this._addCheck({ kind: `cidr`, ...j.errToObj(e) });
    }
    datetime(e) {
      return typeof e == `string`
        ? this._addCheck({ kind: `datetime`, precision: null, offset: !1, local: !1, message: e })
        : this._addCheck({
            kind: `datetime`,
            precision: e?.precision === void 0 ? null : e?.precision,
            offset: e?.offset ?? !1,
            local: e?.local ?? !1,
            ...j.errToObj(e?.message),
          });
    }
    date(e) {
      return this._addCheck({ kind: `date`, message: e });
    }
    time(e) {
      return typeof e == `string`
        ? this._addCheck({ kind: `time`, precision: null, message: e })
        : this._addCheck({
            kind: `time`,
            precision: e?.precision === void 0 ? null : e?.precision,
            ...j.errToObj(e?.message),
          });
    }
    duration(e) {
      return this._addCheck({ kind: `duration`, ...j.errToObj(e) });
    }
    regex(e, t) {
      return this._addCheck({ kind: `regex`, regex: e, ...j.errToObj(t) });
    }
    includes(e, t) {
      return this._addCheck({
        kind: `includes`,
        value: e,
        position: t?.position,
        ...j.errToObj(t?.message),
      });
    }
    startsWith(e, t) {
      return this._addCheck({ kind: `startsWith`, value: e, ...j.errToObj(t) });
    }
    endsWith(e, t) {
      return this._addCheck({ kind: `endsWith`, value: e, ...j.errToObj(t) });
    }
    min(e, t) {
      return this._addCheck({ kind: `min`, value: e, ...j.errToObj(t) });
    }
    max(e, t) {
      return this._addCheck({ kind: `max`, value: e, ...j.errToObj(t) });
    }
    length(e, t) {
      return this._addCheck({ kind: `length`, value: e, ...j.errToObj(t) });
    }
    nonempty(e) {
      return this.min(1, j.errToObj(e));
    }
    trim() {
      return new e({ ...this._def, checks: [...this._def.checks, { kind: `trim` }] });
    }
    toLowerCase() {
      return new e({ ...this._def, checks: [...this._def.checks, { kind: `toLowerCase` }] });
    }
    toUpperCase() {
      return new e({ ...this._def, checks: [...this._def.checks, { kind: `toUpperCase` }] });
    }
    get isDatetime() {
      return !!this._def.checks.find((e) => e.kind === `datetime`);
    }
    get isDate() {
      return !!this._def.checks.find((e) => e.kind === `date`);
    }
    get isTime() {
      return !!this._def.checks.find((e) => e.kind === `time`);
    }
    get isDuration() {
      return !!this._def.checks.find((e) => e.kind === `duration`);
    }
    get isEmail() {
      return !!this._def.checks.find((e) => e.kind === `email`);
    }
    get isURL() {
      return !!this._def.checks.find((e) => e.kind === `url`);
    }
    get isEmoji() {
      return !!this._def.checks.find((e) => e.kind === `emoji`);
    }
    get isUUID() {
      return !!this._def.checks.find((e) => e.kind === `uuid`);
    }
    get isNANOID() {
      return !!this._def.checks.find((e) => e.kind === `nanoid`);
    }
    get isCUID() {
      return !!this._def.checks.find((e) => e.kind === `cuid`);
    }
    get isCUID2() {
      return !!this._def.checks.find((e) => e.kind === `cuid2`);
    }
    get isULID() {
      return !!this._def.checks.find((e) => e.kind === `ulid`);
    }
    get isIP() {
      return !!this._def.checks.find((e) => e.kind === `ip`);
    }
    get isCIDR() {
      return !!this._def.checks.find((e) => e.kind === `cidr`);
    }
    get isBase64() {
      return !!this._def.checks.find((e) => e.kind === `base64`);
    }
    get isBase64url() {
      return !!this._def.checks.find((e) => e.kind === `base64url`);
    }
    get minLength() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === `min` && (e === null || t.value > e) && (e = t.value);
      return e;
    }
    get maxLength() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === `max` && (e === null || t.value < e) && (e = t.value);
      return e;
    }
  };
  It.create = (e) =>
    new It({ checks: [], typeName: Y.ZodString, coerce: e?.coerce ?? !1, ...N(e) });
  function Lt(e, t) {
    let n = (e.toString().split(`.`)[1] || ``).length,
      r = (t.toString().split(`.`)[1] || ``).length,
      i = n > r ? n : r;
    return (
      (Number.parseInt(e.toFixed(i).replace(`.`, ``)) %
        Number.parseInt(t.toFixed(i).replace(`.`, ``))) /
      10 ** i
    );
  }
  var Rt = class e extends P {
    constructor() {
      (super(...arguments),
        (this.min = this.gte),
        (this.max = this.lte),
        (this.step = this.multipleOf));
    }
    _parse(e) {
      if ((this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== b.number)) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.number, received: t.parsedType }), D);
      }
      let t,
        n = new E();
      for (let r of this._def.checks)
        r.kind === `int`
          ? y.isInteger(e.data) ||
            ((t = this._getOrReturnCtx(e, t)),
            T(t, {
              code: S.invalid_type,
              expected: `integer`,
              received: `float`,
              message: r.message,
            }),
            n.dirty())
          : r.kind === `min`
            ? (r.inclusive ? e.data < r.value : e.data <= r.value) &&
              ((t = this._getOrReturnCtx(e, t)),
              T(t, {
                code: S.too_small,
                minimum: r.value,
                type: `number`,
                inclusive: r.inclusive,
                exact: !1,
                message: r.message,
              }),
              n.dirty())
            : r.kind === `max`
              ? (r.inclusive ? e.data > r.value : e.data >= r.value) &&
                ((t = this._getOrReturnCtx(e, t)),
                T(t, {
                  code: S.too_big,
                  maximum: r.value,
                  type: `number`,
                  inclusive: r.inclusive,
                  exact: !1,
                  message: r.message,
                }),
                n.dirty())
              : r.kind === `multipleOf`
                ? Lt(e.data, r.value) !== 0 &&
                  ((t = this._getOrReturnCtx(e, t)),
                  T(t, { code: S.not_multiple_of, multipleOf: r.value, message: r.message }),
                  n.dirty())
                : r.kind === `finite`
                  ? Number.isFinite(e.data) ||
                    ((t = this._getOrReturnCtx(e, t)),
                    T(t, { code: S.not_finite, message: r.message }),
                    n.dirty())
                  : y.assertNever(r);
      return { status: n.value, value: e.data };
    }
    gte(e, t) {
      return this.setLimit(`min`, e, !0, j.toString(t));
    }
    gt(e, t) {
      return this.setLimit(`min`, e, !1, j.toString(t));
    }
    lte(e, t) {
      return this.setLimit(`max`, e, !0, j.toString(t));
    }
    lt(e, t) {
      return this.setLimit(`max`, e, !1, j.toString(t));
    }
    setLimit(t, n, r, i) {
      return new e({
        ...this._def,
        checks: [...this._def.checks, { kind: t, value: n, inclusive: r, message: j.toString(i) }],
      });
    }
    _addCheck(t) {
      return new e({ ...this._def, checks: [...this._def.checks, t] });
    }
    int(e) {
      return this._addCheck({ kind: `int`, message: j.toString(e) });
    }
    positive(e) {
      return this._addCheck({ kind: `min`, value: 0, inclusive: !1, message: j.toString(e) });
    }
    negative(e) {
      return this._addCheck({ kind: `max`, value: 0, inclusive: !1, message: j.toString(e) });
    }
    nonpositive(e) {
      return this._addCheck({ kind: `max`, value: 0, inclusive: !0, message: j.toString(e) });
    }
    nonnegative(e) {
      return this._addCheck({ kind: `min`, value: 0, inclusive: !0, message: j.toString(e) });
    }
    multipleOf(e, t) {
      return this._addCheck({ kind: `multipleOf`, value: e, message: j.toString(t) });
    }
    finite(e) {
      return this._addCheck({ kind: `finite`, message: j.toString(e) });
    }
    safe(e) {
      return this._addCheck({
        kind: `min`,
        inclusive: !0,
        value: -(2 ** 53 - 1),
        message: j.toString(e),
      })._addCheck({ kind: `max`, inclusive: !0, value: 2 ** 53 - 1, message: j.toString(e) });
    }
    get minValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === `min` && (e === null || t.value > e) && (e = t.value);
      return e;
    }
    get maxValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === `max` && (e === null || t.value < e) && (e = t.value);
      return e;
    }
    get isInt() {
      return !!this._def.checks.find(
        (e) => e.kind === `int` || (e.kind === `multipleOf` && y.isInteger(e.value)),
      );
    }
    get isFinite() {
      let e = null,
        t = null;
      for (let n of this._def.checks)
        if (n.kind === `finite` || n.kind === `int` || n.kind === `multipleOf`) return !0;
        else
          n.kind === `min`
            ? (t === null || n.value > t) && (t = n.value)
            : n.kind === `max` && (e === null || n.value < e) && (e = n.value);
      return Number.isFinite(t) && Number.isFinite(e);
    }
  };
  Rt.create = (e) =>
    new Rt({ checks: [], typeName: Y.ZodNumber, coerce: e?.coerce || !1, ...N(e) });
  var zt = class e extends P {
    constructor() {
      (super(...arguments), (this.min = this.gte), (this.max = this.lte));
    }
    _parse(e) {
      if (this._def.coerce)
        try {
          e.data = BigInt(e.data);
        } catch {
          return this._getInvalidInput(e);
        }
      if (this._getType(e) !== b.bigint) return this._getInvalidInput(e);
      let t,
        n = new E();
      for (let r of this._def.checks)
        r.kind === `min`
          ? (r.inclusive ? e.data < r.value : e.data <= r.value) &&
            ((t = this._getOrReturnCtx(e, t)),
            T(t, {
              code: S.too_small,
              type: `bigint`,
              minimum: r.value,
              inclusive: r.inclusive,
              message: r.message,
            }),
            n.dirty())
          : r.kind === `max`
            ? (r.inclusive ? e.data > r.value : e.data >= r.value) &&
              ((t = this._getOrReturnCtx(e, t)),
              T(t, {
                code: S.too_big,
                type: `bigint`,
                maximum: r.value,
                inclusive: r.inclusive,
                message: r.message,
              }),
              n.dirty())
            : r.kind === `multipleOf`
              ? e.data % r.value !== BigInt(0) &&
                ((t = this._getOrReturnCtx(e, t)),
                T(t, { code: S.not_multiple_of, multipleOf: r.value, message: r.message }),
                n.dirty())
              : y.assertNever(r);
      return { status: n.value, value: e.data };
    }
    _getInvalidInput(e) {
      let t = this._getOrReturnCtx(e);
      return (T(t, { code: S.invalid_type, expected: b.bigint, received: t.parsedType }), D);
    }
    gte(e, t) {
      return this.setLimit(`min`, e, !0, j.toString(t));
    }
    gt(e, t) {
      return this.setLimit(`min`, e, !1, j.toString(t));
    }
    lte(e, t) {
      return this.setLimit(`max`, e, !0, j.toString(t));
    }
    lt(e, t) {
      return this.setLimit(`max`, e, !1, j.toString(t));
    }
    setLimit(t, n, r, i) {
      return new e({
        ...this._def,
        checks: [...this._def.checks, { kind: t, value: n, inclusive: r, message: j.toString(i) }],
      });
    }
    _addCheck(t) {
      return new e({ ...this._def, checks: [...this._def.checks, t] });
    }
    positive(e) {
      return this._addCheck({
        kind: `min`,
        value: BigInt(0),
        inclusive: !1,
        message: j.toString(e),
      });
    }
    negative(e) {
      return this._addCheck({
        kind: `max`,
        value: BigInt(0),
        inclusive: !1,
        message: j.toString(e),
      });
    }
    nonpositive(e) {
      return this._addCheck({
        kind: `max`,
        value: BigInt(0),
        inclusive: !0,
        message: j.toString(e),
      });
    }
    nonnegative(e) {
      return this._addCheck({
        kind: `min`,
        value: BigInt(0),
        inclusive: !0,
        message: j.toString(e),
      });
    }
    multipleOf(e, t) {
      return this._addCheck({ kind: `multipleOf`, value: e, message: j.toString(t) });
    }
    get minValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === `min` && (e === null || t.value > e) && (e = t.value);
      return e;
    }
    get maxValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === `max` && (e === null || t.value < e) && (e = t.value);
      return e;
    }
  };
  zt.create = (e) =>
    new zt({ checks: [], typeName: Y.ZodBigInt, coerce: e?.coerce ?? !1, ...N(e) });
  var Bt = class extends P {
    _parse(e) {
      if ((this._def.coerce && (e.data = !!e.data), this._getType(e) !== b.boolean)) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.boolean, received: t.parsedType }), D);
      }
      return O(e.data);
    }
  };
  Bt.create = (e) => new Bt({ typeName: Y.ZodBoolean, coerce: e?.coerce || !1, ...N(e) });
  var Vt = class e extends P {
    _parse(e) {
      if ((this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== b.date)) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.date, received: t.parsedType }), D);
      }
      if (Number.isNaN(e.data.getTime()))
        return (T(this._getOrReturnCtx(e), { code: S.invalid_date }), D);
      let t = new E(),
        n;
      for (let r of this._def.checks)
        r.kind === `min`
          ? e.data.getTime() < r.value &&
            ((n = this._getOrReturnCtx(e, n)),
            T(n, {
              code: S.too_small,
              message: r.message,
              inclusive: !0,
              exact: !1,
              minimum: r.value,
              type: `date`,
            }),
            t.dirty())
          : r.kind === `max`
            ? e.data.getTime() > r.value &&
              ((n = this._getOrReturnCtx(e, n)),
              T(n, {
                code: S.too_big,
                message: r.message,
                inclusive: !0,
                exact: !1,
                maximum: r.value,
                type: `date`,
              }),
              t.dirty())
            : y.assertNever(r);
      return { status: t.value, value: new Date(e.data.getTime()) };
    }
    _addCheck(t) {
      return new e({ ...this._def, checks: [...this._def.checks, t] });
    }
    min(e, t) {
      return this._addCheck({ kind: `min`, value: e.getTime(), message: j.toString(t) });
    }
    max(e, t) {
      return this._addCheck({ kind: `max`, value: e.getTime(), message: j.toString(t) });
    }
    get minDate() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === `min` && (e === null || t.value > e) && (e = t.value);
      return e == null ? null : new Date(e);
    }
    get maxDate() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === `max` && (e === null || t.value < e) && (e = t.value);
      return e == null ? null : new Date(e);
    }
  };
  Vt.create = (e) => new Vt({ checks: [], coerce: e?.coerce || !1, typeName: Y.ZodDate, ...N(e) });
  var Ht = class extends P {
    _parse(e) {
      if (this._getType(e) !== b.symbol) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.symbol, received: t.parsedType }), D);
      }
      return O(e.data);
    }
  };
  Ht.create = (e) => new Ht({ typeName: Y.ZodSymbol, ...N(e) });
  var F = class extends P {
    _parse(e) {
      if (this._getType(e) !== b.undefined) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.undefined, received: t.parsedType }), D);
      }
      return O(e.data);
    }
  };
  F.create = (e) => new F({ typeName: Y.ZodUndefined, ...N(e) });
  var I = class extends P {
    _parse(e) {
      if (this._getType(e) !== b.null) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.null, received: t.parsedType }), D);
      }
      return O(e.data);
    }
  };
  I.create = (e) => new I({ typeName: Y.ZodNull, ...N(e) });
  var Ut = class extends P {
    constructor() {
      (super(...arguments), (this._any = !0));
    }
    _parse(e) {
      return O(e.data);
    }
  };
  Ut.create = (e) => new Ut({ typeName: Y.ZodAny, ...N(e) });
  var L = class extends P {
    constructor() {
      (super(...arguments), (this._unknown = !0));
    }
    _parse(e) {
      return O(e.data);
    }
  };
  L.create = (e) => new L({ typeName: Y.ZodUnknown, ...N(e) });
  var R = class extends P {
    _parse(e) {
      let t = this._getOrReturnCtx(e);
      return (T(t, { code: S.invalid_type, expected: b.never, received: t.parsedType }), D);
    }
  };
  R.create = (e) => new R({ typeName: Y.ZodNever, ...N(e) });
  var Wt = class extends P {
    _parse(e) {
      if (this._getType(e) !== b.undefined) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.void, received: t.parsedType }), D);
      }
      return O(e.data);
    }
  };
  Wt.create = (e) => new Wt({ typeName: Y.ZodVoid, ...N(e) });
  var z = class e extends P {
    _parse(e) {
      let { ctx: t, status: n } = this._processInputParams(e),
        r = this._def;
      if (t.parsedType !== b.array)
        return (T(t, { code: S.invalid_type, expected: b.array, received: t.parsedType }), D);
      if (r.exactLength !== null) {
        let e = t.data.length > r.exactLength.value,
          i = t.data.length < r.exactLength.value;
        (e || i) &&
          (T(t, {
            code: e ? S.too_big : S.too_small,
            minimum: i ? r.exactLength.value : void 0,
            maximum: e ? r.exactLength.value : void 0,
            type: `array`,
            inclusive: !0,
            exact: !0,
            message: r.exactLength.message,
          }),
          n.dirty());
      }
      if (
        (r.minLength !== null &&
          t.data.length < r.minLength.value &&
          (T(t, {
            code: S.too_small,
            minimum: r.minLength.value,
            type: `array`,
            inclusive: !0,
            exact: !1,
            message: r.minLength.message,
          }),
          n.dirty()),
        r.maxLength !== null &&
          t.data.length > r.maxLength.value &&
          (T(t, {
            code: S.too_big,
            maximum: r.maxLength.value,
            type: `array`,
            inclusive: !0,
            exact: !1,
            message: r.maxLength.message,
          }),
          n.dirty()),
        t.common.async)
      )
        return Promise.all(
          [...t.data].map((e, n) => r.type._parseAsync(new M(t, e, t.path, n))),
        ).then((e) => E.mergeArray(n, e));
      let i = [...t.data].map((e, n) => r.type._parseSync(new M(t, e, t.path, n)));
      return E.mergeArray(n, i);
    }
    get element() {
      return this._def.type;
    }
    min(t, n) {
      return new e({ ...this._def, minLength: { value: t, message: j.toString(n) } });
    }
    max(t, n) {
      return new e({ ...this._def, maxLength: { value: t, message: j.toString(n) } });
    }
    length(t, n) {
      return new e({ ...this._def, exactLength: { value: t, message: j.toString(n) } });
    }
    nonempty(e) {
      return this.min(1, e);
    }
  };
  z.create = (e, t) =>
    new z({
      type: e,
      minLength: null,
      maxLength: null,
      exactLength: null,
      typeName: Y.ZodArray,
      ...N(t),
    });
  function B(e) {
    if (e instanceof V) {
      let t = {};
      for (let n in e.shape) {
        let r = e.shape[n];
        t[n] = q.create(B(r));
      }
      return new V({ ...e._def, shape: () => t });
    } else if (e instanceof z) return new z({ ...e._def, type: B(e.element) });
    else if (e instanceof q) return q.create(B(e.unwrap()));
    else if (e instanceof J) return J.create(B(e.unwrap()));
    else if (e instanceof W) return W.create(e.items.map((e) => B(e)));
    else return e;
  }
  var V = class e extends P {
    constructor() {
      (super(...arguments),
        (this._cached = null),
        (this.nonstrict = this.passthrough),
        (this.augment = this.extend));
    }
    _getCached() {
      if (this._cached !== null) return this._cached;
      let e = this._def.shape();
      return ((this._cached = { shape: e, keys: y.objectKeys(e) }), this._cached);
    }
    _parse(e) {
      if (this._getType(e) !== b.object) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.object, received: t.parsedType }), D);
      }
      let { status: t, ctx: n } = this._processInputParams(e),
        { shape: r, keys: i } = this._getCached(),
        a = [];
      if (!(this._def.catchall instanceof R && this._def.unknownKeys === `strip`))
        for (let e in n.data) i.includes(e) || a.push(e);
      let o = [];
      for (let e of i) {
        let t = r[e],
          i = n.data[e];
        o.push({
          key: { status: `valid`, value: e },
          value: t._parse(new M(n, i, n.path, e)),
          alwaysSet: e in n.data,
        });
      }
      if (this._def.catchall instanceof R) {
        let e = this._def.unknownKeys;
        if (e === `passthrough`)
          for (let e of a)
            o.push({
              key: { status: `valid`, value: e },
              value: { status: `valid`, value: n.data[e] },
            });
        else if (e === `strict`)
          a.length > 0 && (T(n, { code: S.unrecognized_keys, keys: a }), t.dirty());
        else if (e !== `strip`) throw Error(`Internal ZodObject error: invalid unknownKeys value.`);
      } else {
        let e = this._def.catchall;
        for (let t of a) {
          let r = n.data[t];
          o.push({
            key: { status: `valid`, value: t },
            value: e._parse(new M(n, r, n.path, t)),
            alwaysSet: t in n.data,
          });
        }
      }
      return n.common.async
        ? Promise.resolve()
            .then(async () => {
              let e = [];
              for (let t of o) {
                let n = await t.key,
                  r = await t.value;
                e.push({ key: n, value: r, alwaysSet: t.alwaysSet });
              }
              return e;
            })
            .then((e) => E.mergeObjectSync(t, e))
        : E.mergeObjectSync(t, o);
    }
    get shape() {
      return this._def.shape();
    }
    strict(t) {
      return (
        j.errToObj,
        new e({
          ...this._def,
          unknownKeys: `strict`,
          ...(t === void 0
            ? {}
            : {
                errorMap: (e, n) => {
                  let r = this._def.errorMap?.(e, n).message ?? n.defaultError;
                  return e.code === `unrecognized_keys`
                    ? { message: j.errToObj(t).message ?? r }
                    : { message: r };
                },
              }),
        })
      );
    }
    strip() {
      return new e({ ...this._def, unknownKeys: `strip` });
    }
    passthrough() {
      return new e({ ...this._def, unknownKeys: `passthrough` });
    }
    extend(t) {
      return new e({ ...this._def, shape: () => ({ ...this._def.shape(), ...t }) });
    }
    merge(t) {
      return new e({
        unknownKeys: t._def.unknownKeys,
        catchall: t._def.catchall,
        shape: () => ({ ...this._def.shape(), ...t._def.shape() }),
        typeName: Y.ZodObject,
      });
    }
    setKey(e, t) {
      return this.augment({ [e]: t });
    }
    catchall(t) {
      return new e({ ...this._def, catchall: t });
    }
    pick(t) {
      let n = {};
      for (let e of y.objectKeys(t)) t[e] && this.shape[e] && (n[e] = this.shape[e]);
      return new e({ ...this._def, shape: () => n });
    }
    omit(t) {
      let n = {};
      for (let e of y.objectKeys(this.shape)) t[e] || (n[e] = this.shape[e]);
      return new e({ ...this._def, shape: () => n });
    }
    deepPartial() {
      return B(this);
    }
    partial(t) {
      let n = {};
      for (let e of y.objectKeys(this.shape)) {
        let r = this.shape[e];
        t && !t[e] ? (n[e] = r) : (n[e] = r.optional());
      }
      return new e({ ...this._def, shape: () => n });
    }
    required(t) {
      let n = {};
      for (let e of y.objectKeys(this.shape))
        if (t && !t[e]) n[e] = this.shape[e];
        else {
          let t = this.shape[e];
          for (; t instanceof q; ) t = t._def.innerType;
          n[e] = t;
        }
      return new e({ ...this._def, shape: () => n });
    }
    keyof() {
      return en(y.objectKeys(this.shape));
    }
  };
  ((V.create = (e, t) =>
    new V({
      shape: () => e,
      unknownKeys: `strip`,
      catchall: R.create(),
      typeName: Y.ZodObject,
      ...N(t),
    })),
    (V.strictCreate = (e, t) =>
      new V({
        shape: () => e,
        unknownKeys: `strict`,
        catchall: R.create(),
        typeName: Y.ZodObject,
        ...N(t),
      })),
    (V.lazycreate = (e, t) =>
      new V({
        shape: e,
        unknownKeys: `strip`,
        catchall: R.create(),
        typeName: Y.ZodObject,
        ...N(t),
      })));
  var H = class extends P {
    _parse(e) {
      let { ctx: t } = this._processInputParams(e),
        n = this._def.options;
      function r(e) {
        for (let t of e) if (t.result.status === `valid`) return t.result;
        for (let n of e)
          if (n.result.status === `dirty`)
            return (t.common.issues.push(...n.ctx.common.issues), n.result);
        let n = e.map((e) => new C(e.ctx.common.issues));
        return (T(t, { code: S.invalid_union, unionErrors: n }), D);
      }
      if (t.common.async)
        return Promise.all(
          n.map(async (e) => {
            let n = { ...t, common: { ...t.common, issues: [] }, parent: null };
            return {
              result: await e._parseAsync({ data: t.data, path: t.path, parent: n }),
              ctx: n,
            };
          }),
        ).then(r);
      {
        let e,
          r = [];
        for (let i of n) {
          let n = { ...t, common: { ...t.common, issues: [] }, parent: null },
            a = i._parseSync({ data: t.data, path: t.path, parent: n });
          if (a.status === `valid`) return a;
          (a.status === `dirty` && !e && (e = { result: a, ctx: n }),
            n.common.issues.length && r.push(n.common.issues));
        }
        if (e) return (t.common.issues.push(...e.ctx.common.issues), e.result);
        let i = r.map((e) => new C(e));
        return (T(t, { code: S.invalid_union, unionErrors: i }), D);
      }
    }
    get options() {
      return this._def.options;
    }
  };
  H.create = (e, t) => new H({ options: e, typeName: Y.ZodUnion, ...N(t) });
  var U = (e) =>
      e instanceof Qt
        ? U(e.schema)
        : e instanceof K
          ? U(e.innerType())
          : e instanceof $t
            ? [e.value]
            : e instanceof tn
              ? e.options
              : e instanceof nn
                ? y.objectValues(e.enum)
                : e instanceof rn
                  ? U(e._def.innerType)
                  : e instanceof F
                    ? [void 0]
                    : e instanceof I
                      ? [null]
                      : e instanceof q
                        ? [void 0, ...U(e.unwrap())]
                        : e instanceof J
                          ? [null, ...U(e.unwrap())]
                          : e instanceof sn || e instanceof ln
                            ? U(e.unwrap())
                            : e instanceof an
                              ? U(e._def.innerType)
                              : [],
    Gt = class e extends P {
      _parse(e) {
        let { ctx: t } = this._processInputParams(e);
        if (t.parsedType !== b.object)
          return (T(t, { code: S.invalid_type, expected: b.object, received: t.parsedType }), D);
        let n = this.discriminator,
          r = t.data[n],
          i = this.optionsMap.get(r);
        return i
          ? t.common.async
            ? i._parseAsync({ data: t.data, path: t.path, parent: t })
            : i._parseSync({ data: t.data, path: t.path, parent: t })
          : (T(t, {
              code: S.invalid_union_discriminator,
              options: Array.from(this.optionsMap.keys()),
              path: [n],
            }),
            D);
      }
      get discriminator() {
        return this._def.discriminator;
      }
      get options() {
        return this._def.options;
      }
      get optionsMap() {
        return this._def.optionsMap;
      }
      static create(t, n, r) {
        let i = new Map();
        for (let e of n) {
          let n = U(e.shape[t]);
          if (!n.length)
            throw Error(
              `A discriminator value for key \`${t}\` could not be extracted from all schema options`,
            );
          for (let r of n) {
            if (i.has(r))
              throw Error(`Discriminator property ${String(t)} has duplicate value ${String(r)}`);
            i.set(r, e);
          }
        }
        return new e({
          typeName: Y.ZodDiscriminatedUnion,
          discriminator: t,
          options: n,
          optionsMap: i,
          ...N(r),
        });
      }
    };
  function Kt(e, t) {
    let n = x(e),
      r = x(t);
    if (e === t) return { valid: !0, data: e };
    if (n === b.object && r === b.object) {
      let n = y.objectKeys(t),
        r = y.objectKeys(e).filter((e) => n.indexOf(e) !== -1),
        i = { ...e, ...t };
      for (let n of r) {
        let r = Kt(e[n], t[n]);
        if (!r.valid) return { valid: !1 };
        i[n] = r.data;
      }
      return { valid: !0, data: i };
    } else if (n === b.array && r === b.array) {
      if (e.length !== t.length) return { valid: !1 };
      let n = [];
      for (let r = 0; r < e.length; r++) {
        let i = e[r],
          a = t[r],
          o = Kt(i, a);
        if (!o.valid) return { valid: !1 };
        n.push(o.data);
      }
      return { valid: !0, data: n };
    } else if (n === b.date && r === b.date && +e == +t) return { valid: !0, data: e };
    else return { valid: !1 };
  }
  var qt = class extends P {
    _parse(e) {
      let { status: t, ctx: n } = this._processInputParams(e),
        r = (e, r) => {
          if (lt(e) || lt(r)) return D;
          let i = Kt(e.value, r.value);
          return i.valid
            ? ((ut(e) || ut(r)) && t.dirty(), { status: t.value, value: i.data })
            : (T(n, { code: S.invalid_intersection_types }), D);
        };
      return n.common.async
        ? Promise.all([
            this._def.left._parseAsync({ data: n.data, path: n.path, parent: n }),
            this._def.right._parseAsync({ data: n.data, path: n.path, parent: n }),
          ]).then(([e, t]) => r(e, t))
        : r(
            this._def.left._parseSync({ data: n.data, path: n.path, parent: n }),
            this._def.right._parseSync({ data: n.data, path: n.path, parent: n }),
          );
    }
  };
  qt.create = (e, t, n) => new qt({ left: e, right: t, typeName: Y.ZodIntersection, ...N(n) });
  var W = class e extends P {
    _parse(e) {
      let { status: t, ctx: n } = this._processInputParams(e);
      if (n.parsedType !== b.array)
        return (T(n, { code: S.invalid_type, expected: b.array, received: n.parsedType }), D);
      if (n.data.length < this._def.items.length)
        return (
          T(n, {
            code: S.too_small,
            minimum: this._def.items.length,
            inclusive: !0,
            exact: !1,
            type: `array`,
          }),
          D
        );
      !this._def.rest &&
        n.data.length > this._def.items.length &&
        (T(n, {
          code: S.too_big,
          maximum: this._def.items.length,
          inclusive: !0,
          exact: !1,
          type: `array`,
        }),
        t.dirty());
      let r = [...n.data]
        .map((e, t) => {
          let r = this._def.items[t] || this._def.rest;
          return r ? r._parse(new M(n, e, n.path, t)) : null;
        })
        .filter((e) => !!e);
      return n.common.async ? Promise.all(r).then((e) => E.mergeArray(t, e)) : E.mergeArray(t, r);
    }
    get items() {
      return this._def.items;
    }
    rest(t) {
      return new e({ ...this._def, rest: t });
    }
  };
  W.create = (e, t) => {
    if (!Array.isArray(e)) throw Error(`You must pass an array of schemas to z.tuple([ ... ])`);
    return new W({ items: e, typeName: Y.ZodTuple, rest: null, ...N(t) });
  };
  var Jt = class e extends P {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(e) {
        let { status: t, ctx: n } = this._processInputParams(e);
        if (n.parsedType !== b.object)
          return (T(n, { code: S.invalid_type, expected: b.object, received: n.parsedType }), D);
        let r = [],
          i = this._def.keyType,
          a = this._def.valueType;
        for (let e in n.data)
          r.push({
            key: i._parse(new M(n, e, n.path, e)),
            value: a._parse(new M(n, n.data[e], n.path, e)),
            alwaysSet: e in n.data,
          });
        return n.common.async ? E.mergeObjectAsync(t, r) : E.mergeObjectSync(t, r);
      }
      get element() {
        return this._def.valueType;
      }
      static create(t, n, r) {
        return n instanceof P
          ? new e({ keyType: t, valueType: n, typeName: Y.ZodRecord, ...N(r) })
          : new e({ keyType: It.create(), valueType: t, typeName: Y.ZodRecord, ...N(n) });
      }
    },
    Yt = class extends P {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(e) {
        let { status: t, ctx: n } = this._processInputParams(e);
        if (n.parsedType !== b.map)
          return (T(n, { code: S.invalid_type, expected: b.map, received: n.parsedType }), D);
        let r = this._def.keyType,
          i = this._def.valueType,
          a = [...n.data.entries()].map(([e, t], a) => ({
            key: r._parse(new M(n, e, n.path, [a, `key`])),
            value: i._parse(new M(n, t, n.path, [a, `value`])),
          }));
        if (n.common.async) {
          let e = new Map();
          return Promise.resolve().then(async () => {
            for (let n of a) {
              let r = await n.key,
                i = await n.value;
              if (r.status === `aborted` || i.status === `aborted`) return D;
              ((r.status === `dirty` || i.status === `dirty`) && t.dirty(),
                e.set(r.value, i.value));
            }
            return { status: t.value, value: e };
          });
        } else {
          let e = new Map();
          for (let n of a) {
            let r = n.key,
              i = n.value;
            if (r.status === `aborted` || i.status === `aborted`) return D;
            ((r.status === `dirty` || i.status === `dirty`) && t.dirty(), e.set(r.value, i.value));
          }
          return { status: t.value, value: e };
        }
      }
    };
  Yt.create = (e, t, n) => new Yt({ valueType: t, keyType: e, typeName: Y.ZodMap, ...N(n) });
  var Xt = class e extends P {
    _parse(e) {
      let { status: t, ctx: n } = this._processInputParams(e);
      if (n.parsedType !== b.set)
        return (T(n, { code: S.invalid_type, expected: b.set, received: n.parsedType }), D);
      let r = this._def;
      (r.minSize !== null &&
        n.data.size < r.minSize.value &&
        (T(n, {
          code: S.too_small,
          minimum: r.minSize.value,
          type: `set`,
          inclusive: !0,
          exact: !1,
          message: r.minSize.message,
        }),
        t.dirty()),
        r.maxSize !== null &&
          n.data.size > r.maxSize.value &&
          (T(n, {
            code: S.too_big,
            maximum: r.maxSize.value,
            type: `set`,
            inclusive: !0,
            exact: !1,
            message: r.maxSize.message,
          }),
          t.dirty()));
      let i = this._def.valueType;
      function a(e) {
        let n = new Set();
        for (let r of e) {
          if (r.status === `aborted`) return D;
          (r.status === `dirty` && t.dirty(), n.add(r.value));
        }
        return { status: t.value, value: n };
      }
      let o = [...n.data.values()].map((e, t) => i._parse(new M(n, e, n.path, t)));
      return n.common.async ? Promise.all(o).then((e) => a(e)) : a(o);
    }
    min(t, n) {
      return new e({ ...this._def, minSize: { value: t, message: j.toString(n) } });
    }
    max(t, n) {
      return new e({ ...this._def, maxSize: { value: t, message: j.toString(n) } });
    }
    size(e, t) {
      return this.min(e, t).max(e, t);
    }
    nonempty(e) {
      return this.min(1, e);
    }
  };
  Xt.create = (e, t) =>
    new Xt({ valueType: e, minSize: null, maxSize: null, typeName: Y.ZodSet, ...N(t) });
  var Zt = class e extends P {
      constructor() {
        (super(...arguments), (this.validate = this.implement));
      }
      _parse(e) {
        let { ctx: t } = this._processInputParams(e);
        if (t.parsedType !== b.function)
          return (T(t, { code: S.invalid_type, expected: b.function, received: t.parsedType }), D);
        function n(e, n) {
          return st({
            data: e,
            path: t.path,
            errorMaps: [t.common.contextualErrorMap, t.schemaErrorMap, ot(), w].filter((e) => !!e),
            issueData: { code: S.invalid_arguments, argumentsError: n },
          });
        }
        function r(e, n) {
          return st({
            data: e,
            path: t.path,
            errorMaps: [t.common.contextualErrorMap, t.schemaErrorMap, ot(), w].filter((e) => !!e),
            issueData: { code: S.invalid_return_type, returnTypeError: n },
          });
        }
        let i = { errorMap: t.common.contextualErrorMap },
          a = t.data;
        if (this._def.returns instanceof G) {
          let e = this;
          return O(async function (...t) {
            let o = new C([]),
              s = await e._def.args.parseAsync(t, i).catch((e) => {
                throw (o.addIssue(n(t, e)), o);
              }),
              c = await Reflect.apply(a, this, s);
            return await e._def.returns._def.type.parseAsync(c, i).catch((e) => {
              throw (o.addIssue(r(c, e)), o);
            });
          });
        } else {
          let e = this;
          return O(function (...t) {
            let o = e._def.args.safeParse(t, i);
            if (!o.success) throw new C([n(t, o.error)]);
            let s = Reflect.apply(a, this, o.data),
              c = e._def.returns.safeParse(s, i);
            if (!c.success) throw new C([r(s, c.error)]);
            return c.data;
          });
        }
      }
      parameters() {
        return this._def.args;
      }
      returnType() {
        return this._def.returns;
      }
      args(...t) {
        return new e({ ...this._def, args: W.create(t).rest(L.create()) });
      }
      returns(t) {
        return new e({ ...this._def, returns: t });
      }
      implement(e) {
        return this.parse(e);
      }
      strictImplement(e) {
        return this.parse(e);
      }
      static create(t, n, r) {
        return new e({
          args: t || W.create([]).rest(L.create()),
          returns: n || L.create(),
          typeName: Y.ZodFunction,
          ...N(r),
        });
      }
    },
    Qt = class extends P {
      get schema() {
        return this._def.getter();
      }
      _parse(e) {
        let { ctx: t } = this._processInputParams(e);
        return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
      }
    };
  Qt.create = (e, t) => new Qt({ getter: e, typeName: Y.ZodLazy, ...N(t) });
  var $t = class extends P {
    _parse(e) {
      if (e.data !== this._def.value) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { received: t.data, code: S.invalid_literal, expected: this._def.value }), D);
      }
      return { status: `valid`, value: e.data };
    }
    get value() {
      return this._def.value;
    }
  };
  $t.create = (e, t) => new $t({ value: e, typeName: Y.ZodLiteral, ...N(t) });
  function en(e, t) {
    return new tn({ values: e, typeName: Y.ZodEnum, ...N(t) });
  }
  var tn = class e extends P {
    _parse(e) {
      if (typeof e.data != `string`) {
        let t = this._getOrReturnCtx(e),
          n = this._def.values;
        return (
          T(t, { expected: y.joinValues(n), received: t.parsedType, code: S.invalid_type }), D
        );
      }
      if (((this._cache ||= new Set(this._def.values)), !this._cache.has(e.data))) {
        let t = this._getOrReturnCtx(e),
          n = this._def.values;
        return (T(t, { received: t.data, code: S.invalid_enum_value, options: n }), D);
      }
      return O(e.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      let e = {};
      for (let t of this._def.values) e[t] = t;
      return e;
    }
    get Values() {
      let e = {};
      for (let t of this._def.values) e[t] = t;
      return e;
    }
    get Enum() {
      let e = {};
      for (let t of this._def.values) e[t] = t;
      return e;
    }
    extract(t, n = this._def) {
      return e.create(t, { ...this._def, ...n });
    }
    exclude(t, n = this._def) {
      return e.create(
        this.options.filter((e) => !t.includes(e)),
        { ...this._def, ...n },
      );
    }
  };
  tn.create = en;
  var nn = class extends P {
    _parse(e) {
      let t = y.getValidEnumValues(this._def.values),
        n = this._getOrReturnCtx(e);
      if (n.parsedType !== b.string && n.parsedType !== b.number) {
        let e = y.objectValues(t);
        return (
          T(n, { expected: y.joinValues(e), received: n.parsedType, code: S.invalid_type }), D
        );
      }
      if (
        ((this._cache ||= new Set(y.getValidEnumValues(this._def.values))),
        !this._cache.has(e.data))
      ) {
        let e = y.objectValues(t);
        return (T(n, { received: n.data, code: S.invalid_enum_value, options: e }), D);
      }
      return O(e.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  nn.create = (e, t) => new nn({ values: e, typeName: Y.ZodNativeEnum, ...N(t) });
  var G = class extends P {
    unwrap() {
      return this._def.type;
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      return t.parsedType !== b.promise && t.common.async === !1
        ? (T(t, { code: S.invalid_type, expected: b.promise, received: t.parsedType }), D)
        : O(
            (t.parsedType === b.promise ? t.data : Promise.resolve(t.data)).then((e) =>
              this._def.type.parseAsync(e, { path: t.path, errorMap: t.common.contextualErrorMap }),
            ),
          );
    }
  };
  G.create = (e, t) => new G({ type: e, typeName: Y.ZodPromise, ...N(t) });
  var K = class extends P {
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === Y.ZodEffects
        ? this._def.schema.sourceType()
        : this._def.schema;
    }
    _parse(e) {
      let { status: t, ctx: n } = this._processInputParams(e),
        r = this._def.effect || null,
        i = {
          addIssue: (e) => {
            (T(n, e), e.fatal ? t.abort() : t.dirty());
          },
          get path() {
            return n.path;
          },
        };
      if (((i.addIssue = i.addIssue.bind(i)), r.type === `preprocess`)) {
        let e = r.transform(n.data, i);
        if (n.common.async)
          return Promise.resolve(e).then(async (e) => {
            if (t.value === `aborted`) return D;
            let r = await this._def.schema._parseAsync({ data: e, path: n.path, parent: n });
            return r.status === `aborted`
              ? D
              : r.status === `dirty` || t.value === `dirty`
                ? ct(r.value)
                : r;
          });
        {
          if (t.value === `aborted`) return D;
          let r = this._def.schema._parseSync({ data: e, path: n.path, parent: n });
          return r.status === `aborted`
            ? D
            : r.status === `dirty` || t.value === `dirty`
              ? ct(r.value)
              : r;
        }
      }
      if (r.type === `refinement`) {
        let e = (e) => {
          let t = r.refinement(e, i);
          if (n.common.async) return Promise.resolve(t);
          if (t instanceof Promise)
            throw Error(
              `Async refinement encountered during synchronous parse operation. Use .parseAsync instead.`,
            );
          return e;
        };
        if (n.common.async === !1) {
          let r = this._def.schema._parseSync({ data: n.data, path: n.path, parent: n });
          return r.status === `aborted`
            ? D
            : (r.status === `dirty` && t.dirty(), e(r.value), { status: t.value, value: r.value });
        } else
          return this._def.schema
            ._parseAsync({ data: n.data, path: n.path, parent: n })
            .then((n) =>
              n.status === `aborted`
                ? D
                : (n.status === `dirty` && t.dirty(),
                  e(n.value).then(() => ({ status: t.value, value: n.value }))),
            );
      }
      if (r.type === `transform`)
        if (n.common.async === !1) {
          let e = this._def.schema._parseSync({ data: n.data, path: n.path, parent: n });
          if (!k(e)) return D;
          let a = r.transform(e.value, i);
          if (a instanceof Promise)
            throw Error(
              `Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`,
            );
          return { status: t.value, value: a };
        } else
          return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((e) =>
            k(e)
              ? Promise.resolve(r.transform(e.value, i)).then((e) => ({
                  status: t.value,
                  value: e,
                }))
              : D,
          );
      y.assertNever(r);
    }
  };
  ((K.create = (e, t, n) => new K({ schema: e, typeName: Y.ZodEffects, effect: t, ...N(n) })),
    (K.createWithPreprocess = (e, t, n) =>
      new K({
        schema: t,
        effect: { type: `preprocess`, transform: e },
        typeName: Y.ZodEffects,
        ...N(n),
      })));
  var q = class extends P {
    _parse(e) {
      return this._getType(e) === b.undefined ? O(void 0) : this._def.innerType._parse(e);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  q.create = (e, t) => new q({ innerType: e, typeName: Y.ZodOptional, ...N(t) });
  var J = class extends P {
    _parse(e) {
      return this._getType(e) === b.null ? O(null) : this._def.innerType._parse(e);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  J.create = (e, t) => new J({ innerType: e, typeName: Y.ZodNullable, ...N(t) });
  var rn = class extends P {
    _parse(e) {
      let { ctx: t } = this._processInputParams(e),
        n = t.data;
      return (
        t.parsedType === b.undefined && (n = this._def.defaultValue()),
        this._def.innerType._parse({ data: n, path: t.path, parent: t })
      );
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  rn.create = (e, t) =>
    new rn({
      innerType: e,
      typeName: Y.ZodDefault,
      defaultValue: typeof t.default == `function` ? t.default : () => t.default,
      ...N(t),
    });
  var an = class extends P {
    _parse(e) {
      let { ctx: t } = this._processInputParams(e),
        n = { ...t, common: { ...t.common, issues: [] } },
        r = this._def.innerType._parse({ data: n.data, path: n.path, parent: { ...n } });
      return A(r)
        ? r.then((e) => ({
            status: `valid`,
            value:
              e.status === `valid`
                ? e.value
                : this._def.catchValue({
                    get error() {
                      return new C(n.common.issues);
                    },
                    input: n.data,
                  }),
          }))
        : {
            status: `valid`,
            value:
              r.status === `valid`
                ? r.value
                : this._def.catchValue({
                    get error() {
                      return new C(n.common.issues);
                    },
                    input: n.data,
                  }),
          };
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  an.create = (e, t) =>
    new an({
      innerType: e,
      typeName: Y.ZodCatch,
      catchValue: typeof t.catch == `function` ? t.catch : () => t.catch,
      ...N(t),
    });
  var on = class extends P {
    _parse(e) {
      if (this._getType(e) !== b.nan) {
        let t = this._getOrReturnCtx(e);
        return (T(t, { code: S.invalid_type, expected: b.nan, received: t.parsedType }), D);
      }
      return { status: `valid`, value: e.data };
    }
  };
  on.create = (e) => new on({ typeName: Y.ZodNaN, ...N(e) });
  var sn = class extends P {
      _parse(e) {
        let { ctx: t } = this._processInputParams(e),
          n = t.data;
        return this._def.type._parse({ data: n, path: t.path, parent: t });
      }
      unwrap() {
        return this._def.type;
      }
    },
    cn = class e extends P {
      _parse(e) {
        let { status: t, ctx: n } = this._processInputParams(e);
        if (n.common.async)
          return (async () => {
            let e = await this._def.in._parseAsync({ data: n.data, path: n.path, parent: n });
            return e.status === `aborted`
              ? D
              : e.status === `dirty`
                ? (t.dirty(), ct(e.value))
                : this._def.out._parseAsync({ data: e.value, path: n.path, parent: n });
          })();
        {
          let e = this._def.in._parseSync({ data: n.data, path: n.path, parent: n });
          return e.status === `aborted`
            ? D
            : e.status === `dirty`
              ? (t.dirty(), { status: `dirty`, value: e.value })
              : this._def.out._parseSync({ data: e.value, path: n.path, parent: n });
        }
      }
      static create(t, n) {
        return new e({ in: t, out: n, typeName: Y.ZodPipeline });
      }
    },
    ln = class extends P {
      _parse(e) {
        let t = this._def.innerType._parse(e),
          n = (e) => (k(e) && (e.value = Object.freeze(e.value)), e);
        return A(t) ? t.then((e) => n(e)) : n(t);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
  ((ln.create = (e, t) => new ln({ innerType: e, typeName: Y.ZodReadonly, ...N(t) })),
    V.lazycreate);
  var Y;
  (function (e) {
    ((e.ZodString = `ZodString`),
      (e.ZodNumber = `ZodNumber`),
      (e.ZodNaN = `ZodNaN`),
      (e.ZodBigInt = `ZodBigInt`),
      (e.ZodBoolean = `ZodBoolean`),
      (e.ZodDate = `ZodDate`),
      (e.ZodSymbol = `ZodSymbol`),
      (e.ZodUndefined = `ZodUndefined`),
      (e.ZodNull = `ZodNull`),
      (e.ZodAny = `ZodAny`),
      (e.ZodUnknown = `ZodUnknown`),
      (e.ZodNever = `ZodNever`),
      (e.ZodVoid = `ZodVoid`),
      (e.ZodArray = `ZodArray`),
      (e.ZodObject = `ZodObject`),
      (e.ZodUnion = `ZodUnion`),
      (e.ZodDiscriminatedUnion = `ZodDiscriminatedUnion`),
      (e.ZodIntersection = `ZodIntersection`),
      (e.ZodTuple = `ZodTuple`),
      (e.ZodRecord = `ZodRecord`),
      (e.ZodMap = `ZodMap`),
      (e.ZodSet = `ZodSet`),
      (e.ZodFunction = `ZodFunction`),
      (e.ZodLazy = `ZodLazy`),
      (e.ZodLiteral = `ZodLiteral`),
      (e.ZodEnum = `ZodEnum`),
      (e.ZodEffects = `ZodEffects`),
      (e.ZodNativeEnum = `ZodNativeEnum`),
      (e.ZodOptional = `ZodOptional`),
      (e.ZodNullable = `ZodNullable`),
      (e.ZodDefault = `ZodDefault`),
      (e.ZodCatch = `ZodCatch`),
      (e.ZodPromise = `ZodPromise`),
      (e.ZodBranded = `ZodBranded`),
      (e.ZodPipeline = `ZodPipeline`),
      (e.ZodReadonly = `ZodReadonly`));
  })((Y ||= {}));
  var X = It.create,
    Z = Rt.create;
  (on.create, zt.create);
  var un = Bt.create;
  (Vt.create, Ht.create, F.create, I.create, Ut.create);
  var dn = L.create;
  (R.create, Wt.create);
  var fn = z.create,
    Q = V.create;
  (V.strictCreate, H.create, Gt.create, qt.create, W.create);
  var pn = Jt.create;
  (Yt.create, Xt.create, Zt.create, Qt.create, $t.create);
  var $ = tn.create;
  (nn.create, G.create, K.create, q.create, J.create, K.createWithPreprocess, cn.create);
  let mn = $([`us-east`, `us-west`, `eu-west`, `eu-central`, `asia-pacific`]),
    hn = $([`healthy`, `warning`, `critical`, `offline`]),
    gn = Q({
      id: X().uuid(),
      name: X().min(1).max(100),
      ip: X().ip(),
      region: mn,
      status: hn,
      tags: fn(X()),
      createdAt: Z(),
      lastSeen: Z(),
    });
  Q({
    id: X(),
    serverId: X().uuid(),
    timestamp: Z(),
    cpu: Z().min(0).max(100),
    memory: Z().min(0).max(100),
    networkIn: Z().nonnegative(),
    networkOut: Z().nonnegative(),
    diskRead: Z().nonnegative(),
    diskWrite: Z().nonnegative(),
  });
  let _n = $([`debug`, `info`, `warn`, `error`, `critical`]);
  Q({
    id: X().uuid(),
    serverId: X().uuid(),
    timestamp: Z(),
    level: _n,
    message: X(),
    service: X().optional(),
    metadata: pn(dn()).optional(),
  });
  let vn = $([`cpu`, `memory`, `networkIn`, `networkOut`]),
    yn = $([`>`, `<`, `>=`, `<=`]),
    bn = Q({
      id: X().uuid(),
      name: X().min(1).max(100),
      serverId: X().uuid().nullable(),
      metric: vn,
      operator: yn,
      threshold: Z(),
      duration: Z().positive(),
      enabled: un(),
      createdAt: Z(),
    }),
    xn = $([`active`, `acknowledged`, `resolved`]);
  (Q({
    id: X().uuid(),
    alertId: X().uuid(),
    serverId: X().uuid(),
    status: xn,
    value: Z(),
    startedAt: Z(),
    resolvedAt: Z().nullable(),
  }),
    Q({ key: X(), value: dn() }));
  let Sn = gn.omit({ id: !0, createdAt: !0, lastSeen: !0 }),
    Cn = gn.partial().required({ id: !0 }),
    wn = bn.omit({ id: !0, createdAt: !0 }),
    Tn = bn.partial().required({ id: !0 }),
    En = Q({
      serverId: X().uuid().optional(),
      level: _n.optional(),
      search: X().optional(),
      startTime: Z().optional(),
      endTime: Z().optional(),
      limit: Z().min(1).max(1e3).default(100),
      offset: Z().min(0).default(0),
    }),
    Dn = Q({
      serverIds: fn(X().uuid()),
      startTime: Z(),
      endTime: Z(),
      resolution: $([`1m`, `5m`, `15m`, `1h`]).default(`1m`),
    });
  (Q({
    healthy: Z(),
    warning: Z(),
    critical: Z(),
    offline: Z(),
    activeIncidents: Z(),
    totalServers: Z(),
  }),
    Ee([
      g.get(`/api/servers`, async () => d(await (await v()).getAll(`servers`))),
      g.get(`/api/servers/:id`, async ({ params: e }) => {
        let t = await (await v()).get(`servers`, e.id);
        return t ? d(t) : p(`Server not found`, 404);
      }),
      g.post(`/api/servers`, async ({ request: e }) => {
        let t = await e.json(),
          n = Sn.safeParse(t);
        if (!n.success) return p(n.error.format(), 400);
        let r = Date.now(),
          i = { id: crypto.randomUUID(), ...n.data, createdAt: r, lastSeen: r };
        return (await (await v()).put(`servers`, i), d(i, { status: 201 }));
      }),
      g.patch(`/api/servers/:id`, async ({ params: e, request: t }) => {
        let n = await v(),
          r = await n.get(`servers`, e.id);
        if (!r) return p(`Server not found`, 404);
        let i = await t.json(),
          a = Cn.safeParse({ ...i, id: e.id });
        if (!a.success) return p(a.error.format(), 400);
        let o = { ...r, ...a.data };
        return (await n.put(`servers`, o), d(o));
      }),
      g.delete(
        `/api/servers/:id`,
        async ({ params: e }) => (await (await v()).delete(`servers`, e.id), f()),
      ),
      g.post(`/api/metrics/query`, async ({ request: e }) => {
        let t = await e.json(),
          n = Dn.safeParse(t);
        if (!n.success) return p(n.error.format(), 400);
        let { serverIds: r, startTime: i, endTime: a } = n.data,
          o = await v(),
          s = [];
        for (let e of r) {
          let t = IDBKeyRange.bound([e, i], [e, a]),
            n = await o.getAllFromIndex(`metrics`, `by-server-time`, t);
          s.push(...n);
        }
        return (s.sort((e, t) => e.timestamp - t.timestamp), d(s));
      }),
      g.get(`/api/metrics/latest`, async ({ request: e }) => {
        let t = new URL(e.url).searchParams.get(`serverIds`)?.split(`,`) ?? [],
          n = await v(),
          r = {};
        for (let e of t) {
          let t = IDBKeyRange.bound([e, 0], [e, Date.now()]);
          r[e] =
            (await n.transaction(`metrics`).store.index(`by-server-time`).openCursor(t, `prev`))
              ?.value ?? null;
        }
        return d(r);
      }),
      g.get(`/api/logs`, async ({ request: e }) => {
        let t = new URL(e.url),
          n = En.safeParse({
            serverId: t.searchParams.get(`serverId`) ?? void 0,
            level: t.searchParams.get(`level`) ?? void 0,
            search: t.searchParams.get(`search`) ?? void 0,
            startTime: t.searchParams.get(`startTime`)
              ? Number(t.searchParams.get(`startTime`))
              : void 0,
            endTime: t.searchParams.get(`endTime`) ? Number(t.searchParams.get(`endTime`)) : void 0,
            limit: t.searchParams.get(`limit`) ? Number(t.searchParams.get(`limit`)) : 100,
            offset: t.searchParams.get(`offset`) ? Number(t.searchParams.get(`offset`)) : 0,
          });
        if (!n.success) return p(n.error.format(), 400);
        let {
            serverId: r,
            level: i,
            search: a,
            startTime: o,
            endTime: s,
            limit: c,
            offset: l,
          } = n.data,
          u = await v(),
          f;
        if (r && o !== void 0 && s !== void 0) {
          let e = IDBKeyRange.bound([r, o], [r, s]);
          f = await u.getAllFromIndex(`logs`, `by-server-time`, e);
        } else if (o !== void 0 && s !== void 0) {
          let e = IDBKeyRange.bound(o, s);
          f = await u.getAllFromIndex(`logs`, `by-timestamp`, e);
        } else f = await u.getAll(`logs`);
        if (
          (r && !(o !== void 0 && s !== void 0) && (f = f.filter((e) => e.serverId === r)),
          i && (f = f.filter((e) => e.level === i)),
          a)
        ) {
          let e = a.toLowerCase();
          f = f.filter((t) => t.message.toLowerCase().includes(e));
        }
        f.sort((e, t) => t.timestamp - e.timestamp);
        let ee = f.length;
        return d({ logs: f.slice(l, l + c), total: ee, limit: c, offset: l });
      }),
      g.get(`/api/logs/:id`, async ({ params: e }) => {
        let t = await (await v()).get(`logs`, e.id);
        return t ? d(t) : p(`Log not found`, 404);
      }),
      g.get(`/api/alerts`, async () => d(await (await v()).getAll(`alerts`))),
      g.get(`/api/alerts/:id`, async ({ params: e }) => {
        let t = await (await v()).get(`alerts`, e.id);
        return t ? d(t) : p(`Alert not found`, 404);
      }),
      g.post(`/api/alerts`, async ({ request: e }) => {
        let t = await e.json(),
          n = wn.safeParse(t);
        if (!n.success) return p(n.error.format(), 400);
        let r = { id: crypto.randomUUID(), ...n.data, createdAt: Date.now() },
          i = bn.parse(r);
        return (await (await v()).put(`alerts`, i), d(i, { status: 201 }));
      }),
      g.patch(`/api/alerts/:id`, async ({ params: e, request: t }) => {
        let n = await v(),
          r = await n.get(`alerts`, e.id);
        if (!r) return p(`Alert not found`, 404);
        let i = await t.json(),
          a = Tn.safeParse({ ...i, id: e.id });
        if (!a.success) return p(a.error.format(), 400);
        let o = { ...r, ...a.data };
        return (await n.put(`alerts`, o), d(o));
      }),
      g.delete(
        `/api/alerts/:id`,
        async ({ params: e }) => (await (await v()).delete(`alerts`, e.id), f()),
      ),
      g.get(`/api/incidents`, async ({ request: e }) => {
        let t = new URL(e.url).searchParams.get(`status`),
          n = await (await v()).getAll(`incidents`);
        return (
          t && (n = n.filter((e) => e.status === t)),
          n.sort((e, t) => t.startedAt - e.startedAt),
          d(n)
        );
      }),
      g.post(`/api/incidents/:id/acknowledge`, async ({ params: e }) => {
        let t = await v(),
          n = await t.get(`incidents`, e.id);
        return n
          ? ((n.status = `acknowledged`), await t.put(`incidents`, n), d(n))
          : p(`Incident not found`, 404);
      }),
      g.post(`/api/incidents/:id/resolve`, async ({ params: e }) => {
        let t = await v(),
          n = await t.get(`incidents`, e.id);
        return n
          ? ((n.status = `resolved`),
            (n.resolvedAt = Date.now()),
            await t.put(`incidents`, n),
            d(n))
          : p(`Incident not found`, 404);
      }),
      g.get(`/api/stats`, async () => {
        let e = await v(),
          t = await e.getAll(`servers`),
          n = await e.getAllFromIndex(`incidents`, `by-status`, `active`);
        return d({
          healthy: t.filter((e) => e.status === `healthy`).length,
          warning: t.filter((e) => e.status === `warning`).length,
          critical: t.filter((e) => e.status === `critical`).length,
          offline: t.filter((e) => e.status === `offline`).length,
          activeIncidents: n.length,
          totalServers: t.length,
        });
      }),
      g.post(
        `/api/simulation/record-time`,
        async () => (await rt(Date.now()), d({ recorded: Date.now() })),
      ),
    ]));
})();
