function e() {}
function t(e) {
  return (typeof e == `object` && !!e) || typeof e == `function`;
}
var n = e;
function r(e, t) {
  try {
    Object.defineProperty(e, `name`, { value: t, configurable: !0 });
  } catch {}
}
var i = Promise,
  a = Promise.resolve.bind(i),
  o = Promise.prototype.then,
  s = Promise.reject.bind(i),
  c = a;
function l(e) {
  return new i(e);
}
function u(e) {
  return l((t) => t(e));
}
function d(e) {
  return s(e);
}
function f(e, t, n) {
  return o.call(e, t, n);
}
function p(e, t, r) {
  f(f(e, t, r), void 0, n);
}
function m(e, t) {
  p(e, t);
}
function ee(e, t) {
  p(e, void 0, t);
}
function h(e, t, n) {
  return f(e, t, n);
}
function g(e) {
  f(e, void 0, n);
}
var _ = (e) => {
  if (typeof queueMicrotask == `function`) _ = queueMicrotask;
  else {
    let e = u(void 0);
    _ = (t) => f(e, t);
  }
  return _(e);
};
function v(e, t, n) {
  if (typeof e != `function`) throw TypeError(`Argument is not a function`);
  return Function.prototype.apply.call(e, t, n);
}
function y(e, t, n) {
  try {
    return u(v(e, t, n));
  } catch (e) {
    return d(e);
  }
}
var b = class {
    constructor() {
      ((this._cursor = 0),
        (this._size = 0),
        (this._front = { _elements: [], _next: void 0 }),
        (this._back = this._front),
        (this._cursor = 0),
        (this._size = 0));
    }
    get length() {
      return this._size;
    }
    push(e) {
      let t = this._back,
        n = t;
      (t._elements.length === 16383 && (n = { _elements: [], _next: void 0 }),
        t._elements.push(e),
        n !== t && ((this._back = n), (t._next = n)),
        ++this._size);
    }
    shift() {
      let e = this._front,
        t = e,
        n = this._cursor,
        r = n + 1,
        i = e._elements,
        a = i[n];
      return (
        r === 16384 && ((t = e._next), (r = 0)),
        --this._size,
        (this._cursor = r),
        e !== t && (this._front = t),
        (i[n] = void 0),
        a
      );
    }
    forEach(e) {
      let t = this._cursor,
        n = this._front,
        r = n._elements;
      for (
        ;
        !(
          (t === r.length && n._next === void 0) ||
          (t === r.length && ((n = n._next), (r = n._elements), (t = 0), r.length === 0))
        );
      )
        (e(r[t]), ++t);
    }
    peek() {
      let e = this._front,
        t = this._cursor;
      return e._elements[t];
    }
  },
  te = Symbol(`[[AbortSteps]]`),
  ne = Symbol(`[[ErrorSteps]]`),
  x = Symbol(`[[CancelSteps]]`),
  re = Symbol(`[[PullSteps]]`),
  ie = Symbol(`[[ReleaseSteps]]`);
function S(e, t) {
  ((e._ownerReadableStream = t),
    (t._reader = e),
    t._state === `readable`
      ? ae(e)
      : t._state === `closed`
        ? (function (e) {
            (ae(e), ce(e));
          })(e)
        : oe(e, t._storedError));
}
function C(e, t) {
  return Z(e._ownerReadableStream, t);
}
function w(e) {
  let t = e._ownerReadableStream;
  (t._state === `readable`
    ? se(
        e,
        TypeError(
          `Reader was released and can no longer be used to monitor the stream's closedness`,
        ),
      )
    : (function (e, t) {
        oe(e, t);
      })(
        e,
        TypeError(
          `Reader was released and can no longer be used to monitor the stream's closedness`,
        ),
      ),
    t._readableStreamController[ie](),
    (t._reader = void 0),
    (e._ownerReadableStream = void 0));
}
function T(e) {
  return TypeError(`Cannot ` + e + ` a stream using a released reader`);
}
function ae(e) {
  e._closedPromise = l((t, n) => {
    ((e._closedPromise_resolve = t), (e._closedPromise_reject = n));
  });
}
function oe(e, t) {
  (ae(e), se(e, t));
}
function se(e, t) {
  e._closedPromise_reject !== void 0 &&
    (g(e._closedPromise),
    e._closedPromise_reject(t),
    (e._closedPromise_resolve = void 0),
    (e._closedPromise_reject = void 0));
}
function ce(e) {
  e._closedPromise_resolve !== void 0 &&
    (e._closedPromise_resolve(void 0),
    (e._closedPromise_resolve = void 0),
    (e._closedPromise_reject = void 0));
}
var le =
    Number.isFinite ||
    function (e) {
      return typeof e == `number` && isFinite(e);
    },
  ue =
    Math.trunc ||
    function (e) {
      return e < 0 ? Math.ceil(e) : Math.floor(e);
    };
function E(e, t) {
  if (e !== void 0 && typeof (n = e) != `object` && typeof n != `function`)
    throw TypeError(`${t} is not an object.`);
  var n;
}
function D(e, t) {
  if (typeof e != `function`) throw TypeError(`${t} is not a function.`);
}
function de(e, t) {
  if (
    !(function (e) {
      return (typeof e == `object` && !!e) || typeof e == `function`;
    })(e)
  )
    throw TypeError(`${t} is not an object.`);
}
function O(e, t, n) {
  if (e === void 0) throw TypeError(`Parameter ${t} is required in '${n}'.`);
}
function fe(e, t, n) {
  if (e === void 0) throw TypeError(`${t} is required in '${n}'.`);
}
function pe(e) {
  return Number(e);
}
function me(e) {
  return e === 0 ? 0 : e;
}
function he(e, t) {
  let n = 2 ** 53 - 1,
    r = Number(e);
  if (((r = me(r)), !le(r))) throw TypeError(`${t} is not a finite number`);
  if (
    ((r = (function (e) {
      return me(ue(e));
    })(r)),
    r < 0 || r > n)
  )
    throw TypeError(`${t} is outside the accepted range of 0 to ${n}, inclusive`);
  return le(r) && r !== 0 ? r : 0;
}
function ge(e, t) {
  if (!Y(e)) throw TypeError(`${t} is not a ReadableStream.`);
}
function _e(e) {
  return new k(e);
}
function ve(e, t) {
  e._reader._readRequests.push(t);
}
function ye(e, t, n) {
  let r = e._reader._readRequests.shift();
  n ? r._closeSteps() : r._chunkSteps(t);
}
function be(e) {
  return e._reader._readRequests.length;
}
function xe(e) {
  let t = e._reader;
  return t !== void 0 && !!A(t);
}
var k = class {
  constructor(e) {
    if ((O(e, 1, `ReadableStreamDefaultReader`), ge(e, `First parameter`), X(e)))
      throw TypeError(
        `This stream has already been locked for exclusive reading by another reader`,
      );
    (S(this, e), (this._readRequests = new b()));
  }
  get closed() {
    return A(this) ? this._closedPromise : d(we(`closed`));
  }
  cancel(e = void 0) {
    return A(this)
      ? this._ownerReadableStream === void 0
        ? d(T(`cancel`))
        : C(this, e)
      : d(we(`cancel`));
  }
  read() {
    if (!A(this)) return d(we(`read`));
    if (this._ownerReadableStream === void 0) return d(T(`read from`));
    let e,
      t,
      n = l((n, r) => {
        ((e = n), (t = r));
      });
    return (
      Se(this, {
        _chunkSteps: (t) => e({ value: t, done: !1 }),
        _closeSteps: () => e({ value: void 0, done: !0 }),
        _errorSteps: (e) => t(e),
      }),
      n
    );
  }
  releaseLock() {
    if (!A(this)) throw we(`releaseLock`);
    this._ownerReadableStream !== void 0 &&
      (function (e) {
        (w(e), Ce(e, TypeError(`Reader was released`)));
      })(this);
  }
};
function A(e) {
  return !!t(e) && !!Object.prototype.hasOwnProperty.call(e, `_readRequests`) && e instanceof k;
}
function Se(e, t) {
  let n = e._ownerReadableStream;
  ((n._disturbed = !0),
    n._state === `closed`
      ? t._closeSteps()
      : n._state === `errored`
        ? t._errorSteps(n._storedError)
        : n._readableStreamController[re](t));
}
function Ce(e, t) {
  let n = e._readRequests;
  ((e._readRequests = new b()),
    n.forEach((e) => {
      e._errorSteps(t);
    }));
}
function we(e) {
  return TypeError(
    `ReadableStreamDefaultReader.prototype.${e} can only be used on a ReadableStreamDefaultReader`,
  );
}
function Te(e) {
  return e.slice();
}
function Ee(e, t, n, r, i) {
  new Uint8Array(e).set(new Uint8Array(n, r, i), t);
}
(Object.defineProperties(k.prototype, {
  cancel: { enumerable: !0 },
  read: { enumerable: !0 },
  releaseLock: { enumerable: !0 },
  closed: { enumerable: !0 },
}),
  r(k.prototype.cancel, `cancel`),
  r(k.prototype.read, `read`),
  r(k.prototype.releaseLock, `releaseLock`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(k.prototype, Symbol.toStringTag, {
      value: `ReadableStreamDefaultReader`,
      configurable: !0,
    }));
var j = (e) => (
    (j =
      typeof e.transfer == `function`
        ? (e) => e.transfer()
        : typeof structuredClone == `function`
          ? (e) => structuredClone(e, { transfer: [e] })
          : (e) => e),
    j(e)
  ),
  M = (e) => (
    (M = typeof e.detached == `boolean` ? (e) => e.detached : (e) => e.byteLength === 0), M(e)
  );
function De(e, t, n) {
  if (e.slice) return e.slice(t, n);
  let r = n - t,
    i = new ArrayBuffer(r);
  return (Ee(i, 0, e, t, r), i);
}
function Oe(e, t) {
  let n = e[t];
  if (n != null) {
    if (typeof n != `function`) throw TypeError(`${String(t)} is not a function`);
    return n;
  }
}
function ke(e) {
  try {
    let t = e.done,
      n = e.value;
    return f(c(n), (e) => ({ done: t, value: e }));
  } catch (e) {
    return d(e);
  }
}
var Ae =
  Symbol.asyncIterator ?? Symbol.for?.call(Symbol, `Symbol.asyncIterator`) ?? `@@asyncIterator`;
function je(e, n = `sync`, r) {
  if (r === void 0)
    if (n === `async`) {
      if ((r = Oe(e, Ae)) === void 0)
        return (function (e) {
          let n = {
            next() {
              let t;
              try {
                t = Me(e);
              } catch (e) {
                return d(e);
              }
              return ke(t);
            },
            return(n) {
              let r;
              try {
                let t = Oe(e.iterator, `return`);
                if (t === void 0) return u({ done: !0, value: n });
                r = v(t, e.iterator, [n]);
              } catch (e) {
                return d(e);
              }
              return t(r)
                ? ke(r)
                : d(TypeError(`The iterator.return() method must return an object`));
            },
          };
          return { iterator: n, nextMethod: n.next, done: !1 };
        })(je(e, `sync`, Oe(e, Symbol.iterator)));
    } else r = Oe(e, Symbol.iterator);
  if (r === void 0) throw TypeError(`The object is not iterable`);
  let i = v(r, e, []);
  if (!t(i)) throw TypeError(`The iterator method must return an object`);
  return { iterator: i, nextMethod: i.next, done: !1 };
}
function Me(e) {
  let n = v(e.nextMethod, e.iterator, []);
  if (!t(n)) throw TypeError(`The iterator.next() method must return an object`);
  return n;
}
var Ne = class {
    constructor(e, t) {
      ((this._ongoingPromise = void 0),
        (this._isFinished = !1),
        (this._reader = e),
        (this._preventCancel = t));
    }
    next() {
      let e = () => this._nextSteps();
      return (
        (this._ongoingPromise = this._ongoingPromise ? h(this._ongoingPromise, e, e) : e()),
        this._ongoingPromise
      );
    }
    return(e) {
      let t = () => this._returnSteps(e);
      return (
        (this._ongoingPromise = this._ongoingPromise ? h(this._ongoingPromise, t, t) : t()),
        this._ongoingPromise
      );
    }
    _nextSteps() {
      if (this._isFinished) return Promise.resolve({ value: void 0, done: !0 });
      let e = this._reader,
        t,
        n,
        r = l((e, r) => {
          ((t = e), (n = r));
        });
      return (
        Se(e, {
          _chunkSteps: (e) => {
            ((this._ongoingPromise = void 0), _(() => t({ value: e, done: !1 })));
          },
          _closeSteps: () => {
            ((this._ongoingPromise = void 0),
              (this._isFinished = !0),
              w(e),
              t({ value: void 0, done: !0 }));
          },
          _errorSteps: (t) => {
            ((this._ongoingPromise = void 0), (this._isFinished = !0), w(e), n(t));
          },
        }),
        r
      );
    }
    _returnSteps(e) {
      if (this._isFinished) return Promise.resolve({ value: e, done: !0 });
      this._isFinished = !0;
      let t = this._reader;
      if (!this._preventCancel) {
        let n = C(t, e);
        return (w(t), h(n, () => ({ value: e, done: !0 })));
      }
      return (w(t), u({ value: e, done: !0 }));
    }
  },
  Pe = {
    next() {
      return Fe(this) ? this._asyncIteratorImpl.next() : d(Ie(`next`));
    },
    return(e) {
      return Fe(this) ? this._asyncIteratorImpl.return(e) : d(Ie(`return`));
    },
    [Ae]() {
      return this;
    },
  };
function Fe(e) {
  if (!t(e) || !Object.prototype.hasOwnProperty.call(e, `_asyncIteratorImpl`)) return !1;
  try {
    return e._asyncIteratorImpl instanceof Ne;
  } catch {
    return !1;
  }
}
function Ie(e) {
  return TypeError(
    `ReadableStreamAsyncIterator.${e} can only be used on a ReadableSteamAsyncIterator`,
  );
}
Object.defineProperty(Pe, Ae, { enumerable: !1 });
var Le =
  Number.isNaN ||
  function (e) {
    return e != e;
  };
function Re(e) {
  let t = De(e.buffer, e.byteOffset, e.byteOffset + e.byteLength);
  return new Uint8Array(t);
}
function ze(e) {
  let t = e._queue.shift();
  return ((e._queueTotalSize -= t.size), e._queueTotalSize < 0 && (e._queueTotalSize = 0), t.value);
}
function Be(e, t, n) {
  if (typeof (r = n) != `number` || Le(r) || r < 0 || n === 1 / 0)
    throw RangeError(`Size must be a finite, non-NaN, non-negative number.`);
  var r;
  (e._queue.push({ value: t, size: n }), (e._queueTotalSize += n));
}
function N(e) {
  ((e._queue = new b()), (e._queueTotalSize = 0));
}
function Ve(e) {
  return e === DataView;
}
var He = class {
  constructor() {
    throw TypeError(`Illegal constructor`);
  }
  get view() {
    if (!Ue(this)) throw mt(`view`);
    return this._view;
  }
  respond(e) {
    if (!Ue(this)) throw mt(`respond`);
    if (
      (O(e, 1, `respond`),
      (e = he(e, `First parameter`)),
      this._associatedReadableByteStreamController === void 0)
    )
      throw TypeError(`This BYOB request has been invalidated`);
    if (M(this._view.buffer))
      throw TypeError(
        `The BYOB request's buffer has been detached and so cannot be used as a response`,
      );
    dt(this._associatedReadableByteStreamController, e);
  }
  respondWithNewView(e) {
    if (!Ue(this)) throw mt(`respondWithNewView`);
    if ((O(e, 1, `respondWithNewView`), !ArrayBuffer.isView(e)))
      throw TypeError(`You can only respond with array buffer views`);
    if (this._associatedReadableByteStreamController === void 0)
      throw TypeError(`This BYOB request has been invalidated`);
    if (M(e.buffer))
      throw TypeError(
        `The given view's buffer has been detached and so cannot be used as a response`,
      );
    ft(this._associatedReadableByteStreamController, e);
  }
};
(Object.defineProperties(He.prototype, {
  respond: { enumerable: !0 },
  respondWithNewView: { enumerable: !0 },
  view: { enumerable: !0 },
}),
  r(He.prototype.respond, `respond`),
  r(He.prototype.respondWithNewView, `respondWithNewView`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(He.prototype, Symbol.toStringTag, {
      value: `ReadableStreamBYOBRequest`,
      configurable: !0,
    }));
var P = class {
  constructor() {
    throw TypeError(`Illegal constructor`);
  }
  get byobRequest() {
    if (!F(this)) throw ht(`byobRequest`);
    return lt(this);
  }
  get desiredSize() {
    if (!F(this)) throw ht(`desiredSize`);
    return ut(this);
  }
  close() {
    if (!F(this)) throw ht(`close`);
    if (this._closeRequested)
      throw TypeError(`The stream has already been closed; do not close it again!`);
    let e = this._controlledReadableByteStream._state;
    if (e !== `readable`)
      throw TypeError(
        `The stream (in ${e} state) is not in the readable state and cannot be closed`,
      );
    ot(this);
  }
  enqueue(e) {
    if (!F(this)) throw ht(`enqueue`);
    if ((O(e, 1, `enqueue`), !ArrayBuffer.isView(e)))
      throw TypeError(`chunk must be an array buffer view`);
    if (e.byteLength === 0) throw TypeError(`chunk must have non-zero byteLength`);
    if (e.buffer.byteLength === 0) throw TypeError(`chunk's buffer must have non-zero byteLength`);
    if (this._closeRequested) throw TypeError(`stream is closed or draining`);
    let t = this._controlledReadableByteStream._state;
    if (t !== `readable`)
      throw TypeError(
        `The stream (in ${t} state) is not in the readable state and cannot be enqueued to`,
      );
    st(this, e);
  }
  error(e = void 0) {
    if (!F(this)) throw ht(`error`);
    L(this, e);
  }
  [x](e) {
    (We(this), N(this));
    let t = this._cancelAlgorithm(e);
    return (at(this), t);
  }
  [re](e) {
    let t = this._controlledReadableByteStream;
    if (this._queueTotalSize > 0) return void ct(this, e);
    let n = this._autoAllocateChunkSize;
    if (n !== void 0) {
      let t;
      try {
        t = new ArrayBuffer(n);
      } catch (t) {
        e._errorSteps(t);
        return;
      }
      let r = {
        buffer: t,
        bufferByteLength: n,
        byteOffset: 0,
        byteLength: n,
        bytesFilled: 0,
        minimumFill: 1,
        elementSize: 1,
        viewConstructor: Uint8Array,
        readerType: `default`,
      };
      this._pendingPullIntos.push(r);
    }
    (ve(t, e), I(this));
  }
  [ie]() {
    if (this._pendingPullIntos.length > 0) {
      let e = this._pendingPullIntos.peek();
      ((e.readerType = `none`), (this._pendingPullIntos = new b()), this._pendingPullIntos.push(e));
    }
  }
};
function F(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_controlledReadableByteStream`) &&
    e instanceof P
  );
}
function Ue(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_associatedReadableByteStreamController`) &&
    e instanceof He
  );
}
function I(e) {
  if (
    (function (e) {
      let t = e._controlledReadableByteStream;
      return t._state !== `readable` || e._closeRequested || !e._started
        ? !1
        : !!((xe(t) && be(t) > 0) || (bt(t) && yt(t) > 0) || ut(e) > 0);
    })(e)
  ) {
    if (e._pulling) return void (e._pullAgain = !0);
    ((e._pulling = !0),
      p(
        e._pullAlgorithm(),
        () => ((e._pulling = !1), e._pullAgain && ((e._pullAgain = !1), I(e)), null),
        (t) => (L(e, t), null),
      ));
  }
}
function We(e) {
  (et(e), (e._pendingPullIntos = new b()));
}
function Ge(e, t) {
  let n = !1;
  e._state === `closed` && (n = !0);
  let r = qe(t);
  t.readerType === `default`
    ? ye(e, r, n)
    : (function (e, t, n) {
        let r = e._reader._readIntoRequests.shift();
        n ? r._closeSteps(t) : r._chunkSteps(t);
      })(e, r, n);
}
function Ke(e, t) {
  for (let n = 0; n < t.length; ++n) Ge(e, t[n]);
}
function qe(e) {
  let t = e.bytesFilled,
    n = e.elementSize;
  return new e.viewConstructor(e.buffer, e.byteOffset, t / n);
}
function Je(e, t, n, r) {
  (e._queue.push({ buffer: t, byteOffset: n, byteLength: r }), (e._queueTotalSize += r));
}
function Ye(e, t, n, r) {
  let i;
  try {
    i = De(t, n, n + r);
  } catch (t) {
    throw (L(e, t), t);
  }
  Je(e, i, 0, r);
}
function Xe(e, t) {
  (t.bytesFilled > 0 && Ye(e, t.buffer, t.byteOffset, t.bytesFilled), it(e));
}
function Ze(e, t) {
  let n = Math.min(e._queueTotalSize, t.byteLength - t.bytesFilled),
    r = t.bytesFilled + n,
    i = n,
    a = !1,
    o = r - (r % t.elementSize);
  o >= t.minimumFill && ((i = o - t.bytesFilled), (a = !0));
  let s = e._queue;
  for (; i > 0; ) {
    let n = s.peek(),
      r = Math.min(i, n.byteLength),
      a = t.byteOffset + t.bytesFilled;
    (Ee(t.buffer, a, n.buffer, n.byteOffset, r),
      n.byteLength === r ? s.shift() : ((n.byteOffset += r), (n.byteLength -= r)),
      (e._queueTotalSize -= r),
      Qe(e, r, t),
      (i -= r));
  }
  return a;
}
function Qe(e, t, n) {
  n.bytesFilled += t;
}
function $e(e) {
  e._queueTotalSize === 0 && e._closeRequested
    ? (at(e), Bn(e._controlledReadableByteStream))
    : I(e);
}
function et(e) {
  e._byobRequest !== null &&
    ((e._byobRequest._associatedReadableByteStreamController = void 0),
    (e._byobRequest._view = null),
    (e._byobRequest = null));
}
function tt(e) {
  let t = [];
  for (; e._pendingPullIntos.length > 0 && e._queueTotalSize !== 0; ) {
    let n = e._pendingPullIntos.peek();
    Ze(e, n) && (it(e), t.push(n));
  }
  return t;
}
function nt(e, t, n, r) {
  let i = e._controlledReadableByteStream,
    a = t.constructor,
    o = (function (e) {
      return Ve(e) ? 1 : e.BYTES_PER_ELEMENT;
    })(a),
    { byteOffset: s, byteLength: c } = t,
    l = n * o,
    u;
  try {
    u = j(t.buffer);
  } catch (e) {
    r._errorSteps(e);
    return;
  }
  let d = {
    buffer: u,
    bufferByteLength: u.byteLength,
    byteOffset: s,
    byteLength: c,
    bytesFilled: 0,
    minimumFill: l,
    elementSize: o,
    viewConstructor: a,
    readerType: `byob`,
  };
  if (e._pendingPullIntos.length > 0) return (e._pendingPullIntos.push(d), void vt(i, r));
  if (i._state === `closed`) {
    let e = new a(d.buffer, d.byteOffset, 0);
    r._closeSteps(e);
    return;
  }
  if (e._queueTotalSize > 0) {
    if (Ze(e, d)) {
      let t = qe(d);
      ($e(e), r._chunkSteps(t));
      return;
    }
    if (e._closeRequested) {
      let t = TypeError(`Insufficient bytes to fill elements in the given buffer`);
      (L(e, t), r._errorSteps(t));
      return;
    }
  }
  (e._pendingPullIntos.push(d), vt(i, r), I(e));
}
function rt(e, t) {
  let n = e._pendingPullIntos.peek();
  (et(e),
    e._controlledReadableByteStream._state === `closed`
      ? (function (e, t) {
          t.readerType === `none` && it(e);
          let n = e._controlledReadableByteStream;
          if (bt(n)) {
            let t = [];
            for (; t.length < yt(n); ) t.push(it(e));
            Ke(n, t);
          }
        })(e, n)
      : (function (e, t, n) {
          if ((Qe(0, t, n), n.readerType === `none`)) {
            Xe(e, n);
            let t = tt(e);
            Ke(e._controlledReadableByteStream, t);
            return;
          }
          if (n.bytesFilled < n.minimumFill) return;
          it(e);
          let r = n.bytesFilled % n.elementSize;
          if (r > 0) {
            let t = n.byteOffset + n.bytesFilled;
            Ye(e, n.buffer, t - r, r);
          }
          n.bytesFilled -= r;
          let i = tt(e);
          (Ge(e._controlledReadableByteStream, n), Ke(e._controlledReadableByteStream, i));
        })(e, t, n),
    I(e));
}
function it(e) {
  return e._pendingPullIntos.shift();
}
function at(e) {
  ((e._pullAlgorithm = void 0), (e._cancelAlgorithm = void 0));
}
function ot(e) {
  let t = e._controlledReadableByteStream;
  if (!e._closeRequested && t._state === `readable`)
    if (e._queueTotalSize > 0) e._closeRequested = !0;
    else {
      if (e._pendingPullIntos.length > 0) {
        let t = e._pendingPullIntos.peek();
        if (t.bytesFilled % t.elementSize !== 0) {
          let t = TypeError(`Insufficient bytes to fill elements in the given buffer`);
          throw (L(e, t), t);
        }
      }
      (at(e), Bn(t));
    }
}
function st(e, t) {
  let n = e._controlledReadableByteStream;
  if (e._closeRequested || n._state !== `readable`) return;
  let { buffer: r, byteOffset: i, byteLength: a } = t;
  if (M(r)) throw TypeError(`chunk's buffer is detached and so cannot be enqueued`);
  let o = j(r);
  if (e._pendingPullIntos.length > 0) {
    let t = e._pendingPullIntos.peek();
    if (M(t.buffer))
      throw TypeError(
        `The BYOB request's buffer has been detached and so cannot be filled with an enqueued chunk`,
      );
    (et(e), (t.buffer = j(t.buffer)), t.readerType === `none` && Xe(e, t));
  }
  (xe(n)
    ? ((function (e) {
        let t = e._controlledReadableByteStream._reader;
        for (; t._readRequests.length > 0; ) {
          if (e._queueTotalSize === 0) return;
          ct(e, t._readRequests.shift());
        }
      })(e),
      be(n) === 0
        ? Je(e, o, i, a)
        : (e._pendingPullIntos.length > 0 && it(e), ye(n, new Uint8Array(o, i, a), !1)))
    : bt(n)
      ? (Je(e, o, i, a), Ke(n, tt(e)))
      : Je(e, o, i, a),
    I(e));
}
function L(e, t) {
  let n = e._controlledReadableByteStream;
  n._state === `readable` && (We(e), N(e), at(e), Vn(n, t));
}
function ct(e, t) {
  let n = e._queue.shift();
  ((e._queueTotalSize -= n.byteLength), $e(e));
  let r = new Uint8Array(n.buffer, n.byteOffset, n.byteLength);
  t._chunkSteps(r);
}
function lt(e) {
  if (e._byobRequest === null && e._pendingPullIntos.length > 0) {
    let t = e._pendingPullIntos.peek(),
      n = new Uint8Array(t.buffer, t.byteOffset + t.bytesFilled, t.byteLength - t.bytesFilled),
      r = Object.create(He.prototype);
    ((function (e, t, n) {
      ((e._associatedReadableByteStreamController = t), (e._view = n));
    })(r, e, n),
      (e._byobRequest = r));
  }
  return e._byobRequest;
}
function ut(e) {
  let t = e._controlledReadableByteStream._state;
  return t === `errored` ? null : t === `closed` ? 0 : e._strategyHWM - e._queueTotalSize;
}
function dt(e, t) {
  let n = e._pendingPullIntos.peek();
  if (e._controlledReadableByteStream._state === `closed`) {
    if (t !== 0)
      throw TypeError(`bytesWritten must be 0 when calling respond() on a closed stream`);
  } else {
    if (t === 0)
      throw TypeError(
        `bytesWritten must be greater than 0 when calling respond() on a readable stream`,
      );
    if (n.bytesFilled + t > n.byteLength) throw RangeError(`bytesWritten out of range`);
  }
  ((n.buffer = j(n.buffer)), rt(e, t));
}
function ft(e, t) {
  let n = e._pendingPullIntos.peek();
  if (e._controlledReadableByteStream._state === `closed`) {
    if (t.byteLength !== 0)
      throw TypeError(
        `The view's length must be 0 when calling respondWithNewView() on a closed stream`,
      );
  } else if (t.byteLength === 0)
    throw TypeError(
      `The view's length must be greater than 0 when calling respondWithNewView() on a readable stream`,
    );
  if (n.byteOffset + n.bytesFilled !== t.byteOffset)
    throw RangeError(`The region specified by view does not match byobRequest`);
  if (n.bufferByteLength !== t.buffer.byteLength)
    throw RangeError(`The buffer of view has different capacity than byobRequest`);
  if (n.bytesFilled + t.byteLength > n.byteLength)
    throw RangeError(`The region specified by view is larger than byobRequest`);
  let r = t.byteLength;
  ((n.buffer = j(t.buffer)), rt(e, r));
}
function pt(e, t, n, r, i, a, o) {
  ((t._controlledReadableByteStream = e),
    (t._pullAgain = !1),
    (t._pulling = !1),
    (t._byobRequest = null),
    (t._queue = t._queueTotalSize = void 0),
    N(t),
    (t._closeRequested = !1),
    (t._started = !1),
    (t._strategyHWM = a),
    (t._pullAlgorithm = r),
    (t._cancelAlgorithm = i),
    (t._autoAllocateChunkSize = o),
    (t._pendingPullIntos = new b()),
    (e._readableStreamController = t),
    p(
      u(n()),
      () => ((t._started = !0), I(t), null),
      (e) => (L(t, e), null),
    ));
}
function mt(e) {
  return TypeError(
    `ReadableStreamBYOBRequest.prototype.${e} can only be used on a ReadableStreamBYOBRequest`,
  );
}
function ht(e) {
  return TypeError(
    `ReadableByteStreamController.prototype.${e} can only be used on a ReadableByteStreamController`,
  );
}
function gt(e, t) {
  if ((e = `${e}`) != `byob`)
    throw TypeError(`${t} '${e}' is not a valid enumeration value for ReadableStreamReaderMode`);
  return e;
}
function _t(e) {
  return new R(e);
}
function vt(e, t) {
  e._reader._readIntoRequests.push(t);
}
function yt(e) {
  return e._reader._readIntoRequests.length;
}
function bt(e) {
  let t = e._reader;
  return t !== void 0 && !!z(t);
}
(Object.defineProperties(P.prototype, {
  close: { enumerable: !0 },
  enqueue: { enumerable: !0 },
  error: { enumerable: !0 },
  byobRequest: { enumerable: !0 },
  desiredSize: { enumerable: !0 },
}),
  r(P.prototype.close, `close`),
  r(P.prototype.enqueue, `enqueue`),
  r(P.prototype.error, `error`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(P.prototype, Symbol.toStringTag, {
      value: `ReadableByteStreamController`,
      configurable: !0,
    }));
var R = class {
  constructor(e) {
    if ((O(e, 1, `ReadableStreamBYOBReader`), ge(e, `First parameter`), X(e)))
      throw TypeError(
        `This stream has already been locked for exclusive reading by another reader`,
      );
    if (!F(e._readableStreamController))
      throw TypeError(
        `Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source`,
      );
    (S(this, e), (this._readIntoRequests = new b()));
  }
  get closed() {
    return z(this) ? this._closedPromise : d(Ct(`closed`));
  }
  cancel(e = void 0) {
    return z(this)
      ? this._ownerReadableStream === void 0
        ? d(T(`cancel`))
        : C(this, e)
      : d(Ct(`cancel`));
  }
  read(e, t = {}) {
    if (!z(this)) return d(Ct(`read`));
    if (!ArrayBuffer.isView(e)) return d(TypeError(`view must be an array buffer view`));
    if (e.byteLength === 0) return d(TypeError(`view must have non-zero byteLength`));
    if (e.buffer.byteLength === 0)
      return d(TypeError(`view's buffer must have non-zero byteLength`));
    if (M(e.buffer)) return d(TypeError(`view's buffer has been detached`));
    let n;
    try {
      n = (function (e, t) {
        return (E(e, t), { min: he(e?.min ?? 1, `${t} has member 'min' that`) });
      })(t, `options`);
    } catch (e) {
      return d(e);
    }
    let r = n.min;
    if (r === 0) return d(TypeError(`options.min must be greater than 0`));
    if (
      (function (e) {
        return Ve(e.constructor);
      })(e)
    ) {
      if (r > e.byteLength)
        return d(RangeError(`options.min must be less than or equal to view's byteLength`));
    } else if (r > e.length)
      return d(RangeError(`options.min must be less than or equal to view's length`));
    if (this._ownerReadableStream === void 0) return d(T(`read from`));
    let i,
      a,
      o = l((e, t) => {
        ((i = e), (a = t));
      });
    return (
      xt(this, e, r, {
        _chunkSteps: (e) => i({ value: e, done: !1 }),
        _closeSteps: (e) => i({ value: e, done: !0 }),
        _errorSteps: (e) => a(e),
      }),
      o
    );
  }
  releaseLock() {
    if (!z(this)) throw Ct(`releaseLock`);
    this._ownerReadableStream !== void 0 &&
      (function (e) {
        (w(e), St(e, TypeError(`Reader was released`)));
      })(this);
  }
};
function z(e) {
  return !!t(e) && !!Object.prototype.hasOwnProperty.call(e, `_readIntoRequests`) && e instanceof R;
}
function xt(e, t, n, r) {
  let i = e._ownerReadableStream;
  ((i._disturbed = !0),
    i._state === `errored`
      ? r._errorSteps(i._storedError)
      : nt(i._readableStreamController, t, n, r));
}
function St(e, t) {
  let n = e._readIntoRequests;
  ((e._readIntoRequests = new b()),
    n.forEach((e) => {
      e._errorSteps(t);
    }));
}
function Ct(e) {
  return TypeError(
    `ReadableStreamBYOBReader.prototype.${e} can only be used on a ReadableStreamBYOBReader`,
  );
}
function wt(e, t) {
  let { highWaterMark: n } = e;
  if (n === void 0) return t;
  if (Le(n) || n < 0) throw RangeError(`Invalid highWaterMark`);
  return n;
}
function Tt(e) {
  let { size: t } = e;
  return t || (() => 1);
}
function Et(e, t) {
  E(e, t);
  let n = e?.highWaterMark,
    r = e?.size;
  return {
    highWaterMark: n === void 0 ? void 0 : pe(n),
    size: r === void 0 ? void 0 : Dt(r, `${t} has member 'size' that`),
  };
}
function Dt(e, t) {
  return (D(e, t), (t) => pe(e(t)));
}
function Ot(e, t, n) {
  return (D(e, n), (n) => y(e, t, [n]));
}
function kt(e, t, n) {
  return (D(e, n), () => y(e, t, []));
}
function At(e, t, n) {
  return (D(e, n), (n) => v(e, t, [n]));
}
function jt(e, t, n) {
  return (D(e, n), (n, r) => y(e, t, [n, r]));
}
function Mt(e, t) {
  if (!Ft(e)) throw TypeError(`${t} is not a WritableStream.`);
}
(Object.defineProperties(R.prototype, {
  cancel: { enumerable: !0 },
  read: { enumerable: !0 },
  releaseLock: { enumerable: !0 },
  closed: { enumerable: !0 },
}),
  r(R.prototype.cancel, `cancel`),
  r(R.prototype.read, `read`),
  r(R.prototype.releaseLock, `releaseLock`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(R.prototype, Symbol.toStringTag, {
      value: `ReadableStreamBYOBReader`,
      configurable: !0,
    }));
var B = class {
  constructor(e = {}, t = {}) {
    e === void 0 ? (e = null) : de(e, `First parameter`);
    let n = Et(t, `Second parameter`),
      r = (function (e, t) {
        E(e, t);
        let n = e?.abort,
          r = e?.close,
          i = e?.start,
          a = e?.type,
          o = e?.write;
        return {
          abort: n === void 0 ? void 0 : Ot(n, e, `${t} has member 'abort' that`),
          close: r === void 0 ? void 0 : kt(r, e, `${t} has member 'close' that`),
          start: i === void 0 ? void 0 : At(i, e, `${t} has member 'start' that`),
          write: o === void 0 ? void 0 : jt(o, e, `${t} has member 'write' that`),
          type: a,
        };
      })(e, `First parameter`);
    if ((Pt(this), r.type !== void 0)) throw RangeError(`Invalid type is specified`);
    let i = Tt(n);
    (function (e, t, n, r) {
      let i = Object.create(Xt.prototype),
        a,
        o,
        s,
        c;
      ((a = t.start === void 0 ? () => {} : () => t.start(i)),
        (o = t.write === void 0 ? () => u(void 0) : (e) => t.write(e, i)),
        (s = t.close === void 0 ? () => u(void 0) : () => t.close()),
        (c = t.abort === void 0 ? () => u(void 0) : (e) => t.abort(e)),
        Qt(e, i, a, o, s, c, n, r));
    })(this, r, wt(n, 1), i);
  }
  get locked() {
    if (!Ft(this)) throw on(`locked`);
    return It(this);
  }
  abort(e = void 0) {
    return Ft(this)
      ? It(this)
        ? d(TypeError(`Cannot abort a stream that already has a writer`))
        : Lt(this, e)
      : d(on(`abort`));
  }
  close() {
    return Ft(this)
      ? It(this)
        ? d(TypeError(`Cannot close a stream that already has a writer`))
        : V(this)
          ? d(TypeError(`Cannot close an already-closing stream`))
          : Rt(this)
      : d(on(`close`));
  }
  getWriter() {
    if (!Ft(this)) throw on(`getWriter`);
    return Nt(this);
  }
};
function Nt(e) {
  return new H(e);
}
function Pt(e) {
  ((e._state = `writable`),
    (e._storedError = void 0),
    (e._writer = void 0),
    (e._writableStreamController = void 0),
    (e._writeRequests = new b()),
    (e._inFlightWriteRequest = void 0),
    (e._closeRequest = void 0),
    (e._inFlightCloseRequest = void 0),
    (e._pendingAbortRequest = void 0),
    (e._backpressure = !1));
}
function Ft(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_writableStreamController`) &&
    e instanceof B
  );
}
function It(e) {
  return e._writer !== void 0;
}
function Lt(e, t) {
  var n;
  if (e._state === `closed` || e._state === `errored`) return u(void 0);
  ((e._writableStreamController._abortReason = t),
    (n = e._writableStreamController._abortController) == null || n.abort(t));
  let r = e._state;
  if (r === `closed` || r === `errored`) return u(void 0);
  if (e._pendingAbortRequest !== void 0) return e._pendingAbortRequest._promise;
  let i = !1;
  r === `erroring` && ((i = !0), (t = void 0));
  let a = l((n, r) => {
    e._pendingAbortRequest = {
      _promise: void 0,
      _resolve: n,
      _reject: r,
      _reason: t,
      _wasAlreadyErroring: i,
    };
  });
  return ((e._pendingAbortRequest._promise = a), i || Bt(e, t), a);
}
function Rt(e) {
  let t = e._state;
  if (t === `closed` || t === `errored`)
    return d(
      TypeError(`The stream (in ${t} state) is not in the writable state and cannot be closed`),
    );
  let n = l((t, n) => {
      e._closeRequest = { _resolve: t, _reject: n };
    }),
    r = e._writer;
  var i;
  return (
    r !== void 0 && e._backpressure && t === `writable` && _n(r),
    Be((i = e._writableStreamController), Yt, 0),
    tn(i),
    n
  );
}
function zt(e, t) {
  e._state === `writable` ? Bt(e, t) : Vt(e);
}
function Bt(e, t) {
  let n = e._writableStreamController;
  ((e._state = `erroring`), (e._storedError = t));
  let r = e._writer;
  (r !== void 0 && Kt(r, t),
    !(function (e) {
      return !(e._inFlightWriteRequest === void 0 && e._inFlightCloseRequest === void 0);
    })(e) &&
      n._started &&
      Vt(e));
}
function Vt(e) {
  ((e._state = `errored`), e._writableStreamController[ne]());
  let t = e._storedError;
  if (
    (e._writeRequests.forEach((e) => {
      e._reject(t);
    }),
    (e._writeRequests = new b()),
    e._pendingAbortRequest === void 0)
  )
    return void Ht(e);
  let n = e._pendingAbortRequest;
  if (((e._pendingAbortRequest = void 0), n._wasAlreadyErroring)) return (n._reject(t), void Ht(e));
  p(
    e._writableStreamController[te](n._reason),
    () => (n._resolve(), Ht(e), null),
    (t) => (n._reject(t), Ht(e), null),
  );
}
function V(e) {
  return e._closeRequest !== void 0 || e._inFlightCloseRequest !== void 0;
}
function Ht(e) {
  e._closeRequest !== void 0 &&
    (e._closeRequest._reject(e._storedError), (e._closeRequest = void 0));
  let t = e._writer;
  t !== void 0 && dn(t, e._storedError);
}
function Ut(e, t) {
  let n = e._writer;
  (n !== void 0 &&
    t !== e._backpressure &&
    (t
      ? (function (e) {
          pn(e);
        })(n)
      : _n(n)),
    (e._backpressure = t));
}
(Object.defineProperties(B.prototype, {
  abort: { enumerable: !0 },
  close: { enumerable: !0 },
  getWriter: { enumerable: !0 },
  locked: { enumerable: !0 },
}),
  r(B.prototype.abort, `abort`),
  r(B.prototype.close, `close`),
  r(B.prototype.getWriter, `getWriter`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(B.prototype, Symbol.toStringTag, {
      value: `WritableStream`,
      configurable: !0,
    }));
var H = class {
  constructor(e) {
    if ((O(e, 1, `WritableStreamDefaultWriter`), Mt(e, `First parameter`), It(e)))
      throw TypeError(
        `This stream has already been locked for exclusive writing by another writer`,
      );
    ((this._ownerWritableStream = e), (e._writer = this));
    let t = e._state;
    if (t === `writable`) (!V(e) && e._backpressure ? pn(this) : hn(this), ln(this));
    else if (t === `erroring`) (mn(this, e._storedError), ln(this));
    else if (t === `closed`) (hn(this), ln((n = this)), fn(n));
    else {
      let t = e._storedError;
      (mn(this, t), un(this, t));
    }
    var n;
  }
  get closed() {
    return U(this) ? this._closedPromise : d(W(`closed`));
  }
  get desiredSize() {
    if (!U(this)) throw W(`desiredSize`);
    if (this._ownerWritableStream === void 0) throw cn(`desiredSize`);
    return (function (e) {
      let t = e._ownerWritableStream,
        n = t._state;
      return n === `errored` || n === `erroring`
        ? null
        : n === `closed`
          ? 0
          : en(t._writableStreamController);
    })(this);
  }
  get ready() {
    return U(this) ? this._readyPromise : d(W(`ready`));
  }
  abort(e = void 0) {
    return U(this)
      ? this._ownerWritableStream === void 0
        ? d(cn(`abort`))
        : (function (e, t) {
            return Lt(e._ownerWritableStream, t);
          })(this, e)
      : d(W(`abort`));
  }
  close() {
    if (!U(this)) return d(W(`close`));
    let e = this._ownerWritableStream;
    return e === void 0
      ? d(cn(`close`))
      : V(e)
        ? d(TypeError(`Cannot close an already-closing stream`))
        : Wt(this);
  }
  releaseLock() {
    if (!U(this)) throw W(`releaseLock`);
    this._ownerWritableStream !== void 0 && qt(this);
  }
  write(e = void 0) {
    return U(this)
      ? this._ownerWritableStream === void 0
        ? d(cn(`write to`))
        : Jt(this, e)
      : d(W(`write`));
  }
};
function U(e) {
  return (
    !!t(e) && !!Object.prototype.hasOwnProperty.call(e, `_ownerWritableStream`) && e instanceof H
  );
}
function Wt(e) {
  return Rt(e._ownerWritableStream);
}
function Gt(e, t) {
  e._closedPromiseState === `pending`
    ? dn(e, t)
    : (function (e, t) {
        un(e, t);
      })(e, t);
}
function Kt(e, t) {
  e._readyPromiseState === `pending`
    ? gn(e, t)
    : (function (e, t) {
        mn(e, t);
      })(e, t);
}
function qt(e) {
  let t = e._ownerWritableStream,
    n = TypeError(
      `Writer was released and can no longer be used to monitor the stream's closedness`,
    );
  (Kt(e, n), Gt(e, n), (t._writer = void 0), (e._ownerWritableStream = void 0));
}
function Jt(e, t) {
  let n = e._ownerWritableStream,
    r = n._writableStreamController,
    i = (function (e, t) {
      if (e._strategySizeAlgorithm === void 0) return 1;
      try {
        return e._strategySizeAlgorithm(t);
      } catch (t) {
        return (nn(e, t), 1);
      }
    })(r, t);
  if (n !== e._ownerWritableStream) return d(cn(`write to`));
  let a = n._state;
  if (a === `errored`) return d(n._storedError);
  if (V(n) || a === `closed`)
    return d(TypeError(`The stream is closing or closed and cannot be written to`));
  if (a === `erroring`) return d(n._storedError);
  let o = (function (e) {
    return l((t, n) => {
      let r = { _resolve: t, _reject: n };
      e._writeRequests.push(r);
    });
  })(n);
  return (
    (function (e, t, n) {
      try {
        Be(e, t, n);
      } catch (t) {
        nn(e, t);
        return;
      }
      let r = e._controlledWritableStream;
      (!V(r) && r._state === `writable` && Ut(r, rn(e)), tn(e));
    })(r, t, i),
    o
  );
}
(Object.defineProperties(H.prototype, {
  abort: { enumerable: !0 },
  close: { enumerable: !0 },
  releaseLock: { enumerable: !0 },
  write: { enumerable: !0 },
  closed: { enumerable: !0 },
  desiredSize: { enumerable: !0 },
  ready: { enumerable: !0 },
}),
  r(H.prototype.abort, `abort`),
  r(H.prototype.close, `close`),
  r(H.prototype.releaseLock, `releaseLock`),
  r(H.prototype.write, `write`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(H.prototype, Symbol.toStringTag, {
      value: `WritableStreamDefaultWriter`,
      configurable: !0,
    }));
var Yt = {},
  Xt = class {
    constructor() {
      throw TypeError(`Illegal constructor`);
    }
    get abortReason() {
      if (!Zt(this)) throw sn(`abortReason`);
      return this._abortReason;
    }
    get signal() {
      if (!Zt(this)) throw sn(`signal`);
      if (this._abortController === void 0)
        throw TypeError(`WritableStreamDefaultController.prototype.signal is not supported`);
      return this._abortController.signal;
    }
    error(e = void 0) {
      if (!Zt(this)) throw sn(`error`);
      this._controlledWritableStream._state === `writable` && an(this, e);
    }
    [te](e) {
      let t = this._abortAlgorithm(e);
      return ($t(this), t);
    }
    [ne]() {
      N(this);
    }
  };
function Zt(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_controlledWritableStream`) &&
    e instanceof Xt
  );
}
function Qt(e, t, n, r, i, a, o, s) {
  ((t._controlledWritableStream = e),
    (e._writableStreamController = t),
    (t._queue = void 0),
    (t._queueTotalSize = void 0),
    N(t),
    (t._abortReason = void 0),
    (t._abortController = (function () {
      if (typeof AbortController == `function`) return new AbortController();
    })()),
    (t._started = !1),
    (t._strategySizeAlgorithm = s),
    (t._strategyHWM = o),
    (t._writeAlgorithm = r),
    (t._closeAlgorithm = i),
    (t._abortAlgorithm = a),
    Ut(e, rn(t)),
    p(
      u(n()),
      () => ((t._started = !0), tn(t), null),
      (n) => ((t._started = !0), zt(e, n), null),
    ));
}
function $t(e) {
  ((e._writeAlgorithm = void 0),
    (e._closeAlgorithm = void 0),
    (e._abortAlgorithm = void 0),
    (e._strategySizeAlgorithm = void 0));
}
function en(e) {
  return e._strategyHWM - e._queueTotalSize;
}
function tn(e) {
  let t = e._controlledWritableStream;
  if (!e._started || t._inFlightWriteRequest !== void 0) return;
  if (t._state === `erroring`) return void Vt(t);
  if (e._queue.length === 0) return;
  let n = e._queue.peek().value;
  n === Yt
    ? (function (e) {
        let t = e._controlledWritableStream;
        ((function (e) {
          ((e._inFlightCloseRequest = e._closeRequest), (e._closeRequest = void 0));
        })(t),
          ze(e));
        let n = e._closeAlgorithm();
        ($t(e),
          p(
            n,
            () => (
              (function (e) {
                (e._inFlightCloseRequest._resolve(void 0),
                  (e._inFlightCloseRequest = void 0),
                  e._state === `erroring` &&
                    ((e._storedError = void 0),
                    e._pendingAbortRequest !== void 0 &&
                      (e._pendingAbortRequest._resolve(), (e._pendingAbortRequest = void 0))),
                  (e._state = `closed`));
                let t = e._writer;
                t !== void 0 && fn(t);
              })(t),
              null
            ),
            (e) => (
              (function (e, t) {
                (e._inFlightCloseRequest._reject(t),
                  (e._inFlightCloseRequest = void 0),
                  e._pendingAbortRequest !== void 0 &&
                    (e._pendingAbortRequest._reject(t), (e._pendingAbortRequest = void 0)),
                  zt(e, t));
              })(t, e),
              null
            ),
          ));
      })(e)
    : (function (e, t) {
        let n = e._controlledWritableStream;
        ((function (e) {
          e._inFlightWriteRequest = e._writeRequests.shift();
        })(n),
          p(
            e._writeAlgorithm(t),
            () => {
              (function (e) {
                (e._inFlightWriteRequest._resolve(void 0), (e._inFlightWriteRequest = void 0));
              })(n);
              let t = n._state;
              return (ze(e), !V(n) && t === `writable` && Ut(n, rn(e)), tn(e), null);
            },
            (t) => (
              n._state === `writable` && $t(e),
              (function (e, t) {
                (e._inFlightWriteRequest._reject(t), (e._inFlightWriteRequest = void 0), zt(e, t));
              })(n, t),
              null
            ),
          ));
      })(e, n);
}
function nn(e, t) {
  e._controlledWritableStream._state === `writable` && an(e, t);
}
function rn(e) {
  return en(e) <= 0;
}
function an(e, t) {
  let n = e._controlledWritableStream;
  ($t(e), Bt(n, t));
}
function on(e) {
  return TypeError(`WritableStream.prototype.${e} can only be used on a WritableStream`);
}
function sn(e) {
  return TypeError(
    `WritableStreamDefaultController.prototype.${e} can only be used on a WritableStreamDefaultController`,
  );
}
function W(e) {
  return TypeError(
    `WritableStreamDefaultWriter.prototype.${e} can only be used on a WritableStreamDefaultWriter`,
  );
}
function cn(e) {
  return TypeError(`Cannot ` + e + ` a stream using a released writer`);
}
function ln(e) {
  e._closedPromise = l((t, n) => {
    ((e._closedPromise_resolve = t),
      (e._closedPromise_reject = n),
      (e._closedPromiseState = `pending`));
  });
}
function un(e, t) {
  (ln(e), dn(e, t));
}
function dn(e, t) {
  e._closedPromise_reject !== void 0 &&
    (g(e._closedPromise),
    e._closedPromise_reject(t),
    (e._closedPromise_resolve = void 0),
    (e._closedPromise_reject = void 0),
    (e._closedPromiseState = `rejected`));
}
function fn(e) {
  e._closedPromise_resolve !== void 0 &&
    (e._closedPromise_resolve(void 0),
    (e._closedPromise_resolve = void 0),
    (e._closedPromise_reject = void 0),
    (e._closedPromiseState = `resolved`));
}
function pn(e) {
  ((e._readyPromise = l((t, n) => {
    ((e._readyPromise_resolve = t), (e._readyPromise_reject = n));
  })),
    (e._readyPromiseState = `pending`));
}
function mn(e, t) {
  (pn(e), gn(e, t));
}
function hn(e) {
  (pn(e), _n(e));
}
function gn(e, t) {
  e._readyPromise_reject !== void 0 &&
    (g(e._readyPromise),
    e._readyPromise_reject(t),
    (e._readyPromise_resolve = void 0),
    (e._readyPromise_reject = void 0),
    (e._readyPromiseState = `rejected`));
}
function _n(e) {
  e._readyPromise_resolve !== void 0 &&
    (e._readyPromise_resolve(void 0),
    (e._readyPromise_resolve = void 0),
    (e._readyPromise_reject = void 0),
    (e._readyPromiseState = `fulfilled`));
}
(Object.defineProperties(Xt.prototype, {
  abortReason: { enumerable: !0 },
  signal: { enumerable: !0 },
  error: { enumerable: !0 },
}),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(Xt.prototype, Symbol.toStringTag, {
      value: `WritableStreamDefaultController`,
      configurable: !0,
    }));
var vn =
    typeof globalThis < `u`
      ? globalThis
      : typeof self < `u`
        ? self
        : typeof global < `u`
          ? global
          : void 0,
  yn =
    (function () {
      let e = vn?.DOMException;
      return (function (e) {
        if ((typeof e != `function` && typeof e != `object`) || e.name !== `DOMException`)
          return !1;
        try {
          return (new e(), !0);
        } catch {
          return !1;
        }
      })(e)
        ? e
        : void 0;
    })() ||
    (function () {
      let e = function (e, t) {
        ((this.message = e || ``),
          (this.name = t || `Error`),
          Error.captureStackTrace && Error.captureStackTrace(this, this.constructor));
      };
      return (
        r(e, `DOMException`),
        (e.prototype = Object.create(Error.prototype)),
        Object.defineProperty(e.prototype, `constructor`, {
          value: e,
          writable: !0,
          configurable: !0,
        }),
        e
      );
    })();
function bn(t, n, r, i, a, o) {
  let s = _e(t),
    c = Nt(n);
  t._disturbed = !0;
  let h = !1,
    _ = u(void 0);
  return l((v, y) => {
    let b;
    if (o !== void 0) {
      if (
        ((b = () => {
          let e = o.reason === void 0 ? new yn(`Aborted`, `AbortError`) : o.reason,
            r = [];
          (i || r.push(() => (n._state === `writable` ? Lt(n, e) : u(void 0))),
            a || r.push(() => (t._state === `readable` ? Z(t, e) : u(void 0))),
            S(() => Promise.all(r.map((e) => e())), !0, e));
        }),
        o.aborted)
      )
        return void b();
      o.addEventListener(`abort`, b);
    }
    var te, ne, x;
    if (
      (ie(t, s._closedPromise, (e) => (i ? C(!0, e) : S(() => Lt(n, e), !0, e), null)),
      ie(n, c._closedPromise, (e) => (a ? C(!0, e) : S(() => Z(t, e), !0, e), null)),
      (te = t),
      (ne = s._closedPromise),
      (x = () => (
        r
          ? C()
          : S(() =>
              (function (e) {
                let t = e._ownerWritableStream,
                  n = t._state;
                return V(t) || n === `closed`
                  ? u(void 0)
                  : n === `errored`
                    ? d(t._storedError)
                    : Wt(e);
              })(c),
            ),
        null
      )),
      te._state === `closed` ? x() : m(ne, x),
      V(n) || n._state === `closed`)
    ) {
      let e = TypeError(
        `the destination writable stream closed before all data could be piped to it`,
      );
      a ? C(!0, e) : S(() => Z(t, e), !0, e);
    }
    function re() {
      let e = _;
      return f(_, () => (e === _ ? void 0 : re()));
    }
    function ie(e, t, n) {
      e._state === `errored` ? n(e._storedError) : ee(t, n);
    }
    function S(e, t, r) {
      function i() {
        return (
          p(
            e(),
            () => T(t, r),
            (e) => T(!0, e),
          ),
          null
        );
      }
      h || ((h = !0), n._state !== `writable` || V(n) ? i() : m(re(), i));
    }
    function C(e, t) {
      h || ((h = !0), n._state !== `writable` || V(n) ? T(e, t) : m(re(), () => T(e, t)));
    }
    function T(e, t) {
      return (
        qt(c), w(s), o !== void 0 && o.removeEventListener(`abort`, b), e ? y(t) : v(void 0), null
      );
    }
    g(
      l((t, n) => {
        (function r(i) {
          i
            ? t()
            : f(
                h
                  ? u(!0)
                  : f(c._readyPromise, () =>
                      l((t, n) => {
                        Se(s, {
                          _chunkSteps: (n) => {
                            ((_ = f(Jt(c, n), void 0, e)), t(!1));
                          },
                          _closeSteps: () => t(!0),
                          _errorSteps: n,
                        });
                      }),
                    ),
                r,
                n,
              );
        })(!1);
      }),
    );
  });
}
var G = class {
  constructor() {
    throw TypeError(`Illegal constructor`);
  }
  get desiredSize() {
    if (!xn(this)) throw kn(`desiredSize`);
    return En(this);
  }
  close() {
    if (!xn(this)) throw kn(`close`);
    if (!Dn(this)) throw TypeError(`The stream is not in a state that permits close`);
    K(this);
  }
  enqueue(e = void 0) {
    if (!xn(this)) throw kn(`enqueue`);
    if (!Dn(this)) throw TypeError(`The stream is not in a state that permits enqueue`);
    return Tn(this, e);
  }
  error(e = void 0) {
    if (!xn(this)) throw kn(`error`);
    q(this, e);
  }
  [x](e) {
    N(this);
    let t = this._cancelAlgorithm(e);
    return (wn(this), t);
  }
  [re](e) {
    let t = this._controlledReadableStream;
    if (this._queue.length > 0) {
      let n = ze(this);
      (this._closeRequested && this._queue.length === 0 ? (wn(this), Bn(t)) : Sn(this),
        e._chunkSteps(n));
    } else (ve(t, e), Sn(this));
  }
  [ie]() {}
};
function xn(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_controlledReadableStream`) &&
    e instanceof G
  );
}
function Sn(e) {
  if (Cn(e)) {
    if (e._pulling) return void (e._pullAgain = !0);
    ((e._pulling = !0),
      p(
        e._pullAlgorithm(),
        () => ((e._pulling = !1), e._pullAgain && ((e._pullAgain = !1), Sn(e)), null),
        (t) => (q(e, t), null),
      ));
  }
}
function Cn(e) {
  let t = e._controlledReadableStream;
  return !Dn(e) || !e._started ? !1 : X(t) && be(t) > 0 ? !0 : En(e) > 0;
}
function wn(e) {
  ((e._pullAlgorithm = void 0), (e._cancelAlgorithm = void 0), (e._strategySizeAlgorithm = void 0));
}
function K(e) {
  if (!Dn(e)) return;
  let t = e._controlledReadableStream;
  ((e._closeRequested = !0), e._queue.length === 0 && (wn(e), Bn(t)));
}
function Tn(e, t) {
  if (!Dn(e)) return;
  let n = e._controlledReadableStream;
  if (X(n) && be(n) > 0) ye(n, t, !1);
  else {
    let n;
    try {
      n = e._strategySizeAlgorithm(t);
    } catch (t) {
      throw (q(e, t), t);
    }
    try {
      Be(e, t, n);
    } catch (t) {
      throw (q(e, t), t);
    }
  }
  Sn(e);
}
function q(e, t) {
  let n = e._controlledReadableStream;
  n._state === `readable` && (N(e), wn(e), Vn(n, t));
}
function En(e) {
  let t = e._controlledReadableStream._state;
  return t === `errored` ? null : t === `closed` ? 0 : e._strategyHWM - e._queueTotalSize;
}
function Dn(e) {
  let t = e._controlledReadableStream._state;
  return !e._closeRequested && t === `readable`;
}
function On(e, t, n, r, i, a, o) {
  ((t._controlledReadableStream = e),
    (t._queue = void 0),
    (t._queueTotalSize = void 0),
    N(t),
    (t._started = !1),
    (t._closeRequested = !1),
    (t._pullAgain = !1),
    (t._pulling = !1),
    (t._strategySizeAlgorithm = o),
    (t._strategyHWM = a),
    (t._pullAlgorithm = r),
    (t._cancelAlgorithm = i),
    (e._readableStreamController = t),
    p(
      u(n()),
      () => ((t._started = !0), Sn(t), null),
      (e) => (q(t, e), null),
    ));
}
function kn(e) {
  return TypeError(
    `ReadableStreamDefaultController.prototype.${e} can only be used on a ReadableStreamDefaultController`,
  );
}
function An(e, t) {
  return F(e._readableStreamController)
    ? (function (e) {
        let t,
          n,
          r,
          i,
          a,
          o = _e(e),
          s = !1,
          c = !1,
          d = !1,
          f = !1,
          p = !1,
          m = l((e) => {
            a = e;
          });
        function h(e) {
          ee(
            e._closedPromise,
            (t) => (
              e !== o ||
                (L(r._readableStreamController, t),
                L(i._readableStreamController, t),
                (f && p) || a(void 0)),
              null
            ),
          );
        }
        function g() {
          (z(o) && (w(o), (o = _e(e)), h(o)),
            Se(o, {
              _chunkSteps: (t) => {
                _(() => {
                  ((c = !1), (d = !1));
                  let n = t,
                    o = t;
                  if (!f && !p)
                    try {
                      o = Re(t);
                    } catch (t) {
                      (L(r._readableStreamController, t),
                        L(i._readableStreamController, t),
                        a(Z(e, t)));
                      return;
                    }
                  (f || st(r._readableStreamController, n),
                    p || st(i._readableStreamController, o),
                    (s = !1),
                    c ? y() : d && b());
                });
              },
              _closeSteps: () => {
                ((s = !1),
                  f || ot(r._readableStreamController),
                  p || ot(i._readableStreamController),
                  r._readableStreamController._pendingPullIntos.length > 0 &&
                    dt(r._readableStreamController, 0),
                  i._readableStreamController._pendingPullIntos.length > 0 &&
                    dt(i._readableStreamController, 0),
                  (f && p) || a(void 0));
              },
              _errorSteps: () => {
                s = !1;
              },
            }));
        }
        function v(t, n) {
          A(o) && (w(o), (o = _t(e)), h(o));
          let l = n ? i : r,
            u = n ? r : i;
          xt(o, t, 1, {
            _chunkSteps: (t) => {
              _(() => {
                ((c = !1), (d = !1));
                let r = n ? p : f;
                if (n ? f : p) r || ft(l._readableStreamController, t);
                else {
                  let n;
                  try {
                    n = Re(t);
                  } catch (t) {
                    (L(l._readableStreamController, t),
                      L(u._readableStreamController, t),
                      a(Z(e, t)));
                    return;
                  }
                  (r || ft(l._readableStreamController, t), st(u._readableStreamController, n));
                }
                ((s = !1), c ? y() : d && b());
              });
            },
            _closeSteps: (e) => {
              s = !1;
              let t = n ? p : f,
                r = n ? f : p;
              (t || ot(l._readableStreamController),
                r || ot(u._readableStreamController),
                e !== void 0 &&
                  (t || ft(l._readableStreamController, e),
                  !r &&
                    u._readableStreamController._pendingPullIntos.length > 0 &&
                    dt(u._readableStreamController, 0)),
                (t && r) || a(void 0));
            },
            _errorSteps: () => {
              s = !1;
            },
          });
        }
        function y() {
          if (s) return ((c = !0), u(void 0));
          s = !0;
          let e = lt(r._readableStreamController);
          return (e === null ? g() : v(e._view, !1), u(void 0));
        }
        function b() {
          if (s) return ((d = !0), u(void 0));
          s = !0;
          let e = lt(i._readableStreamController);
          return (e === null ? g() : v(e._view, !0), u(void 0));
        }
        function te(r) {
          if (((f = !0), (t = r), p)) {
            let r = Z(e, Te([t, n]));
            a(r);
          }
          return m;
        }
        function ne(r) {
          if (((p = !0), (n = r), f)) {
            let r = Z(e, Te([t, n]));
            a(r);
          }
          return m;
        }
        function x() {}
        return ((r = Rn(x, y, te)), (i = Rn(x, b, ne)), h(o), [r, i]);
      })(e)
    : (function (e) {
        let t = _e(e),
          n,
          r,
          i,
          a,
          o,
          s = !1,
          c = !1,
          d = !1,
          f = !1,
          p = l((e) => {
            o = e;
          });
        function m() {
          return s
            ? ((c = !0), u(void 0))
            : ((s = !0),
              Se(t, {
                _chunkSteps: (e) => {
                  _(() => {
                    c = !1;
                    let t = e,
                      n = e;
                    (d || Tn(i._readableStreamController, t),
                      f || Tn(a._readableStreamController, n),
                      (s = !1),
                      c && m());
                  });
                },
                _closeSteps: () => {
                  ((s = !1),
                    d || K(i._readableStreamController),
                    f || K(a._readableStreamController),
                    (d && f) || o(void 0));
                },
                _errorSteps: () => {
                  s = !1;
                },
              }),
              u(void 0));
        }
        function h(t) {
          if (((d = !0), (n = t), f)) {
            let t = Z(e, Te([n, r]));
            o(t);
          }
          return p;
        }
        function g(t) {
          if (((f = !0), (r = t), d)) {
            let t = Z(e, Te([n, r]));
            o(t);
          }
          return p;
        }
        function v() {}
        return (
          (i = Ln(v, m, h)),
          (a = Ln(v, m, g)),
          ee(
            t._closedPromise,
            (e) => (
              q(i._readableStreamController, e),
              q(a._readableStreamController, e),
              (d && f) || o(void 0),
              null
            ),
          ),
          [i, a]
        );
      })(e);
}
function jn(n) {
  return t((r = n)) && r.getReader !== void 0
    ? (function (n) {
        let r;
        function i() {
          let e;
          try {
            e = n.read();
          } catch (e) {
            return d(e);
          }
          return h(e, (e) => {
            if (!t(e))
              throw TypeError(
                `The promise returned by the reader.read() method must fulfill with an object`,
              );
            if (e.done) K(r._readableStreamController);
            else {
              let t = e.value;
              Tn(r._readableStreamController, t);
            }
          });
        }
        function a(e) {
          try {
            return u(n.cancel(e));
          } catch (e) {
            return d(e);
          }
        }
        return ((r = Ln(e, i, a, 0)), r);
      })(n.getReader())
    : (function (n) {
        let r,
          i = je(n, `async`);
        function a() {
          let e;
          try {
            e = Me(i);
          } catch (e) {
            return d(e);
          }
          return h(u(e), (e) => {
            if (!t(e))
              throw TypeError(
                `The promise returned by the iterator.next() method must fulfill with an object`,
              );
            if (e.done) K(r._readableStreamController);
            else {
              let t = e.value;
              Tn(r._readableStreamController, t);
            }
          });
        }
        function o(e) {
          let n = i.iterator,
            r;
          try {
            r = Oe(n, `return`);
          } catch (e) {
            return d(e);
          }
          return r === void 0
            ? u(void 0)
            : h(y(r, n, [e]), (e) => {
                if (!t(e))
                  throw TypeError(
                    `The promise returned by the iterator.return() method must fulfill with an object`,
                  );
              });
        }
        return ((r = Ln(e, a, o, 0)), r);
      })(n);
  var r;
}
function Mn(e, t, n) {
  return (D(e, n), (n) => y(e, t, [n]));
}
function Nn(e, t, n) {
  return (D(e, n), (n) => y(e, t, [n]));
}
function Pn(e, t, n) {
  return (D(e, n), (n) => v(e, t, [n]));
}
function Fn(e, t) {
  if ((e = `${e}`) != `bytes`)
    throw TypeError(`${t} '${e}' is not a valid enumeration value for ReadableStreamType`);
  return e;
}
function In(e, t) {
  E(e, t);
  let n = e?.preventAbort,
    r = e?.preventCancel,
    i = e?.preventClose,
    a = e?.signal;
  return (
    a !== void 0 &&
      (function (e, t) {
        if (
          !(function (e) {
            if (typeof e != `object` || !e) return !1;
            try {
              return typeof e.aborted == `boolean`;
            } catch {
              return !1;
            }
          })(e)
        )
          throw TypeError(`${t} is not an AbortSignal.`);
      })(a, `${t} has member 'signal' that`),
    { preventAbort: !!n, preventCancel: !!r, preventClose: !!i, signal: a }
  );
}
(Object.defineProperties(G.prototype, {
  close: { enumerable: !0 },
  enqueue: { enumerable: !0 },
  error: { enumerable: !0 },
  desiredSize: { enumerable: !0 },
}),
  r(G.prototype.close, `close`),
  r(G.prototype.enqueue, `enqueue`),
  r(G.prototype.error, `error`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(G.prototype, Symbol.toStringTag, {
      value: `ReadableStreamDefaultController`,
      configurable: !0,
    }));
var J = class {
  constructor(e = {}, t = {}) {
    e === void 0 ? (e = null) : de(e, `First parameter`);
    let n = Et(t, `Second parameter`),
      r = (function (e, t) {
        E(e, t);
        let n = e,
          r = n?.autoAllocateChunkSize,
          i = n?.cancel,
          a = n?.pull,
          o = n?.start,
          s = n?.type;
        return {
          autoAllocateChunkSize:
            r === void 0 ? void 0 : he(r, `${t} has member 'autoAllocateChunkSize' that`),
          cancel: i === void 0 ? void 0 : Mn(i, n, `${t} has member 'cancel' that`),
          pull: a === void 0 ? void 0 : Nn(a, n, `${t} has member 'pull' that`),
          start: o === void 0 ? void 0 : Pn(o, n, `${t} has member 'start' that`),
          type: s === void 0 ? void 0 : Fn(s, `${t} has member 'type' that`),
        };
      })(e, `First parameter`);
    if ((zn(this), r.type === `bytes`)) {
      if (n.size !== void 0)
        throw RangeError(`The strategy for a byte stream cannot have a size function`);
      (function (e, t, n) {
        let r = Object.create(P.prototype),
          i,
          a,
          o;
        ((i = t.start === void 0 ? () => {} : () => t.start(r)),
          (a = t.pull === void 0 ? () => u(void 0) : () => t.pull(r)),
          (o = t.cancel === void 0 ? () => u(void 0) : (e) => t.cancel(e)));
        let s = t.autoAllocateChunkSize;
        if (s === 0) throw TypeError(`autoAllocateChunkSize must be greater than 0`);
        pt(e, r, i, a, o, n, s);
      })(this, r, wt(n, 0));
    } else {
      let e = Tt(n);
      (function (e, t, n, r) {
        let i = Object.create(G.prototype),
          a,
          o,
          s;
        ((a = t.start === void 0 ? () => {} : () => t.start(i)),
          (o = t.pull === void 0 ? () => u(void 0) : () => t.pull(i)),
          (s = t.cancel === void 0 ? () => u(void 0) : (e) => t.cancel(e)),
          On(e, i, a, o, s, n, r));
      })(this, r, wt(n, 1), e);
    }
  }
  get locked() {
    if (!Y(this)) throw Q(`locked`);
    return X(this);
  }
  cancel(e = void 0) {
    return Y(this)
      ? X(this)
        ? d(TypeError(`Cannot cancel a stream that already has a reader`))
        : Z(this, e)
      : d(Q(`cancel`));
  }
  getReader(e = void 0) {
    if (!Y(this)) throw Q(`getReader`);
    return (function (e, t) {
      E(e, t);
      let n = e?.mode;
      return { mode: n === void 0 ? void 0 : gt(n, `${t} has member 'mode' that`) };
    })(e, `First parameter`).mode === void 0
      ? _e(this)
      : _t(this);
  }
  pipeThrough(e, t = {}) {
    if (!Y(this)) throw Q(`pipeThrough`);
    O(e, 1, `pipeThrough`);
    let n = (function (e, t) {
        E(e, t);
        let n = e?.readable;
        (fe(n, `readable`, `ReadableWritablePair`), ge(n, `${t} has member 'readable' that`));
        let r = e?.writable;
        return (
          fe(r, `writable`, `ReadableWritablePair`),
          Mt(r, `${t} has member 'writable' that`),
          { readable: n, writable: r }
        );
      })(e, `First parameter`),
      r = In(t, `Second parameter`);
    if (X(this))
      throw TypeError(
        `ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream`,
      );
    if (It(n.writable))
      throw TypeError(
        `ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream`,
      );
    return (
      g(bn(this, n.writable, r.preventClose, r.preventAbort, r.preventCancel, r.signal)), n.readable
    );
  }
  pipeTo(e, t = {}) {
    if (!Y(this)) return d(Q(`pipeTo`));
    if (e === void 0) return d(`Parameter 1 is required in 'pipeTo'.`);
    if (!Ft(e))
      return d(
        TypeError(`ReadableStream.prototype.pipeTo's first argument must be a WritableStream`),
      );
    let n;
    try {
      n = In(t, `Second parameter`);
    } catch (e) {
      return d(e);
    }
    return X(this)
      ? d(TypeError(`ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream`))
      : It(e)
        ? d(TypeError(`ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream`))
        : bn(this, e, n.preventClose, n.preventAbort, n.preventCancel, n.signal);
  }
  tee() {
    if (!Y(this)) throw Q(`tee`);
    return Te(An(this));
  }
  values(e = void 0) {
    if (!Y(this)) throw Q(`values`);
    return (function (e, t) {
      let n = new Ne(_e(e), t),
        r = Object.create(Pe);
      return ((r._asyncIteratorImpl = n), r);
    })(
      this,
      (function (e, t) {
        return (E(e, t), { preventCancel: !!e?.preventCancel });
      })(e, `First parameter`).preventCancel,
    );
  }
  [Ae](e) {
    return this.values(e);
  }
  static from(e) {
    return jn(e);
  }
};
function Ln(e, t, n, r = 1, i = () => 1) {
  let a = Object.create(J.prototype);
  return (zn(a), On(a, Object.create(G.prototype), e, t, n, r, i), a);
}
function Rn(e, t, n) {
  let r = Object.create(J.prototype);
  return (zn(r), pt(r, Object.create(P.prototype), e, t, n, 0, void 0), r);
}
function zn(e) {
  ((e._state = `readable`), (e._reader = void 0), (e._storedError = void 0), (e._disturbed = !1));
}
function Y(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_readableStreamController`) &&
    e instanceof J
  );
}
function X(e) {
  return e._reader !== void 0;
}
function Z(t, n) {
  if (((t._disturbed = !0), t._state === `closed`)) return u(void 0);
  if (t._state === `errored`) return d(t._storedError);
  Bn(t);
  let r = t._reader;
  if (r !== void 0 && z(r)) {
    let e = r._readIntoRequests;
    ((r._readIntoRequests = new b()),
      e.forEach((e) => {
        e._closeSteps(void 0);
      }));
  }
  return h(t._readableStreamController[x](n), e);
}
function Bn(e) {
  e._state = `closed`;
  let t = e._reader;
  if (t !== void 0 && (ce(t), A(t))) {
    let e = t._readRequests;
    ((t._readRequests = new b()),
      e.forEach((e) => {
        e._closeSteps();
      }));
  }
}
function Vn(e, t) {
  ((e._state = `errored`), (e._storedError = t));
  let n = e._reader;
  n !== void 0 && (se(n, t), A(n) ? Ce(n, t) : St(n, t));
}
function Q(e) {
  return TypeError(`ReadableStream.prototype.${e} can only be used on a ReadableStream`);
}
function Hn(e, t) {
  E(e, t);
  let n = e?.highWaterMark;
  return (fe(n, `highWaterMark`, `QueuingStrategyInit`), { highWaterMark: pe(n) });
}
(Object.defineProperties(J, { from: { enumerable: !0 } }),
  Object.defineProperties(J.prototype, {
    cancel: { enumerable: !0 },
    getReader: { enumerable: !0 },
    pipeThrough: { enumerable: !0 },
    pipeTo: { enumerable: !0 },
    tee: { enumerable: !0 },
    values: { enumerable: !0 },
    locked: { enumerable: !0 },
  }),
  r(J.from, `from`),
  r(J.prototype.cancel, `cancel`),
  r(J.prototype.getReader, `getReader`),
  r(J.prototype.pipeThrough, `pipeThrough`),
  r(J.prototype.pipeTo, `pipeTo`),
  r(J.prototype.tee, `tee`),
  r(J.prototype.values, `values`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(J.prototype, Symbol.toStringTag, {
      value: `ReadableStream`,
      configurable: !0,
    }),
  Object.defineProperty(J.prototype, Ae, {
    value: J.prototype.values,
    writable: !0,
    configurable: !0,
  }));
var Un = (e) => e.byteLength;
r(Un, `size`);
var Wn = class {
  constructor(e) {
    (O(e, 1, `ByteLengthQueuingStrategy`),
      (e = Hn(e, `First parameter`)),
      (this._byteLengthQueuingStrategyHighWaterMark = e.highWaterMark));
  }
  get highWaterMark() {
    if (!Kn(this)) throw Gn(`highWaterMark`);
    return this._byteLengthQueuingStrategyHighWaterMark;
  }
  get size() {
    if (!Kn(this)) throw Gn(`size`);
    return Un;
  }
};
function Gn(e) {
  return TypeError(
    `ByteLengthQueuingStrategy.prototype.${e} can only be used on a ByteLengthQueuingStrategy`,
  );
}
function Kn(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_byteLengthQueuingStrategyHighWaterMark`) &&
    e instanceof Wn
  );
}
(Object.defineProperties(Wn.prototype, {
  highWaterMark: { enumerable: !0 },
  size: { enumerable: !0 },
}),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(Wn.prototype, Symbol.toStringTag, {
      value: `ByteLengthQueuingStrategy`,
      configurable: !0,
    }));
var qn = () => 1;
r(qn, `size`);
var Jn = class {
  constructor(e) {
    (O(e, 1, `CountQueuingStrategy`),
      (e = Hn(e, `First parameter`)),
      (this._countQueuingStrategyHighWaterMark = e.highWaterMark));
  }
  get highWaterMark() {
    if (!Xn(this)) throw Yn(`highWaterMark`);
    return this._countQueuingStrategyHighWaterMark;
  }
  get size() {
    if (!Xn(this)) throw Yn(`size`);
    return qn;
  }
};
function Yn(e) {
  return TypeError(
    `CountQueuingStrategy.prototype.${e} can only be used on a CountQueuingStrategy`,
  );
}
function Xn(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_countQueuingStrategyHighWaterMark`) &&
    e instanceof Jn
  );
}
function Zn(e, t, n) {
  return (D(e, n), (n) => y(e, t, [n]));
}
function Qn(e, t, n) {
  return (D(e, n), (n) => v(e, t, [n]));
}
function $n(e, t, n) {
  return (D(e, n), (n, r) => y(e, t, [n, r]));
}
function er(e, t, n) {
  return (D(e, n), (n) => y(e, t, [n]));
}
(Object.defineProperties(Jn.prototype, {
  highWaterMark: { enumerable: !0 },
  size: { enumerable: !0 },
}),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(Jn.prototype, Symbol.toStringTag, {
      value: `CountQueuingStrategy`,
      configurable: !0,
    }));
var tr = class {
  constructor(e = {}, t = {}, n = {}) {
    e === void 0 && (e = null);
    let r = Et(t, `Second parameter`),
      i = Et(n, `Third parameter`),
      a = (function (e, t) {
        E(e, t);
        let n = e?.cancel,
          r = e?.flush,
          i = e?.readableType,
          a = e?.start,
          o = e?.transform,
          s = e?.writableType;
        return {
          cancel: n === void 0 ? void 0 : er(n, e, `${t} has member 'cancel' that`),
          flush: r === void 0 ? void 0 : Zn(r, e, `${t} has member 'flush' that`),
          readableType: i,
          start: a === void 0 ? void 0 : Qn(a, e, `${t} has member 'start' that`),
          transform: o === void 0 ? void 0 : $n(o, e, `${t} has member 'transform' that`),
          writableType: s,
        };
      })(e, `First parameter`);
    if (a.readableType !== void 0) throw RangeError(`Invalid readableType specified`);
    if (a.writableType !== void 0) throw RangeError(`Invalid writableType specified`);
    let o = wt(i, 0),
      s = Tt(i),
      c = wt(r, 1),
      f = Tt(r),
      m;
    ((function (e, t, n, r, i, a) {
      function o() {
        return t;
      }
      function s(t) {
        return (function (e, t) {
          let n = e._transformStreamController;
          return e._backpressure
            ? h(e._backpressureChangePromise, () => {
                let r = e._writable;
                if (r._state === `erroring`) throw r._storedError;
                return ur(n, t);
              })
            : ur(n, t);
        })(e, t);
      }
      function c(t) {
        return (function (e, t) {
          let n = e._transformStreamController;
          if (n._finishPromise !== void 0) return n._finishPromise;
          let r = e._readable;
          n._finishPromise = l((e, t) => {
            ((n._finishPromise_resolve = e), (n._finishPromise_reject = t));
          });
          let i = n._cancelAlgorithm(t);
          return (
            cr(n),
            p(
              i,
              () => (
                r._state === `errored`
                  ? pr(n, r._storedError)
                  : (q(r._readableStreamController, t), fr(n)),
                null
              ),
              (e) => (q(r._readableStreamController, e), pr(n, e), null),
            ),
            n._finishPromise
          );
        })(e, t);
      }
      function u() {
        return (function (e) {
          let t = e._transformStreamController;
          if (t._finishPromise !== void 0) return t._finishPromise;
          let n = e._readable;
          t._finishPromise = l((e, n) => {
            ((t._finishPromise_resolve = e), (t._finishPromise_reject = n));
          });
          let r = t._flushAlgorithm();
          return (
            cr(t),
            p(
              r,
              () => (
                n._state === `errored`
                  ? pr(t, n._storedError)
                  : (K(n._readableStreamController), fr(t)),
                null
              ),
              (e) => (q(n._readableStreamController, e), pr(t, e), null),
            ),
            t._finishPromise
          );
        })(e);
      }
      function d() {
        return (function (e) {
          return (or(e, !1), e._backpressureChangePromise);
        })(e);
      }
      function f(t) {
        return (function (e, t) {
          let n = e._transformStreamController;
          if (n._finishPromise !== void 0) return n._finishPromise;
          let r = e._writable;
          n._finishPromise = l((e, t) => {
            ((n._finishPromise_resolve = e), (n._finishPromise_reject = t));
          });
          let i = n._cancelAlgorithm(t);
          return (
            cr(n),
            p(
              i,
              () => (
                r._state === `errored`
                  ? pr(n, r._storedError)
                  : (nn(r._writableStreamController, t), ar(e), fr(n)),
                null
              ),
              (t) => (nn(r._writableStreamController, t), ar(e), pr(n, t), null),
            ),
            n._finishPromise
          );
        })(e, t);
      }
      ((e._writable = (function (e, t, n, r, i = 1, a = () => 1) {
        let o = Object.create(B.prototype);
        return (Pt(o), Qt(o, Object.create(Xt.prototype), e, t, n, r, i, a), o);
      })(o, s, u, c, n, r)),
        (e._readable = Ln(o, d, f, i, a)),
        (e._backpressure = void 0),
        (e._backpressureChangePromise = void 0),
        (e._backpressureChangePromise_resolve = void 0),
        or(e, !0),
        (e._transformStreamController = void 0));
    })(
      this,
      l((e) => {
        m = e;
      }),
      c,
      f,
      o,
      s,
    ),
      (function (e, t) {
        let n = Object.create($.prototype),
          r,
          i,
          a;
        ((r =
          t.transform === void 0
            ? (e) => {
                try {
                  return (lr(n, e), u(void 0));
                } catch (e) {
                  return d(e);
                }
              }
            : (e) => t.transform(e, n)),
          (i = t.flush === void 0 ? () => u(void 0) : () => t.flush(n)),
          (a = t.cancel === void 0 ? () => u(void 0) : (e) => t.cancel(e)),
          (function (e, t, n, r, i) {
            ((t._controlledTransformStream = e),
              (e._transformStreamController = t),
              (t._transformAlgorithm = n),
              (t._flushAlgorithm = r),
              (t._cancelAlgorithm = i),
              (t._finishPromise = void 0),
              (t._finishPromise_resolve = void 0),
              (t._finishPromise_reject = void 0));
          })(e, n, r, i, a));
      })(this, a),
      a.start === void 0 ? m(void 0) : m(a.start(this._transformStreamController)));
  }
  get readable() {
    if (!nr(this)) throw mr(`readable`);
    return this._readable;
  }
  get writable() {
    if (!nr(this)) throw mr(`writable`);
    return this._writable;
  }
};
function nr(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_transformStreamController`) &&
    e instanceof tr
  );
}
function rr(e, t) {
  (q(e._readable._readableStreamController, t), ir(e, t));
}
function ir(e, t) {
  (cr(e._transformStreamController), nn(e._writable._writableStreamController, t), ar(e));
}
function ar(e) {
  e._backpressure && or(e, !1);
}
function or(e, t) {
  (e._backpressureChangePromise !== void 0 && e._backpressureChangePromise_resolve(),
    (e._backpressureChangePromise = l((t) => {
      e._backpressureChangePromise_resolve = t;
    })),
    (e._backpressure = t));
}
(Object.defineProperties(tr.prototype, {
  readable: { enumerable: !0 },
  writable: { enumerable: !0 },
}),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty(tr.prototype, Symbol.toStringTag, {
      value: `TransformStream`,
      configurable: !0,
    }));
var $ = class {
  constructor() {
    throw TypeError(`Illegal constructor`);
  }
  get desiredSize() {
    if (!sr(this)) throw dr(`desiredSize`);
    return En(this._controlledTransformStream._readable._readableStreamController);
  }
  enqueue(e = void 0) {
    if (!sr(this)) throw dr(`enqueue`);
    lr(this, e);
  }
  error(e = void 0) {
    if (!sr(this)) throw dr(`error`);
    var t = e;
    rr(this._controlledTransformStream, t);
  }
  terminate() {
    if (!sr(this)) throw dr(`terminate`);
    (function (e) {
      let t = e._controlledTransformStream;
      (K(t._readable._readableStreamController), ir(t, TypeError(`TransformStream terminated`)));
    })(this);
  }
};
function sr(e) {
  return (
    !!t(e) &&
    !!Object.prototype.hasOwnProperty.call(e, `_controlledTransformStream`) &&
    e instanceof $
  );
}
function cr(e) {
  ((e._transformAlgorithm = void 0), (e._flushAlgorithm = void 0), (e._cancelAlgorithm = void 0));
}
function lr(e, t) {
  let n = e._controlledTransformStream,
    r = n._readable._readableStreamController;
  if (!Dn(r)) throw TypeError(`Readable side is not in a state that permits enqueue`);
  try {
    Tn(r, t);
  } catch (e) {
    throw (ir(n, e), n._readable._storedError);
  }
  (function (e) {
    return !Cn(e);
  })(r) !== n._backpressure && or(n, !0);
}
function ur(e, t) {
  return h(e._transformAlgorithm(t), void 0, (t) => {
    throw (rr(e._controlledTransformStream, t), t);
  });
}
function dr(e) {
  return TypeError(
    `TransformStreamDefaultController.prototype.${e} can only be used on a TransformStreamDefaultController`,
  );
}
function fr(e) {
  e._finishPromise_resolve !== void 0 &&
    (e._finishPromise_resolve(),
    (e._finishPromise_resolve = void 0),
    (e._finishPromise_reject = void 0));
}
function pr(e, t) {
  e._finishPromise_reject !== void 0 &&
    (g(e._finishPromise),
    e._finishPromise_reject(t),
    (e._finishPromise_resolve = void 0),
    (e._finishPromise_reject = void 0));
}
function mr(e) {
  return TypeError(`TransformStream.prototype.${e} can only be used on a TransformStream`);
}
(Object.defineProperties($.prototype, {
  enqueue: { enumerable: !0 },
  error: { enumerable: !0 },
  terminate: { enumerable: !0 },
  desiredSize: { enumerable: !0 },
}),
  r($.prototype.enqueue, `enqueue`),
  r($.prototype.error, `error`),
  r($.prototype.terminate, `terminate`),
  typeof Symbol.toStringTag == `symbol` &&
    Object.defineProperty($.prototype, Symbol.toStringTag, {
      value: `TransformStreamDefaultController`,
      configurable: !0,
    }));
export { J as ReadableStream };
