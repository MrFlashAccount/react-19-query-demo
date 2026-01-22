(function() {
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
	var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
	var __export = (all, symbols) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return target;
	};
	var __copyProps = (to$1, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i$1 = 0, n$1 = keys.length, key; i$1 < n$1; i$1++) {
			key = keys[i$1];
			if (!__hasOwnProp.call(to$1, key) && key !== except) __defProp(to$1, key, {
				get: ((k$1) => from[k$1]).bind(null, key),
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to$1;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));
	var g$1 = globalThis;
	const moduleCache = {};
	g$1.__webpack_module_cache__ = moduleCache;
	g$1.__webpack_require__ = (moduleId) => {
		const cached = moduleCache[moduleId];
		if (cached) return cached.exports ?? cached;
		throw new Error(`[rsc-sw-bff] Module "${moduleId}" not found in webpack cache`);
	};
	g$1.__webpack_chunk_load__ = () => Promise.resolve();
	g$1.__webpack_get_script_filename__ = () => "";
	g$1.__webpack_public_path__ = "/";
	g$1.__webpack_require__.e = () => Promise.resolve();
	g$1.__webpack_require__.r = (exports$1) => {
		if (typeof Symbol !== "undefined" && Symbol.toStringTag) Object.defineProperty(exports$1, Symbol.toStringTag, { value: "Module" });
		Object.defineProperty(exports$1, "__esModule", { value: true });
	};
	g$1.__webpack_require__.d = (exports$1, definition) => {
		for (const key in definition) if (Object.prototype.hasOwnProperty.call(definition, key) && !Object.prototype.hasOwnProperty.call(exports$1, key)) Object.defineProperty(exports$1, key, {
			enumerable: true,
			get: definition[key]
		});
	};
	g$1.__webpack_require__.t = (value, mode) => {
		if (mode & 1) value = g$1.__webpack_require__(value);
		if (mode & 8) return value;
		if (mode & 4 && typeof value === "object" && value && value.__esModule) return value;
		const ns = Object.create(null);
		g$1.__webpack_require__.r(ns);
		Object.defineProperty(ns, "default", {
			enumerable: true,
			value
		});
		if (mode & 2 && typeof value !== "string") for (const key in value) g$1.__webpack_require__.d(ns, { [key]: () => value[key] });
		return ns;
	};
	function json(data, init) {
		const headers = new Headers(init?.headers);
		headers.set("Content-Type", "application/json");
		return new Response(JSON.stringify(data), {
			...init,
			headers
		});
	}
	function error(message, status = 500) {
		return json({ error: message }, { status });
	}
	var require_server = /* @__PURE__ */ __commonJSMin((() => {
		throw new Error("The React Server Writer cannot be used outside a react-server environment. You must configure Node.js using the `--conditions react-server` flag.");
	}));
	var server_exports = /* @__PURE__ */ __export({
		createClientProxy: () => createClientProxy,
		createRSC: () => createRSC,
		createRSCContext: () => createRSCContext,
		decodeActionArgs: () => decodeActionArgs,
		getActionIdFromRequest: () => getActionIdFromRequest,
		handleAction: () => handleAction,
		isActionRequest: () => isActionRequest,
		registerAction: () => registerAction,
		registerActions: () => registerActions,
		renderRSC: () => renderRSC
	}, 1);
	async function ensureImports() {
		if (!_renderToReadableStream) {
			const mod = await Promise.resolve().then(() => /* @__PURE__ */ __toESM(require_server(), 1));
			_renderToReadableStream = mod.renderToReadableStream;
			_registerServerReference = mod.registerServerReference;
			_createClientModuleProxy = mod.createClientModuleProxy;
			_decodeReply = mod.decodeReply;
		}
	}
	function createRSCContext(manifest$1) {
		return {
			manifest: manifest$1,
			actions: /* @__PURE__ */ new Map()
		};
	}
	async function registerAction(ctx, id, fn) {
		await ensureImports();
		const registeredFn = _registerServerReference(fn, id, id);
		ctx.actions.set(id, {
			fn: registeredFn,
			id
		});
	}
	async function registerActions(ctx, actions) {
		await ensureImports();
		for (const [id, fn] of Object.entries(actions)) {
			const registeredFn = _registerServerReference(fn, id, id);
			ctx.actions.set(id, {
				fn: registeredFn,
				id
			});
		}
	}
	async function createClientProxy(moduleId) {
		await ensureImports();
		return _createClientModuleProxy(moduleId);
	}
	async function renderRSC(element, ctx, options) {
		await ensureImports();
		return _renderToReadableStream(element, ctx.manifest, {
			onError: options?.onError ?? ((err) => {
				console.error("[rsc-sw-bff] Render error:", err);
				return "An error occurred during server rendering.";
			}),
			signal: options?.signal
		});
	}
	async function decodeActionArgs(encoded) {
		await ensureImports();
		let body;
		if (encoded.type === "formdata") {
			body = new FormData();
			for (const [key, value] of new URLSearchParams(encoded.data)) body.append(key, value);
		} else body = encoded.data;
		const decoded = await _decodeReply(body, {});
		return Array.isArray(decoded) ? decoded : [decoded];
	}
	async function handleAction(ctx, actionId, encodedArgs, options) {
		await ensureImports();
		const actionName = actionId.includes("#") ? actionId.split("#")[1] ?? actionId : actionId;
		const action = ctx.actions.get(actionName);
		if (!action) {
			const available = Array.from(ctx.actions.keys()).join(", ") || "(none)";
			throw new Error(`Action "${actionName}" not found. Available: ${available}`);
		}
		const args = await decodeActionArgs(encodedArgs);
		const result = await action.fn(...args);
		return _renderToReadableStream(result, ctx.manifest, { onError: options?.onError });
	}
	function getActionIdFromRequest(request) {
		return request.headers.get("rsc-action") ?? request.headers.get("x-rsc-action") ?? null;
	}
	function isActionRequest(request) {
		return getActionIdFromRequest(request) !== null;
	}
	function createSyncClientProxy(moduleId) {
		const cache = /* @__PURE__ */ new Map();
		return new Proxy({}, { get(_target, prop) {
			if (cache.has(prop)) return cache.get(prop);
			const ref = {
				$$typeof: REACT_CLIENT_REFERENCE$2,
				$$id: `${moduleId}#${prop}`,
				name: prop
			};
			cache.set(prop, ref);
			return ref;
		} });
	}
	function createRSC(config) {
		const manifest$1 = { [config.moduleId]: {
			id: config.moduleId,
			chunks: [],
			name: "*"
		} };
		for (const name of config.components) manifest$1[`${config.moduleId}#${name}`] = {
			id: config.moduleId,
			chunks: [],
			name
		};
		const ctx = createRSCContext(manifest$1);
		return {
			ctx,
			Client: createSyncClientProxy(config.moduleId),
			ready: (async () => {
				if (config.actions) {
					await ensureImports();
					for (const [id, fn] of Object.entries(config.actions)) {
						const registeredFn = _registerServerReference(fn, id, id);
						ctx.actions.set(id, {
							fn: registeredFn,
							id
						});
					}
				}
			})()
		};
	}
	var _renderToReadableStream, _registerServerReference, _createClientModuleProxy, _decodeReply, REACT_CLIENT_REFERENCE$2;
	var init_server = __esmMin((() => {
		REACT_CLIENT_REFERENCE$2 = Symbol.for("react.client.reference");
	}));
	function createRouteFactory(method) {
		return function(path, handler) {
			return {
				method,
				path,
				handler
			};
		};
	}
	var RSC_HEADERS = {
		"Content-Type": "text/x-component; charset=utf-8",
		"Cache-Control": "no-cache, no-store, must-revalidate"
	};
	const http = {
		get: createRouteFactory("GET"),
		post: createRouteFactory("POST"),
		put: createRouteFactory("PUT"),
		patch: createRouteFactory("PATCH"),
		delete: createRouteFactory("DELETE"),
		head: createRouteFactory("HEAD"),
		options: createRouteFactory("OPTIONS"),
		all(path, handler) {
			return [
				"GET",
				"POST",
				"PUT",
				"PATCH",
				"DELETE",
				"HEAD",
				"OPTIONS"
			].map((method) => ({
				method,
				path,
				handler
			}));
		},
		rsc(path, render, ctx, options) {
			return {
				method: "GET",
				path,
				handler: async ({ url, request, params }) => {
					const { renderRSC: renderRSC$1 } = await Promise.resolve().then(() => (init_server(), server_exports));
					if (options?.ready) await options.ready;
					const stream = await renderRSC$1(await render({
						url,
						request,
						params
					}), ctx);
					return new Response(stream, { headers: {
						...RSC_HEADERS,
						...options?.headers
					} });
				}
			};
		},
		action(path, ctx, options) {
			return {
				method: "POST",
				path,
				handler: async ({ request }) => {
					const { handleAction: handleAction$1, isActionRequest: isActionRequest$1, getActionIdFromRequest: getActionIdFromRequest$1 } = await Promise.resolve().then(() => (init_server(), server_exports));
					if (options?.ready) await options.ready;
					if (!isActionRequest$1(request)) return json({ error: "Missing action header (x-rsc-action)" }, { status: 400 });
					const actionId = getActionIdFromRequest$1(request);
					const body = await request.text();
					let args = [];
					try {
						args = JSON.parse(body);
						if (!Array.isArray(args)) args = [args];
					} catch {
						args = body ? [body] : [];
					}
					const encodedArgs = {
						type: "string",
						data: JSON.stringify(args)
					};
					try {
						const stream = await handleAction$1(ctx, actionId, encodedArgs);
						return new Response(stream, { headers: {
							...RSC_HEADERS,
							...options?.headers
						} });
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						console.error("[rsc-sw-bff] Action error:", message);
						return json({ error: message }, { status: 500 });
					}
				}
			};
		},
		rscRoutes(path, render, ctx, options) {
			return [this.rsc(path, render, ctx, options), this.action(path, ctx, options)];
		}
	};
	function compileRoute(route) {
		const pattern = new URLPattern({ pathname: route.path });
		return {
			method: route.method,
			pattern,
			handler: route.handler
		};
	}
	function matchRoute(pathname, method, routes) {
		for (const route of routes) {
			if (route.method !== method) continue;
			const match = route.pattern.exec({ pathname });
			if (match) {
				const params = {};
				const groups = match.pathname.groups;
				for (const [key, value] of Object.entries(groups)) if (value !== void 0) params[key] = decodeURIComponent(value);
				return {
					route,
					params
				};
			}
		}
		return null;
	}
	var installedRoutes = [];
	var installedOptions = {};
	function handleFetch(event) {
		const url = new URL(event.request.url);
		const { basePath = "" } = installedOptions;
		if (basePath && !url.pathname.startsWith(basePath)) return;
		const pathname = basePath ? url.pathname.slice(basePath.length) || "/" : url.pathname;
		const method = event.request.method;
		const match = matchRoute(pathname, method, installedRoutes);
		if (!match) {
			if (installedOptions.fallback) event.respondWith(Promise.resolve(installedOptions.fallback(event.request)));
			return;
		}
		event.respondWith((async () => {
			try {
				return await match.route.handler({
					request: event.request,
					url,
					params: match.params
				});
			} catch (err) {
				console.error("[sw-bff] Handler error:", err);
				return error(err instanceof Error ? err.message : String(err), 500);
			}
		})());
	}
	function installListeners() {
		self.addEventListener("install", (event) => {
			event.waitUntil(self.skipWaiting());
		});
		self.addEventListener("activate", (event) => {
			event.waitUntil(self.clients.claim());
		});
		self.addEventListener("fetch", handleFetch);
	}
	function setupWorker(routes, options = {}) {
		installedRoutes = routes.map(compileRoute);
		installedOptions = options;
		installListeners();
	}
	var ponyfill_exports = /* @__PURE__ */ __export({
		ByteLengthQueuingStrategy: () => ByteLengthQueuingStrategy,
		CountQueuingStrategy: () => CountQueuingStrategy,
		ReadableByteStreamController: () => ReadableByteStreamController,
		ReadableStream: () => ReadableStream$1,
		ReadableStreamBYOBReader: () => ReadableStreamBYOBReader,
		ReadableStreamBYOBRequest: () => ReadableStreamBYOBRequest,
		ReadableStreamDefaultController: () => ReadableStreamDefaultController,
		ReadableStreamDefaultReader: () => ReadableStreamDefaultReader,
		TransformStream: () => TransformStream,
		TransformStreamDefaultController: () => TransformStreamDefaultController,
		WritableStream: () => WritableStream,
		WritableStreamDefaultController: () => WritableStreamDefaultController,
		WritableStreamDefaultWriter: () => WritableStreamDefaultWriter
	}, 1);
	/**
	* @license
	* web-streams-polyfill v4.2.0
	* Copyright 2025 Mattias Buelens, Diwank Singh Tomer and other contributors.
	* This code is released under the MIT license.
	* SPDX-License-Identifier: MIT
	*/
	function e() {}
	function t(e$1) {
		return "object" == typeof e$1 && null !== e$1 || "function" == typeof e$1;
	}
	function o(e$1, t$1) {
		try {
			Object.defineProperty(e$1, "name", {
				value: t$1,
				configurable: !0
			});
		} catch (e$2) {}
	}
	function u(e$1) {
		return new n(e$1);
	}
	function c(e$1) {
		return u((t$1) => t$1(e$1));
	}
	function d(e$1) {
		return l(e$1);
	}
	function f(e$1, t$1, r$1) {
		return i.call(e$1, t$1, r$1);
	}
	function b(e$1, t$1, o$1) {
		f(f(e$1, t$1, o$1), void 0, r);
	}
	function h(e$1, t$1) {
		b(e$1, t$1);
	}
	function m(e$1, t$1) {
		b(e$1, void 0, t$1);
	}
	function _(e$1, t$1, r$1) {
		return f(e$1, t$1, r$1);
	}
	function p(e$1) {
		f(e$1, void 0, r);
	}
	function S(e$1, t$1, r$1) {
		if ("function" != typeof e$1) throw new TypeError("Argument is not a function");
		return Function.prototype.apply.call(e$1, t$1, r$1);
	}
	function g(e$1, t$1, r$1) {
		try {
			return c(S(e$1, t$1, r$1));
		} catch (e$2) {
			return d(e$2);
		}
	}
	function q(e$1, t$1) {
		e$1._ownerReadableStream = t$1, t$1._reader = e$1, "readable" === t$1._state ? B(e$1) : "closed" === t$1._state ? function(e$2) {
			B(e$2), A(e$2);
		}(e$1) : k(e$1, t$1._storedError);
	}
	function E(e$1, t$1) {
		return Or(e$1._ownerReadableStream, t$1);
	}
	function W(e$1) {
		const t$1 = e$1._ownerReadableStream;
		"readable" === t$1._state ? j(e$1, /* @__PURE__ */ new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")) : function(e$2, t$2) {
			k(e$2, t$2);
		}(e$1, /* @__PURE__ */ new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")), t$1._readableStreamController[P](), t$1._reader = void 0, e$1._ownerReadableStream = void 0;
	}
	function O(e$1) {
		return /* @__PURE__ */ new TypeError("Cannot " + e$1 + " a stream using a released reader");
	}
	function B(e$1) {
		e$1._closedPromise = u((t$1, r$1) => {
			e$1._closedPromise_resolve = t$1, e$1._closedPromise_reject = r$1;
		});
	}
	function k(e$1, t$1) {
		B(e$1), j(e$1, t$1);
	}
	function j(e$1, t$1) {
		void 0 !== e$1._closedPromise_reject && (p(e$1._closedPromise), e$1._closedPromise_reject(t$1), e$1._closedPromise_resolve = void 0, e$1._closedPromise_reject = void 0);
	}
	function A(e$1) {
		void 0 !== e$1._closedPromise_resolve && (e$1._closedPromise_resolve(void 0), e$1._closedPromise_resolve = void 0, e$1._closedPromise_reject = void 0);
	}
	function L(e$1, t$1) {
		if (void 0 !== e$1 && "object" != typeof (r$1 = e$1) && "function" != typeof r$1) throw new TypeError(`${t$1} is not an object.`);
		var r$1;
	}
	function F(e$1, t$1) {
		if ("function" != typeof e$1) throw new TypeError(`${t$1} is not a function.`);
	}
	function I(e$1, t$1) {
		if (!function(e$2) {
			return "object" == typeof e$2 && null !== e$2 || "function" == typeof e$2;
		}(e$1)) throw new TypeError(`${t$1} is not an object.`);
	}
	function $(e$1, t$1, r$1) {
		if (void 0 === e$1) throw new TypeError(`Parameter ${t$1} is required in '${r$1}'.`);
	}
	function M(e$1, t$1, r$1) {
		if (void 0 === e$1) throw new TypeError(`${t$1} is required in '${r$1}'.`);
	}
	function Y(e$1) {
		return Number(e$1);
	}
	function x(e$1) {
		return 0 === e$1 ? 0 : e$1;
	}
	function Q(e$1, t$1) {
		const r$1 = Number.MAX_SAFE_INTEGER;
		let o$1 = Number(e$1);
		if (o$1 = x(o$1), !z(o$1)) throw new TypeError(`${t$1} is not a finite number`);
		if (o$1 = function(e$2) {
			return x(D(e$2));
		}(o$1), o$1 < 0 || o$1 > r$1) throw new TypeError(`${t$1} is outside the accepted range of 0 to ${r$1}, inclusive`);
		return z(o$1) && 0 !== o$1 ? o$1 : 0;
	}
	function N(e$1, t$1) {
		if (!Er(e$1)) throw new TypeError(`${t$1} is not a ReadableStream.`);
	}
	function H(e$1) {
		return new ReadableStreamDefaultReader(e$1);
	}
	function V(e$1, t$1) {
		e$1._reader._readRequests.push(t$1);
	}
	function U(e$1, t$1, r$1) {
		const o$1 = e$1._reader._readRequests.shift();
		r$1 ? o$1._closeSteps() : o$1._chunkSteps(t$1);
	}
	function G(e$1) {
		return e$1._reader._readRequests.length;
	}
	function X(e$1) {
		const t$1 = e$1._reader;
		return void 0 !== t$1 && !!J(t$1);
	}
	function J(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_readRequests") && e$1 instanceof ReadableStreamDefaultReader;
	}
	function K(e$1, t$1) {
		const r$1 = e$1._ownerReadableStream;
		r$1._disturbed = !0, "closed" === r$1._state ? t$1._closeSteps() : "errored" === r$1._state ? t$1._errorSteps(r$1._storedError) : r$1._readableStreamController[C](t$1);
	}
	function Z(e$1, t$1) {
		const r$1 = e$1._readRequests;
		e$1._readRequests = new v(), r$1.forEach((e$2) => {
			e$2._errorSteps(t$1);
		});
	}
	function ee(e$1) {
		return /* @__PURE__ */ new TypeError(`ReadableStreamDefaultReader.prototype.${e$1} can only be used on a ReadableStreamDefaultReader`);
	}
	function ne(e$1) {
		return e$1.slice();
	}
	function ae(e$1, t$1, r$1, o$1, n$1) {
		new Uint8Array(e$1).set(new Uint8Array(r$1, o$1, n$1), t$1);
	}
	function se(e$1, t$1, r$1) {
		if (e$1.slice) return e$1.slice(t$1, r$1);
		const o$1 = r$1 - t$1, n$1 = new ArrayBuffer(o$1);
		return ae(n$1, 0, e$1, t$1, o$1), n$1;
	}
	function ue(e$1, t$1) {
		const r$1 = e$1[t$1];
		if (null != r$1) {
			if ("function" != typeof r$1) throw new TypeError(`${String(t$1)} is not a function`);
			return r$1;
		}
	}
	function ce(e$1) {
		try {
			const t$1 = e$1.done, r$1 = e$1.value;
			return f(s(r$1), (e$2) => ({
				done: t$1,
				value: e$2
			}));
		} catch (e$2) {
			return d(e$2);
		}
	}
	function fe(e$1, r$1 = "sync", o$1) {
		if (void 0 === o$1) if ("async" === r$1) {
			if (void 0 === (o$1 = ue(e$1, de))) return function(e$2) {
				const r$2 = {
					next() {
						let t$1;
						try {
							t$1 = be(e$2);
						} catch (e$3) {
							return d(e$3);
						}
						return ce(t$1);
					},
					return(r$3) {
						let o$2;
						try {
							const t$1 = ue(e$2.iterator, "return");
							if (void 0 === t$1) return c({
								done: !0,
								value: r$3
							});
							o$2 = S(t$1, e$2.iterator, [r$3]);
						} catch (e$3) {
							return d(e$3);
						}
						return t(o$2) ? ce(o$2) : d(/* @__PURE__ */ new TypeError("The iterator.return() method must return an object"));
					}
				};
				return {
					iterator: r$2,
					nextMethod: r$2.next,
					done: !1
				};
			}(fe(e$1, "sync", ue(e$1, Symbol.iterator)));
		} else o$1 = ue(e$1, Symbol.iterator);
		if (void 0 === o$1) throw new TypeError("The object is not iterable");
		const n$1 = S(o$1, e$1, []);
		if (!t(n$1)) throw new TypeError("The iterator method must return an object");
		return {
			iterator: n$1,
			nextMethod: n$1.next,
			done: !1
		};
	}
	function be(e$1) {
		const r$1 = S(e$1.nextMethod, e$1.iterator, []);
		if (!t(r$1)) throw new TypeError("The iterator.next() method must return an object");
		return r$1;
	}
	function _e(e$1) {
		if (!t(e$1)) return !1;
		if (!Object.prototype.hasOwnProperty.call(e$1, "_asyncIteratorImpl")) return !1;
		try {
			return e$1._asyncIteratorImpl instanceof he;
		} catch (e$2) {
			return !1;
		}
	}
	function pe(e$1) {
		return /* @__PURE__ */ new TypeError(`ReadableStreamAsyncIterator.${e$1} can only be used on a ReadableSteamAsyncIterator`);
	}
	function Se(e$1) {
		const t$1 = se(e$1.buffer, e$1.byteOffset, e$1.byteOffset + e$1.byteLength);
		return new Uint8Array(t$1);
	}
	function ge(e$1) {
		const t$1 = e$1._queue.shift();
		return e$1._queueTotalSize -= t$1.size, e$1._queueTotalSize < 0 && (e$1._queueTotalSize = 0), t$1.value;
	}
	function ve(e$1, t$1, r$1) {
		if ("number" != typeof (o$1 = r$1) || ye(o$1) || o$1 < 0 || r$1 === Infinity) throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
		var o$1;
		e$1._queue.push({
			value: t$1,
			size: r$1
		}), e$1._queueTotalSize += r$1;
	}
	function we(e$1) {
		e$1._queue = new v(), e$1._queueTotalSize = 0;
	}
	function Re(e$1) {
		return e$1 === DataView;
	}
	function Te(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_controlledReadableByteStream") && e$1 instanceof ReadableByteStreamController;
	}
	function Ce(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_associatedReadableByteStreamController") && e$1 instanceof ReadableStreamBYOBRequest;
	}
	function Pe(e$1) {
		if (!function(e$2) {
			const t$1 = e$2._controlledReadableByteStream;
			if ("readable" !== t$1._state) return !1;
			if (e$2._closeRequested) return !1;
			if (!e$2._started) return !1;
			if (X(t$1) && G(t$1) > 0) return !0;
			if (nt(t$1) && ot(t$1) > 0) return !0;
			if (Ue(e$2) > 0) return !0;
			return !1;
		}(e$1)) return;
		if (e$1._pulling) return void (e$1._pullAgain = !0);
		e$1._pulling = !0;
		b(e$1._pullAlgorithm(), () => (e$1._pulling = !1, e$1._pullAgain && (e$1._pullAgain = !1, Pe(e$1)), null), (t$1) => (Ne(e$1, t$1), null));
	}
	function qe(e$1) {
		Le(e$1), e$1._pendingPullIntos = new v();
	}
	function Ee(e$1, t$1) {
		let r$1 = !1;
		"closed" === e$1._state && (r$1 = !0);
		const o$1 = Oe(t$1);
		"default" === t$1.readerType ? U(e$1, o$1, r$1) : function(e$2, t$2, r$2) {
			const n$1 = e$2._reader._readIntoRequests.shift();
			r$2 ? n$1._closeSteps(t$2) : n$1._chunkSteps(t$2);
		}(e$1, o$1, r$1);
	}
	function We(e$1, t$1) {
		for (let r$1 = 0; r$1 < t$1.length; ++r$1) Ee(e$1, t$1[r$1]);
	}
	function Oe(e$1) {
		const t$1 = e$1.bytesFilled, r$1 = e$1.elementSize;
		return new e$1.viewConstructor(e$1.buffer, e$1.byteOffset, t$1 / r$1);
	}
	function Be(e$1, t$1, r$1, o$1) {
		e$1._queue.push({
			buffer: t$1,
			byteOffset: r$1,
			byteLength: o$1
		}), e$1._queueTotalSize += o$1;
	}
	function ke(e$1, t$1, r$1, o$1) {
		let n$1;
		try {
			n$1 = se(t$1, r$1, r$1 + o$1);
		} catch (t$2) {
			throw Ne(e$1, t$2), t$2;
		}
		Be(e$1, n$1, 0, o$1);
	}
	function je(e$1, t$1) {
		t$1.bytesFilled > 0 && ke(e$1, t$1.buffer, t$1.byteOffset, t$1.bytesFilled), Me(e$1);
	}
	function Ae(e$1, t$1) {
		const r$1 = Math.min(e$1._queueTotalSize, t$1.byteLength - t$1.bytesFilled), o$1 = t$1.bytesFilled + r$1;
		let n$1 = r$1, a$1 = !1;
		const i$1 = o$1 - o$1 % t$1.elementSize;
		i$1 >= t$1.minimumFill && (n$1 = i$1 - t$1.bytesFilled, a$1 = !0);
		const l$1 = e$1._queue;
		for (; n$1 > 0;) {
			const r$2 = l$1.peek(), o$2 = Math.min(n$1, r$2.byteLength), a$2 = t$1.byteOffset + t$1.bytesFilled;
			ae(t$1.buffer, a$2, r$2.buffer, r$2.byteOffset, o$2), r$2.byteLength === o$2 ? l$1.shift() : (r$2.byteOffset += o$2, r$2.byteLength -= o$2), e$1._queueTotalSize -= o$2, ze(e$1, o$2, t$1), n$1 -= o$2;
		}
		return a$1;
	}
	function ze(e$1, t$1, r$1) {
		r$1.bytesFilled += t$1;
	}
	function De(e$1) {
		0 === e$1._queueTotalSize && e$1._closeRequested ? (Ye(e$1), Br(e$1._controlledReadableByteStream)) : Pe(e$1);
	}
	function Le(e$1) {
		null !== e$1._byobRequest && (e$1._byobRequest._associatedReadableByteStreamController = void 0, e$1._byobRequest._view = null, e$1._byobRequest = null);
	}
	function Fe(e$1) {
		const t$1 = [];
		for (; e$1._pendingPullIntos.length > 0 && 0 !== e$1._queueTotalSize;) {
			const r$1 = e$1._pendingPullIntos.peek();
			Ae(e$1, r$1) && (Me(e$1), t$1.push(r$1));
		}
		return t$1;
	}
	function Ie(e$1, t$1, r$1, o$1) {
		const n$1 = e$1._controlledReadableByteStream, a$1 = t$1.constructor, i$1 = function(e$2) {
			return Re(e$2) ? 1 : e$2.BYTES_PER_ELEMENT;
		}(a$1), { byteOffset: l$1, byteLength: s$1 } = t$1, u$1 = r$1 * i$1;
		let c$1;
		try {
			c$1 = ie(t$1.buffer);
		} catch (e$2) {
			o$1._errorSteps(e$2);
			return;
		}
		const d$1 = {
			buffer: c$1,
			bufferByteLength: c$1.byteLength,
			byteOffset: l$1,
			byteLength: s$1,
			bytesFilled: 0,
			minimumFill: u$1,
			elementSize: i$1,
			viewConstructor: a$1,
			readerType: "byob"
		};
		if (e$1._pendingPullIntos.length > 0) return e$1._pendingPullIntos.push(d$1), void rt(n$1, o$1);
		if ("closed" === n$1._state) {
			const e$2 = new a$1(d$1.buffer, d$1.byteOffset, 0);
			o$1._closeSteps(e$2);
			return;
		}
		if (e$1._queueTotalSize > 0) {
			if (Ae(e$1, d$1)) {
				const t$2 = Oe(d$1);
				De(e$1), o$1._chunkSteps(t$2);
				return;
			}
			if (e$1._closeRequested) {
				const t$2 = /* @__PURE__ */ new TypeError("Insufficient bytes to fill elements in the given buffer");
				Ne(e$1, t$2), o$1._errorSteps(t$2);
				return;
			}
		}
		e$1._pendingPullIntos.push(d$1), rt(n$1, o$1), Pe(e$1);
	}
	function $e(e$1, t$1) {
		const r$1 = e$1._pendingPullIntos.peek();
		Le(e$1);
		"closed" === e$1._controlledReadableByteStream._state ? function(e$2, t$2) {
			"none" === t$2.readerType && Me(e$2);
			const r$2 = e$2._controlledReadableByteStream;
			if (nt(r$2)) {
				const t$3 = [];
				for (; t$3.length < ot(r$2);) t$3.push(Me(e$2));
				We(r$2, t$3);
			}
		}(e$1, r$1) : function(e$2, t$2, r$2) {
			if (ze(0, t$2, r$2), "none" === r$2.readerType) {
				je(e$2, r$2);
				const t$3 = Fe(e$2);
				We(e$2._controlledReadableByteStream, t$3);
				return;
			}
			if (r$2.bytesFilled < r$2.minimumFill) return;
			Me(e$2);
			const o$1 = r$2.bytesFilled % r$2.elementSize;
			if (o$1 > 0) {
				const t$3 = r$2.byteOffset + r$2.bytesFilled;
				ke(e$2, r$2.buffer, t$3 - o$1, o$1);
			}
			r$2.bytesFilled -= o$1;
			const n$1 = Fe(e$2);
			Ee(e$2._controlledReadableByteStream, r$2), We(e$2._controlledReadableByteStream, n$1);
		}(e$1, t$1, r$1), Pe(e$1);
	}
	function Me(e$1) {
		return e$1._pendingPullIntos.shift();
	}
	function Ye(e$1) {
		e$1._pullAlgorithm = void 0, e$1._cancelAlgorithm = void 0;
	}
	function xe(e$1) {
		const t$1 = e$1._controlledReadableByteStream;
		if (!e$1._closeRequested && "readable" === t$1._state) if (e$1._queueTotalSize > 0) e$1._closeRequested = !0;
		else {
			if (e$1._pendingPullIntos.length > 0) {
				const t$2 = e$1._pendingPullIntos.peek();
				if (t$2.bytesFilled % t$2.elementSize !== 0) {
					const t$3 = /* @__PURE__ */ new TypeError("Insufficient bytes to fill elements in the given buffer");
					throw Ne(e$1, t$3), t$3;
				}
			}
			Ye(e$1), Br(t$1);
		}
	}
	function Qe(e$1, t$1) {
		const r$1 = e$1._controlledReadableByteStream;
		if (e$1._closeRequested || "readable" !== r$1._state) return;
		const { buffer: o$1, byteOffset: n$1, byteLength: a$1 } = t$1;
		if (le(o$1)) throw new TypeError("chunk's buffer is detached and so cannot be enqueued");
		const i$1 = ie(o$1);
		if (e$1._pendingPullIntos.length > 0) {
			const t$2 = e$1._pendingPullIntos.peek();
			if (le(t$2.buffer)) throw new TypeError("The BYOB request's buffer has been detached and so cannot be filled with an enqueued chunk");
			Le(e$1), t$2.buffer = ie(t$2.buffer), "none" === t$2.readerType && je(e$1, t$2);
		}
		if (X(r$1)) if (function(e$2) {
			const t$2 = e$2._controlledReadableByteStream._reader;
			for (; t$2._readRequests.length > 0;) {
				if (0 === e$2._queueTotalSize) return;
				He(e$2, t$2._readRequests.shift());
			}
		}(e$1), 0 === G(r$1)) Be(e$1, i$1, n$1, a$1);
		else {
			e$1._pendingPullIntos.length > 0 && Me(e$1);
			U(r$1, new Uint8Array(i$1, n$1, a$1), !1);
		}
		else if (nt(r$1)) {
			Be(e$1, i$1, n$1, a$1);
			We(r$1, Fe(e$1));
		} else Be(e$1, i$1, n$1, a$1);
		Pe(e$1);
	}
	function Ne(e$1, t$1) {
		const r$1 = e$1._controlledReadableByteStream;
		"readable" === r$1._state && (qe(e$1), we(e$1), Ye(e$1), kr(r$1, t$1));
	}
	function He(e$1, t$1) {
		const r$1 = e$1._queue.shift();
		e$1._queueTotalSize -= r$1.byteLength, De(e$1);
		const o$1 = new Uint8Array(r$1.buffer, r$1.byteOffset, r$1.byteLength);
		t$1._chunkSteps(o$1);
	}
	function Ve(e$1) {
		if (null === e$1._byobRequest && e$1._pendingPullIntos.length > 0) {
			const t$1 = e$1._pendingPullIntos.peek(), r$1 = new Uint8Array(t$1.buffer, t$1.byteOffset + t$1.bytesFilled, t$1.byteLength - t$1.bytesFilled), o$1 = Object.create(ReadableStreamBYOBRequest.prototype);
			(function(e$2, t$2, r$2) {
				e$2._associatedReadableByteStreamController = t$2, e$2._view = r$2;
			})(o$1, e$1, r$1), e$1._byobRequest = o$1;
		}
		return e$1._byobRequest;
	}
	function Ue(e$1) {
		const t$1 = e$1._controlledReadableByteStream._state;
		return "errored" === t$1 ? null : "closed" === t$1 ? 0 : e$1._strategyHWM - e$1._queueTotalSize;
	}
	function Ge(e$1, t$1) {
		const r$1 = e$1._pendingPullIntos.peek();
		if ("closed" === e$1._controlledReadableByteStream._state) {
			if (0 !== t$1) throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
		} else {
			if (0 === t$1) throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");
			if (r$1.bytesFilled + t$1 > r$1.byteLength) throw new RangeError("bytesWritten out of range");
		}
		r$1.buffer = ie(r$1.buffer), $e(e$1, t$1);
	}
	function Xe(e$1, t$1) {
		const r$1 = e$1._pendingPullIntos.peek();
		if ("closed" === e$1._controlledReadableByteStream._state) {
			if (0 !== t$1.byteLength) throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream");
		} else if (0 === t$1.byteLength) throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");
		if (r$1.byteOffset + r$1.bytesFilled !== t$1.byteOffset) throw new RangeError("The region specified by view does not match byobRequest");
		if (r$1.bufferByteLength !== t$1.buffer.byteLength) throw new RangeError("The buffer of view has different capacity than byobRequest");
		if (r$1.bytesFilled + t$1.byteLength > r$1.byteLength) throw new RangeError("The region specified by view is larger than byobRequest");
		const o$1 = t$1.byteLength;
		r$1.buffer = ie(t$1.buffer), $e(e$1, o$1);
	}
	function Je(e$1, t$1, r$1, o$1, n$1, a$1, i$1) {
		t$1._controlledReadableByteStream = e$1, t$1._pullAgain = !1, t$1._pulling = !1, t$1._byobRequest = null, t$1._queue = t$1._queueTotalSize = void 0, we(t$1), t$1._closeRequested = !1, t$1._started = !1, t$1._strategyHWM = a$1, t$1._pullAlgorithm = o$1, t$1._cancelAlgorithm = n$1, t$1._autoAllocateChunkSize = i$1, t$1._pendingPullIntos = new v(), e$1._readableStreamController = t$1;
		b(c(r$1()), () => (t$1._started = !0, Pe(t$1), null), (e$2) => (Ne(t$1, e$2), null));
	}
	function Ke(e$1) {
		return /* @__PURE__ */ new TypeError(`ReadableStreamBYOBRequest.prototype.${e$1} can only be used on a ReadableStreamBYOBRequest`);
	}
	function Ze(e$1) {
		return /* @__PURE__ */ new TypeError(`ReadableByteStreamController.prototype.${e$1} can only be used on a ReadableByteStreamController`);
	}
	function et(e$1, t$1) {
		if ("byob" !== (e$1 = `${e$1}`)) throw new TypeError(`${t$1} '${e$1}' is not a valid enumeration value for ReadableStreamReaderMode`);
		return e$1;
	}
	function tt(e$1) {
		return new ReadableStreamBYOBReader(e$1);
	}
	function rt(e$1, t$1) {
		e$1._reader._readIntoRequests.push(t$1);
	}
	function ot(e$1) {
		return e$1._reader._readIntoRequests.length;
	}
	function nt(e$1) {
		const t$1 = e$1._reader;
		return void 0 !== t$1 && !!at(t$1);
	}
	function at(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_readIntoRequests") && e$1 instanceof ReadableStreamBYOBReader;
	}
	function it(e$1, t$1, r$1, o$1) {
		const n$1 = e$1._ownerReadableStream;
		n$1._disturbed = !0, "errored" === n$1._state ? o$1._errorSteps(n$1._storedError) : Ie(n$1._readableStreamController, t$1, r$1, o$1);
	}
	function lt(e$1, t$1) {
		const r$1 = e$1._readIntoRequests;
		e$1._readIntoRequests = new v(), r$1.forEach((e$2) => {
			e$2._errorSteps(t$1);
		});
	}
	function st(e$1) {
		return /* @__PURE__ */ new TypeError(`ReadableStreamBYOBReader.prototype.${e$1} can only be used on a ReadableStreamBYOBReader`);
	}
	function ut(e$1, t$1) {
		const { highWaterMark: r$1 } = e$1;
		if (void 0 === r$1) return t$1;
		if (ye(r$1) || r$1 < 0) throw new RangeError("Invalid highWaterMark");
		return r$1;
	}
	function ct(e$1) {
		const { size: t$1 } = e$1;
		return t$1 || (() => 1);
	}
	function dt(e$1, t$1) {
		L(e$1, t$1);
		const r$1 = null == e$1 ? void 0 : e$1.highWaterMark, o$1 = null == e$1 ? void 0 : e$1.size;
		return {
			highWaterMark: void 0 === r$1 ? void 0 : Y(r$1),
			size: void 0 === o$1 ? void 0 : ft(o$1, `${t$1} has member 'size' that`)
		};
	}
	function ft(e$1, t$1) {
		return F(e$1, t$1), (t$2) => Y(e$1(t$2));
	}
	function bt(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2) => g(e$1, t$1, [r$2]);
	}
	function ht(e$1, t$1, r$1) {
		return F(e$1, r$1), () => g(e$1, t$1, []);
	}
	function mt(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2) => S(e$1, t$1, [r$2]);
	}
	function _t(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2, o$1) => g(e$1, t$1, [r$2, o$1]);
	}
	function pt(e$1, t$1) {
		if (!gt(e$1)) throw new TypeError(`${t$1} is not a WritableStream.`);
	}
	function yt(e$1) {
		return new WritableStreamDefaultWriter(e$1);
	}
	function St(e$1) {
		e$1._state = "writable", e$1._storedError = void 0, e$1._writer = void 0, e$1._writableStreamController = void 0, e$1._writeRequests = new v(), e$1._inFlightWriteRequest = void 0, e$1._closeRequest = void 0, e$1._inFlightCloseRequest = void 0, e$1._pendingAbortRequest = void 0, e$1._backpressure = !1;
	}
	function gt(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_writableStreamController") && e$1 instanceof WritableStream;
	}
	function vt(e$1) {
		return void 0 !== e$1._writer;
	}
	function wt(e$1, t$1) {
		var r$1;
		if ("closed" === e$1._state || "errored" === e$1._state) return c(void 0);
		e$1._writableStreamController._abortReason = t$1, null === (r$1 = e$1._writableStreamController._abortController) || void 0 === r$1 || r$1.abort(t$1);
		const o$1 = e$1._state;
		if ("closed" === o$1 || "errored" === o$1) return c(void 0);
		if (void 0 !== e$1._pendingAbortRequest) return e$1._pendingAbortRequest._promise;
		let n$1 = !1;
		"erroring" === o$1 && (n$1 = !0, t$1 = void 0);
		const a$1 = u((r$2, o$2) => {
			e$1._pendingAbortRequest = {
				_promise: void 0,
				_resolve: r$2,
				_reject: o$2,
				_reason: t$1,
				_wasAlreadyErroring: n$1
			};
		});
		return e$1._pendingAbortRequest._promise = a$1, n$1 || Ct(e$1, t$1), a$1;
	}
	function Rt(e$1) {
		const t$1 = e$1._state;
		if ("closed" === t$1 || "errored" === t$1) return d(/* @__PURE__ */ new TypeError(`The stream (in ${t$1} state) is not in the writable state and cannot be closed`));
		const r$1 = u((t$2, r$2) => {
			e$1._closeRequest = {
				_resolve: t$2,
				_reject: r$2
			};
		}), o$1 = e$1._writer;
		var n$1;
		return void 0 !== o$1 && e$1._backpressure && "writable" === t$1 && or(o$1), ve(n$1 = e$1._writableStreamController, Dt, 0), Mt(n$1), r$1;
	}
	function Tt(e$1, t$1) {
		"writable" !== e$1._state ? Pt(e$1) : Ct(e$1, t$1);
	}
	function Ct(e$1, t$1) {
		const r$1 = e$1._writableStreamController;
		e$1._state = "erroring", e$1._storedError = t$1;
		const o$1 = e$1._writer;
		void 0 !== o$1 && jt(o$1, t$1), !function(e$2) {
			if (void 0 === e$2._inFlightWriteRequest && void 0 === e$2._inFlightCloseRequest) return !1;
			return !0;
		}(e$1) && r$1._started && Pt(e$1);
	}
	function Pt(e$1) {
		e$1._state = "errored", e$1._writableStreamController[R]();
		const t$1 = e$1._storedError;
		if (e$1._writeRequests.forEach((e$2) => {
			e$2._reject(t$1);
		}), e$1._writeRequests = new v(), void 0 === e$1._pendingAbortRequest) return void Et(e$1);
		const r$1 = e$1._pendingAbortRequest;
		if (e$1._pendingAbortRequest = void 0, r$1._wasAlreadyErroring) return r$1._reject(t$1), void Et(e$1);
		b(e$1._writableStreamController[w](r$1._reason), () => (r$1._resolve(), Et(e$1), null), (t$2) => (r$1._reject(t$2), Et(e$1), null));
	}
	function qt(e$1) {
		return void 0 !== e$1._closeRequest || void 0 !== e$1._inFlightCloseRequest;
	}
	function Et(e$1) {
		void 0 !== e$1._closeRequest && (e$1._closeRequest._reject(e$1._storedError), e$1._closeRequest = void 0);
		const t$1 = e$1._writer;
		void 0 !== t$1 && Jt(t$1, e$1._storedError);
	}
	function Wt(e$1, t$1) {
		const r$1 = e$1._writer;
		void 0 !== r$1 && t$1 !== e$1._backpressure && (t$1 ? function(e$2) {
			Zt(e$2);
		}(r$1) : or(r$1)), e$1._backpressure = t$1;
	}
	function Ot(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_ownerWritableStream") && e$1 instanceof WritableStreamDefaultWriter;
	}
	function Bt(e$1) {
		return Rt(e$1._ownerWritableStream);
	}
	function kt(e$1, t$1) {
		"pending" === e$1._closedPromiseState ? Jt(e$1, t$1) : function(e$2, t$2) {
			Xt(e$2, t$2);
		}(e$1, t$1);
	}
	function jt(e$1, t$1) {
		"pending" === e$1._readyPromiseState ? rr(e$1, t$1) : function(e$2, t$2) {
			er(e$2, t$2);
		}(e$1, t$1);
	}
	function At(e$1) {
		const t$1 = e$1._ownerWritableStream, r$1 = /* @__PURE__ */ new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");
		jt(e$1, r$1), kt(e$1, r$1), t$1._writer = void 0, e$1._ownerWritableStream = void 0;
	}
	function zt(e$1, t$1) {
		const r$1 = e$1._ownerWritableStream, o$1 = r$1._writableStreamController, n$1 = function(e$2, t$2) {
			if (void 0 === e$2._strategySizeAlgorithm) return 1;
			try {
				return e$2._strategySizeAlgorithm(t$2);
			} catch (t$3) {
				return Yt(e$2, t$3), 1;
			}
		}(o$1, t$1);
		if (r$1 !== e$1._ownerWritableStream) return d(Ut("write to"));
		const a$1 = r$1._state;
		if ("errored" === a$1) return d(r$1._storedError);
		if (qt(r$1) || "closed" === a$1) return d(/* @__PURE__ */ new TypeError("The stream is closing or closed and cannot be written to"));
		if ("erroring" === a$1) return d(r$1._storedError);
		const i$1 = function(e$2) {
			return u((t$2, r$2) => {
				const o$2 = {
					_resolve: t$2,
					_reject: r$2
				};
				e$2._writeRequests.push(o$2);
			});
		}(r$1);
		return function(e$2, t$2, r$2) {
			try {
				ve(e$2, t$2, r$2);
			} catch (t$3) {
				Yt(e$2, t$3);
				return;
			}
			const o$2 = e$2._controlledWritableStream;
			if (!qt(o$2) && "writable" === o$2._state) Wt(o$2, xt(e$2));
			Mt(e$2);
		}(o$1, t$1, n$1), i$1;
	}
	function Lt(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_controlledWritableStream") && e$1 instanceof WritableStreamDefaultController;
	}
	function Ft(e$1, t$1, r$1, o$1, n$1, a$1, i$1, l$1) {
		t$1._controlledWritableStream = e$1, e$1._writableStreamController = t$1, t$1._queue = void 0, t$1._queueTotalSize = void 0, we(t$1), t$1._abortReason = void 0, t$1._abortController = function() {
			if ("function" == typeof AbortController) return new AbortController();
		}(), t$1._started = !1, t$1._strategySizeAlgorithm = l$1, t$1._strategyHWM = i$1, t$1._writeAlgorithm = o$1, t$1._closeAlgorithm = n$1, t$1._abortAlgorithm = a$1;
		Wt(e$1, xt(t$1));
		b(c(r$1()), () => (t$1._started = !0, Mt(t$1), null), (r$2) => (t$1._started = !0, Tt(e$1, r$2), null));
	}
	function It(e$1) {
		e$1._writeAlgorithm = void 0, e$1._closeAlgorithm = void 0, e$1._abortAlgorithm = void 0, e$1._strategySizeAlgorithm = void 0;
	}
	function $t(e$1) {
		return e$1._strategyHWM - e$1._queueTotalSize;
	}
	function Mt(e$1) {
		const t$1 = e$1._controlledWritableStream;
		if (!e$1._started) return;
		if (void 0 !== t$1._inFlightWriteRequest) return;
		if ("erroring" === t$1._state) return void Pt(t$1);
		if (0 === e$1._queue.length) return;
		const r$1 = e$1._queue.peek().value;
		r$1 === Dt ? function(e$2) {
			const t$2 = e$2._controlledWritableStream;
			(function(e$3) {
				e$3._inFlightCloseRequest = e$3._closeRequest, e$3._closeRequest = void 0;
			})(t$2), ge(e$2);
			const r$2 = e$2._closeAlgorithm();
			It(e$2), b(r$2, () => (function(e$3) {
				e$3._inFlightCloseRequest._resolve(void 0), e$3._inFlightCloseRequest = void 0, "erroring" === e$3._state && (e$3._storedError = void 0, void 0 !== e$3._pendingAbortRequest && (e$3._pendingAbortRequest._resolve(), e$3._pendingAbortRequest = void 0)), e$3._state = "closed";
				const t$3 = e$3._writer;
				void 0 !== t$3 && Kt(t$3);
			}(t$2), null), (e$3) => (function(e$4, t$3) {
				e$4._inFlightCloseRequest._reject(t$3), e$4._inFlightCloseRequest = void 0, void 0 !== e$4._pendingAbortRequest && (e$4._pendingAbortRequest._reject(t$3), e$4._pendingAbortRequest = void 0), Tt(e$4, t$3);
			}(t$2, e$3), null));
		}(e$1) : function(e$2, t$2) {
			const r$2 = e$2._controlledWritableStream;
			(function(e$3) {
				e$3._inFlightWriteRequest = e$3._writeRequests.shift();
			})(r$2);
			b(e$2._writeAlgorithm(t$2), () => {
				(function(e$3) {
					e$3._inFlightWriteRequest._resolve(void 0), e$3._inFlightWriteRequest = void 0;
				})(r$2);
				const t$3 = r$2._state;
				if (ge(e$2), !qt(r$2) && "writable" === t$3) Wt(r$2, xt(e$2));
				return Mt(e$2), null;
			}, (t$3) => ("writable" === r$2._state && It(e$2), function(e$3, t$4) {
				e$3._inFlightWriteRequest._reject(t$4), e$3._inFlightWriteRequest = void 0, Tt(e$3, t$4);
			}(r$2, t$3), null));
		}(e$1, r$1);
	}
	function Yt(e$1, t$1) {
		"writable" === e$1._controlledWritableStream._state && Qt(e$1, t$1);
	}
	function xt(e$1) {
		return $t(e$1) <= 0;
	}
	function Qt(e$1, t$1) {
		const r$1 = e$1._controlledWritableStream;
		It(e$1), Ct(r$1, t$1);
	}
	function Nt(e$1) {
		return /* @__PURE__ */ new TypeError(`WritableStream.prototype.${e$1} can only be used on a WritableStream`);
	}
	function Ht(e$1) {
		return /* @__PURE__ */ new TypeError(`WritableStreamDefaultController.prototype.${e$1} can only be used on a WritableStreamDefaultController`);
	}
	function Vt(e$1) {
		return /* @__PURE__ */ new TypeError(`WritableStreamDefaultWriter.prototype.${e$1} can only be used on a WritableStreamDefaultWriter`);
	}
	function Ut(e$1) {
		return /* @__PURE__ */ new TypeError("Cannot " + e$1 + " a stream using a released writer");
	}
	function Gt(e$1) {
		e$1._closedPromise = u((t$1, r$1) => {
			e$1._closedPromise_resolve = t$1, e$1._closedPromise_reject = r$1, e$1._closedPromiseState = "pending";
		});
	}
	function Xt(e$1, t$1) {
		Gt(e$1), Jt(e$1, t$1);
	}
	function Jt(e$1, t$1) {
		void 0 !== e$1._closedPromise_reject && (p(e$1._closedPromise), e$1._closedPromise_reject(t$1), e$1._closedPromise_resolve = void 0, e$1._closedPromise_reject = void 0, e$1._closedPromiseState = "rejected");
	}
	function Kt(e$1) {
		void 0 !== e$1._closedPromise_resolve && (e$1._closedPromise_resolve(void 0), e$1._closedPromise_resolve = void 0, e$1._closedPromise_reject = void 0, e$1._closedPromiseState = "resolved");
	}
	function Zt(e$1) {
		e$1._readyPromise = u((t$1, r$1) => {
			e$1._readyPromise_resolve = t$1, e$1._readyPromise_reject = r$1;
		}), e$1._readyPromiseState = "pending";
	}
	function er(e$1, t$1) {
		Zt(e$1), rr(e$1, t$1);
	}
	function tr(e$1) {
		Zt(e$1), or(e$1);
	}
	function rr(e$1, t$1) {
		void 0 !== e$1._readyPromise_reject && (p(e$1._readyPromise), e$1._readyPromise_reject(t$1), e$1._readyPromise_resolve = void 0, e$1._readyPromise_reject = void 0, e$1._readyPromiseState = "rejected");
	}
	function or(e$1) {
		void 0 !== e$1._readyPromise_resolve && (e$1._readyPromise_resolve(void 0), e$1._readyPromise_resolve = void 0, e$1._readyPromise_reject = void 0, e$1._readyPromiseState = "fulfilled");
	}
	function ir(t$1, r$1, o$1, n$1, a$1, i$1) {
		const l$1 = H(t$1), s$1 = yt(r$1);
		t$1._disturbed = !0;
		let _$1 = !1, y$1 = c(void 0);
		return u((S$1, g$2) => {
			let v$1;
			if (void 0 !== i$1) {
				if (v$1 = () => {
					const e$1 = void 0 !== i$1.reason ? i$1.reason : new ar("Aborted", "AbortError"), o$2 = [];
					n$1 || o$2.push(() => "writable" === r$1._state ? wt(r$1, e$1) : c(void 0)), a$1 || o$2.push(() => "readable" === t$1._state ? Or(t$1, e$1) : c(void 0)), q$1(() => Promise.all(o$2.map((e$2) => e$2())), !0, e$1);
				}, i$1.aborted) return void v$1();
				i$1.addEventListener("abort", v$1);
			}
			var w$1, R$1, T$1;
			if (P$1(t$1, l$1._closedPromise, (e$1) => (n$1 ? E$1(!0, e$1) : q$1(() => wt(r$1, e$1), !0, e$1), null)), P$1(r$1, s$1._closedPromise, (e$1) => (a$1 ? E$1(!0, e$1) : q$1(() => Or(t$1, e$1), !0, e$1), null)), w$1 = t$1, R$1 = l$1._closedPromise, T$1 = () => (o$1 ? E$1() : q$1(() => function(e$1) {
				const t$2 = e$1._ownerWritableStream, r$2 = t$2._state;
				return qt(t$2) || "closed" === r$2 ? c(void 0) : "errored" === r$2 ? d(t$2._storedError) : Bt(e$1);
			}(s$1)), null), "closed" === w$1._state ? T$1() : h(R$1, T$1), qt(r$1) || "closed" === r$1._state) {
				const e$1 = /* @__PURE__ */ new TypeError("the destination writable stream closed before all data could be piped to it");
				a$1 ? E$1(!0, e$1) : q$1(() => Or(t$1, e$1), !0, e$1);
			}
			function C$1() {
				const e$1 = y$1;
				return f(y$1, () => e$1 !== y$1 ? C$1() : void 0);
			}
			function P$1(e$1, t$2, r$2) {
				"errored" === e$1._state ? r$2(e$1._storedError) : m(t$2, r$2);
			}
			function q$1(e$1, t$2, o$2) {
				function n$2() {
					return b(e$1(), () => O$1(t$2, o$2), (e$2) => O$1(!0, e$2)), null;
				}
				_$1 || (_$1 = !0, "writable" !== r$1._state || qt(r$1) ? n$2() : h(C$1(), n$2));
			}
			function E$1(e$1, t$2) {
				_$1 || (_$1 = !0, "writable" !== r$1._state || qt(r$1) ? O$1(e$1, t$2) : h(C$1(), () => O$1(e$1, t$2)));
			}
			function O$1(e$1, t$2) {
				return At(s$1), W(l$1), void 0 !== i$1 && i$1.removeEventListener("abort", v$1), e$1 ? g$2(t$2) : S$1(void 0), null;
			}
			p(u((t$2, r$2) => {
				(function o$2(n$2) {
					n$2 ? t$2() : f(_$1 ? c(!0) : f(s$1._readyPromise, () => u((t$3, r$3) => {
						K(l$1, {
							_chunkSteps: (r$4) => {
								y$1 = f(zt(s$1, r$4), void 0, e), t$3(!1);
							},
							_closeSteps: () => t$3(!0),
							_errorSteps: r$3
						});
					})), o$2, r$2);
				})(!1);
			}));
		});
	}
	function lr(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_controlledReadableStream") && e$1 instanceof ReadableStreamDefaultController;
	}
	function sr(e$1) {
		if (!ur(e$1)) return;
		if (e$1._pulling) return void (e$1._pullAgain = !0);
		e$1._pulling = !0;
		b(e$1._pullAlgorithm(), () => (e$1._pulling = !1, e$1._pullAgain && (e$1._pullAgain = !1, sr(e$1)), null), (t$1) => (br(e$1, t$1), null));
	}
	function ur(e$1) {
		const t$1 = e$1._controlledReadableStream;
		if (!mr(e$1)) return !1;
		if (!e$1._started) return !1;
		if (Wr(t$1) && G(t$1) > 0) return !0;
		return hr(e$1) > 0;
	}
	function cr(e$1) {
		e$1._pullAlgorithm = void 0, e$1._cancelAlgorithm = void 0, e$1._strategySizeAlgorithm = void 0;
	}
	function dr(e$1) {
		if (!mr(e$1)) return;
		const t$1 = e$1._controlledReadableStream;
		e$1._closeRequested = !0, 0 === e$1._queue.length && (cr(e$1), Br(t$1));
	}
	function fr(e$1, t$1) {
		if (!mr(e$1)) return;
		const r$1 = e$1._controlledReadableStream;
		if (Wr(r$1) && G(r$1) > 0) U(r$1, t$1, !1);
		else {
			let r$2;
			try {
				r$2 = e$1._strategySizeAlgorithm(t$1);
			} catch (t$2) {
				throw br(e$1, t$2), t$2;
			}
			try {
				ve(e$1, t$1, r$2);
			} catch (t$2) {
				throw br(e$1, t$2), t$2;
			}
		}
		sr(e$1);
	}
	function br(e$1, t$1) {
		const r$1 = e$1._controlledReadableStream;
		"readable" === r$1._state && (we(e$1), cr(e$1), kr(r$1, t$1));
	}
	function hr(e$1) {
		const t$1 = e$1._controlledReadableStream._state;
		return "errored" === t$1 ? null : "closed" === t$1 ? 0 : e$1._strategyHWM - e$1._queueTotalSize;
	}
	function mr(e$1) {
		const t$1 = e$1._controlledReadableStream._state;
		return !e$1._closeRequested && "readable" === t$1;
	}
	function _r(e$1, t$1, r$1, o$1, n$1, a$1, i$1) {
		t$1._controlledReadableStream = e$1, t$1._queue = void 0, t$1._queueTotalSize = void 0, we(t$1), t$1._started = !1, t$1._closeRequested = !1, t$1._pullAgain = !1, t$1._pulling = !1, t$1._strategySizeAlgorithm = i$1, t$1._strategyHWM = a$1, t$1._pullAlgorithm = o$1, t$1._cancelAlgorithm = n$1, e$1._readableStreamController = t$1;
		b(c(r$1()), () => (t$1._started = !0, sr(t$1), null), (e$2) => (br(t$1, e$2), null));
	}
	function pr(e$1) {
		return /* @__PURE__ */ new TypeError(`ReadableStreamDefaultController.prototype.${e$1} can only be used on a ReadableStreamDefaultController`);
	}
	function yr(e$1, t$1) {
		return Te(e$1._readableStreamController) ? function(e$2) {
			let t$2, r$1, o$1, n$1, a$1, i$1 = H(e$2), l$1 = !1, s$1 = !1, d$1 = !1, f$1 = !1, b$1 = !1;
			const h$1 = u((e$3) => {
				a$1 = e$3;
			});
			function _$1(e$3) {
				m(e$3._closedPromise, (t$3) => (e$3 !== i$1 || (Ne(o$1._readableStreamController, t$3), Ne(n$1._readableStreamController, t$3), f$1 && b$1 || a$1(void 0)), null));
			}
			function p$1() {
				at(i$1) && (W(i$1), i$1 = H(e$2), _$1(i$1));
				K(i$1, {
					_chunkSteps: (t$3) => {
						y(() => {
							s$1 = !1, d$1 = !1;
							const r$2 = t$3;
							let i$2 = t$3;
							if (!f$1 && !b$1) try {
								i$2 = Se(t$3);
							} catch (t$4) {
								Ne(o$1._readableStreamController, t$4), Ne(n$1._readableStreamController, t$4), a$1(Or(e$2, t$4));
								return;
							}
							f$1 || Qe(o$1._readableStreamController, r$2), b$1 || Qe(n$1._readableStreamController, i$2), l$1 = !1, s$1 ? g$2() : d$1 && v$1();
						});
					},
					_closeSteps: () => {
						l$1 = !1, f$1 || xe(o$1._readableStreamController), b$1 || xe(n$1._readableStreamController), o$1._readableStreamController._pendingPullIntos.length > 0 && Ge(o$1._readableStreamController, 0), n$1._readableStreamController._pendingPullIntos.length > 0 && Ge(n$1._readableStreamController, 0), f$1 && b$1 || a$1(void 0);
					},
					_errorSteps: () => {
						l$1 = !1;
					}
				});
			}
			function S$1(t$3, r$2) {
				J(i$1) && (W(i$1), i$1 = tt(e$2), _$1(i$1));
				const u$1 = r$2 ? n$1 : o$1, c$1 = r$2 ? o$1 : n$1;
				it(i$1, t$3, 1, {
					_chunkSteps: (t$4) => {
						y(() => {
							s$1 = !1, d$1 = !1;
							const o$2 = r$2 ? b$1 : f$1;
							if (r$2 ? f$1 : b$1) o$2 || Xe(u$1._readableStreamController, t$4);
							else {
								let r$3;
								try {
									r$3 = Se(t$4);
								} catch (t$5) {
									Ne(u$1._readableStreamController, t$5), Ne(c$1._readableStreamController, t$5), a$1(Or(e$2, t$5));
									return;
								}
								o$2 || Xe(u$1._readableStreamController, t$4), Qe(c$1._readableStreamController, r$3);
							}
							l$1 = !1, s$1 ? g$2() : d$1 && v$1();
						});
					},
					_closeSteps: (e$3) => {
						l$1 = !1;
						const t$4 = r$2 ? b$1 : f$1, o$2 = r$2 ? f$1 : b$1;
						t$4 || xe(u$1._readableStreamController), o$2 || xe(c$1._readableStreamController), void 0 !== e$3 && (t$4 || Xe(u$1._readableStreamController, e$3), !o$2 && c$1._readableStreamController._pendingPullIntos.length > 0 && Ge(c$1._readableStreamController, 0)), t$4 && o$2 || a$1(void 0);
					},
					_errorSteps: () => {
						l$1 = !1;
					}
				});
			}
			function g$2() {
				if (l$1) return s$1 = !0, c(void 0);
				l$1 = !0;
				const e$3 = Ve(o$1._readableStreamController);
				return null === e$3 ? p$1() : S$1(e$3._view, !1), c(void 0);
			}
			function v$1() {
				if (l$1) return d$1 = !0, c(void 0);
				l$1 = !0;
				const e$3 = Ve(n$1._readableStreamController);
				return null === e$3 ? p$1() : S$1(e$3._view, !0), c(void 0);
			}
			function w$1(o$2) {
				if (f$1 = !0, t$2 = o$2, b$1) {
					const n$2 = Or(e$2, ne([t$2, r$1]));
					a$1(n$2);
				}
				return h$1;
			}
			function R$1(o$2) {
				if (b$1 = !0, r$1 = o$2, f$1) {
					const n$2 = Or(e$2, ne([t$2, r$1]));
					a$1(n$2);
				}
				return h$1;
			}
			function T$1() {}
			return o$1 = Pr(T$1, g$2, w$1), n$1 = Pr(T$1, v$1, R$1), _$1(i$1), [o$1, n$1];
		}(e$1) : function(e$2) {
			const t$2 = H(e$2);
			let r$1, o$1, n$1, a$1, i$1, l$1 = !1, s$1 = !1, d$1 = !1, f$1 = !1;
			const b$1 = u((e$3) => {
				i$1 = e$3;
			});
			function h$1() {
				if (l$1) return s$1 = !0, c(void 0);
				l$1 = !0;
				return K(t$2, {
					_chunkSteps: (e$3) => {
						y(() => {
							s$1 = !1;
							const t$3 = e$3, r$2 = e$3;
							d$1 || fr(n$1._readableStreamController, t$3), f$1 || fr(a$1._readableStreamController, r$2), l$1 = !1, s$1 && h$1();
						});
					},
					_closeSteps: () => {
						l$1 = !1, d$1 || dr(n$1._readableStreamController), f$1 || dr(a$1._readableStreamController), d$1 && f$1 || i$1(void 0);
					},
					_errorSteps: () => {
						l$1 = !1;
					}
				}), c(void 0);
			}
			function _$1(t$3) {
				if (d$1 = !0, r$1 = t$3, f$1) {
					const n$2 = Or(e$2, ne([r$1, o$1]));
					i$1(n$2);
				}
				return b$1;
			}
			function p$1(t$3) {
				if (f$1 = !0, o$1 = t$3, d$1) {
					const n$2 = Or(e$2, ne([r$1, o$1]));
					i$1(n$2);
				}
				return b$1;
			}
			function S$1() {}
			return n$1 = Cr(S$1, h$1, _$1), a$1 = Cr(S$1, h$1, p$1), m(t$2._closedPromise, (e$3) => (br(n$1._readableStreamController, e$3), br(a$1._readableStreamController, e$3), d$1 && f$1 || i$1(void 0), null)), [n$1, a$1];
		}(e$1);
	}
	function Sr(r$1) {
		return t(o$1 = r$1) && void 0 !== o$1.getReader ? function(r$2) {
			let o$2;
			function n$1() {
				let e$1;
				try {
					e$1 = r$2.read();
				} catch (e$2) {
					return d(e$2);
				}
				return _(e$1, (e$2) => {
					if (!t(e$2)) throw new TypeError("The promise returned by the reader.read() method must fulfill with an object");
					if (e$2.done) dr(o$2._readableStreamController);
					else {
						const t$1 = e$2.value;
						fr(o$2._readableStreamController, t$1);
					}
				});
			}
			function a$1(e$1) {
				try {
					return c(r$2.cancel(e$1));
				} catch (e$2) {
					return d(e$2);
				}
			}
			return o$2 = Cr(e, n$1, a$1, 0), o$2;
		}(r$1.getReader()) : function(r$2) {
			let o$2;
			const n$1 = fe(r$2, "async");
			function a$1() {
				let e$1;
				try {
					e$1 = be(n$1);
				} catch (e$2) {
					return d(e$2);
				}
				return _(c(e$1), (e$2) => {
					if (!t(e$2)) throw new TypeError("The promise returned by the iterator.next() method must fulfill with an object");
					if (e$2.done) dr(o$2._readableStreamController);
					else {
						const t$1 = e$2.value;
						fr(o$2._readableStreamController, t$1);
					}
				});
			}
			function i$1(e$1) {
				const r$3 = n$1.iterator;
				let o$3;
				try {
					o$3 = ue(r$3, "return");
				} catch (e$2) {
					return d(e$2);
				}
				if (void 0 === o$3) return c(void 0);
				return _(g(o$3, r$3, [e$1]), (e$2) => {
					if (!t(e$2)) throw new TypeError("The promise returned by the iterator.return() method must fulfill with an object");
				});
			}
			return o$2 = Cr(e, a$1, i$1, 0), o$2;
		}(r$1);
		var o$1;
	}
	function gr(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2) => g(e$1, t$1, [r$2]);
	}
	function vr(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2) => g(e$1, t$1, [r$2]);
	}
	function wr(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2) => S(e$1, t$1, [r$2]);
	}
	function Rr(e$1, t$1) {
		if ("bytes" !== (e$1 = `${e$1}`)) throw new TypeError(`${t$1} '${e$1}' is not a valid enumeration value for ReadableStreamType`);
		return e$1;
	}
	function Tr(e$1, t$1) {
		L(e$1, t$1);
		const r$1 = null == e$1 ? void 0 : e$1.preventAbort, o$1 = null == e$1 ? void 0 : e$1.preventCancel, n$1 = null == e$1 ? void 0 : e$1.preventClose, a$1 = null == e$1 ? void 0 : e$1.signal;
		return void 0 !== a$1 && function(e$2, t$2) {
			if (!function(e$3) {
				if ("object" != typeof e$3 || null === e$3) return !1;
				try {
					return "boolean" == typeof e$3.aborted;
				} catch (e$4) {
					return !1;
				}
			}(e$2)) throw new TypeError(`${t$2} is not an AbortSignal.`);
		}(a$1, `${t$1} has member 'signal' that`), {
			preventAbort: Boolean(r$1),
			preventCancel: Boolean(o$1),
			preventClose: Boolean(n$1),
			signal: a$1
		};
	}
	function Cr(e$1, t$1, r$1, o$1 = 1, n$1 = () => 1) {
		const a$1 = Object.create(ReadableStream$1.prototype);
		qr(a$1);
		return _r(a$1, Object.create(ReadableStreamDefaultController.prototype), e$1, t$1, r$1, o$1, n$1), a$1;
	}
	function Pr(e$1, t$1, r$1) {
		const o$1 = Object.create(ReadableStream$1.prototype);
		qr(o$1);
		return Je(o$1, Object.create(ReadableByteStreamController.prototype), e$1, t$1, r$1, 0, void 0), o$1;
	}
	function qr(e$1) {
		e$1._state = "readable", e$1._reader = void 0, e$1._storedError = void 0, e$1._disturbed = !1;
	}
	function Er(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_readableStreamController") && e$1 instanceof ReadableStream$1;
	}
	function Wr(e$1) {
		return void 0 !== e$1._reader;
	}
	function Or(t$1, r$1) {
		if (t$1._disturbed = !0, "closed" === t$1._state) return c(void 0);
		if ("errored" === t$1._state) return d(t$1._storedError);
		Br(t$1);
		const o$1 = t$1._reader;
		if (void 0 !== o$1 && at(o$1)) {
			const e$1 = o$1._readIntoRequests;
			o$1._readIntoRequests = new v(), e$1.forEach((e$2) => {
				e$2._closeSteps(void 0);
			});
		}
		return _(t$1._readableStreamController[T](r$1), e);
	}
	function Br(e$1) {
		e$1._state = "closed";
		const t$1 = e$1._reader;
		if (void 0 !== t$1 && (A(t$1), J(t$1))) {
			const e$2 = t$1._readRequests;
			t$1._readRequests = new v(), e$2.forEach((e$3) => {
				e$3._closeSteps();
			});
		}
	}
	function kr(e$1, t$1) {
		e$1._state = "errored", e$1._storedError = t$1;
		const r$1 = e$1._reader;
		void 0 !== r$1 && (j(r$1, t$1), J(r$1) ? Z(r$1, t$1) : lt(r$1, t$1));
	}
	function jr(e$1) {
		return /* @__PURE__ */ new TypeError(`ReadableStream.prototype.${e$1} can only be used on a ReadableStream`);
	}
	function Ar(e$1, t$1) {
		L(e$1, t$1);
		const r$1 = null == e$1 ? void 0 : e$1.highWaterMark;
		return M(r$1, "highWaterMark", "QueuingStrategyInit"), { highWaterMark: Y(r$1) };
	}
	function Dr(e$1) {
		return /* @__PURE__ */ new TypeError(`ByteLengthQueuingStrategy.prototype.${e$1} can only be used on a ByteLengthQueuingStrategy`);
	}
	function Lr(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_byteLengthQueuingStrategyHighWaterMark") && e$1 instanceof ByteLengthQueuingStrategy;
	}
	function Ir(e$1) {
		return /* @__PURE__ */ new TypeError(`CountQueuingStrategy.prototype.${e$1} can only be used on a CountQueuingStrategy`);
	}
	function $r(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_countQueuingStrategyHighWaterMark") && e$1 instanceof CountQueuingStrategy;
	}
	function Mr(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2) => g(e$1, t$1, [r$2]);
	}
	function Yr(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2) => S(e$1, t$1, [r$2]);
	}
	function xr(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2, o$1) => g(e$1, t$1, [r$2, o$1]);
	}
	function Qr(e$1, t$1, r$1) {
		return F(e$1, r$1), (r$2) => g(e$1, t$1, [r$2]);
	}
	function Nr(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_transformStreamController") && e$1 instanceof TransformStream;
	}
	function Hr(e$1, t$1) {
		br(e$1._readable._readableStreamController, t$1), Vr(e$1, t$1);
	}
	function Vr(e$1, t$1) {
		Jr(e$1._transformStreamController), Yt(e$1._writable._writableStreamController, t$1), Ur(e$1);
	}
	function Ur(e$1) {
		e$1._backpressure && Gr(e$1, !1);
	}
	function Gr(e$1, t$1) {
		void 0 !== e$1._backpressureChangePromise && e$1._backpressureChangePromise_resolve(), e$1._backpressureChangePromise = u((t$2) => {
			e$1._backpressureChangePromise_resolve = t$2;
		}), e$1._backpressure = t$1;
	}
	function Xr(e$1) {
		return !!t(e$1) && !!Object.prototype.hasOwnProperty.call(e$1, "_controlledTransformStream") && e$1 instanceof TransformStreamDefaultController;
	}
	function Jr(e$1) {
		e$1._transformAlgorithm = void 0, e$1._flushAlgorithm = void 0, e$1._cancelAlgorithm = void 0;
	}
	function Kr(e$1, t$1) {
		const r$1 = e$1._controlledTransformStream, o$1 = r$1._readable._readableStreamController;
		if (!mr(o$1)) throw new TypeError("Readable side is not in a state that permits enqueue");
		try {
			fr(o$1, t$1);
		} catch (e$2) {
			throw Vr(r$1, e$2), r$1._readable._storedError;
		}
		(function(e$2) {
			return !ur(e$2);
		})(o$1) !== r$1._backpressure && Gr(r$1, !0);
	}
	function Zr(e$1, t$1) {
		return _(e$1._transformAlgorithm(t$1), void 0, (t$2) => {
			throw Hr(e$1._controlledTransformStream, t$2), t$2;
		});
	}
	function eo(e$1) {
		return /* @__PURE__ */ new TypeError(`TransformStreamDefaultController.prototype.${e$1} can only be used on a TransformStreamDefaultController`);
	}
	function to(e$1) {
		void 0 !== e$1._finishPromise_resolve && (e$1._finishPromise_resolve(), e$1._finishPromise_resolve = void 0, e$1._finishPromise_reject = void 0);
	}
	function ro(e$1, t$1) {
		void 0 !== e$1._finishPromise_reject && (p(e$1._finishPromise), e$1._finishPromise_reject(t$1), e$1._finishPromise_resolve = void 0, e$1._finishPromise_reject = void 0);
	}
	function oo(e$1) {
		return /* @__PURE__ */ new TypeError(`TransformStream.prototype.${e$1} can only be used on a TransformStream`);
	}
	var r, n, a, i, l, s, y, v, w, R, T, C, P, z, D, ReadableStreamDefaultReader, te, re, oe, ie, le, de, he, me, ye, ReadableStreamBYOBRequest, ReadableByteStreamController, ReadableStreamBYOBReader, WritableStream, WritableStreamDefaultWriter, Dt, WritableStreamDefaultController, nr, ar, ReadableStreamDefaultController, ReadableStream$1, zr, ByteLengthQueuingStrategy, Fr, CountQueuingStrategy, TransformStream, TransformStreamDefaultController;
	var init_ponyfill = __esmMin((() => {
		r = e;
		n = Promise, a = Promise.resolve.bind(n), i = Promise.prototype.then, l = Promise.reject.bind(n), s = a;
		y = (e$1) => {
			if ("function" == typeof queueMicrotask) y = queueMicrotask;
			else {
				const e$2 = c(void 0);
				y = (t$1) => f(e$2, t$1);
			}
			return y(e$1);
		};
		v = class {
			constructor() {
				this._cursor = 0, this._size = 0, this._front = {
					_elements: [],
					_next: void 0
				}, this._back = this._front, this._cursor = 0, this._size = 0;
			}
			get length() {
				return this._size;
			}
			push(e$1) {
				const t$1 = this._back;
				let r$1 = t$1;
				16383 === t$1._elements.length && (r$1 = {
					_elements: [],
					_next: void 0
				}), t$1._elements.push(e$1), r$1 !== t$1 && (this._back = r$1, t$1._next = r$1), ++this._size;
			}
			shift() {
				const e$1 = this._front;
				let t$1 = e$1;
				const r$1 = this._cursor;
				let o$1 = r$1 + 1;
				const n$1 = e$1._elements, a$1 = n$1[r$1];
				return 16384 === o$1 && (t$1 = e$1._next, o$1 = 0), --this._size, this._cursor = o$1, e$1 !== t$1 && (this._front = t$1), n$1[r$1] = void 0, a$1;
			}
			forEach(e$1) {
				let t$1 = this._cursor, r$1 = this._front, o$1 = r$1._elements;
				for (; !(t$1 === o$1.length && void 0 === r$1._next || t$1 === o$1.length && (r$1 = r$1._next, o$1 = r$1._elements, t$1 = 0, 0 === o$1.length));) e$1(o$1[t$1]), ++t$1;
			}
			peek() {
				const e$1 = this._front, t$1 = this._cursor;
				return e$1._elements[t$1];
			}
		};
		w = Symbol("[[AbortSteps]]"), R = Symbol("[[ErrorSteps]]"), T = Symbol("[[CancelSteps]]"), C = Symbol("[[PullSteps]]"), P = Symbol("[[ReleaseSteps]]");
		z = Number.isFinite || function(e$1) {
			return "number" == typeof e$1 && isFinite(e$1);
		}, D = Math.trunc || function(e$1) {
			return e$1 < 0 ? Math.ceil(e$1) : Math.floor(e$1);
		};
		ReadableStreamDefaultReader = class {
			constructor(e$1) {
				if ($(e$1, 1, "ReadableStreamDefaultReader"), N(e$1, "First parameter"), Wr(e$1)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
				q(this, e$1), this._readRequests = new v();
			}
			get closed() {
				return J(this) ? this._closedPromise : d(ee("closed"));
			}
			cancel(e$1 = void 0) {
				return J(this) ? void 0 === this._ownerReadableStream ? d(O("cancel")) : E(this, e$1) : d(ee("cancel"));
			}
			read() {
				if (!J(this)) return d(ee("read"));
				if (void 0 === this._ownerReadableStream) return d(O("read from"));
				let e$1, t$1;
				const r$1 = u((r$2, o$1) => {
					e$1 = r$2, t$1 = o$1;
				});
				return K(this, {
					_chunkSteps: (t$2) => e$1({
						value: t$2,
						done: !1
					}),
					_closeSteps: () => e$1({
						value: void 0,
						done: !0
					}),
					_errorSteps: (e$2) => t$1(e$2)
				}), r$1;
			}
			releaseLock() {
				if (!J(this)) throw ee("releaseLock");
				void 0 !== this._ownerReadableStream && function(e$1) {
					W(e$1);
					Z(e$1, /* @__PURE__ */ new TypeError("Reader was released"));
				}(this);
			}
		};
		Object.defineProperties(ReadableStreamDefaultReader.prototype, {
			cancel: { enumerable: !0 },
			read: { enumerable: !0 },
			releaseLock: { enumerable: !0 },
			closed: { enumerable: !0 }
		}), o(ReadableStreamDefaultReader.prototype.cancel, "cancel"), o(ReadableStreamDefaultReader.prototype.read, "read"), o(ReadableStreamDefaultReader.prototype.releaseLock, "releaseLock"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ReadableStreamDefaultReader.prototype, Symbol.toStringTag, {
			value: "ReadableStreamDefaultReader",
			configurable: !0
		});
		ie = (e$1) => (ie = "function" == typeof e$1.transfer ? (e$2) => e$2.transfer() : "function" == typeof structuredClone ? (e$2) => structuredClone(e$2, { transfer: [e$2] }) : (e$2) => e$2, ie(e$1)), le = (e$1) => (le = "boolean" == typeof e$1.detached ? (e$2) => e$2.detached : (e$2) => 0 === e$2.byteLength, le(e$1));
		de = null !== (oe = null !== (te = Symbol.asyncIterator) && void 0 !== te ? te : null === (re = Symbol.for) || void 0 === re ? void 0 : re.call(Symbol, "Symbol.asyncIterator")) && void 0 !== oe ? oe : "@@asyncIterator";
		he = class {
			constructor(e$1, t$1) {
				this._ongoingPromise = void 0, this._isFinished = !1, this._reader = e$1, this._preventCancel = t$1;
			}
			next() {
				const e$1 = () => this._nextSteps();
				return this._ongoingPromise = this._ongoingPromise ? _(this._ongoingPromise, e$1, e$1) : e$1(), this._ongoingPromise;
			}
			return(e$1) {
				const t$1 = () => this._returnSteps(e$1);
				return this._ongoingPromise = this._ongoingPromise ? _(this._ongoingPromise, t$1, t$1) : t$1(), this._ongoingPromise;
			}
			_nextSteps() {
				if (this._isFinished) return Promise.resolve({
					value: void 0,
					done: !0
				});
				const e$1 = this._reader;
				let t$1, r$1;
				const o$1 = u((e$2, o$2) => {
					t$1 = e$2, r$1 = o$2;
				});
				return K(e$1, {
					_chunkSteps: (e$2) => {
						this._ongoingPromise = void 0, y(() => t$1({
							value: e$2,
							done: !1
						}));
					},
					_closeSteps: () => {
						this._ongoingPromise = void 0, this._isFinished = !0, W(e$1), t$1({
							value: void 0,
							done: !0
						});
					},
					_errorSteps: (t$2) => {
						this._ongoingPromise = void 0, this._isFinished = !0, W(e$1), r$1(t$2);
					}
				}), o$1;
			}
			_returnSteps(e$1) {
				if (this._isFinished) return Promise.resolve({
					value: e$1,
					done: !0
				});
				this._isFinished = !0;
				const t$1 = this._reader;
				if (!this._preventCancel) {
					const r$1 = E(t$1, e$1);
					return W(t$1), _(r$1, () => ({
						value: e$1,
						done: !0
					}));
				}
				return W(t$1), c({
					value: e$1,
					done: !0
				});
			}
		};
		me = {
			next() {
				return _e(this) ? this._asyncIteratorImpl.next() : d(pe("next"));
			},
			return(e$1) {
				return _e(this) ? this._asyncIteratorImpl.return(e$1) : d(pe("return"));
			},
			[de]() {
				return this;
			}
		};
		Object.defineProperty(me, de, { enumerable: !1 });
		ye = Number.isNaN || function(e$1) {
			return e$1 != e$1;
		};
		ReadableStreamBYOBRequest = class {
			constructor() {
				throw new TypeError("Illegal constructor");
			}
			get view() {
				if (!Ce(this)) throw Ke("view");
				return this._view;
			}
			respond(e$1) {
				if (!Ce(this)) throw Ke("respond");
				if ($(e$1, 1, "respond"), e$1 = Q(e$1, "First parameter"), void 0 === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
				if (le(this._view.buffer)) throw new TypeError("The BYOB request's buffer has been detached and so cannot be used as a response");
				Ge(this._associatedReadableByteStreamController, e$1);
			}
			respondWithNewView(e$1) {
				if (!Ce(this)) throw Ke("respondWithNewView");
				if ($(e$1, 1, "respondWithNewView"), !ArrayBuffer.isView(e$1)) throw new TypeError("You can only respond with array buffer views");
				if (void 0 === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
				if (le(e$1.buffer)) throw new TypeError("The given view's buffer has been detached and so cannot be used as a response");
				Xe(this._associatedReadableByteStreamController, e$1);
			}
		};
		Object.defineProperties(ReadableStreamBYOBRequest.prototype, {
			respond: { enumerable: !0 },
			respondWithNewView: { enumerable: !0 },
			view: { enumerable: !0 }
		}), o(ReadableStreamBYOBRequest.prototype.respond, "respond"), o(ReadableStreamBYOBRequest.prototype.respondWithNewView, "respondWithNewView"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ReadableStreamBYOBRequest.prototype, Symbol.toStringTag, {
			value: "ReadableStreamBYOBRequest",
			configurable: !0
		});
		ReadableByteStreamController = class {
			constructor() {
				throw new TypeError("Illegal constructor");
			}
			get byobRequest() {
				if (!Te(this)) throw Ze("byobRequest");
				return Ve(this);
			}
			get desiredSize() {
				if (!Te(this)) throw Ze("desiredSize");
				return Ue(this);
			}
			close() {
				if (!Te(this)) throw Ze("close");
				if (this._closeRequested) throw new TypeError("The stream has already been closed; do not close it again!");
				const e$1 = this._controlledReadableByteStream._state;
				if ("readable" !== e$1) throw new TypeError(`The stream (in ${e$1} state) is not in the readable state and cannot be closed`);
				xe(this);
			}
			enqueue(e$1) {
				if (!Te(this)) throw Ze("enqueue");
				if ($(e$1, 1, "enqueue"), !ArrayBuffer.isView(e$1)) throw new TypeError("chunk must be an array buffer view");
				if (0 === e$1.byteLength) throw new TypeError("chunk must have non-zero byteLength");
				if (0 === e$1.buffer.byteLength) throw new TypeError("chunk's buffer must have non-zero byteLength");
				if (this._closeRequested) throw new TypeError("stream is closed or draining");
				const t$1 = this._controlledReadableByteStream._state;
				if ("readable" !== t$1) throw new TypeError(`The stream (in ${t$1} state) is not in the readable state and cannot be enqueued to`);
				Qe(this, e$1);
			}
			error(e$1 = void 0) {
				if (!Te(this)) throw Ze("error");
				Ne(this, e$1);
			}
			[T](e$1) {
				qe(this), we(this);
				const t$1 = this._cancelAlgorithm(e$1);
				return Ye(this), t$1;
			}
			[C](e$1) {
				const t$1 = this._controlledReadableByteStream;
				if (this._queueTotalSize > 0) return void He(this, e$1);
				const r$1 = this._autoAllocateChunkSize;
				if (void 0 !== r$1) {
					let t$2;
					try {
						t$2 = new ArrayBuffer(r$1);
					} catch (t$3) {
						e$1._errorSteps(t$3);
						return;
					}
					const o$1 = {
						buffer: t$2,
						bufferByteLength: r$1,
						byteOffset: 0,
						byteLength: r$1,
						bytesFilled: 0,
						minimumFill: 1,
						elementSize: 1,
						viewConstructor: Uint8Array,
						readerType: "default"
					};
					this._pendingPullIntos.push(o$1);
				}
				V(t$1, e$1), Pe(this);
			}
			[P]() {
				if (this._pendingPullIntos.length > 0) {
					const e$1 = this._pendingPullIntos.peek();
					e$1.readerType = "none", this._pendingPullIntos = new v(), this._pendingPullIntos.push(e$1);
				}
			}
		};
		Object.defineProperties(ReadableByteStreamController.prototype, {
			close: { enumerable: !0 },
			enqueue: { enumerable: !0 },
			error: { enumerable: !0 },
			byobRequest: { enumerable: !0 },
			desiredSize: { enumerable: !0 }
		}), o(ReadableByteStreamController.prototype.close, "close"), o(ReadableByteStreamController.prototype.enqueue, "enqueue"), o(ReadableByteStreamController.prototype.error, "error"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ReadableByteStreamController.prototype, Symbol.toStringTag, {
			value: "ReadableByteStreamController",
			configurable: !0
		});
		ReadableStreamBYOBReader = class {
			constructor(e$1) {
				if ($(e$1, 1, "ReadableStreamBYOBReader"), N(e$1, "First parameter"), Wr(e$1)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
				if (!Te(e$1._readableStreamController)) throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
				q(this, e$1), this._readIntoRequests = new v();
			}
			get closed() {
				return at(this) ? this._closedPromise : d(st("closed"));
			}
			cancel(e$1 = void 0) {
				return at(this) ? void 0 === this._ownerReadableStream ? d(O("cancel")) : E(this, e$1) : d(st("cancel"));
			}
			read(e$1, t$1 = {}) {
				if (!at(this)) return d(st("read"));
				if (!ArrayBuffer.isView(e$1)) return d(/* @__PURE__ */ new TypeError("view must be an array buffer view"));
				if (0 === e$1.byteLength) return d(/* @__PURE__ */ new TypeError("view must have non-zero byteLength"));
				if (0 === e$1.buffer.byteLength) return d(/* @__PURE__ */ new TypeError("view's buffer must have non-zero byteLength"));
				if (le(e$1.buffer)) return d(/* @__PURE__ */ new TypeError("view's buffer has been detached"));
				let r$1;
				try {
					r$1 = function(e$2, t$2) {
						var r$2;
						return L(e$2, t$2), { min: Q(null !== (r$2 = null == e$2 ? void 0 : e$2.min) && void 0 !== r$2 ? r$2 : 1, `${t$2} has member 'min' that`) };
					}(t$1, "options");
				} catch (e$2) {
					return d(e$2);
				}
				const o$1 = r$1.min;
				if (0 === o$1) return d(/* @__PURE__ */ new TypeError("options.min must be greater than 0"));
				if (function(e$2) {
					return Re(e$2.constructor);
				}(e$1)) {
					if (o$1 > e$1.byteLength) return d(/* @__PURE__ */ new RangeError("options.min must be less than or equal to view's byteLength"));
				} else if (o$1 > e$1.length) return d(/* @__PURE__ */ new RangeError("options.min must be less than or equal to view's length"));
				if (void 0 === this._ownerReadableStream) return d(O("read from"));
				let n$1, a$1;
				const i$1 = u((e$2, t$2) => {
					n$1 = e$2, a$1 = t$2;
				});
				return it(this, e$1, o$1, {
					_chunkSteps: (e$2) => n$1({
						value: e$2,
						done: !1
					}),
					_closeSteps: (e$2) => n$1({
						value: e$2,
						done: !0
					}),
					_errorSteps: (e$2) => a$1(e$2)
				}), i$1;
			}
			releaseLock() {
				if (!at(this)) throw st("releaseLock");
				void 0 !== this._ownerReadableStream && function(e$1) {
					W(e$1);
					lt(e$1, /* @__PURE__ */ new TypeError("Reader was released"));
				}(this);
			}
		};
		Object.defineProperties(ReadableStreamBYOBReader.prototype, {
			cancel: { enumerable: !0 },
			read: { enumerable: !0 },
			releaseLock: { enumerable: !0 },
			closed: { enumerable: !0 }
		}), o(ReadableStreamBYOBReader.prototype.cancel, "cancel"), o(ReadableStreamBYOBReader.prototype.read, "read"), o(ReadableStreamBYOBReader.prototype.releaseLock, "releaseLock"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ReadableStreamBYOBReader.prototype, Symbol.toStringTag, {
			value: "ReadableStreamBYOBReader",
			configurable: !0
		});
		WritableStream = class {
			constructor(e$1 = {}, t$1 = {}) {
				void 0 === e$1 ? e$1 = null : I(e$1, "First parameter");
				const r$1 = dt(t$1, "Second parameter"), o$1 = function(e$2, t$2) {
					L(e$2, t$2);
					const r$2 = null == e$2 ? void 0 : e$2.abort, o$2 = null == e$2 ? void 0 : e$2.close, n$2 = null == e$2 ? void 0 : e$2.start, a$1 = null == e$2 ? void 0 : e$2.type, i$1 = null == e$2 ? void 0 : e$2.write;
					return {
						abort: void 0 === r$2 ? void 0 : bt(r$2, e$2, `${t$2} has member 'abort' that`),
						close: void 0 === o$2 ? void 0 : ht(o$2, e$2, `${t$2} has member 'close' that`),
						start: void 0 === n$2 ? void 0 : mt(n$2, e$2, `${t$2} has member 'start' that`),
						write: void 0 === i$1 ? void 0 : _t(i$1, e$2, `${t$2} has member 'write' that`),
						type: a$1
					};
				}(e$1, "First parameter");
				St(this);
				if (void 0 !== o$1.type) throw new RangeError("Invalid type is specified");
				const n$1 = ct(r$1);
				(function(e$2, t$2, r$2, o$2) {
					const n$2 = Object.create(WritableStreamDefaultController.prototype);
					let a$1, i$1, l$1, s$1;
					a$1 = void 0 !== t$2.start ? () => t$2.start(n$2) : () => {};
					i$1 = void 0 !== t$2.write ? (e$3) => t$2.write(e$3, n$2) : () => c(void 0);
					l$1 = void 0 !== t$2.close ? () => t$2.close() : () => c(void 0);
					s$1 = void 0 !== t$2.abort ? (e$3) => t$2.abort(e$3) : () => c(void 0);
					Ft(e$2, n$2, a$1, i$1, l$1, s$1, r$2, o$2);
				})(this, o$1, ut(r$1, 1), n$1);
			}
			get locked() {
				if (!gt(this)) throw Nt("locked");
				return vt(this);
			}
			abort(e$1 = void 0) {
				return gt(this) ? vt(this) ? d(/* @__PURE__ */ new TypeError("Cannot abort a stream that already has a writer")) : wt(this, e$1) : d(Nt("abort"));
			}
			close() {
				return gt(this) ? vt(this) ? d(/* @__PURE__ */ new TypeError("Cannot close a stream that already has a writer")) : qt(this) ? d(/* @__PURE__ */ new TypeError("Cannot close an already-closing stream")) : Rt(this) : d(Nt("close"));
			}
			getWriter() {
				if (!gt(this)) throw Nt("getWriter");
				return yt(this);
			}
		};
		Object.defineProperties(WritableStream.prototype, {
			abort: { enumerable: !0 },
			close: { enumerable: !0 },
			getWriter: { enumerable: !0 },
			locked: { enumerable: !0 }
		}), o(WritableStream.prototype.abort, "abort"), o(WritableStream.prototype.close, "close"), o(WritableStream.prototype.getWriter, "getWriter"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(WritableStream.prototype, Symbol.toStringTag, {
			value: "WritableStream",
			configurable: !0
		});
		WritableStreamDefaultWriter = class {
			constructor(e$1) {
				if ($(e$1, 1, "WritableStreamDefaultWriter"), pt(e$1, "First parameter"), vt(e$1)) throw new TypeError("This stream has already been locked for exclusive writing by another writer");
				this._ownerWritableStream = e$1, e$1._writer = this;
				const t$1 = e$1._state;
				if ("writable" === t$1) !qt(e$1) && e$1._backpressure ? Zt(this) : tr(this), Gt(this);
				else if ("erroring" === t$1) er(this, e$1._storedError), Gt(this);
				else if ("closed" === t$1) tr(this), Gt(r$1 = this), Kt(r$1);
				else {
					const t$2 = e$1._storedError;
					er(this, t$2), Xt(this, t$2);
				}
				var r$1;
			}
			get closed() {
				return Ot(this) ? this._closedPromise : d(Vt("closed"));
			}
			get desiredSize() {
				if (!Ot(this)) throw Vt("desiredSize");
				if (void 0 === this._ownerWritableStream) throw Ut("desiredSize");
				return function(e$1) {
					const t$1 = e$1._ownerWritableStream, r$1 = t$1._state;
					if ("errored" === r$1 || "erroring" === r$1) return null;
					if ("closed" === r$1) return 0;
					return $t(t$1._writableStreamController);
				}(this);
			}
			get ready() {
				return Ot(this) ? this._readyPromise : d(Vt("ready"));
			}
			abort(e$1 = void 0) {
				return Ot(this) ? void 0 === this._ownerWritableStream ? d(Ut("abort")) : function(e$2, t$1) {
					return wt(e$2._ownerWritableStream, t$1);
				}(this, e$1) : d(Vt("abort"));
			}
			close() {
				if (!Ot(this)) return d(Vt("close"));
				const e$1 = this._ownerWritableStream;
				return void 0 === e$1 ? d(Ut("close")) : qt(e$1) ? d(/* @__PURE__ */ new TypeError("Cannot close an already-closing stream")) : Bt(this);
			}
			releaseLock() {
				if (!Ot(this)) throw Vt("releaseLock");
				void 0 !== this._ownerWritableStream && At(this);
			}
			write(e$1 = void 0) {
				return Ot(this) ? void 0 === this._ownerWritableStream ? d(Ut("write to")) : zt(this, e$1) : d(Vt("write"));
			}
		};
		Object.defineProperties(WritableStreamDefaultWriter.prototype, {
			abort: { enumerable: !0 },
			close: { enumerable: !0 },
			releaseLock: { enumerable: !0 },
			write: { enumerable: !0 },
			closed: { enumerable: !0 },
			desiredSize: { enumerable: !0 },
			ready: { enumerable: !0 }
		}), o(WritableStreamDefaultWriter.prototype.abort, "abort"), o(WritableStreamDefaultWriter.prototype.close, "close"), o(WritableStreamDefaultWriter.prototype.releaseLock, "releaseLock"), o(WritableStreamDefaultWriter.prototype.write, "write"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(WritableStreamDefaultWriter.prototype, Symbol.toStringTag, {
			value: "WritableStreamDefaultWriter",
			configurable: !0
		});
		Dt = {};
		WritableStreamDefaultController = class {
			constructor() {
				throw new TypeError("Illegal constructor");
			}
			get abortReason() {
				if (!Lt(this)) throw Ht("abortReason");
				return this._abortReason;
			}
			get signal() {
				if (!Lt(this)) throw Ht("signal");
				if (void 0 === this._abortController) throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");
				return this._abortController.signal;
			}
			error(e$1 = void 0) {
				if (!Lt(this)) throw Ht("error");
				"writable" === this._controlledWritableStream._state && Qt(this, e$1);
			}
			[w](e$1) {
				const t$1 = this._abortAlgorithm(e$1);
				return It(this), t$1;
			}
			[R]() {
				we(this);
			}
		};
		Object.defineProperties(WritableStreamDefaultController.prototype, {
			abortReason: { enumerable: !0 },
			signal: { enumerable: !0 },
			error: { enumerable: !0 }
		}), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(WritableStreamDefaultController.prototype, Symbol.toStringTag, {
			value: "WritableStreamDefaultController",
			configurable: !0
		});
		nr = "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : "undefined" != typeof global ? global : void 0;
		ar = function() {
			const e$1 = null == nr ? void 0 : nr.DOMException;
			return function(e$2) {
				if ("function" != typeof e$2 && "object" != typeof e$2) return !1;
				if ("DOMException" !== e$2.name) return !1;
				try {
					return new e$2(), !0;
				} catch (e$3) {
					return !1;
				}
			}(e$1) ? e$1 : void 0;
		}() || function() {
			const e$1 = function(e$2, t$1) {
				this.message = e$2 || "", this.name = t$1 || "Error", Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);
			};
			return o(e$1, "DOMException"), e$1.prototype = Object.create(Error.prototype), Object.defineProperty(e$1.prototype, "constructor", {
				value: e$1,
				writable: !0,
				configurable: !0
			}), e$1;
		}();
		ReadableStreamDefaultController = class {
			constructor() {
				throw new TypeError("Illegal constructor");
			}
			get desiredSize() {
				if (!lr(this)) throw pr("desiredSize");
				return hr(this);
			}
			close() {
				if (!lr(this)) throw pr("close");
				if (!mr(this)) throw new TypeError("The stream is not in a state that permits close");
				dr(this);
			}
			enqueue(e$1 = void 0) {
				if (!lr(this)) throw pr("enqueue");
				if (!mr(this)) throw new TypeError("The stream is not in a state that permits enqueue");
				return fr(this, e$1);
			}
			error(e$1 = void 0) {
				if (!lr(this)) throw pr("error");
				br(this, e$1);
			}
			[T](e$1) {
				we(this);
				const t$1 = this._cancelAlgorithm(e$1);
				return cr(this), t$1;
			}
			[C](e$1) {
				const t$1 = this._controlledReadableStream;
				if (this._queue.length > 0) {
					const r$1 = ge(this);
					this._closeRequested && 0 === this._queue.length ? (cr(this), Br(t$1)) : sr(this), e$1._chunkSteps(r$1);
				} else V(t$1, e$1), sr(this);
			}
			[P]() {}
		};
		Object.defineProperties(ReadableStreamDefaultController.prototype, {
			close: { enumerable: !0 },
			enqueue: { enumerable: !0 },
			error: { enumerable: !0 },
			desiredSize: { enumerable: !0 }
		}), o(ReadableStreamDefaultController.prototype.close, "close"), o(ReadableStreamDefaultController.prototype.enqueue, "enqueue"), o(ReadableStreamDefaultController.prototype.error, "error"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ReadableStreamDefaultController.prototype, Symbol.toStringTag, {
			value: "ReadableStreamDefaultController",
			configurable: !0
		});
		ReadableStream$1 = class {
			constructor(e$1 = {}, t$1 = {}) {
				void 0 === e$1 ? e$1 = null : I(e$1, "First parameter");
				const r$1 = dt(t$1, "Second parameter"), o$1 = function(e$2, t$2) {
					L(e$2, t$2);
					const r$2 = e$2, o$2 = null == r$2 ? void 0 : r$2.autoAllocateChunkSize, n$1 = null == r$2 ? void 0 : r$2.cancel, a$1 = null == r$2 ? void 0 : r$2.pull, i$1 = null == r$2 ? void 0 : r$2.start, l$1 = null == r$2 ? void 0 : r$2.type;
					return {
						autoAllocateChunkSize: void 0 === o$2 ? void 0 : Q(o$2, `${t$2} has member 'autoAllocateChunkSize' that`),
						cancel: void 0 === n$1 ? void 0 : gr(n$1, r$2, `${t$2} has member 'cancel' that`),
						pull: void 0 === a$1 ? void 0 : vr(a$1, r$2, `${t$2} has member 'pull' that`),
						start: void 0 === i$1 ? void 0 : wr(i$1, r$2, `${t$2} has member 'start' that`),
						type: void 0 === l$1 ? void 0 : Rr(l$1, `${t$2} has member 'type' that`)
					};
				}(e$1, "First parameter");
				if (qr(this), "bytes" === o$1.type) {
					if (void 0 !== r$1.size) throw new RangeError("The strategy for a byte stream cannot have a size function");
					(function(e$2, t$2, r$2) {
						const o$2 = Object.create(ReadableByteStreamController.prototype);
						let n$1, a$1, i$1;
						n$1 = void 0 !== t$2.start ? () => t$2.start(o$2) : () => {}, a$1 = void 0 !== t$2.pull ? () => t$2.pull(o$2) : () => c(void 0), i$1 = void 0 !== t$2.cancel ? (e$3) => t$2.cancel(e$3) : () => c(void 0);
						const l$1 = t$2.autoAllocateChunkSize;
						if (0 === l$1) throw new TypeError("autoAllocateChunkSize must be greater than 0");
						Je(e$2, o$2, n$1, a$1, i$1, r$2, l$1);
					})(this, o$1, ut(r$1, 0));
				} else {
					const e$2 = ct(r$1);
					(function(e$3, t$2, r$2, o$2) {
						const n$1 = Object.create(ReadableStreamDefaultController.prototype);
						let a$1, i$1, l$1;
						a$1 = void 0 !== t$2.start ? () => t$2.start(n$1) : () => {}, i$1 = void 0 !== t$2.pull ? () => t$2.pull(n$1) : () => c(void 0), l$1 = void 0 !== t$2.cancel ? (e$4) => t$2.cancel(e$4) : () => c(void 0), _r(e$3, n$1, a$1, i$1, l$1, r$2, o$2);
					})(this, o$1, ut(r$1, 1), e$2);
				}
			}
			get locked() {
				if (!Er(this)) throw jr("locked");
				return Wr(this);
			}
			cancel(e$1 = void 0) {
				return Er(this) ? Wr(this) ? d(/* @__PURE__ */ new TypeError("Cannot cancel a stream that already has a reader")) : Or(this, e$1) : d(jr("cancel"));
			}
			getReader(e$1 = void 0) {
				if (!Er(this)) throw jr("getReader");
				return void 0 === function(e$2, t$1) {
					L(e$2, t$1);
					const r$1 = null == e$2 ? void 0 : e$2.mode;
					return { mode: void 0 === r$1 ? void 0 : et(r$1, `${t$1} has member 'mode' that`) };
				}(e$1, "First parameter").mode ? H(this) : tt(this);
			}
			pipeThrough(e$1, t$1 = {}) {
				if (!Er(this)) throw jr("pipeThrough");
				$(e$1, 1, "pipeThrough");
				const r$1 = function(e$2, t$2) {
					L(e$2, t$2);
					const r$2 = null == e$2 ? void 0 : e$2.readable;
					M(r$2, "readable", "ReadableWritablePair"), N(r$2, `${t$2} has member 'readable' that`);
					const o$2 = null == e$2 ? void 0 : e$2.writable;
					return M(o$2, "writable", "ReadableWritablePair"), pt(o$2, `${t$2} has member 'writable' that`), {
						readable: r$2,
						writable: o$2
					};
				}(e$1, "First parameter"), o$1 = Tr(t$1, "Second parameter");
				if (Wr(this)) throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");
				if (vt(r$1.writable)) throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");
				return p(ir(this, r$1.writable, o$1.preventClose, o$1.preventAbort, o$1.preventCancel, o$1.signal)), r$1.readable;
			}
			pipeTo(e$1, t$1 = {}) {
				if (!Er(this)) return d(jr("pipeTo"));
				if (void 0 === e$1) return d("Parameter 1 is required in 'pipeTo'.");
				if (!gt(e$1)) return d(/* @__PURE__ */ new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));
				let r$1;
				try {
					r$1 = Tr(t$1, "Second parameter");
				} catch (e$2) {
					return d(e$2);
				}
				return Wr(this) ? d(/* @__PURE__ */ new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")) : vt(e$1) ? d(/* @__PURE__ */ new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")) : ir(this, e$1, r$1.preventClose, r$1.preventAbort, r$1.preventCancel, r$1.signal);
			}
			tee() {
				if (!Er(this)) throw jr("tee");
				return ne(yr(this));
			}
			values(e$1 = void 0) {
				if (!Er(this)) throw jr("values");
				return function(e$2, t$1) {
					const o$1 = new he(H(e$2), t$1), n$1 = Object.create(me);
					return n$1._asyncIteratorImpl = o$1, n$1;
				}(this, function(e$2, t$1) {
					L(e$2, t$1);
					const r$1 = null == e$2 ? void 0 : e$2.preventCancel;
					return { preventCancel: Boolean(r$1) };
				}(e$1, "First parameter").preventCancel);
			}
			[de](e$1) {
				return this.values(e$1);
			}
			static from(e$1) {
				return Sr(e$1);
			}
		};
		Object.defineProperties(ReadableStream$1, { from: { enumerable: !0 } }), Object.defineProperties(ReadableStream$1.prototype, {
			cancel: { enumerable: !0 },
			getReader: { enumerable: !0 },
			pipeThrough: { enumerable: !0 },
			pipeTo: { enumerable: !0 },
			tee: { enumerable: !0 },
			values: { enumerable: !0 },
			locked: { enumerable: !0 }
		}), o(ReadableStream$1.from, "from"), o(ReadableStream$1.prototype.cancel, "cancel"), o(ReadableStream$1.prototype.getReader, "getReader"), o(ReadableStream$1.prototype.pipeThrough, "pipeThrough"), o(ReadableStream$1.prototype.pipeTo, "pipeTo"), o(ReadableStream$1.prototype.tee, "tee"), o(ReadableStream$1.prototype.values, "values"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ReadableStream$1.prototype, Symbol.toStringTag, {
			value: "ReadableStream",
			configurable: !0
		}), Object.defineProperty(ReadableStream$1.prototype, de, {
			value: ReadableStream$1.prototype.values,
			writable: !0,
			configurable: !0
		});
		zr = (e$1) => e$1.byteLength;
		o(zr, "size");
		ByteLengthQueuingStrategy = class {
			constructor(e$1) {
				$(e$1, 1, "ByteLengthQueuingStrategy"), e$1 = Ar(e$1, "First parameter"), this._byteLengthQueuingStrategyHighWaterMark = e$1.highWaterMark;
			}
			get highWaterMark() {
				if (!Lr(this)) throw Dr("highWaterMark");
				return this._byteLengthQueuingStrategyHighWaterMark;
			}
			get size() {
				if (!Lr(this)) throw Dr("size");
				return zr;
			}
		};
		Object.defineProperties(ByteLengthQueuingStrategy.prototype, {
			highWaterMark: { enumerable: !0 },
			size: { enumerable: !0 }
		}), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ByteLengthQueuingStrategy.prototype, Symbol.toStringTag, {
			value: "ByteLengthQueuingStrategy",
			configurable: !0
		});
		Fr = () => 1;
		o(Fr, "size");
		CountQueuingStrategy = class {
			constructor(e$1) {
				$(e$1, 1, "CountQueuingStrategy"), e$1 = Ar(e$1, "First parameter"), this._countQueuingStrategyHighWaterMark = e$1.highWaterMark;
			}
			get highWaterMark() {
				if (!$r(this)) throw Ir("highWaterMark");
				return this._countQueuingStrategyHighWaterMark;
			}
			get size() {
				if (!$r(this)) throw Ir("size");
				return Fr;
			}
		};
		Object.defineProperties(CountQueuingStrategy.prototype, {
			highWaterMark: { enumerable: !0 },
			size: { enumerable: !0 }
		}), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(CountQueuingStrategy.prototype, Symbol.toStringTag, {
			value: "CountQueuingStrategy",
			configurable: !0
		});
		TransformStream = class {
			constructor(e$1 = {}, t$1 = {}, r$1 = {}) {
				void 0 === e$1 && (e$1 = null);
				const o$1 = dt(t$1, "Second parameter"), n$1 = dt(r$1, "Third parameter"), a$1 = function(e$2, t$2) {
					L(e$2, t$2);
					const r$2 = null == e$2 ? void 0 : e$2.cancel, o$2 = null == e$2 ? void 0 : e$2.flush, n$2 = null == e$2 ? void 0 : e$2.readableType, a$2 = null == e$2 ? void 0 : e$2.start, i$2 = null == e$2 ? void 0 : e$2.transform, l$2 = null == e$2 ? void 0 : e$2.writableType;
					return {
						cancel: void 0 === r$2 ? void 0 : Qr(r$2, e$2, `${t$2} has member 'cancel' that`),
						flush: void 0 === o$2 ? void 0 : Mr(o$2, e$2, `${t$2} has member 'flush' that`),
						readableType: n$2,
						start: void 0 === a$2 ? void 0 : Yr(a$2, e$2, `${t$2} has member 'start' that`),
						transform: void 0 === i$2 ? void 0 : xr(i$2, e$2, `${t$2} has member 'transform' that`),
						writableType: l$2
					};
				}(e$1, "First parameter");
				if (void 0 !== a$1.readableType) throw new RangeError("Invalid readableType specified");
				if (void 0 !== a$1.writableType) throw new RangeError("Invalid writableType specified");
				const i$1 = ut(n$1, 0), l$1 = ct(n$1), s$1 = ut(o$1, 1), f$1 = ct(o$1);
				let h$1;
				(function(e$2, t$2, r$2, o$2, n$2, a$2) {
					function i$2() {
						return t$2;
					}
					function l$2(t$3) {
						return function(e$3, t$4) {
							const r$3 = e$3._transformStreamController;
							if (e$3._backpressure) return _(e$3._backpressureChangePromise, () => {
								const o$3 = e$3._writable;
								if ("erroring" === o$3._state) throw o$3._storedError;
								return Zr(r$3, t$4);
							});
							return Zr(r$3, t$4);
						}(e$2, t$3);
					}
					function s$2(t$3) {
						return function(e$3, t$4) {
							const r$3 = e$3._transformStreamController;
							if (void 0 !== r$3._finishPromise) return r$3._finishPromise;
							const o$3 = e$3._readable;
							r$3._finishPromise = u((e$4, t$5) => {
								r$3._finishPromise_resolve = e$4, r$3._finishPromise_reject = t$5;
							});
							const n$3 = r$3._cancelAlgorithm(t$4);
							return Jr(r$3), b(n$3, () => ("errored" === o$3._state ? ro(r$3, o$3._storedError) : (br(o$3._readableStreamController, t$4), to(r$3)), null), (e$4) => (br(o$3._readableStreamController, e$4), ro(r$3, e$4), null)), r$3._finishPromise;
						}(e$2, t$3);
					}
					function c$1() {
						return function(e$3) {
							const t$3 = e$3._transformStreamController;
							if (void 0 !== t$3._finishPromise) return t$3._finishPromise;
							const r$3 = e$3._readable;
							t$3._finishPromise = u((e$4, r$4) => {
								t$3._finishPromise_resolve = e$4, t$3._finishPromise_reject = r$4;
							});
							const o$3 = t$3._flushAlgorithm();
							return Jr(t$3), b(o$3, () => ("errored" === r$3._state ? ro(t$3, r$3._storedError) : (dr(r$3._readableStreamController), to(t$3)), null), (e$4) => (br(r$3._readableStreamController, e$4), ro(t$3, e$4), null)), t$3._finishPromise;
						}(e$2);
					}
					function d$1() {
						return function(e$3) {
							return Gr(e$3, !1), e$3._backpressureChangePromise;
						}(e$2);
					}
					function f$2(t$3) {
						return function(e$3, t$4) {
							const r$3 = e$3._transformStreamController;
							if (void 0 !== r$3._finishPromise) return r$3._finishPromise;
							const o$3 = e$3._writable;
							r$3._finishPromise = u((e$4, t$5) => {
								r$3._finishPromise_resolve = e$4, r$3._finishPromise_reject = t$5;
							});
							const n$3 = r$3._cancelAlgorithm(t$4);
							return Jr(r$3), b(n$3, () => ("errored" === o$3._state ? ro(r$3, o$3._storedError) : (Yt(o$3._writableStreamController, t$4), Ur(e$3), to(r$3)), null), (t$5) => (Yt(o$3._writableStreamController, t$5), Ur(e$3), ro(r$3, t$5), null)), r$3._finishPromise;
						}(e$2, t$3);
					}
					e$2._writable = function(e$3, t$3, r$3, o$3, n$3 = 1, a$3 = () => 1) {
						const i$3 = Object.create(WritableStream.prototype);
						return St(i$3), Ft(i$3, Object.create(WritableStreamDefaultController.prototype), e$3, t$3, r$3, o$3, n$3, a$3), i$3;
					}(i$2, l$2, c$1, s$2, r$2, o$2), e$2._readable = Cr(i$2, d$1, f$2, n$2, a$2), e$2._backpressure = void 0, e$2._backpressureChangePromise = void 0, e$2._backpressureChangePromise_resolve = void 0, Gr(e$2, !0), e$2._transformStreamController = void 0;
				})(this, u((e$2) => {
					h$1 = e$2;
				}), s$1, f$1, i$1, l$1), function(e$2, t$2) {
					const r$2 = Object.create(TransformStreamDefaultController.prototype);
					let o$2, n$2, a$2;
					o$2 = void 0 !== t$2.transform ? (e$3) => t$2.transform(e$3, r$2) : (e$3) => {
						try {
							return Kr(r$2, e$3), c(void 0);
						} catch (e$4) {
							return d(e$4);
						}
					};
					n$2 = void 0 !== t$2.flush ? () => t$2.flush(r$2) : () => c(void 0);
					a$2 = void 0 !== t$2.cancel ? (e$3) => t$2.cancel(e$3) : () => c(void 0);
					(function(e$3, t$3, r$3, o$3, n$3) {
						t$3._controlledTransformStream = e$3, e$3._transformStreamController = t$3, t$3._transformAlgorithm = r$3, t$3._flushAlgorithm = o$3, t$3._cancelAlgorithm = n$3, t$3._finishPromise = void 0, t$3._finishPromise_resolve = void 0, t$3._finishPromise_reject = void 0;
					})(e$2, r$2, o$2, n$2, a$2);
				}(this, a$1), void 0 !== a$1.start ? h$1(a$1.start(this._transformStreamController)) : h$1(void 0);
			}
			get readable() {
				if (!Nr(this)) throw oo("readable");
				return this._readable;
			}
			get writable() {
				if (!Nr(this)) throw oo("writable");
				return this._writable;
			}
		};
		Object.defineProperties(TransformStream.prototype, {
			readable: { enumerable: !0 },
			writable: { enumerable: !0 }
		}), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(TransformStream.prototype, Symbol.toStringTag, {
			value: "TransformStream",
			configurable: !0
		});
		TransformStreamDefaultController = class {
			constructor() {
				throw new TypeError("Illegal constructor");
			}
			get desiredSize() {
				if (!Xr(this)) throw eo("desiredSize");
				return hr(this._controlledTransformStream._readable._readableStreamController);
			}
			enqueue(e$1 = void 0) {
				if (!Xr(this)) throw eo("enqueue");
				Kr(this, e$1);
			}
			error(e$1 = void 0) {
				if (!Xr(this)) throw eo("error");
				var t$1 = e$1;
				Hr(this._controlledTransformStream, t$1);
			}
			terminate() {
				if (!Xr(this)) throw eo("terminate");
				(function(e$1) {
					const t$1 = e$1._controlledTransformStream;
					dr(t$1._readable._readableStreamController);
					Vr(t$1, /* @__PURE__ */ new TypeError("TransformStream terminated"));
				})(this);
			}
		};
		Object.defineProperties(TransformStreamDefaultController.prototype, {
			enqueue: { enumerable: !0 },
			error: { enumerable: !0 },
			terminate: { enumerable: !0 },
			desiredSize: { enumerable: !0 }
		}), o(TransformStreamDefaultController.prototype.enqueue, "enqueue"), o(TransformStreamDefaultController.prototype.error, "error"), o(TransformStreamDefaultController.prototype.terminate, "terminate"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(TransformStreamDefaultController.prototype, Symbol.toStringTag, {
			value: "TransformStreamDefaultController",
			configurable: !0
		});
	}));
	typeof globalThis.ReadableByteStreamController === "undefined" ? Promise.resolve().then(() => (init_ponyfill(), ponyfill_exports)).then(({ ReadableStream: ReadableStream$2 }) => {
		globalThis.ReadableStream = ReadableStream$2;
	}) : Promise.resolve();
	/**
	* @license React
	* react.development.js
	*
	* Copyright (c) Meta Platforms, Inc. and affiliates.
	*
	* This source code is licensed under the MIT license found in the
	* LICENSE file in the root directory of this source tree.
	*/
	var require_react_development = /* @__PURE__ */ __commonJSMin(((exports, module) => {
		(function() {
			function defineDeprecationWarning(methodName, info) {
				Object.defineProperty(Component.prototype, methodName, { get: function() {
					console.warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
				} });
			}
			function getIteratorFn(maybeIterable) {
				if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
				maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
				return "function" === typeof maybeIterable ? maybeIterable : null;
			}
			function warnNoop(publicInstance, callerName) {
				publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
				var warningKey = publicInstance + "." + callerName;
				didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, publicInstance), didWarnStateUpdateForUnmountedComponent[warningKey] = !0);
			}
			function Component(props, context, updater) {
				this.props = props;
				this.context = context;
				this.refs = emptyObject;
				this.updater = updater || ReactNoopUpdateQueue;
			}
			function ComponentDummy() {}
			function PureComponent(props, context, updater) {
				this.props = props;
				this.context = context;
				this.refs = emptyObject;
				this.updater = updater || ReactNoopUpdateQueue;
			}
			function noop() {}
			function testStringCoercion(value) {
				return "" + value;
			}
			function checkKeyStringCoercion(value) {
				try {
					testStringCoercion(value);
					var JSCompiler_inline_result = !1;
				} catch (e$1) {
					JSCompiler_inline_result = !0;
				}
				if (JSCompiler_inline_result) {
					JSCompiler_inline_result = console;
					var JSCompiler_temp_const = JSCompiler_inline_result.error;
					var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
					JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
					return testStringCoercion(value);
				}
			}
			function getComponentNameFromType(type) {
				if (null == type) return null;
				if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE$3 ? null : type.displayName || type.name || null;
				if ("string" === typeof type) return type;
				switch (type) {
					case REACT_FRAGMENT_TYPE: return "Fragment";
					case REACT_PROFILER_TYPE: return "Profiler";
					case REACT_STRICT_MODE_TYPE: return "StrictMode";
					case REACT_SUSPENSE_TYPE: return "Suspense";
					case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
					case REACT_ACTIVITY_TYPE: return "Activity";
				}
				if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
					case REACT_PORTAL_TYPE: return "Portal";
					case REACT_CONTEXT_TYPE: return type.displayName || "Context";
					case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
					case REACT_FORWARD_REF_TYPE:
						var innerType = type.render;
						type = type.displayName;
						type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
						return type;
					case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
					case REACT_LAZY_TYPE:
						innerType = type._payload;
						type = type._init;
						try {
							return getComponentNameFromType(type(innerType));
						} catch (x$1) {}
				}
				return null;
			}
			function getTaskName(type) {
				if (type === REACT_FRAGMENT_TYPE) return "<>";
				if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
				try {
					var name = getComponentNameFromType(type);
					return name ? "<" + name + ">" : "<...>";
				} catch (x$1) {
					return "<...>";
				}
			}
			function getOwner() {
				var dispatcher = ReactSharedInternals.A;
				return null === dispatcher ? null : dispatcher.getOwner();
			}
			function UnknownOwner() {
				return Error("react-stack-top-frame");
			}
			function hasValidKey(config) {
				if (hasOwnProperty.call(config, "key")) {
					var getter = Object.getOwnPropertyDescriptor(config, "key").get;
					if (getter && getter.isReactWarning) return !1;
				}
				return void 0 !== config.key;
			}
			function defineKeyPropWarningGetter(props, displayName) {
				function warnAboutAccessingKey() {
					specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
				}
				warnAboutAccessingKey.isReactWarning = !0;
				Object.defineProperty(props, "key", {
					get: warnAboutAccessingKey,
					configurable: !0
				});
			}
			function elementRefGetterWithDeprecationWarning() {
				var componentName = getComponentNameFromType(this.type);
				didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
				componentName = this.props.ref;
				return void 0 !== componentName ? componentName : null;
			}
			function ReactElement(type, key, props, owner, debugStack, debugTask) {
				var refProp = props.ref;
				type = {
					$$typeof: REACT_ELEMENT_TYPE$1,
					type,
					key,
					props,
					_owner: owner
				};
				null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
					enumerable: !1,
					get: elementRefGetterWithDeprecationWarning
				}) : Object.defineProperty(type, "ref", {
					enumerable: !1,
					value: null
				});
				type._store = {};
				Object.defineProperty(type._store, "validated", {
					configurable: !1,
					enumerable: !1,
					writable: !0,
					value: 0
				});
				Object.defineProperty(type, "_debugInfo", {
					configurable: !1,
					enumerable: !1,
					writable: !0,
					value: null
				});
				Object.defineProperty(type, "_debugStack", {
					configurable: !1,
					enumerable: !1,
					writable: !0,
					value: debugStack
				});
				Object.defineProperty(type, "_debugTask", {
					configurable: !1,
					enumerable: !1,
					writable: !0,
					value: debugTask
				});
				Object.freeze && (Object.freeze(type.props), Object.freeze(type));
				return type;
			}
			function cloneAndReplaceKey(oldElement, newKey) {
				newKey = ReactElement(oldElement.type, newKey, oldElement.props, oldElement._owner, oldElement._debugStack, oldElement._debugTask);
				oldElement._store && (newKey._store.validated = oldElement._store.validated);
				return newKey;
			}
			function validateChildKeys(node) {
				isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
			}
			function isValidElement(object) {
				return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE$1;
			}
			function escape(key) {
				var escaperLookup = {
					"=": "=0",
					":": "=2"
				};
				return "$" + key.replace(/[=:]/g, function(match) {
					return escaperLookup[match];
				});
			}
			function getElementKey(element, index) {
				return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
			}
			function resolveThenable(thenable) {
				switch (thenable.status) {
					case "fulfilled": return thenable.value;
					case "rejected": throw thenable.reason;
					default: switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
						"pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
					}, function(error$1) {
						"pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error$1);
					})), thenable.status) {
						case "fulfilled": return thenable.value;
						case "rejected": throw thenable.reason;
					}
				}
				throw thenable;
			}
			function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
				var type = typeof children;
				if ("undefined" === type || "boolean" === type) children = null;
				var invokeCallback = !1;
				if (null === children) invokeCallback = !0;
				else switch (type) {
					case "bigint":
					case "string":
					case "number":
						invokeCallback = !0;
						break;
					case "object": switch (children.$$typeof) {
						case REACT_ELEMENT_TYPE$1:
						case REACT_PORTAL_TYPE:
							invokeCallback = !0;
							break;
						case REACT_LAZY_TYPE: return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
					}
				}
				if (invokeCallback) {
					invokeCallback = children;
					callback = callback(invokeCallback);
					var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
					isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c$1) {
						return c$1;
					})) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + childKey), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
					return 1;
				}
				invokeCallback = 0;
				childKey = "" === nameSoFar ? "." : nameSoFar + ":";
				if (isArrayImpl(children)) for (var i$1 = 0; i$1 < children.length; i$1++) nameSoFar = children[i$1], type = childKey + getElementKey(nameSoFar, i$1), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
				else if (i$1 = getIteratorFn(children), "function" === typeof i$1) for (i$1 === children.entries && (didWarnAboutMaps || console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), didWarnAboutMaps = !0), children = i$1.call(children), i$1 = 0; !(nameSoFar = children.next()).done;) nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i$1++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
				else if ("object" === type) {
					if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
					array = String(children);
					throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
				}
				return invokeCallback;
			}
			function mapChildren(children, func, context) {
				if (null == children) return children;
				var result = [], count = 0;
				mapIntoArray(children, result, "", "", function(child) {
					return func.call(context, child, count++);
				});
				return result;
			}
			function lazyInitializer(payload) {
				if (-1 === payload._status) {
					var ioInfo = payload._ioInfo;
					null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
					ioInfo = payload._result;
					var thenable = ioInfo();
					thenable.then(function(moduleObject) {
						if (0 === payload._status || -1 === payload._status) {
							payload._status = 1;
							payload._result = moduleObject;
							var _ioInfo = payload._ioInfo;
							null != _ioInfo && (_ioInfo.end = performance.now());
							void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
						}
					}, function(error$1) {
						if (0 === payload._status || -1 === payload._status) {
							payload._status = 2;
							payload._result = error$1;
							var _ioInfo2 = payload._ioInfo;
							null != _ioInfo2 && (_ioInfo2.end = performance.now());
							void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error$1);
						}
					});
					ioInfo = payload._ioInfo;
					if (null != ioInfo) {
						ioInfo.value = thenable;
						var displayName = thenable.displayName;
						"string" === typeof displayName && (ioInfo.name = displayName);
					}
					-1 === payload._status && (payload._status = 0, payload._result = thenable);
				}
				if (1 === payload._status) return ioInfo = payload._result, void 0 === ioInfo && console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", ioInfo), "default" in ioInfo || console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", ioInfo), ioInfo.default;
				throw payload._result;
			}
			function resolveDispatcher() {
				var dispatcher = ReactSharedInternals.H;
				null === dispatcher && console.error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.");
				return dispatcher;
			}
			function releaseAsyncTransition() {
				ReactSharedInternals.asyncTransitions--;
			}
			function enqueueTask(task) {
				if (null === enqueueTaskImpl) try {
					var requireString = ("require" + Math.random()).slice(0, 7);
					enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
				} catch (_err) {
					enqueueTaskImpl = function(callback) {
						!1 === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = !0, "undefined" === typeof MessageChannel && console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."));
						var channel = new MessageChannel();
						channel.port1.onmessage = callback;
						channel.port2.postMessage(void 0);
					};
				}
				return enqueueTaskImpl(task);
			}
			function aggregateErrors(errors) {
				return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
			}
			function popActScope(prevActQueue, prevActScopeDepth) {
				prevActScopeDepth !== actScopeDepth - 1 && console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
				actScopeDepth = prevActScopeDepth;
			}
			function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
				var queue = ReactSharedInternals.actQueue;
				if (null !== queue) if (0 !== queue.length) try {
					flushActQueue(queue);
					enqueueTask(function() {
						return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
					});
					return;
				} catch (error$1) {
					ReactSharedInternals.thrownErrors.push(error$1);
				}
				else ReactSharedInternals.actQueue = null;
				0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
			}
			function flushActQueue(queue) {
				if (!isFlushing) {
					isFlushing = !0;
					var i$1 = 0;
					try {
						for (; i$1 < queue.length; i$1++) {
							var callback = queue[i$1];
							do {
								ReactSharedInternals.didUsePromise = !1;
								var continuation = callback(!1);
								if (null !== continuation) {
									if (ReactSharedInternals.didUsePromise) {
										queue[i$1] = callback;
										queue.splice(0, i$1);
										return;
									}
									callback = continuation;
								} else break;
							} while (1);
						}
						queue.length = 0;
					} catch (error$1) {
						queue.splice(0, i$1 + 1), ReactSharedInternals.thrownErrors.push(error$1);
					} finally {
						isFlushing = !1;
					}
				}
			}
			"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
			var REACT_ELEMENT_TYPE$1 = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
				isMounted: function() {
					return !1;
				},
				enqueueForceUpdate: function(publicInstance) {
					warnNoop(publicInstance, "forceUpdate");
				},
				enqueueReplaceState: function(publicInstance) {
					warnNoop(publicInstance, "replaceState");
				},
				enqueueSetState: function(publicInstance) {
					warnNoop(publicInstance, "setState");
				}
			}, assign = Object.assign, emptyObject = {};
			Object.freeze(emptyObject);
			Component.prototype.isReactComponent = {};
			Component.prototype.setState = function(partialState, callback) {
				if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
				this.updater.enqueueSetState(this, partialState, callback, "setState");
			};
			Component.prototype.forceUpdate = function(callback) {
				this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
			};
			var deprecatedAPIs = {
				isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
				replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
			};
			for (fnName in deprecatedAPIs) deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
			ComponentDummy.prototype = Component.prototype;
			deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
			deprecatedAPIs.constructor = PureComponent;
			assign(deprecatedAPIs, Component.prototype);
			deprecatedAPIs.isPureReactComponent = !0;
			var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE$3 = Symbol.for("react.client.reference"), ReactSharedInternals = {
				H: null,
				A: null,
				T: null,
				S: null,
				actQueue: null,
				asyncTransitions: 0,
				isBatchingLegacy: !1,
				didScheduleLegacyUpdate: !1,
				didUsePromise: !1,
				thrownErrors: [],
				getCurrentStack: null,
				recentlyCreatedOwnerStacks: 0
			}, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
				return null;
			};
			deprecatedAPIs = { react_stack_bottom_frame: function(callStackForError) {
				return callStackForError();
			} };
			var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
			var didWarnAboutElementRef = {};
			var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(deprecatedAPIs, UnknownOwner)();
			var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
			var didWarnAboutMaps = !1, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error$1) {
				if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
					var event = new window.ErrorEvent("error", {
						bubbles: !0,
						cancelable: !0,
						message: "object" === typeof error$1 && null !== error$1 && "string" === typeof error$1.message ? String(error$1.message) : String(error$1),
						error: error$1
					});
					if (!window.dispatchEvent(event)) return;
				} else if ("object" === typeof process && "function" === typeof process.emit) {
					process.emit("uncaughtException", error$1);
					return;
				}
				console.error(error$1);
			}, didWarnAboutMessageChannel = !1, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = !1, isFlushing = !1, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
				queueMicrotask(function() {
					return queueMicrotask(callback);
				});
			} : enqueueTask;
			deprecatedAPIs = Object.freeze({
				__proto__: null,
				c: function(size) {
					return resolveDispatcher().useMemoCache(size);
				}
			});
			var fnName = {
				map: mapChildren,
				forEach: function(children, forEachFunc, forEachContext) {
					mapChildren(children, function() {
						forEachFunc.apply(this, arguments);
					}, forEachContext);
				},
				count: function(children) {
					var n$1 = 0;
					mapChildren(children, function() {
						n$1++;
					});
					return n$1;
				},
				toArray: function(children) {
					return mapChildren(children, function(child) {
						return child;
					}) || [];
				},
				only: function(children) {
					if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
					return children;
				}
			};
			exports.Activity = REACT_ACTIVITY_TYPE;
			exports.Children = fnName;
			exports.Component = Component;
			exports.Fragment = REACT_FRAGMENT_TYPE;
			exports.Profiler = REACT_PROFILER_TYPE;
			exports.PureComponent = PureComponent;
			exports.StrictMode = REACT_STRICT_MODE_TYPE;
			exports.Suspense = REACT_SUSPENSE_TYPE;
			exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
			exports.__COMPILER_RUNTIME = deprecatedAPIs;
			exports.act = function(callback) {
				var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
				actScopeDepth++;
				var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = !1;
				try {
					var result = callback();
				} catch (error$1) {
					ReactSharedInternals.thrownErrors.push(error$1);
				}
				if (0 < ReactSharedInternals.thrownErrors.length) throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
				if (null !== result && "object" === typeof result && "function" === typeof result.then) {
					var thenable = result;
					queueSeveralMicrotasks(function() {
						didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"));
					});
					return { then: function(resolve, reject) {
						didAwaitActCall = !0;
						thenable.then(function(returnValue) {
							popActScope(prevActQueue, prevActScopeDepth);
							if (0 === prevActScopeDepth) {
								try {
									flushActQueue(queue), enqueueTask(function() {
										return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
									});
								} catch (error$0) {
									ReactSharedInternals.thrownErrors.push(error$0);
								}
								if (0 < ReactSharedInternals.thrownErrors.length) {
									var _thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
									ReactSharedInternals.thrownErrors.length = 0;
									reject(_thrownError);
								}
							} else resolve(returnValue);
						}, function(error$1) {
							popActScope(prevActQueue, prevActScopeDepth);
							0 < ReactSharedInternals.thrownErrors.length ? (error$1 = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(error$1)) : reject(error$1);
						});
					} };
				}
				var returnValue$jscomp$0 = result;
				popActScope(prevActQueue, prevActScopeDepth);
				0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
					didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"));
				}), ReactSharedInternals.actQueue = null);
				if (0 < ReactSharedInternals.thrownErrors.length) throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
				return { then: function(resolve, reject) {
					didAwaitActCall = !0;
					0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
						return recursivelyFlushAsyncActWork(returnValue$jscomp$0, resolve, reject);
					})) : resolve(returnValue$jscomp$0);
				} };
			};
			exports.cache = function(fn) {
				return function() {
					return fn.apply(null, arguments);
				};
			};
			exports.cacheSignal = function() {
				return null;
			};
			exports.captureOwnerStack = function() {
				var getCurrentStack = ReactSharedInternals.getCurrentStack;
				return null === getCurrentStack ? null : getCurrentStack();
			};
			exports.cloneElement = function(element, config, children) {
				if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
				var props = assign({}, element.props), key = element.key, owner = element._owner;
				if (null != config) {
					var JSCompiler_inline_result;
					a: {
						if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(config, "ref").get) && JSCompiler_inline_result.isReactWarning) {
							JSCompiler_inline_result = !1;
							break a;
						}
						JSCompiler_inline_result = void 0 !== config.ref;
					}
					JSCompiler_inline_result && (owner = getOwner());
					hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
					for (propName in config) !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
				}
				var propName = arguments.length - 2;
				if (1 === propName) props.children = children;
				else if (1 < propName) {
					JSCompiler_inline_result = Array(propName);
					for (var i$1 = 0; i$1 < propName; i$1++) JSCompiler_inline_result[i$1] = arguments[i$1 + 2];
					props.children = JSCompiler_inline_result;
				}
				props = ReactElement(element.type, key, props, owner, element._debugStack, element._debugTask);
				for (key = 2; key < arguments.length; key++) validateChildKeys(arguments[key]);
				return props;
			};
			exports.createContext = function(defaultValue) {
				defaultValue = {
					$$typeof: REACT_CONTEXT_TYPE,
					_currentValue: defaultValue,
					_currentValue2: defaultValue,
					_threadCount: 0,
					Provider: null,
					Consumer: null
				};
				defaultValue.Provider = defaultValue;
				defaultValue.Consumer = {
					$$typeof: REACT_CONSUMER_TYPE,
					_context: defaultValue
				};
				defaultValue._currentRenderer = null;
				defaultValue._currentRenderer2 = null;
				return defaultValue;
			};
			exports.createElement = function(type, config, children) {
				for (var i$1 = 2; i$1 < arguments.length; i$1++) validateChildKeys(arguments[i$1]);
				i$1 = {};
				var key = null;
				if (null != config) for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = !0, console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config) hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i$1[propName] = config[propName]);
				var childrenLength = arguments.length - 2;
				if (1 === childrenLength) i$1.children = children;
				else if (1 < childrenLength) {
					for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++) childArray[_i] = arguments[_i + 2];
					Object.freeze && Object.freeze(childArray);
					i$1.children = childArray;
				}
				if (type && type.defaultProps) for (propName in childrenLength = type.defaultProps, childrenLength) void 0 === i$1[propName] && (i$1[propName] = childrenLength[propName]);
				key && defineKeyPropWarningGetter(i$1, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
				var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
				return ReactElement(type, key, i$1, getOwner(), propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack, propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
			};
			exports.createRef = function() {
				var refObject = { current: null };
				Object.seal(refObject);
				return refObject;
			};
			exports.forwardRef = function(render) {
				null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).") : "function" !== typeof render ? console.error("forwardRef requires a render function but was given %s.", null === render ? "null" : typeof render) : 0 !== render.length && 2 !== render.length && console.error("forwardRef render functions accept exactly two parameters: props and ref. %s", 1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
				null != render && null != render.defaultProps && console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");
				var elementType = {
					$$typeof: REACT_FORWARD_REF_TYPE,
					render
				}, ownName;
				Object.defineProperty(elementType, "displayName", {
					enumerable: !1,
					configurable: !0,
					get: function() {
						return ownName;
					},
					set: function(name) {
						ownName = name;
						render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
					}
				});
				return elementType;
			};
			exports.isValidElement = isValidElement;
			exports.lazy = function(ctor) {
				ctor = {
					_status: -1,
					_result: ctor
				};
				var lazyType = {
					$$typeof: REACT_LAZY_TYPE,
					_payload: ctor,
					_init: lazyInitializer
				}, ioInfo = {
					name: "lazy",
					start: -1,
					end: -1,
					value: null,
					owner: null,
					debugStack: Error("react-stack-top-frame"),
					debugTask: console.createTask ? console.createTask("lazy()") : null
				};
				ctor._ioInfo = ioInfo;
				lazyType._debugInfo = [{ awaited: ioInfo }];
				return lazyType;
			};
			exports.memo = function(type, compare) {
				type ?? console.error("memo: The first argument must be a component. Instead received: %s", null === type ? "null" : typeof type);
				compare = {
					$$typeof: REACT_MEMO_TYPE,
					type,
					compare: void 0 === compare ? null : compare
				};
				var ownName;
				Object.defineProperty(compare, "displayName", {
					enumerable: !1,
					configurable: !0,
					get: function() {
						return ownName;
					},
					set: function(name) {
						ownName = name;
						type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
					}
				});
				return compare;
			};
			exports.startTransition = function(scope) {
				var prevTransition = ReactSharedInternals.T, currentTransition = {};
				currentTransition._updatedFibers = /* @__PURE__ */ new Set();
				ReactSharedInternals.T = currentTransition;
				try {
					var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
					null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
					"object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
				} catch (error$1) {
					reportGlobalError(error$1);
				} finally {
					null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
				}
			};
			exports.unstable_useCacheRefresh = function() {
				return resolveDispatcher().useCacheRefresh();
			};
			exports.use = function(usable) {
				return resolveDispatcher().use(usable);
			};
			exports.useActionState = function(action, initialState, permalink) {
				return resolveDispatcher().useActionState(action, initialState, permalink);
			};
			exports.useCallback = function(callback, deps) {
				return resolveDispatcher().useCallback(callback, deps);
			};
			exports.useContext = function(Context) {
				var dispatcher = resolveDispatcher();
				Context.$$typeof === REACT_CONSUMER_TYPE && console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?");
				return dispatcher.useContext(Context);
			};
			exports.useDebugValue = function(value, formatterFn) {
				return resolveDispatcher().useDebugValue(value, formatterFn);
			};
			exports.useDeferredValue = function(value, initialValue) {
				return resolveDispatcher().useDeferredValue(value, initialValue);
			};
			exports.useEffect = function(create, deps) {
				create ?? console.warn("React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?");
				return resolveDispatcher().useEffect(create, deps);
			};
			exports.useEffectEvent = function(callback) {
				return resolveDispatcher().useEffectEvent(callback);
			};
			exports.useId = function() {
				return resolveDispatcher().useId();
			};
			exports.useImperativeHandle = function(ref, create, deps) {
				return resolveDispatcher().useImperativeHandle(ref, create, deps);
			};
			exports.useInsertionEffect = function(create, deps) {
				create ?? console.warn("React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?");
				return resolveDispatcher().useInsertionEffect(create, deps);
			};
			exports.useLayoutEffect = function(create, deps) {
				create ?? console.warn("React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?");
				return resolveDispatcher().useLayoutEffect(create, deps);
			};
			exports.useMemo = function(create, deps) {
				return resolveDispatcher().useMemo(create, deps);
			};
			exports.useOptimistic = function(passthrough$1, reducer) {
				return resolveDispatcher().useOptimistic(passthrough$1, reducer);
			};
			exports.useReducer = function(reducer, initialArg, init) {
				return resolveDispatcher().useReducer(reducer, initialArg, init);
			};
			exports.useRef = function(initialValue) {
				return resolveDispatcher().useRef(initialValue);
			};
			exports.useState = function(initialState) {
				return resolveDispatcher().useState(initialState);
			};
			exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
				return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
			};
			exports.useTransition = function() {
				return resolveDispatcher().useTransition();
			};
			exports.version = "19.2.0";
			"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
		})();
	}));
	var require_react = /* @__PURE__ */ __commonJSMin(((exports, module) => {
		module.exports = require_react_development();
	}));
	init_server();
	/**
	* @license React
	* react-is.development.js
	*
	* Copyright (c) Meta Platforms, Inc. and affiliates.
	*
	* This source code is licensed under the MIT license found in the
	* LICENSE file in the root directory of this source tree.
	*/
	var require_react_is_development = /* @__PURE__ */ __commonJSMin(((exports) => {
		(function() {
			function typeOf(object) {
				if ("object" === typeof object && null !== object) {
					var $$typeof = object.$$typeof;
					switch ($$typeof) {
						case REACT_ELEMENT_TYPE$1: switch (object = object.type, object) {
							case REACT_FRAGMENT_TYPE:
							case REACT_PROFILER_TYPE:
							case REACT_STRICT_MODE_TYPE:
							case REACT_SUSPENSE_TYPE:
							case REACT_SUSPENSE_LIST_TYPE:
							case REACT_VIEW_TRANSITION_TYPE: return object;
							default: switch (object = object && object.$$typeof, object) {
								case REACT_CONTEXT_TYPE:
								case REACT_FORWARD_REF_TYPE:
								case REACT_LAZY_TYPE:
								case REACT_MEMO_TYPE: return object;
								case REACT_CONSUMER_TYPE: return object;
								default: return $$typeof;
							}
						}
						case REACT_PORTAL_TYPE: return $$typeof;
					}
				}
			}
			var REACT_ELEMENT_TYPE$1 = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE$3 = Symbol.for("react.client.reference");
			exports.ContextConsumer = REACT_CONSUMER_TYPE;
			exports.ContextProvider = REACT_CONTEXT_TYPE;
			exports.Element = REACT_ELEMENT_TYPE$1;
			exports.ForwardRef = REACT_FORWARD_REF_TYPE;
			exports.Fragment = REACT_FRAGMENT_TYPE;
			exports.Lazy = REACT_LAZY_TYPE;
			exports.Memo = REACT_MEMO_TYPE;
			exports.Portal = REACT_PORTAL_TYPE;
			exports.Profiler = REACT_PROFILER_TYPE;
			exports.StrictMode = REACT_STRICT_MODE_TYPE;
			exports.Suspense = REACT_SUSPENSE_TYPE;
			exports.SuspenseList = REACT_SUSPENSE_LIST_TYPE;
			exports.isContextConsumer = function(object) {
				return typeOf(object) === REACT_CONSUMER_TYPE;
			};
			exports.isContextProvider = function(object) {
				return typeOf(object) === REACT_CONTEXT_TYPE;
			};
			exports.isElement = function(object) {
				return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE$1;
			};
			exports.isForwardRef = function(object) {
				return typeOf(object) === REACT_FORWARD_REF_TYPE;
			};
			exports.isFragment = function(object) {
				return typeOf(object) === REACT_FRAGMENT_TYPE;
			};
			exports.isLazy = function(object) {
				return typeOf(object) === REACT_LAZY_TYPE;
			};
			exports.isMemo = function(object) {
				return typeOf(object) === REACT_MEMO_TYPE;
			};
			exports.isPortal = function(object) {
				return typeOf(object) === REACT_PORTAL_TYPE;
			};
			exports.isProfiler = function(object) {
				return typeOf(object) === REACT_PROFILER_TYPE;
			};
			exports.isStrictMode = function(object) {
				return typeOf(object) === REACT_STRICT_MODE_TYPE;
			};
			exports.isSuspense = function(object) {
				return typeOf(object) === REACT_SUSPENSE_TYPE;
			};
			exports.isSuspenseList = function(object) {
				return typeOf(object) === REACT_SUSPENSE_LIST_TYPE;
			};
			exports.isValidElementType = function(type) {
				return "string" === typeof type || "function" === typeof type || type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || "object" === typeof type && null !== type && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_CONSUMER_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_CLIENT_REFERENCE$3 || void 0 !== type.getModuleId) ? !0 : !1;
			};
			exports.typeOf = typeOf;
		})();
	}));
	var import_react_is = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
		module.exports = require_react_is_development();
	})))();
	var REACT_ELEMENT_TYPE = Symbol.for("react.element");
	var REACT_TRANSITIONAL_ELEMENT_TYPE = Symbol.for("react.transitional.element");
	var REACT_CLIENT_REFERENCE$1 = Symbol.for("react.client.reference");
	var REACT_SERVER_REFERENCE = Symbol.for("react.server.reference");
	var ELEMENT_PREFIX = "$";
	var MODULE_PREFIX = "$L";
	var FUNCTION_PREFIX = "$F";
	var serverActions = /* @__PURE__ */ new Map();
	function createServerAction(id, fn) {
		serverActions.set(id, fn);
		return {
			$$typeof: REACT_SERVER_REFERENCE,
			$$id: id,
			$$bound: null
		};
	}
	async function executeServerAction(actionId, args, manifest$1) {
		const action = serverActions.get(actionId);
		if (!action) return new Response(JSON.stringify({ error: `Action "${actionId}" not found` }), {
			status: 404,
			headers: { "Content-Type": "application/json" }
		});
		try {
			return createFlightResponse(await action(...args), manifest$1);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { "Content-Type": "application/json" }
			});
		}
	}
	function serializeToFlightPayload(element, manifest$1) {
		let moduleRowId = 1;
		const rows = [];
		const moduleRefs = /* @__PURE__ */ new Map();
		const actionRefs = /* @__PURE__ */ new Map();
		function getModuleRefId(moduleId, exportName) {
			const key = `${moduleId}#${exportName}`;
			if (moduleRefs.has(key)) return moduleRefs.get(key);
			const id = moduleRowId++;
			moduleRefs.set(key, id);
			const entry = manifest$1[exportName === "*" ? moduleId : `${moduleId}#${exportName}`];
			const modId = entry?.id ?? moduleId;
			const modName = entry?.name ?? exportName;
			const chunks = entry?.chunks ?? [];
			rows.push(`${id}:I${JSON.stringify([
				modId,
				chunks,
				modName
			])}\n`);
			return id;
		}
		function getActionRefId(actionId) {
			if (actionRefs.has(actionId)) return actionRefs.get(actionId);
			const id = moduleRowId++;
			actionRefs.set(actionId, id);
			rows.push(`${id}:{"id":"${actionId}","bound":null}\n`);
			return id;
		}
		function serializeValue(value) {
			if (value === null || value === void 0) return value;
			if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
			if (Array.isArray(value)) return value.map(serializeValue);
			if (typeof value === "object") {
				const obj = value;
				if (obj.$$typeof === REACT_ELEMENT_TYPE || obj.$$typeof === REACT_TRANSITIONAL_ELEMENT_TYPE) return serializeElement(obj);
				if (obj.$$typeof === REACT_SERVER_REFERENCE) return `${FUNCTION_PREFIX}${getActionRefId(obj.$$id ?? "").toString(16)}`;
				if (obj.$$typeof === REACT_CLIENT_REFERENCE$1) {
					const ref = obj;
					const id = ref.$$id ?? "";
					const name = ref.name ?? "*";
					return `${MODULE_PREFIX}${getModuleRefId(id.includes("#") ? id.split("#")[0] : id, id.includes("#") ? id.split("#")[1] : name).toString(16)}`;
				}
				const result = {};
				for (const key of Object.keys(obj)) result[key] = serializeValue(obj[key]);
				return result;
			}
			if (typeof value === "function") {
				const fn = value;
				if (fn.$$typeof === REACT_SERVER_REFERENCE) return `${FUNCTION_PREFIX}${getActionRefId(fn.$$id ?? "").toString(16)}`;
				return serializeValue(value({}));
			}
			return null;
		}
		function serializeElement(element$1) {
			const { type, key, props } = element$1;
			if ((0, import_react_is.isFragment)(type)) {
				const children = props.children;
				return serializeValue(children);
			}
			function serializeProps(props$1) {
				const serializedProps = {};
				for (const propKey of Object.keys(props$1)) if (propKey !== "children") serializedProps[propKey] = serializeValue(props$1[propKey]);
				if (props$1.children !== void 0) serializedProps.children = serializeValue(props$1.children);
				return serializedProps;
			}
			if (typeof type === "object" && type !== null) {
				const ref = type;
				if (ref.$$typeof === REACT_CLIENT_REFERENCE$1) {
					const id = ref.$$id ?? "";
					const name = ref.name ?? "*";
					return [
						ELEMENT_PREFIX,
						`${MODULE_PREFIX}${getModuleRefId(id.includes("#") ? id.split("#")[0] : id, id.includes("#") ? id.split("#")[1] : name).toString(16)}`,
						key,
						serializeProps(props)
					];
				}
			}
			if (typeof type === "function") {
				const fn = type;
				if (fn.$$typeof === REACT_CLIENT_REFERENCE$1) {
					const id = fn.$$id ?? "";
					const name = fn.name ?? "*";
					return [
						ELEMENT_PREFIX,
						`${MODULE_PREFIX}${getModuleRefId(id.includes("#") ? id.split("#")[0] : id, id.includes("#") ? id.split("#")[1] : name).toString(16)}`,
						key,
						serializeProps(props)
					];
				}
				return serializeValue(type(props));
			}
			if (typeof type === "string") return [
				ELEMENT_PREFIX,
				type,
				key,
				serializeProps(props)
			];
			return null;
		}
		const rootValue = serializeValue(element);
		const rootRow = `0:${JSON.stringify(rootValue)}\n`;
		return [...rows, rootRow].join("");
	}
	function createFlightResponse(element, manifest$1, init) {
		const payload = serializeToFlightPayload(element, manifest$1);
		return new Response(payload, {
			...init,
			headers: {
				"Content-Type": "text/x-component; charset=utf-8",
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"X-Content-Type-Options": "nosniff",
				...init?.headers
			}
		});
	}
	init_server();
	var REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");
	function clientRef(moduleId, exportName) {
		return {
			$$typeof: REACT_CLIENT_REFERENCE,
			$$id: `${moduleId}#${exportName}`
		};
	}
	function createClientRefs(moduleId, exportNames) {
		const refs = {};
		for (const name of exportNames) refs[name] = clientRef(moduleId, name);
		return refs;
	}
	function createClientModule(moduleId, exportNames) {
		const manifest$1 = { [moduleId]: {
			id: moduleId,
			chunks: [],
			name: "*"
		} };
		for (const name of exportNames) manifest$1[`${moduleId}#${name}`] = {
			id: moduleId,
			chunks: [],
			name
		};
		return {
			manifest: manifest$1,
			refs: createClientRefs(moduleId, exportNames)
		};
	}
	init_server();
	/**
	* @license React
	* react-jsx-dev-runtime.development.js
	*
	* Copyright (c) Meta Platforms, Inc. and affiliates.
	*
	* This source code is licensed under the MIT license found in the
	* LICENSE file in the root directory of this source tree.
	*/
	var require_react_jsx_dev_runtime_development = /* @__PURE__ */ __commonJSMin(((exports) => {
		(function() {
			function getComponentNameFromType(type) {
				if (null == type) return null;
				if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE$3 ? null : type.displayName || type.name || null;
				if ("string" === typeof type) return type;
				switch (type) {
					case REACT_FRAGMENT_TYPE: return "Fragment";
					case REACT_PROFILER_TYPE: return "Profiler";
					case REACT_STRICT_MODE_TYPE: return "StrictMode";
					case REACT_SUSPENSE_TYPE: return "Suspense";
					case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
					case REACT_ACTIVITY_TYPE: return "Activity";
				}
				if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
					case REACT_PORTAL_TYPE: return "Portal";
					case REACT_CONTEXT_TYPE: return type.displayName || "Context";
					case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
					case REACT_FORWARD_REF_TYPE:
						var innerType = type.render;
						type = type.displayName;
						type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
						return type;
					case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
					case REACT_LAZY_TYPE:
						innerType = type._payload;
						type = type._init;
						try {
							return getComponentNameFromType(type(innerType));
						} catch (x$1) {}
				}
				return null;
			}
			function testStringCoercion(value) {
				return "" + value;
			}
			function checkKeyStringCoercion(value) {
				try {
					testStringCoercion(value);
					var JSCompiler_inline_result = !1;
				} catch (e$1) {
					JSCompiler_inline_result = !0;
				}
				if (JSCompiler_inline_result) {
					JSCompiler_inline_result = console;
					var JSCompiler_temp_const = JSCompiler_inline_result.error;
					var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
					JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
					return testStringCoercion(value);
				}
			}
			function getTaskName(type) {
				if (type === REACT_FRAGMENT_TYPE) return "<>";
				if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
				try {
					var name = getComponentNameFromType(type);
					return name ? "<" + name + ">" : "<...>";
				} catch (x$1) {
					return "<...>";
				}
			}
			function getOwner() {
				var dispatcher = ReactSharedInternals.A;
				return null === dispatcher ? null : dispatcher.getOwner();
			}
			function UnknownOwner() {
				return Error("react-stack-top-frame");
			}
			function hasValidKey(config) {
				if (hasOwnProperty.call(config, "key")) {
					var getter = Object.getOwnPropertyDescriptor(config, "key").get;
					if (getter && getter.isReactWarning) return !1;
				}
				return void 0 !== config.key;
			}
			function defineKeyPropWarningGetter(props, displayName) {
				function warnAboutAccessingKey() {
					specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
				}
				warnAboutAccessingKey.isReactWarning = !0;
				Object.defineProperty(props, "key", {
					get: warnAboutAccessingKey,
					configurable: !0
				});
			}
			function elementRefGetterWithDeprecationWarning() {
				var componentName = getComponentNameFromType(this.type);
				didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
				componentName = this.props.ref;
				return void 0 !== componentName ? componentName : null;
			}
			function ReactElement(type, key, props, owner, debugStack, debugTask) {
				var refProp = props.ref;
				type = {
					$$typeof: REACT_ELEMENT_TYPE$1,
					type,
					key,
					props,
					_owner: owner
				};
				null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
					enumerable: !1,
					get: elementRefGetterWithDeprecationWarning
				}) : Object.defineProperty(type, "ref", {
					enumerable: !1,
					value: null
				});
				type._store = {};
				Object.defineProperty(type._store, "validated", {
					configurable: !1,
					enumerable: !1,
					writable: !0,
					value: 0
				});
				Object.defineProperty(type, "_debugInfo", {
					configurable: !1,
					enumerable: !1,
					writable: !0,
					value: null
				});
				Object.defineProperty(type, "_debugStack", {
					configurable: !1,
					enumerable: !1,
					writable: !0,
					value: debugStack
				});
				Object.defineProperty(type, "_debugTask", {
					configurable: !1,
					enumerable: !1,
					writable: !0,
					value: debugTask
				});
				Object.freeze && (Object.freeze(type.props), Object.freeze(type));
				return type;
			}
			function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
				var children = config.children;
				if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
					for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++) validateChildKeys(children[isStaticChildren]);
					Object.freeze && Object.freeze(children);
				} else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
				else validateChildKeys(children);
				if (hasOwnProperty.call(config, "key")) {
					children = getComponentNameFromType(type);
					var keys = Object.keys(config).filter(function(k$1) {
						return "key" !== k$1;
					});
					isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
					didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
				}
				children = null;
				void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
				hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
				if ("key" in config) {
					maybeKey = {};
					for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
				} else maybeKey = config;
				children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
				return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
			}
			function validateChildKeys(node) {
				isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
			}
			function isValidElement(object) {
				return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE$1;
			}
			var React = require_react(), REACT_ELEMENT_TYPE$1 = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE$3 = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
				return null;
			};
			React = { react_stack_bottom_frame: function(callStackForError) {
				return callStackForError();
			} };
			var specialPropKeyWarningShown;
			var didWarnAboutElementRef = {};
			var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
			var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
			var didWarnAboutKeySpread = {};
			exports.Fragment = REACT_FRAGMENT_TYPE;
			exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
				var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
				return jsxDEVImpl(type, config, maybeKey, isStaticChildren, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
			};
		})();
	}));
	var import_jsx_dev_runtime = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
		module.exports = require_react_jsx_dev_runtime_development();
	})))();
	var _jsxFileName = "/Users/sergeygarin/Projects/react-19-query-demo/src/components/RSCMoviesTab/sw.tsx";
	var movieDatabaseCache = null;
	async function getDatabase() {
		if (movieDatabaseCache != null) return movieDatabaseCache;
		const [movies1, movies2] = await Promise.all([fetch("/movies/1.json").then((res) => res.json()), fetch("/movies/2.json").then((res) => res.json())]);
		movieDatabaseCache = [...movies1, ...movies2].map((movie) => ({
			id: movie.id,
			titleText: movie.titleText.text,
			releaseYear: movie.releaseYear?.year ?? 0,
			genres: movie.genres.genres.map((genre) => genre.text),
			plot: movie.plot?.plotText.plainText ?? "",
			directors: [],
			rating: movie.ratingsSummary.aggregateRating ?? 0,
			image: movie.primaryImage?.url ?? ""
		}));
		return movieDatabaseCache;
	}
	async function searchMovies(query, limit = 500) {
		const database = await getDatabase();
		query = query.trim();
		if (!query) return database.slice(0, limit);
		const searchTerm = query.toLowerCase();
		return database.filter((movie) => {
			if (movie.titleText.toLowerCase().includes(searchTerm)) return true;
			if (movie.genres.some((genre) => genre.toLowerCase().includes(searchTerm))) return true;
			if (movie.plot.toLowerCase().includes(searchTerm)) return true;
			if (movie.directors.some((director) => director.toLowerCase().includes(searchTerm))) return true;
			return false;
		}).slice(0, limit);
	}
	var { manifest, refs: Client } = createClientModule("rsc-movies-client", ["RatingStars"]);
	createServerAction("updateRating", async (movieId, rating) => {
		const movie = (await getDatabase()).find((m$1) => m$1.id === movieId);
		if (!movie) throw new Error(`Movie ${movieId} not found`);
		const randomDecimal = Math.random() * 1.9;
		movie.rating = Math.min(10, parseFloat((rating + randomDecimal).toFixed(1)));
		console.log("[SW] Updated rating:", movieId, "->", movie.rating);
		return movie;
	});
	var MOVIE_CARD_SIZE = "140px";
	function MovieCard({ movie }) {
		const rating = movie.rating;
		const currentStars = Math.ceil((rating ?? 0) / 2);
		const director = movie.directors.join(", ") || "Unknown";
		const genres = movie.genres.join(", ") || "Unknown";
		return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "group bg-white border border-gray-100 rounded-4xl [corner-shape:superellipse(1.33)] overflow-hidden hover:border-black hover:shadow-lg flex flex-col sm:flex-row max-w-3xl mx-auto w-full",
			style: { height: MOVIE_CARD_SIZE },
			children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "p-3 sm:p-4 flex-1 flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-start justify-between gap-2",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
							className: "text-sm sm:text-base font-bold text-black line-clamp-2 sm:truncate group-hover:text-gray-900",
							children: movie.titleText
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 108,
							columnNumber: 11
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 107,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-600",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("svg", {
									className: "w-3 h-3",
									fill: "currentColor",
									viewBox: "0 0 20 20",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 116,
										columnNumber: 15
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 115,
									columnNumber: 13
								}, this), movie.releaseYear ?? "N/A"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 114,
								columnNumber: 11
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-gray-400",
								children: "•"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 120,
								columnNumber: 11
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "px-2 py-0.5 text-xs font-bold bg-black text-white rounded-md shadow-lg",
								children: rating?.toFixed(1) ?? "N/A"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 121,
								columnNumber: 11
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-gray-400",
								children: "•"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 124,
								columnNumber: 11
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "truncate max-w-[120px] sm:max-w-none",
								children: director
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 125,
								columnNumber: 11
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-gray-400",
								children: "•"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 126,
								columnNumber: 11
							}, this),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md truncate max-w-[150px]",
								children: genres
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 127,
								columnNumber: 11
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 113,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-2",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Client.RatingStars, {
							movieId: movie.id,
							currentStars
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 134,
							columnNumber: 11
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 133,
						columnNumber: 9
					}, this),
					movie.plot && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "text-xs text-gray-600 line-clamp-2",
						children: movie.plot
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 137,
						columnNumber: 24
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 106,
				columnNumber: 7
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 102,
			columnNumber: 5
		}, this);
	}
	function MovieList({ movies }) {
		if (movies.length === 0) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "text-center py-12 md:py-20",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "text-4xl md:text-6xl mb-4",
					children: "🎬"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 147,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-lg md:text-xl text-gray-600 mb-2",
					children: "No movies found"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 148,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-xs md:text-sm text-gray-400",
					children: "Try a different search term"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 149,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 146,
			columnNumber: 7
		}, this);
		return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "mb-4 md:mb-6 text-center",
			children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "text-xs md:text-sm text-gray-500",
				children: [
					"Found ",
					movies.length,
					" ",
					movies.length === 1 ? "movie" : "movies"
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 157,
				columnNumber: 9
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 156,
			columnNumber: 7
		}, this), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex flex-col gap-3 md:gap-4",
			children: movies.map((movie) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MovieCard, { movie }, movie.id, false, {
				fileName: _jsxFileName,
				lineNumber: 163,
				columnNumber: 11
			}, this))
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 161,
			columnNumber: 7
		}, this)] }, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 155,
			columnNumber: 5
		}, this);
	}
	async function App({ searchQuery, limit }) {
		return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MovieList, { movies: await searchMovies(searchQuery, limit) }, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 172,
			columnNumber: 10
		}, this);
	}
	setupWorker([
		http.get("/api/movies/search", async ({ url }) => {
			const query = url.searchParams.get("query") ?? "";
			const limitParam = url.searchParams.get("limit");
			return json(await searchMovies(query, limitParam != null ? Number.parseInt(limitParam, 10) : 500));
		}),
		http.get("/api/movies/:id", async ({ params }) => {
			const id = params.id;
			const movie = (await getDatabase()).find((m$1) => m$1.id === id);
			if (movie == null) return json({ error: `Movie with id ${id} not found` }, { status: 404 });
			return json(movie);
		}),
		http.patch("/api/movies/:id/rating", async ({ params, request }) => {
			const id = params.id;
			const body = await request.json();
			const movie = (await getDatabase()).find((m$1) => m$1.id === id);
			if (movie == null) return json({ error: `Movie with id ${id} not found` }, { status: 404 });
			const randomDecimal = Math.random() * 1.9;
			movie.rating = Math.min(10, parseFloat((body.rating + randomDecimal).toFixed(1)));
			return json(movie);
		}),
		http.get("/rsc/movies", async ({ url }) => {
			const searchQuery = url.searchParams.get("q") ?? "";
			const limit = Number(url.searchParams.get("limit") ?? 100);
			console.log("[SW] Rendering RSC for movies:", {
				searchQuery,
				limit
			});
			return createFlightResponse(/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(App, {
				searchQuery,
				limit
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 227,
				columnNumber: 33
			}, void 0), manifest);
		}),
		http.post("/rsc/movies", async ({ request }) => {
			const actionId = request.headers.get("x-rsc-action");
			if (!actionId) return json({ error: "Missing x-rsc-action header" }, { status: 400 });
			console.log("[SW] Executing server action:", actionId);
			const body = await request.text();
			let args = [];
			try {
				args = JSON.parse(body);
				if (!Array.isArray(args)) args = [args];
			} catch {
				args = body ? [body] : [];
			}
			return executeServerAction(actionId, args, manifest);
		})
	]);
	console.log("[Movies SW] Routes registered (JSON API + RSC)");
})();

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3cuanMiLCJuYW1lcyI6WyJtb2R1bGVDYWNoZTogUmVjb3JkPHN0cmluZywgeyBleHBvcnRzPzogdW5rbm93biB9PiIsIl9yZW5kZXJUb1JlYWRhYmxlU3RyZWFtOiB0eXBlb2YgaW1wb3J0KFwicmVhY3Qtc2VydmVyLWRvbS13ZWJwYWNrL3NlcnZlclwiKS5yZW5kZXJUb1JlYWRhYmxlU3RyZWFtIiwiX3JlZ2lzdGVyU2VydmVyUmVmZXJlbmNlOiB0eXBlb2YgaW1wb3J0KFwicmVhY3Qtc2VydmVyLWRvbS13ZWJwYWNrL3NlcnZlclwiKS5yZWdpc3RlclNlcnZlclJlZmVyZW5jZSIsIl9jcmVhdGVDbGllbnRNb2R1bGVQcm94eTogdHlwZW9mIGltcG9ydChcInJlYWN0LXNlcnZlci1kb20td2VicGFjay9zZXJ2ZXJcIikuY3JlYXRlQ2xpZW50TW9kdWxlUHJveHkiLCJfZGVjb2RlUmVwbHk6IHR5cGVvZiBpbXBvcnQoXCJyZWFjdC1zZXJ2ZXItZG9tLXdlYnBhY2svc2VydmVyXCIpLmRlY29kZVJlcGx5IiwiYm9keTogRm9ybURhdGEgfCBzdHJpbmciLCJtYW5pZmVzdDogQ2xpZW50TWFuaWZlc3QiLCJtZXRob2RzOiBIdHRwTWV0aG9kW10iLCJhcmdzOiB1bmtub3duW10iLCJwYXJhbXM6IFJvdXRlUGFyYW1zIiwiaW5zdGFsbGVkUm91dGVzOiBDb21waWxlZFJvdXRlW10iLCJpbnN0YWxsZWRPcHRpb25zOiBTZXJ2aWNlV29ya2VyT3B0aW9ucyIsInJlZ2lzdHJhdGlvbjogU2VydmljZVdvcmtlclJlZ2lzdHJhdGlvbiB8IG51bGwiLCJlIiwidCIsInIiLCJvIiwibiIsImEiLCJpIiwibCIsInMiLCJ1IiwiYyIsImQiLCJfIiwieSIsInYiLCJxIiwidyIsIlIiLCJUIiwiUCIsIkUiLCJDIiwiTyIsImciLCJTIiwiZiIsImIiLCJoIiwicCIsIlJlYWRhYmxlU3RyZWFtIiwicG9seWZpbGxSZWFkeTogUHJvbWlzZTx2b2lkPiIsImUiLCJSRUFDVF9DTElFTlRfUkVGRVJFTkNFIiwieCIsIlJFQUNUX0VMRU1FTlRfVFlQRSIsImVycm9yIiwiYyIsImkiLCJuIiwicGFzc3Rocm91Z2giLCJfY3JlYXRlRnJvbVJlYWRhYmxlU3RyZWFtOiB0eXBlb2YgaW1wb3J0KFwicmVhY3Qtc2VydmVyLWRvbS13ZWJwYWNrL2NsaWVudFwiKS5jcmVhdGVGcm9tUmVhZGFibGVTdHJlYW0iLCJfZW5jb2RlUmVwbHk6IHR5cGVvZiBpbXBvcnQoXCJyZWFjdC1zZXJ2ZXItZG9tLXdlYnBhY2svY2xpZW50XCIpLmVuY29kZVJlcGx5IiwiUkVBQ1RfRUxFTUVOVF9UWVBFIiwiUkVBQ1RfQ0xJRU5UX1JFRkVSRU5DRSIsInJvd3M6IHN0cmluZ1tdIiwicmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCBGbGlnaHRWYWx1ZT4iLCJzZXJpYWxpemVkUHJvcHM6IFJlY29yZDxzdHJpbmcsIEZsaWdodFZhbHVlPiIsIm1hbmlmZXN0OiBDbGllbnRNYW5pZmVzdCIsIlJFQUNUX0NMSUVOVF9SRUZFUkVOQ0UiLCJ4IiwiZSIsIlJFQUNUX0VMRU1FTlRfVFlQRSIsImsiLCJtb3ZpZURhdGFiYXNlQ2FjaGU6IE1vdmllW10gfCBudWxsIiwiYXJnczogdW5rbm93bltdIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvcnNjL3dlYnBhY2stc2hpbS50cyIsIi4uLy4uLy4uLy4uL2xpYi9yc2Mtc2VydmljZS13b3JrZXItYmZmL3Jlc3BvbnNlLnRzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3JlYWN0LXNlcnZlci1kb20td2VicGFja0AxOS4yLjNfcmVhY3QtZG9tQDE5LjIuMF9yZWFjdEAxOS4yLjBfX3JlYWN0QDE5LjIuMF93ZWJwYWNrQDUuMTA0LjFfZXNidWlsZEAwLjI1LjExXy9ub2RlX21vZHVsZXMvcmVhY3Qtc2VydmVyLWRvbS13ZWJwYWNrL3NlcnZlci5qcyIsIi4uLy4uLy4uLy4uL2xpYi9yc2Mtc2VydmljZS13b3JrZXItYmZmL3JzYy9zZXJ2ZXIudHMiLCIuLi8uLi8uLi8uLi9saWIvcnNjLXNlcnZpY2Utd29ya2VyLWJmZi9odHRwLnRzIiwiLi4vLi4vLi4vLi4vbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvcm91dGVyLnRzIiwiLi4vLi4vLi4vLi4vbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvd29ya2VyLnRzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3dlYi1zdHJlYW1zLXBvbHlmaWxsQDQuMi4wL25vZGVfbW9kdWxlcy93ZWItc3RyZWFtcy1wb2x5ZmlsbC9kaXN0L3BvbnlmaWxsLm1qcyIsIi4uLy4uLy4uLy4uL2xpYi9yc2Mtc2VydmljZS13b3JrZXItYmZmL3JzYy9wb2x5ZmlsbC50cyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9yZWFjdEAxOS4yLjAvbm9kZV9tb2R1bGVzL3JlYWN0L2Nqcy9yZWFjdC5kZXZlbG9wbWVudC5qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9yZWFjdEAxOS4yLjAvbm9kZV9tb2R1bGVzL3JlYWN0L2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvcnNjL2NsaWVudC50cyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9yZWFjdC1pc0AxOS4yLjAvbm9kZV9tb2R1bGVzL3JlYWN0LWlzL2Nqcy9yZWFjdC1pcy5kZXZlbG9wbWVudC5qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9yZWFjdC1pc0AxOS4yLjAvbm9kZV9tb2R1bGVzL3JlYWN0LWlzL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvcnNjL2ZsaWdodC1zZXJpYWxpemVyLnRzIiwiLi4vLi4vLi4vLi4vbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvcnNjL2luZGV4LnRzIiwiLi4vLi4vLi4vLi4vbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvcnNjL2NsaWVudC1yZWZlcmVuY2UudHMiLCIuLi8uLi8uLi8uLi9saWIvcnNjLXNlcnZpY2Utd29ya2VyLWJmZi9pbmRleC50cyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9yZWFjdEAxOS4yLjAvbm9kZV9tb2R1bGVzL3JlYWN0L2Nqcy9yZWFjdC1qc3gtZGV2LXJ1bnRpbWUuZGV2ZWxvcG1lbnQuanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vcmVhY3RAMTkuMi4wL25vZGVfbW9kdWxlcy9yZWFjdC9qc3gtZGV2LXJ1bnRpbWUuanMiLCIuLi9zdy50c3giXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQHRzLW5vY2hlY2tcbi8qKlxuICogV2VicGFjayBTaGltIGZvciBSU0NcbiAqXG4gKiByZWFjdC1zZXJ2ZXItZG9tLXdlYnBhY2sgaW50ZXJuYWxseSB1c2VzIHdlYnBhY2sncyBtb2R1bGUgc3lzdGVtLlxuICogVGhpcyBzaGltIHByb3ZpZGVzIHRoZSByZXF1aXJlZCBnbG9iYWxzIGZvciBSU0MgdG8gd29yayBpbiBhbnkgZW52aXJvbm1lbnRcbiAqIChTZXJ2aWNlIFdvcmtlciwgV2ViIFdvcmtlciwgbWFpbiB0aHJlYWQpLlxuICpcbiAqIElNUE9SVEFOVDogVGhpcyBmaWxlIG11c3QgYmUgaW1wb3J0ZWQgQkVGT1JFIGFueSByZWFjdC1zZXJ2ZXItZG9tLXdlYnBhY2sgaW1wb3J0cy5cbiAqL1xuXG5jb25zdCBnID0gZ2xvYmFsVGhpcyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblxuLyoqXG4gKiBNb2R1bGUgY2FjaGUgLSBzdG9yZXMgbG9hZGVkIGNsaWVudCBtb2R1bGVzXG4gKiBVc2VkIGJ5IF9fd2VicGFja19yZXF1aXJlX18gdG8gcmVzb2x2ZSBtb2R1bGUgcmVmZXJlbmNlc1xuICovXG5leHBvcnQgY29uc3QgbW9kdWxlQ2FjaGU6IFJlY29yZDxzdHJpbmcsIHsgZXhwb3J0cz86IHVua25vd24gfT4gPSB7fTtcblxuLy8gU2V0IHVwIHdlYnBhY2sgZ2xvYmFsc1xuZy5fX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSBtb2R1bGVDYWNoZTtcblxuLyoqXG4gKiBNb2R1bGUgbG9hZGVyIC0gcmV0cmlldmVzIG1vZHVsZXMgZnJvbSBjYWNoZVxuICogQ2FsbGVkIGJ5IFJTQyB3aGVuIHJlc29sdmluZyBjbGllbnQgbW9kdWxlIHJlZmVyZW5jZXNcbiAqL1xuZy5fX3dlYnBhY2tfcmVxdWlyZV9fID0gKG1vZHVsZUlkOiBzdHJpbmcpOiB1bmtub3duID0+IHtcbiAgY29uc3QgY2FjaGVkID0gbW9kdWxlQ2FjaGVbbW9kdWxlSWRdO1xuICBpZiAoY2FjaGVkKSByZXR1cm4gY2FjaGVkLmV4cG9ydHMgPz8gY2FjaGVkO1xuICB0aHJvdyBuZXcgRXJyb3IoYFtyc2Mtc3ctYmZmXSBNb2R1bGUgXCIke21vZHVsZUlkfVwiIG5vdCBmb3VuZCBpbiB3ZWJwYWNrIGNhY2hlYCk7XG59O1xuXG4vKipcbiAqIENodW5rIGxvYWRpbmcgLSBuby1vcCBmb3Igc2VydmljZSB3b3JrZXIgZW52aXJvbm1lbnRcbiAqIEFsbCBtb2R1bGVzIHNob3VsZCBhbHJlYWR5IGJlIGxvYWRlZC9yZWdpc3RlcmVkXG4gKi9cbmcuX193ZWJwYWNrX2NodW5rX2xvYWRfXyA9ICgpOiBQcm9taXNlPHZvaWQ+ID0+IFByb21pc2UucmVzb2x2ZSgpO1xuXG4vKipcbiAqIFNjcmlwdCBmaWxlbmFtZSBnZXR0ZXIgLSB1c2VkIGZvciBkeW5hbWljIGltcG9ydHNcbiAqIFJldHVybnMgZW1wdHkgc3RyaW5nIGFzIHdlIGRvbid0IHVzZSBkeW5hbWljIGNodW5rIGxvYWRpbmdcbiAqL1xuZy5fX3dlYnBhY2tfZ2V0X3NjcmlwdF9maWxlbmFtZV9fID0gKCk6IHN0cmluZyA9PiBcIlwiO1xuXG4vKipcbiAqIFB1YmxpYyBwYXRoIC0gYmFzZSBVUkwgZm9yIGxvYWRpbmcgY2h1bmtzXG4gKi9cbmcuX193ZWJwYWNrX3B1YmxpY19wYXRoX18gPSBcIi9cIjtcblxuLyoqXG4gKiBBc3luYyBjaHVuayBoYW5kbGVyIC0gaGFuZGxlcyBhc3luYyBtb2R1bGUgbG9hZGluZ1xuICogUmVzb2x2ZXMgaW1tZWRpYXRlbHkgc2luY2UgYWxsIG1vZHVsZXMgYXJlIHByZS1yZWdpc3RlcmVkXG4gKi9cbmcuX193ZWJwYWNrX3JlcXVpcmVfXy5lID0gKCk6IFByb21pc2U8dm9pZD4gPT4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cbi8qKlxuICogTW9kdWxlIGZhY3Rvcnkgd3JhcHBlclxuICovXG5nLl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHZvaWQgPT4ge1xuICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiBcIk1vZHVsZVwiIH0pO1xuICB9XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07XG5cbi8qKlxuICogRGVmaW5lIGdldHRlciBmdW5jdGlvbiBmb3IgRVMgbW9kdWxlc1xuICovXG5nLl9fd2VicGFja19yZXF1aXJlX18uZCA9IChcbiAgZXhwb3J0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gIGRlZmluaXRpb246IFJlY29yZDxzdHJpbmcsICgpID0+IHVua25vd24+LFxuKTogdm9pZCA9PiB7XG4gIGZvciAoY29uc3Qga2V5IGluIGRlZmluaXRpb24pIHtcbiAgICBpZiAoXG4gICAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZGVmaW5pdGlvbiwga2V5KSAmJlxuICAgICAgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChleHBvcnRzLCBrZXkpXG4gICAgKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBmYWtlIG5hbWVzcGFjZSBvYmplY3QgZm9yIG5vbi1FUyBtb2R1bGVzXG4gKi9cbmcuX193ZWJwYWNrX3JlcXVpcmVfXy50ID0gKHZhbHVlOiB1bmtub3duLCBtb2RlOiBudW1iZXIpOiB1bmtub3duID0+IHtcbiAgaWYgKG1vZGUgJiAxKSB2YWx1ZSA9IChnLl9fd2VicGFja19yZXF1aXJlX18gYXMgKGlkOiBzdHJpbmcpID0+IHVua25vd24pKHZhbHVlIGFzIHN0cmluZyk7XG4gIGlmIChtb2RlICYgOCkgcmV0dXJuIHZhbHVlO1xuICBpZiAoXG4gICAgbW9kZSAmIDQgJiZcbiAgICB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiZcbiAgICB2YWx1ZSAmJlxuICAgICh2YWx1ZSBhcyB7IF9fZXNNb2R1bGU/OiBib29sZWFuIH0pLl9fZXNNb2R1bGVcbiAgKVxuICAgIHJldHVybiB2YWx1ZTtcbiAgY29uc3QgbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBnLl9fd2VicGFja19yZXF1aXJlX18ucihucyk7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShucywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWUgfSk7XG4gIGlmIChtb2RlICYgMiAmJiB0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIpIHtcbiAgICBmb3IgKGNvbnN0IGtleSBpbiB2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikge1xuICAgICAgZy5fX3dlYnBhY2tfcmVxdWlyZV9fLmQobnMsIHtcbiAgICAgICAgW2tleV06ICgpID0+ICh2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnM7XG59O1xuXG4vLyBUeXBlIGRlY2xhcmF0aW9ucyBmb3IgVHlwZVNjcmlwdFxuZGVjbGFyZSBnbG9iYWwge1xuICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdHlsZS9ub1ZhcjogPEdsb2JhbCBkZWNsYXJhdGlvbiByZXF1aXJlcyB2YXI+XG4gIHZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX186IFJlY29yZDxzdHJpbmcsIHsgZXhwb3J0cz86IHVua25vd24gfT47XG4gIC8vIGJpb21lLWlnbm9yZSBsaW50L3N0eWxlL25vVmFyOiA8R2xvYmFsIGRlY2xhcmF0aW9uIHJlcXVpcmVzIHZhcj5cbiAgdmFyIF9fd2VicGFja19yZXF1aXJlX186ICgobW9kdWxlSWQ6IHN0cmluZykgPT4gdW5rbm93bikgJiB7XG4gICAgZTogKCkgPT4gUHJvbWlzZTx2b2lkPjtcbiAgICByOiAoZXhwb3J0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHZvaWQ7XG4gICAgZDogKGV4cG9ydHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBkZWZpbml0aW9uOiBSZWNvcmQ8c3RyaW5nLCAoKSA9PiB1bmtub3duPikgPT4gdm9pZDtcbiAgICB0OiAodmFsdWU6IHVua25vd24sIG1vZGU6IG51bWJlcikgPT4gdW5rbm93bjtcbiAgfTtcbiAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3R5bGUvbm9WYXI6IDxHbG9iYWwgZGVjbGFyYXRpb24gcmVxdWlyZXMgdmFyPlxuICB2YXIgX193ZWJwYWNrX2NodW5rX2xvYWRfXzogKCkgPT4gUHJvbWlzZTx2b2lkPjtcbiAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3R5bGUvbm9WYXI6IDxHbG9iYWwgZGVjbGFyYXRpb24gcmVxdWlyZXMgdmFyPlxuICB2YXIgX193ZWJwYWNrX2dldF9zY3JpcHRfZmlsZW5hbWVfXzogKCkgPT4gc3RyaW5nO1xuICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdHlsZS9ub1ZhcjogPEdsb2JhbCBkZWNsYXJhdGlvbiByZXF1aXJlcyB2YXI+XG4gIHZhciBfX3dlYnBhY2tfcHVibGljX3BhdGhfXzogc3RyaW5nO1xufVxuIiwiZXhwb3J0IGludGVyZmFjZSBKc29uUmVzcG9uc2VJbml0IGV4dGVuZHMgT21pdDxSZXNwb25zZUluaXQsIFwiaGVhZGVyc1wiPiB7XG4gIGhlYWRlcnM/OiBIZWFkZXJzSW5pdDtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBKU09OIHJlc3BvbnNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBqc29uPFQ+KGRhdGE6IFQsIGluaXQ/OiBKc29uUmVzcG9uc2VJbml0KTogUmVzcG9uc2Uge1xuICBjb25zdCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoaW5pdD8uaGVhZGVycyk7XG4gIGhlYWRlcnMuc2V0KFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcblxuICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGRhdGEpLCB7XG4gICAgLi4uaW5pdCxcbiAgICBoZWFkZXJzLFxuICB9KTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSB0ZXh0IHJlc3BvbnNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KGJvZHk6IHN0cmluZywgaW5pdD86IFJlc3BvbnNlSW5pdCk6IFJlc3BvbnNlIHtcbiAgY29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKGluaXQ/LmhlYWRlcnMpO1xuICBoZWFkZXJzLnNldChcIkNvbnRlbnQtVHlwZVwiLCBcInRleHQvcGxhaW5cIik7XG5cbiAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7XG4gICAgLi4uaW5pdCxcbiAgICBoZWFkZXJzLFxuICB9KTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gSFRNTCByZXNwb25zZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaHRtbChib2R5OiBzdHJpbmcsIGluaXQ/OiBSZXNwb25zZUluaXQpOiBSZXNwb25zZSB7XG4gIGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycyhpbml0Py5oZWFkZXJzKTtcbiAgaGVhZGVycy5zZXQoXCJDb250ZW50LVR5cGVcIiwgXCJ0ZXh0L2h0bWxcIik7XG5cbiAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7XG4gICAgLi4uaW5pdCxcbiAgICBoZWFkZXJzLFxuICB9KTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSByZWRpcmVjdCByZXNwb25zZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVkaXJlY3QodXJsOiBzdHJpbmcsIHN0YXR1czogMzAxIHwgMzAyIHwgMzAzIHwgMzA3IHwgMzA4ID0gMzAyKTogUmVzcG9uc2Uge1xuICByZXR1cm4gUmVzcG9uc2UucmVkaXJlY3QodXJsLCBzdGF0dXMpO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIG5vLWNvbnRlbnQgcmVzcG9uc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vQ29udGVudCgpOiBSZXNwb25zZSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwgeyBzdGF0dXM6IDIwNCB9KTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gZXJyb3IgcmVzcG9uc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgc3RhdHVzOiBudW1iZXIgPSA1MDApOiBSZXNwb25zZSB7XG4gIHJldHVybiBqc29uKHsgZXJyb3I6IG1lc3NhZ2UgfSwgeyBzdGF0dXMgfSk7XG59XG5cbi8qKlxuICogUGFzc3Rocm91Z2ggdG8gbmV0d29ya1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGFzc3Rocm91Z2gocmVxdWVzdDogUmVxdWVzdCk6IFByb21pc2U8UmVzcG9uc2U+IHtcbiAgcmV0dXJuIGZldGNoKHJlcXVlc3QpO1xufVxuXG4iLCIndXNlIHN0cmljdCc7XG5cbnRocm93IG5ldyBFcnJvcihcbiAgJ1RoZSBSZWFjdCBTZXJ2ZXIgV3JpdGVyIGNhbm5vdCBiZSB1c2VkIG91dHNpZGUgYSByZWFjdC1zZXJ2ZXIgZW52aXJvbm1lbnQuICcgK1xuICAgICdZb3UgbXVzdCBjb25maWd1cmUgTm9kZS5qcyB1c2luZyB0aGUgYC0tY29uZGl0aW9ucyByZWFjdC1zZXJ2ZXJgIGZsYWcuJ1xuKTtcbiIsIi8qKlxuICogUlNDIFNlcnZlciBNb2R1bGUgLSBGb3IgU2VydmljZSBXb3JrZXJcbiAqXG4gKiBQcm92aWRlcyB1dGlsaXRpZXMgZm9yIHJlbmRlcmluZyBSZWFjdCBTZXJ2ZXIgQ29tcG9uZW50c1xuICogYW5kIGhhbmRsaW5nIHNlcnZlciBhY3Rpb25zIHdpdGhpbiBhIHNlcnZpY2Ugd29ya2VyLlxuICpcbiAqIElNUE9SVEFOVDogSW1wb3J0IHdlYnBhY2stc2hpbSBiZWZvcmUgdGhpcyBtb2R1bGU6XG4gKiBgYGB0c1xuICogaW1wb3J0ICcuL3JzYy93ZWJwYWNrLXNoaW0nO1xuICogaW1wb3J0IHsgcmVuZGVyUlNDIH0gZnJvbSAnLi9yc2Mvc2VydmVyJztcbiAqIGBgYFxuICovXG5cbmltcG9ydCB0eXBlIHsgUmVhY3ROb2RlIH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgdHlwZSB7IENsaWVudE1hbmlmZXN0LCBFbmNvZGVkQWN0aW9uQXJncywgUlNDQ29udGV4dCwgUlNDUmVuZGVyT3B0aW9ucyB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbi8vIExhenkgaW1wb3J0cyB0byBlbnN1cmUgd2VicGFjay1zaGltIGxvYWRzIGZpcnN0XG5sZXQgX3JlbmRlclRvUmVhZGFibGVTdHJlYW06IHR5cGVvZiBpbXBvcnQoXCJyZWFjdC1zZXJ2ZXItZG9tLXdlYnBhY2svc2VydmVyXCIpLnJlbmRlclRvUmVhZGFibGVTdHJlYW07XG5sZXQgX3JlZ2lzdGVyU2VydmVyUmVmZXJlbmNlOiB0eXBlb2YgaW1wb3J0KFwicmVhY3Qtc2VydmVyLWRvbS13ZWJwYWNrL3NlcnZlclwiKS5yZWdpc3RlclNlcnZlclJlZmVyZW5jZTtcbmxldCBfY3JlYXRlQ2xpZW50TW9kdWxlUHJveHk6IHR5cGVvZiBpbXBvcnQoXCJyZWFjdC1zZXJ2ZXItZG9tLXdlYnBhY2svc2VydmVyXCIpLmNyZWF0ZUNsaWVudE1vZHVsZVByb3h5O1xubGV0IF9kZWNvZGVSZXBseTogdHlwZW9mIGltcG9ydChcInJlYWN0LXNlcnZlci1kb20td2VicGFjay9zZXJ2ZXJcIikuZGVjb2RlUmVwbHk7XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUltcG9ydHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghX3JlbmRlclRvUmVhZGFibGVTdHJlYW0pIHtcbiAgICBjb25zdCBtb2QgPSBhd2FpdCBpbXBvcnQoXCJyZWFjdC1zZXJ2ZXItZG9tLXdlYnBhY2svc2VydmVyXCIpO1xuICAgIF9yZW5kZXJUb1JlYWRhYmxlU3RyZWFtID0gbW9kLnJlbmRlclRvUmVhZGFibGVTdHJlYW07XG4gICAgX3JlZ2lzdGVyU2VydmVyUmVmZXJlbmNlID0gbW9kLnJlZ2lzdGVyU2VydmVyUmVmZXJlbmNlO1xuICAgIF9jcmVhdGVDbGllbnRNb2R1bGVQcm94eSA9IG1vZC5jcmVhdGVDbGllbnRNb2R1bGVQcm94eTtcbiAgICBfZGVjb2RlUmVwbHkgPSBtb2QuZGVjb2RlUmVwbHk7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gUlNDIGNvbnRleHQgZm9yIHJlbmRlcmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUlNDQ29udGV4dChtYW5pZmVzdDogQ2xpZW50TWFuaWZlc3QpOiBSU0NDb250ZXh0IHtcbiAgcmV0dXJuIHtcbiAgICBtYW5pZmVzdCxcbiAgICBhY3Rpb25zOiBuZXcgTWFwKCksXG4gIH07XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBzZXJ2ZXIgYWN0aW9uIGluIHRoZSBSU0MgY29udGV4dFxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogY29uc3QgY3R4ID0gY3JlYXRlUlNDQ29udGV4dChtYW5pZmVzdCk7XG4gKiBhd2FpdCByZWdpc3RlckFjdGlvbihjdHgsICdpbmNyZW1lbnRDb3VudCcsIGFzeW5jIChjb3VudDogbnVtYmVyKSA9PiBjb3VudCArIDEpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWdpc3RlckFjdGlvbihcbiAgY3R4OiBSU0NDb250ZXh0LFxuICBpZDogc3RyaW5nLFxuICBmbjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdW5rbm93bixcbik6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBlbnN1cmVJbXBvcnRzKCk7XG4gIGNvbnN0IHJlZ2lzdGVyZWRGbiA9IF9yZWdpc3RlclNlcnZlclJlZmVyZW5jZShmbiwgaWQsIGlkKTtcbiAgY3R4LmFjdGlvbnMuc2V0KGlkLCB7IGZuOiByZWdpc3RlcmVkRm4gYXMgKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdW5rbm93biwgaWQgfSk7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgbXVsdGlwbGUgc2VydmVyIGFjdGlvbnMgYXQgb25jZVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVnaXN0ZXJBY3Rpb25zKFxuICBjdHg6IFJTQ0NvbnRleHQsXG4gIGFjdGlvbnM6IFJlY29yZDxzdHJpbmcsICguLi5hcmdzOiB1bmtub3duW10pID0+IHVua25vd24+LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGVuc3VyZUltcG9ydHMoKTtcbiAgZm9yIChjb25zdCBbaWQsIGZuXSBvZiBPYmplY3QuZW50cmllcyhhY3Rpb25zKSkge1xuICAgIGNvbnN0IHJlZ2lzdGVyZWRGbiA9IF9yZWdpc3RlclNlcnZlclJlZmVyZW5jZShmbiwgaWQsIGlkKTtcbiAgICBjdHguYWN0aW9ucy5zZXQoaWQsIHsgZm46IHJlZ2lzdGVyZWRGbiBhcyAoLi4uYXJnczogdW5rbm93bltdKSA9PiB1bmtub3duLCBpZCB9KTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZSBhIGNsaWVudCBtb2R1bGUgcHJveHkgZm9yIHVzZSBpbiBzZXJ2ZXIgY29tcG9uZW50c1xuICpcbiAqIFRoaXMgYWxsb3dzIHNlcnZlciBjb21wb25lbnRzIHRvIHJlZmVyZW5jZSBjbGllbnQgY29tcG9uZW50czpcbiAqIGBgYHRzeFxuICogY29uc3QgQ2xpZW50ID0gY3JlYXRlQ2xpZW50UHJveHkoJ2NsaWVudCcpO1xuICogLy8gSW4gc2VydmVyIGNvbXBvbmVudDpcbiAqIDxDbGllbnQuQ291bnRlciBpbml0aWFsQ291bnQ9ezB9IC8+XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUNsaWVudFByb3h5PFQgPSBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4obW9kdWxlSWQ6IHN0cmluZyk6IFByb21pc2U8VD4ge1xuICBhd2FpdCBlbnN1cmVJbXBvcnRzKCk7XG4gIHJldHVybiBfY3JlYXRlQ2xpZW50TW9kdWxlUHJveHkobW9kdWxlSWQpIGFzIFQ7XG59XG5cbi8qKlxuICogUmVuZGVyIGEgUmVhY3QgZWxlbWVudCB0byBhbiBSU0Mgc3RyZWFtXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBjb25zdCBzdHJlYW0gPSBhd2FpdCByZW5kZXJSU0MoPEFwcCAvPiwgY3R4KTtcbiAqIHJldHVybiBuZXcgUmVzcG9uc2Uoc3RyZWFtLCB7XG4gKiAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3gtY29tcG9uZW50JyB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVuZGVyUlNDKFxuICBlbGVtZW50OiBSZWFjdE5vZGUsXG4gIGN0eDogUlNDQ29udGV4dCxcbiAgb3B0aW9ucz86IFJTQ1JlbmRlck9wdGlvbnMsXG4pOiBQcm9taXNlPFJlYWRhYmxlU3RyZWFtPFVpbnQ4QXJyYXk+PiB7XG4gIGF3YWl0IGVuc3VyZUltcG9ydHMoKTtcblxuICByZXR1cm4gX3JlbmRlclRvUmVhZGFibGVTdHJlYW0oZWxlbWVudCwgY3R4Lm1hbmlmZXN0LCB7XG4gICAgb25FcnJvcjpcbiAgICAgIG9wdGlvbnM/Lm9uRXJyb3IgPz9cbiAgICAgICgoZXJyKSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbcnNjLXN3LWJmZl0gUmVuZGVyIGVycm9yOlwiLCBlcnIpO1xuICAgICAgICByZXR1cm4gXCJBbiBlcnJvciBvY2N1cnJlZCBkdXJpbmcgc2VydmVyIHJlbmRlcmluZy5cIjtcbiAgICAgIH0pLFxuICAgIHNpZ25hbDogb3B0aW9ucz8uc2lnbmFsLFxuICB9KTtcbn1cblxuLyoqXG4gKiBEZWNvZGUgZW5jb2RlZCBhY3Rpb24gYXJndW1lbnRzIGJhY2sgdG8gSmF2YVNjcmlwdCB2YWx1ZXNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlY29kZUFjdGlvbkFyZ3MoZW5jb2RlZDogRW5jb2RlZEFjdGlvbkFyZ3MpOiBQcm9taXNlPHVua25vd25bXT4ge1xuICBhd2FpdCBlbnN1cmVJbXBvcnRzKCk7XG5cbiAgbGV0IGJvZHk6IEZvcm1EYXRhIHwgc3RyaW5nO1xuICBpZiAoZW5jb2RlZC50eXBlID09PSBcImZvcm1kYXRhXCIpIHtcbiAgICBib2R5ID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgbmV3IFVSTFNlYXJjaFBhcmFtcyhlbmNvZGVkLmRhdGEpKSB7XG4gICAgICBib2R5LmFwcGVuZChrZXksIHZhbHVlKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgYm9keSA9IGVuY29kZWQuZGF0YTtcbiAgfVxuXG4gIGNvbnN0IGRlY29kZWQgPSBhd2FpdCBfZGVjb2RlUmVwbHkoYm9keSwge30pO1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShkZWNvZGVkKSA/IGRlY29kZWQgOiBbZGVjb2RlZF07XG59XG5cbi8qKlxuICogRXhlY3V0ZSBhIHNlcnZlciBhY3Rpb24gYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGFuIFJTQyBzdHJlYW1cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGNvbnN0IHN0cmVhbSA9IGF3YWl0IGhhbmRsZUFjdGlvbihjdHgsICdpbmNyZW1lbnRDb3VudCcsIGVuY29kZWRBcmdzKTtcbiAqIHJldHVybiBuZXcgUmVzcG9uc2Uoc3RyZWFtLCB7XG4gKiAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3gtY29tcG9uZW50JyB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlQWN0aW9uKFxuICBjdHg6IFJTQ0NvbnRleHQsXG4gIGFjdGlvbklkOiBzdHJpbmcsXG4gIGVuY29kZWRBcmdzOiBFbmNvZGVkQWN0aW9uQXJncyxcbiAgb3B0aW9ucz86IFJTQ1JlbmRlck9wdGlvbnMsXG4pOiBQcm9taXNlPFJlYWRhYmxlU3RyZWFtPFVpbnQ4QXJyYXk+PiB7XG4gIGF3YWl0IGVuc3VyZUltcG9ydHMoKTtcblxuICAvLyBIYW5kbGUgXCJtb2R1bGUjZXhwb3J0XCIgZm9ybWF0XG4gIGNvbnN0IGFjdGlvbk5hbWUgPSBhY3Rpb25JZC5pbmNsdWRlcyhcIiNcIikgPyAoYWN0aW9uSWQuc3BsaXQoXCIjXCIpWzFdID8/IGFjdGlvbklkKSA6IGFjdGlvbklkO1xuXG4gIGNvbnN0IGFjdGlvbiA9IGN0eC5hY3Rpb25zLmdldChhY3Rpb25OYW1lKTtcbiAgaWYgKCFhY3Rpb24pIHtcbiAgICBjb25zdCBhdmFpbGFibGUgPSBBcnJheS5mcm9tKGN0eC5hY3Rpb25zLmtleXMoKSkuam9pbihcIiwgXCIpIHx8IFwiKG5vbmUpXCI7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBY3Rpb24gXCIke2FjdGlvbk5hbWV9XCIgbm90IGZvdW5kLiBBdmFpbGFibGU6ICR7YXZhaWxhYmxlfWApO1xuICB9XG5cbiAgY29uc3QgYXJncyA9IGF3YWl0IGRlY29kZUFjdGlvbkFyZ3MoZW5jb2RlZEFyZ3MpO1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBhY3Rpb24uZm4oLi4uYXJncyk7XG5cbiAgcmV0dXJuIF9yZW5kZXJUb1JlYWRhYmxlU3RyZWFtKHJlc3VsdCBhcyBSZWFjdE5vZGUsIGN0eC5tYW5pZmVzdCwge1xuICAgIG9uRXJyb3I6IG9wdGlvbnM/Lm9uRXJyb3IsXG4gIH0pO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgYWN0aW9uIElEIGZyb20gcmVxdWVzdCBoZWFkZXJzIChSZWFjdCBjb252ZW50aW9uKVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QWN0aW9uSWRGcm9tUmVxdWVzdChyZXF1ZXN0OiBSZXF1ZXN0KTogc3RyaW5nIHwgbnVsbCB7XG4gIC8vIFJlYWN0IHNlbmRzIGFjdGlvbiBJRCBpbiB2YXJpb3VzIGhlYWRlcnNcbiAgcmV0dXJuIHJlcXVlc3QuaGVhZGVycy5nZXQoXCJyc2MtYWN0aW9uXCIpID8/IHJlcXVlc3QuaGVhZGVycy5nZXQoXCJ4LXJzYy1hY3Rpb25cIikgPz8gbnVsbDtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhIHJlcXVlc3QgaXMgYW4gUlNDIGFjdGlvbiByZXF1ZXN0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0FjdGlvblJlcXVlc3QocmVxdWVzdDogUmVxdWVzdCk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0QWN0aW9uSWRGcm9tUmVxdWVzdChyZXF1ZXN0KSAhPT0gbnVsbDtcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIGZvciBjcmVhdGVSU0NcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDcmVhdGVSU0NDb25maWc8VENvbXBvbmVudHMgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4ge1xuICAvKiogTW9kdWxlIElEIGZvciBjbGllbnQgY29tcG9uZW50cyAoZS5nLiwgXCJjbGllbnRcIikgKi9cbiAgbW9kdWxlSWQ6IHN0cmluZztcbiAgLyoqIExpc3Qgb2YgY29tcG9uZW50IG5hbWVzIHRvIGluY2x1ZGUgaW4gbWFuaWZlc3QgKi9cbiAgY29tcG9uZW50czogKGtleW9mIFRDb21wb25lbnRzICYgc3RyaW5nKVtdO1xuICAvKiogU2VydmVyIGFjdGlvbnMgdG8gcmVnaXN0ZXIgKi9cbiAgYWN0aW9ucz86IFJlY29yZDxzdHJpbmcsICguLi5hcmdzOiB1bmtub3duW10pID0+IHVua25vd24+O1xufVxuXG4vKipcbiAqIFJlc3VsdCBmcm9tIGNyZWF0ZVJTQ1xuICovXG5leHBvcnQgaW50ZXJmYWNlIENyZWF0ZVJTQ1Jlc3VsdDxUQ29tcG9uZW50cz4ge1xuICAvKiogUlNDIGNvbnRleHQgZm9yIHJlbmRlcmluZyBhbmQgYWN0aW9ucyAqL1xuICBjdHg6IFJTQ0NvbnRleHQ7XG4gIC8qKiBUeXBlZCBjbGllbnQgY29tcG9uZW50IHByb3h5ICovXG4gIENsaWVudDogVENvbXBvbmVudHM7XG4gIC8qKiBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBzZXR1cCBpcyBjb21wbGV0ZSAqL1xuICByZWFkeTogUHJvbWlzZTx2b2lkPjtcbn1cblxuLy8gU3ltYm9sIGZvciBjbGllbnQgcmVmZXJlbmNlc1xuY29uc3QgUkVBQ1RfQ0xJRU5UX1JFRkVSRU5DRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5jbGllbnQucmVmZXJlbmNlXCIpO1xuXG4vKipcbiAqIENyZWF0ZSBhIGNsaWVudCBtb2R1bGUgcHJveHkgc3luY2hyb25vdXNseSAobm8gYXN5bmMgaW1wb3J0cyBuZWVkZWQpXG4gKlxuICogVGhpcyBjcmVhdGVzIGEgUHJveHkgdGhhdCBnZW5lcmF0ZXMgY2xpZW50IHJlZmVyZW5jZXMgb24tZGVtYW5kIGZvciBhbnkgcHJvcGVydHkgYWNjZXNzLlxuICogV29ya3MgdGhlIHNhbWUgYXMgcmVhY3Qtc2VydmVyLWRvbS13ZWJwYWNrJ3MgY3JlYXRlQ2xpZW50TW9kdWxlUHJveHkgYnV0IHdpdGhvdXQgYXN5bmMuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVN5bmNDbGllbnRQcm94eTxUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4+KG1vZHVsZUlkOiBzdHJpbmcpOiBUIHtcbiAgY29uc3QgY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgdW5rbm93bj4oKTtcblxuICByZXR1cm4gbmV3IFByb3h5KHt9IGFzIFQsIHtcbiAgICBnZXQoX3RhcmdldCwgcHJvcDogc3RyaW5nKSB7XG4gICAgICBpZiAoY2FjaGUuaGFzKHByb3ApKSB7XG4gICAgICAgIHJldHVybiBjYWNoZS5nZXQocHJvcCk7XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBhIGNsaWVudCByZWZlcmVuY2UgZm9yIHRoaXMgcHJvcGVydHlcbiAgICAgIGNvbnN0IHJlZiA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0UsXG4gICAgICAgICQkaWQ6IGAke21vZHVsZUlkfSMke3Byb3B9YCxcbiAgICAgICAgbmFtZTogcHJvcCxcbiAgICAgIH07XG5cbiAgICAgIGNhY2hlLnNldChwcm9wLCByZWYpO1xuICAgICAgcmV0dXJuIHJlZjtcbiAgICB9LFxuICB9KTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgUlNDIGNvbnRleHQsIGNsaWVudCBwcm94eSwgYW5kIHJlZ2lzdGVyIGFjdGlvbnMgaW4gb25lIGNhbGxcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHN4XG4gKiBpbXBvcnQgdHlwZSAqIGFzIENsaWVudENvbXBvbmVudHMgZnJvbSBcIi4vY29tcG9uZW50c1wiO1xuICpcbiAqIGNvbnN0IHsgY3R4LCBDbGllbnQsIHJlYWR5IH0gPSBjcmVhdGVSU0M8dHlwZW9mIENsaWVudENvbXBvbmVudHM+KHtcbiAqICAgbW9kdWxlSWQ6IFwiY2xpZW50XCIsXG4gKiAgIGNvbXBvbmVudHM6IFtcIkNvdW50ZXJcIiwgXCJCdXR0b25cIiwgXCJDYXJkXCJdLFxuICogICBhY3Rpb25zOiB7XG4gKiAgICAgaW5jcmVtZW50OiBhc3luYyAoY291bnQpID0+IChjb3VudCBhcyBudW1iZXIpICsgMSxcbiAqICAgICBkZWNyZW1lbnQ6IGFzeW5jIChjb3VudCkgPT4gKGNvdW50IGFzIG51bWJlcikgLSAxLFxuICogICB9LFxuICogfSk7XG4gKlxuICogLy8gVXNlIGluIHJvdXRlczpcbiAqIC4uLmh0dHAucnNjUm91dGVzKFwiL3JzY1wiLCAoKSA9PiA8Q2xpZW50LkNvdW50ZXIgY291bnQ9ezB9IC8+LCBjdHgsIHsgcmVhZHkgfSlcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUlNDPFRDb21wb25lbnRzIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4+KFxuICBjb25maWc6IENyZWF0ZVJTQ0NvbmZpZzxUQ29tcG9uZW50cz4sXG4pOiBDcmVhdGVSU0NSZXN1bHQ8VENvbXBvbmVudHM+IHtcbiAgLy8gQnVpbGQgbWFuaWZlc3QgZnJvbSBjb21wb25lbnQgbmFtZXNcbiAgY29uc3QgbWFuaWZlc3Q6IENsaWVudE1hbmlmZXN0ID0ge1xuICAgIFtjb25maWcubW9kdWxlSWRdOiB7IGlkOiBjb25maWcubW9kdWxlSWQsIGNodW5rczogW10sIG5hbWU6IFwiKlwiIH0sXG4gIH07XG4gIGZvciAoY29uc3QgbmFtZSBvZiBjb25maWcuY29tcG9uZW50cykge1xuICAgIG1hbmlmZXN0W2Ake2NvbmZpZy5tb2R1bGVJZH0jJHtuYW1lfWBdID0geyBpZDogY29uZmlnLm1vZHVsZUlkLCBjaHVua3M6IFtdLCBuYW1lIH07XG4gIH1cblxuICAvLyBDcmVhdGUgY29udGV4dFxuICBjb25zdCBjdHggPSBjcmVhdGVSU0NDb250ZXh0KG1hbmlmZXN0KTtcblxuICAvLyBDcmVhdGUgY2xpZW50IHByb3h5IHN5bmNocm9ub3VzbHkgLSBubyBhc3luYyBuZWVkZWQhXG4gIC8vIFRoaXMgd29ya3MgYmVjYXVzZSBjbGllbnQgcmVmZXJlbmNlcyBhcmUganVzdCBtYXJrZXIgb2JqZWN0c1xuICBjb25zdCBDbGllbnQgPSBjcmVhdGVTeW5jQ2xpZW50UHJveHk8VENvbXBvbmVudHM+KGNvbmZpZy5tb2R1bGVJZCk7XG5cbiAgLy8gSW5pdGlhbGl6ZSBhc3luYyAob25seSBuZWVkZWQgZm9yIGFjdGlvbnMpXG4gIGNvbnN0IHJlYWR5ID0gKGFzeW5jICgpID0+IHtcbiAgICAvLyBSZWdpc3RlciBhY3Rpb25zIGlmIHByb3ZpZGVkXG4gICAgaWYgKGNvbmZpZy5hY3Rpb25zKSB7XG4gICAgICBhd2FpdCBlbnN1cmVJbXBvcnRzKCk7XG4gICAgICBmb3IgKGNvbnN0IFtpZCwgZm5dIG9mIE9iamVjdC5lbnRyaWVzKGNvbmZpZy5hY3Rpb25zKSkge1xuICAgICAgICBjb25zdCByZWdpc3RlcmVkRm4gPSBfcmVnaXN0ZXJTZXJ2ZXJSZWZlcmVuY2UoZm4sIGlkLCBpZCk7XG4gICAgICAgIGN0eC5hY3Rpb25zLnNldChpZCwgeyBmbjogcmVnaXN0ZXJlZEZuIGFzICguLi5hcmdzOiB1bmtub3duW10pID0+IHVua25vd24sIGlkIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4geyBjdHgsIENsaWVudCwgcmVhZHkgfTtcbn1cblxuLy8gUmUtZXhwb3J0IHR5cGVzIGZvciBjb252ZW5pZW5jZVxuZXhwb3J0IHR5cGUgeyBDbGllbnRNYW5pZmVzdCwgUlNDQ29udGV4dCwgUlNDUmVuZGVyT3B0aW9ucywgRW5jb2RlZEFjdGlvbkFyZ3MgfTtcbiIsImltcG9ydCB0eXBlIHsgUmVhY3ROb2RlIH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgdHlwZSB7IEh0dHBNZXRob2QsIFJlcXVlc3RIYW5kbGVyLCBSb3V0ZURlZmluaXRpb24sIFJvdXRlUGFyYW1zIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgUlNDQ29udGV4dCB9IGZyb20gXCIuL3JzYy90eXBlc1wiO1xuaW1wb3J0IHsganNvbiB9IGZyb20gXCIuL3Jlc3BvbnNlXCI7XG5cbi8qKlxuICogQ3JlYXRlIGEgcm91dGUgZGVmaW5pdGlvbiBmb3IgYSBnaXZlbiBIVFRQIG1ldGhvZFxuICovXG5mdW5jdGlvbiBjcmVhdGVSb3V0ZUZhY3RvcnkobWV0aG9kOiBIdHRwTWV0aG9kKSB7XG4gIHJldHVybiBmdW5jdGlvbiA8VFBhcmFtcyBleHRlbmRzIFJvdXRlUGFyYW1zID0gUm91dGVQYXJhbXM+KFxuICAgIHBhdGg6IHN0cmluZyxcbiAgICBoYW5kbGVyOiBSZXF1ZXN0SGFuZGxlcjxUUGFyYW1zPixcbiAgKTogUm91dGVEZWZpbml0aW9uPFRQYXJhbXM+IHtcbiAgICByZXR1cm4geyBtZXRob2QsIHBhdGgsIGhhbmRsZXIgfTtcbiAgfTtcbn1cblxuLyoqXG4gKiBSU0MgUmVzcG9uc2UgaGVhZGVyc1xuICovXG5jb25zdCBSU0NfSEVBREVSUyA9IHtcbiAgXCJDb250ZW50LVR5cGVcIjogXCJ0ZXh0L3gtY29tcG9uZW50OyBjaGFyc2V0PXV0Zi04XCIsXG4gIFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlLCBuby1zdG9yZSwgbXVzdC1yZXZhbGlkYXRlXCIsXG59IGFzIGNvbnN0O1xuXG4vKipcbiAqIE9wdGlvbnMgZm9yIFJTQyByb3V0ZSBoYW5kbGVyc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFJTQ1JvdXRlT3B0aW9ucyB7XG4gIC8qKiBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBpbml0aWFsaXphdGlvbiBpcyBjb21wbGV0ZSAqL1xuICByZWFkeT86IFByb21pc2U8dm9pZD47XG4gIC8qKiBDdXN0b20gaGVhZGVycyB0byBtZXJnZSB3aXRoIFJTQyBkZWZhdWx0cyAqL1xuICBoZWFkZXJzPzogSGVhZGVyc0luaXQ7XG59XG5cbi8qKlxuICogQ29udGV4dCBwYXNzZWQgdG8gUlNDIHJlbmRlciBmdW5jdGlvblxuICovXG5leHBvcnQgaW50ZXJmYWNlIFJTQ1JlbmRlckNvbnRleHQ8VFBhcmFtcyBleHRlbmRzIFJvdXRlUGFyYW1zID0gUm91dGVQYXJhbXM+IHtcbiAgdXJsOiBVUkw7XG4gIHJlcXVlc3Q6IFJlcXVlc3Q7XG4gIHBhcmFtczogVFBhcmFtcztcbn1cblxuLyoqXG4gKiBSU0MgcmVuZGVyIGZ1bmN0aW9uIHR5cGVcbiAqL1xuZXhwb3J0IHR5cGUgUlNDUmVuZGVyRm48VFBhcmFtcyBleHRlbmRzIFJvdXRlUGFyYW1zID0gUm91dGVQYXJhbXM+ID0gKFxuICBjdHg6IFJTQ1JlbmRlckNvbnRleHQ8VFBhcmFtcz4sXG4pID0+IFJlYWN0Tm9kZSB8IFByb21pc2U8UmVhY3ROb2RlPjtcblxuLyoqXG4gKiBIVFRQIG1ldGhvZCBoZWxwZXJzIGZvciBkZWZpbmluZyByb3V0ZXNcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGh0dHAuZ2V0KCcvYXBpL3VzZXJzJywgKHsgdXJsIH0pID0+IHtcbiAqICAgcmV0dXJuIGpzb24oW3sgaWQ6IDEsIG5hbWU6ICdKb2huJyB9XSlcbiAqIH0pXG4gKlxuICogaHR0cC5wb3N0KCcvYXBpL3VzZXJzJywgYXN5bmMgKHsgcmVxdWVzdCB9KSA9PiB7XG4gKiAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpzb24oKVxuICogICByZXR1cm4ganNvbih7IGlkOiAyLCAuLi5ib2R5IH0sIHsgc3RhdHVzOiAyMDEgfSlcbiAqIH0pXG4gKlxuICogaHR0cC5nZXQoJy9hcGkvdXNlcnMvOmlkJywgKHsgcGFyYW1zIH0pID0+IHtcbiAqICAgcmV0dXJuIGpzb24oeyBpZDogcGFyYW1zLmlkLCBuYW1lOiAnSm9obicgfSlcbiAqIH0pXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IGh0dHAgPSB7XG4gIGdldDogY3JlYXRlUm91dGVGYWN0b3J5KFwiR0VUXCIpLFxuICBwb3N0OiBjcmVhdGVSb3V0ZUZhY3RvcnkoXCJQT1NUXCIpLFxuICBwdXQ6IGNyZWF0ZVJvdXRlRmFjdG9yeShcIlBVVFwiKSxcbiAgcGF0Y2g6IGNyZWF0ZVJvdXRlRmFjdG9yeShcIlBBVENIXCIpLFxuICBkZWxldGU6IGNyZWF0ZVJvdXRlRmFjdG9yeShcIkRFTEVURVwiKSxcbiAgaGVhZDogY3JlYXRlUm91dGVGYWN0b3J5KFwiSEVBRFwiKSxcbiAgb3B0aW9uczogY3JlYXRlUm91dGVGYWN0b3J5KFwiT1BUSU9OU1wiKSxcblxuICAvKipcbiAgICogQ3JlYXRlIGEgcm91dGUgdGhhdCBtYXRjaGVzIGFueSBIVFRQIG1ldGhvZFxuICAgKi9cbiAgYWxsPFRQYXJhbXMgZXh0ZW5kcyBSb3V0ZVBhcmFtcyA9IFJvdXRlUGFyYW1zPihcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgaGFuZGxlcjogUmVxdWVzdEhhbmRsZXI8VFBhcmFtcz4sXG4gICk6IFJvdXRlRGVmaW5pdGlvbjxUUGFyYW1zPltdIHtcbiAgICBjb25zdCBtZXRob2RzOiBIdHRwTWV0aG9kW10gPSBbXCJHRVRcIiwgXCJQT1NUXCIsIFwiUFVUXCIsIFwiUEFUQ0hcIiwgXCJERUxFVEVcIiwgXCJIRUFEXCIsIFwiT1BUSU9OU1wiXTtcbiAgICByZXR1cm4gbWV0aG9kcy5tYXAoKG1ldGhvZCkgPT4gKHsgbWV0aG9kLCBwYXRoLCBoYW5kbGVyIH0pKTtcbiAgfSxcblxuICAvKipcbiAgICogQ3JlYXRlIGFuIFJTQyBHRVQgcm91dGUgdGhhdCByZW5kZXJzIGEgUmVhY3QgY29tcG9uZW50XG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHRzeFxuICAgKiBodHRwLnJzYyhcIi9yc2MvbW92aWVzXCIsICh7IHVybCB9KSA9PiB7XG4gICAqICAgY29uc3QgcSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwicVwiKSA/PyBcIlwiO1xuICAgKiAgIHJldHVybiA8TW92aWVMaXN0IHF1ZXJ5PXtxfSAvPjtcbiAgICogfSwgY3R4LCB7IHJlYWR5OiBpbml0UHJvbWlzZSB9KVxuICAgKiBgYGBcbiAgICovXG4gIHJzYzxUUGFyYW1zIGV4dGVuZHMgUm91dGVQYXJhbXMgPSBSb3V0ZVBhcmFtcz4oXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIHJlbmRlcjogUlNDUmVuZGVyRm48VFBhcmFtcz4sXG4gICAgY3R4OiBSU0NDb250ZXh0LFxuICAgIG9wdGlvbnM/OiBSU0NSb3V0ZU9wdGlvbnMsXG4gICk6IFJvdXRlRGVmaW5pdGlvbjxUUGFyYW1zPiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyOiBhc3luYyAoeyB1cmwsIHJlcXVlc3QsIHBhcmFtcyB9KSA9PiB7XG4gICAgICAgIC8vIExhenkgaW1wb3J0IHRvIGF2b2lkIGNpcmN1bGFyIGRlcHMgYW5kIGVuc3VyZSB3ZWJwYWNrLXNoaW0gbG9hZHMgZmlyc3RcbiAgICAgICAgY29uc3QgeyByZW5kZXJSU0MgfSA9IGF3YWl0IGltcG9ydChcIi4vcnNjL3NlcnZlclwiKTtcblxuICAgICAgICBpZiAob3B0aW9ucz8ucmVhZHkpIHtcbiAgICAgICAgICBhd2FpdCBvcHRpb25zLnJlYWR5O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZWxlbWVudCA9IGF3YWl0IHJlbmRlcih7IHVybCwgcmVxdWVzdCwgcGFyYW1zIH0pO1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCByZW5kZXJSU0MoZWxlbWVudCwgY3R4KTtcblxuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKHN0cmVhbSwge1xuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIC4uLlJTQ19IRUFERVJTLFxuICAgICAgICAgICAgLi4ub3B0aW9ucz8uaGVhZGVycyxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfSxcblxuICAvKipcbiAgICogQ3JlYXRlIGFuIFJTQyBQT1NUIHJvdXRlIHRoYXQgaGFuZGxlcyBzZXJ2ZXIgYWN0aW9uc1xuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c3hcbiAgICogaHR0cC5hY3Rpb24oXCIvcnNjXCIsIGN0eCwgeyByZWFkeTogaW5pdFByb21pc2UgfSlcbiAgICogYGBgXG4gICAqL1xuICBhY3Rpb24ocGF0aDogc3RyaW5nLCBjdHg6IFJTQ0NvbnRleHQsIG9wdGlvbnM/OiBSU0NSb3V0ZU9wdGlvbnMpOiBSb3V0ZURlZmluaXRpb24ge1xuICAgIHJldHVybiB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgcGF0aCxcbiAgICAgIGhhbmRsZXI6IGFzeW5jICh7IHJlcXVlc3QgfSkgPT4ge1xuICAgICAgICAvLyBMYXp5IGltcG9ydCB0byBhdm9pZCBjaXJjdWxhciBkZXBzIGFuZCBlbnN1cmUgd2VicGFjay1zaGltIGxvYWRzIGZpcnN0XG4gICAgICAgIGNvbnN0IHsgaGFuZGxlQWN0aW9uLCBpc0FjdGlvblJlcXVlc3QsIGdldEFjdGlvbklkRnJvbVJlcXVlc3QgfSA9XG4gICAgICAgICAgYXdhaXQgaW1wb3J0KFwiLi9yc2Mvc2VydmVyXCIpO1xuXG4gICAgICAgIGlmIChvcHRpb25zPy5yZWFkeSkge1xuICAgICAgICAgIGF3YWl0IG9wdGlvbnMucmVhZHk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzQWN0aW9uUmVxdWVzdChyZXF1ZXN0KSkge1xuICAgICAgICAgIHJldHVybiBqc29uKHsgZXJyb3I6IFwiTWlzc2luZyBhY3Rpb24gaGVhZGVyICh4LXJzYy1hY3Rpb24pXCIgfSwgeyBzdGF0dXM6IDQwMCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFjdGlvbklkID0gZ2V0QWN0aW9uSWRGcm9tUmVxdWVzdChyZXF1ZXN0KSE7XG5cbiAgICAgICAgLy8gUGFyc2UgYXJncyBmcm9tIHJlcXVlc3QgYm9keVxuICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVxdWVzdC50ZXh0KCk7XG4gICAgICAgIGxldCBhcmdzOiB1bmtub3duW10gPSBbXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhcmdzID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJncykpIGFyZ3MgPSBbYXJnc107XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIGFyZ3MgPSBib2R5ID8gW2JvZHldIDogW107XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDcmVhdGUgZW5jb2RlZCBmb3JtYXQgZm9yIGhhbmRsZUFjdGlvblxuICAgICAgICBjb25zdCBlbmNvZGVkQXJncyA9IHsgdHlwZTogXCJzdHJpbmdcIiBhcyBjb25zdCwgZGF0YTogSlNPTi5zdHJpbmdpZnkoYXJncykgfTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHN0cmVhbSA9IGF3YWl0IGhhbmRsZUFjdGlvbihjdHgsIGFjdGlvbklkLCBlbmNvZGVkQXJncyk7XG4gICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShzdHJlYW0sIHtcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgLi4uUlNDX0hFQURFUlMsXG4gICAgICAgICAgICAgIC4uLm9wdGlvbnM/LmhlYWRlcnMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbcnNjLXN3LWJmZl0gQWN0aW9uIGVycm9yOlwiLCBtZXNzYWdlKTtcbiAgICAgICAgICByZXR1cm4ganNvbih7IGVycm9yOiBtZXNzYWdlIH0sIHsgc3RhdHVzOiA1MDAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcbiAgfSxcblxuICAvKipcbiAgICogQ3JlYXRlIGJvdGggUlNDIEdFVCBhbmQgYWN0aW9uIFBPU1Qgcm91dGVzIGF0IHRoZSBzYW1lIHBhdGhcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHN4XG4gICAqIC8vIENyZWF0ZXMgYm90aCBHRVQgL3JzYyAocmVuZGVyKSBhbmQgUE9TVCAvcnNjIChhY3Rpb25zKVxuICAgKiAuLi5odHRwLnJzY1JvdXRlcyhcIi9yc2MvbW92aWVzXCIsICh7IHVybCB9KSA9PiB7XG4gICAqICAgY29uc3QgcSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwicVwiKSA/PyBcIlwiO1xuICAgKiAgIHJldHVybiA8TW92aWVMaXN0IHF1ZXJ5PXtxfSAvPjtcbiAgICogfSwgY3R4LCB7IHJlYWR5OiBpbml0UHJvbWlzZSB9KVxuICAgKiBgYGBcbiAgICovXG4gIHJzY1JvdXRlczxUUGFyYW1zIGV4dGVuZHMgUm91dGVQYXJhbXMgPSBSb3V0ZVBhcmFtcz4oXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIHJlbmRlcjogUlNDUmVuZGVyRm48VFBhcmFtcz4sXG4gICAgY3R4OiBSU0NDb250ZXh0LFxuICAgIG9wdGlvbnM/OiBSU0NSb3V0ZU9wdGlvbnMsXG4gICk6IFtSb3V0ZURlZmluaXRpb248VFBhcmFtcz4sIFJvdXRlRGVmaW5pdGlvbl0ge1xuICAgIHJldHVybiBbdGhpcy5yc2MocGF0aCwgcmVuZGVyLCBjdHgsIG9wdGlvbnMpLCB0aGlzLmFjdGlvbihwYXRoLCBjdHgsIG9wdGlvbnMpXTtcbiAgfSxcbn0gYXMgY29uc3Q7XG4iLCIvLy8gPHJlZmVyZW5jZSBsaWI9XCJ3ZWJ3b3JrZXJcIiAvPlxuaW1wb3J0IHR5cGUgeyBDb21waWxlZFJvdXRlLCBSb3V0ZURlZmluaXRpb24sIFJvdXRlUGFyYW1zIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gRW5zdXJlIFVSTFBhdHRlcm4gZ2xvYmFsIHR5cGVzIGFyZSBhdmFpbGFibGVcbmltcG9ydCBcIi4vdHlwZXNcIjtcblxuLyoqXG4gKiBDb21waWxlIGEgcm91dGUgZGVmaW5pdGlvbiBpbnRvIGEgbWF0Y2hhYmxlIHJvdXRlIHVzaW5nIFVSTFBhdHRlcm5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVSb3V0ZTxUUGFyYW1zIGV4dGVuZHMgUm91dGVQYXJhbXM+KFxuICByb3V0ZTogUm91dGVEZWZpbml0aW9uPFRQYXJhbXM+LFxuKTogQ29tcGlsZWRSb3V0ZTxUUGFyYW1zPiB7XG4gIC8vIFVSTFBhdHRlcm4gdXNlcyA6cGFyYW0gc3ludGF4IG5hdGl2ZWx5XG4gIGNvbnN0IHBhdHRlcm4gPSBuZXcgVVJMUGF0dGVybih7IHBhdGhuYW1lOiByb3V0ZS5wYXRoIH0pO1xuXG4gIHJldHVybiB7XG4gICAgbWV0aG9kOiByb3V0ZS5tZXRob2QsXG4gICAgcGF0dGVybixcbiAgICBoYW5kbGVyOiByb3V0ZS5oYW5kbGVyLFxuICB9O1xufVxuXG4vKipcbiAqIE1hdGNoIGEgcmVxdWVzdCBhZ2FpbnN0IGNvbXBpbGVkIHJvdXRlc1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hSb3V0ZShcbiAgcGF0aG5hbWU6IHN0cmluZyxcbiAgbWV0aG9kOiBzdHJpbmcsXG4gIHJvdXRlczogQ29tcGlsZWRSb3V0ZVtdLFxuKTogeyByb3V0ZTogQ29tcGlsZWRSb3V0ZTsgcGFyYW1zOiBSb3V0ZVBhcmFtcyB9IHwgbnVsbCB7XG4gIGZvciAoY29uc3Qgcm91dGUgb2Ygcm91dGVzKSB7XG4gICAgaWYgKHJvdXRlLm1ldGhvZCAhPT0gbWV0aG9kKSBjb250aW51ZTtcblxuICAgIGNvbnN0IG1hdGNoID0gcm91dGUucGF0dGVybi5leGVjKHsgcGF0aG5hbWUgfSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICAvLyBFeHRyYWN0IHBhcmFtcyBmcm9tIFVSTFBhdHRlcm4gcmVzdWx0XG4gICAgICBjb25zdCBwYXJhbXM6IFJvdXRlUGFyYW1zID0ge307XG4gICAgICBjb25zdCBncm91cHMgPSBtYXRjaC5wYXRobmFtZS5ncm91cHM7XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhncm91cHMpKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcGFyYW1zW2tleV0gPSBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4geyByb3V0ZSwgcGFyYW1zIH07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG4iLCIvLy8gPHJlZmVyZW5jZSBsaWI9XCJ3ZWJ3b3JrZXJcIiAvPlxuXG5pbXBvcnQgeyBjb21waWxlUm91dGUsIG1hdGNoUm91dGUgfSBmcm9tIFwiLi9yb3V0ZXJcIjtcbmltcG9ydCB7IGVycm9yIH0gZnJvbSBcIi4vcmVzcG9uc2VcIjtcbmltcG9ydCB0eXBlIHsgQ29tcGlsZWRSb3V0ZSwgUm91dGVEZWZpbml0aW9uLCBTZXJ2aWNlV29ya2VyLCBTZXJ2aWNlV29ya2VyT3B0aW9ucyB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmRlY2xhcmUgY29uc3Qgc2VsZjogU2VydmljZVdvcmtlckdsb2JhbFNjb3BlO1xuXG5sZXQgaW5zdGFsbGVkUm91dGVzOiBDb21waWxlZFJvdXRlW10gPSBbXTtcbmxldCBpbnN0YWxsZWRPcHRpb25zOiBTZXJ2aWNlV29ya2VyT3B0aW9ucyA9IHt9O1xuXG4vKipcbiAqIEhhbmRsZSBmZXRjaCBldmVudHMgd2l0aGluIHRoZSBzZXJ2aWNlIHdvcmtlclxuICovXG5mdW5jdGlvbiBoYW5kbGVGZXRjaChldmVudDogRmV0Y2hFdmVudCk6IHZvaWQge1xuICBjb25zdCB1cmwgPSBuZXcgVVJMKGV2ZW50LnJlcXVlc3QudXJsKTtcbiAgY29uc3QgeyBiYXNlUGF0aCA9IFwiXCIgfSA9IGluc3RhbGxlZE9wdGlvbnM7XG5cbiAgLy8gQ2hlY2sgaWYgcGF0aCBtYXRjaGVzIGJhc2UgcGF0aFxuICBpZiAoYmFzZVBhdGggJiYgIXVybC5wYXRobmFtZS5zdGFydHNXaXRoKGJhc2VQYXRoKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHBhdGhuYW1lID0gYmFzZVBhdGggPyB1cmwucGF0aG5hbWUuc2xpY2UoYmFzZVBhdGgubGVuZ3RoKSB8fCBcIi9cIiA6IHVybC5wYXRobmFtZTtcbiAgY29uc3QgbWV0aG9kID0gZXZlbnQucmVxdWVzdC5tZXRob2Q7XG5cbiAgY29uc3QgbWF0Y2ggPSBtYXRjaFJvdXRlKHBhdGhuYW1lLCBtZXRob2QsIGluc3RhbGxlZFJvdXRlcyk7XG5cbiAgaWYgKCFtYXRjaCkge1xuICAgIC8vIE5vIHJvdXRlIG1hdGNoZWQgLSB1c2UgZmFsbGJhY2sgb3IgcGFzc3Rocm91Z2hcbiAgICBpZiAoaW5zdGFsbGVkT3B0aW9ucy5mYWxsYmFjaykge1xuICAgICAgZXZlbnQucmVzcG9uZFdpdGgoUHJvbWlzZS5yZXNvbHZlKGluc3RhbGxlZE9wdGlvbnMuZmFsbGJhY2soZXZlbnQucmVxdWVzdCkpKTtcbiAgICB9XG4gICAgLy8gSWYgbm8gZmFsbGJhY2ssIGxldCB0aGUgcmVxdWVzdCBwYXNzIHRocm91Z2ggdG8gbmV0d29ya1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGV2ZW50LnJlc3BvbmRXaXRoKFxuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gYXdhaXQgbWF0Y2gucm91dGUuaGFuZGxlcih7XG4gICAgICAgICAgcmVxdWVzdDogZXZlbnQucmVxdWVzdCxcbiAgICAgICAgICB1cmwsXG4gICAgICAgICAgcGFyYW1zOiBtYXRjaC5wYXJhbXMsXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbc3ctYmZmXSBIYW5kbGVyIGVycm9yOlwiLCBlcnIpO1xuICAgICAgICByZXR1cm4gZXJyb3IoZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpLCA1MDApO1xuICAgICAgfVxuICAgIH0pKCksXG4gICk7XG59XG5cbi8qKlxuICogSW5zdGFsbCBzZXJ2aWNlIHdvcmtlciBldmVudCBsaXN0ZW5lcnNcbiAqL1xuZnVuY3Rpb24gaW5zdGFsbExpc3RlbmVycygpOiB2b2lkIHtcbiAgc2VsZi5hZGRFdmVudExpc3RlbmVyKFwiaW5zdGFsbFwiLCAoZXZlbnQ6IEV4dGVuZGFibGVFdmVudCkgPT4ge1xuICAgIGV2ZW50LndhaXRVbnRpbChzZWxmLnNraXBXYWl0aW5nKCkpO1xuICB9KTtcblxuICBzZWxmLmFkZEV2ZW50TGlzdGVuZXIoXCJhY3RpdmF0ZVwiLCAoZXZlbnQ6IEV4dGVuZGFibGVFdmVudCkgPT4ge1xuICAgIGV2ZW50LndhaXRVbnRpbChzZWxmLmNsaWVudHMuY2xhaW0oKSk7XG4gIH0pO1xuXG4gIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcihcImZldGNoXCIsIGhhbmRsZUZldGNoKTtcbn1cblxuLyoqXG4gKiBTZXR1cCB0aGUgc2VydmljZSB3b3JrZXIgd2l0aCByb3V0ZXMgKGNhbGwgdGhpcyBmcm9tIHlvdXIgU1cgZmlsZSlcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIC8vIG15LXdvcmtlci50c1xuICogaW1wb3J0IHsgc2V0dXBXb3JrZXIsIGh0dHAsIGpzb24gfSBmcm9tICdyc2Mtc2VydmljZS13b3JrZXItYmZmJ1xuICpcbiAqIHNldHVwV29ya2VyKFtcbiAqICAgaHR0cC5nZXQoJy9hcGkvdXNlcnMnLCAoKSA9PiBqc29uKFt7IGlkOiAxIH1dKSksXG4gKiAgIGh0dHAuZ2V0KCcvYXBpL3VzZXJzLzppZCcsICh7IHBhcmFtcyB9KSA9PiBqc29uKHsgaWQ6IHBhcmFtcy5pZCB9KSksXG4gKiBdKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cFdvcmtlcihyb3V0ZXM6IFJvdXRlRGVmaW5pdGlvbltdLCBvcHRpb25zOiBTZXJ2aWNlV29ya2VyT3B0aW9ucyA9IHt9KTogdm9pZCB7XG4gIGluc3RhbGxlZFJvdXRlcyA9IHJvdXRlcy5tYXAoY29tcGlsZVJvdXRlKTtcbiAgaW5zdGFsbGVkT3B0aW9ucyA9IG9wdGlvbnM7XG4gIGluc3RhbGxMaXN0ZW5lcnMoKTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBzZXJ2aWNlIHdvcmtlciBpbnN0YW5jZSBmb3IgcmVnaXN0cmF0aW9uIGZyb20gbWFpbiB0aHJlYWRcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIC8vIG1haW4udHNcbiAqIGltcG9ydCB7IGNyZWF0ZVdvcmtlciB9IGZyb20gJ3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYnXG4gKlxuICogY29uc3Qgd29ya2VyID0gY3JlYXRlV29ya2VyKCcvbXktd29ya2VyLmpzJylcbiAqIGF3YWl0IHdvcmtlci5zdGFydCgpXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVdvcmtlcihzY3JpcHRVcmw6IHN0cmluZywgb3B0aW9ucz86IFJlZ2lzdHJhdGlvbk9wdGlvbnMpOiBTZXJ2aWNlV29ya2VyIHtcbiAgbGV0IHJlZ2lzdHJhdGlvbjogU2VydmljZVdvcmtlclJlZ2lzdHJhdGlvbiB8IG51bGwgPSBudWxsO1xuXG4gIHJldHVybiB7XG4gICAgYXN5bmMgc3RhcnQoKSB7XG4gICAgICBpZiAoIShcInNlcnZpY2VXb3JrZXJcIiBpbiBuYXZpZ2F0b3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNlcnZpY2UgV29ya2VycyBhcmUgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXJcIik7XG4gICAgICB9XG5cbiAgICAgIHJlZ2lzdHJhdGlvbiA9IGF3YWl0IG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKHNjcmlwdFVybCwgb3B0aW9ucyk7XG5cbiAgICAgIC8vIFdhaXQgZm9yIHRoZSBzZXJ2aWNlIHdvcmtlciB0byBiZSBhY3RpdmVcbiAgICAgIGNvbnN0IHN3ID0gcmVnaXN0cmF0aW9uLmluc3RhbGxpbmcgfHwgcmVnaXN0cmF0aW9uLndhaXRpbmcgfHwgcmVnaXN0cmF0aW9uLmFjdGl2ZTtcblxuICAgICAgaWYgKHN3ICYmIHN3LnN0YXRlICE9PSBcImFjdGl2YXRlZFwiKSB7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgc3cuYWRkRXZlbnRMaXN0ZW5lcihcInN0YXRlY2hhbmdlXCIsIGZ1bmN0aW9uIG9uQ2hhbmdlKCkge1xuICAgICAgICAgICAgaWYgKHN3LnN0YXRlID09PSBcImFjdGl2YXRlZFwiKSB7XG4gICAgICAgICAgICAgIHN3LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzdGF0ZWNoYW5nZVwiLCBvbkNoYW5nZSk7XG4gICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWdpc3RyYXRpb247XG4gICAgfSxcblxuICAgIGFzeW5jIHN0b3AoKSB7XG4gICAgICBpZiAocmVnaXN0cmF0aW9uKSB7XG4gICAgICAgIGF3YWl0IHJlZ2lzdHJhdGlvbi51bnJlZ2lzdGVyKCk7XG4gICAgICAgIHJlZ2lzdHJhdGlvbiA9IG51bGw7XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn1cbiIsIi8qKlxuICogQGxpY2Vuc2VcbiAqIHdlYi1zdHJlYW1zLXBvbHlmaWxsIHY0LjIuMFxuICogQ29weXJpZ2h0IDIwMjUgTWF0dGlhcyBCdWVsZW5zLCBEaXdhbmsgU2luZ2ggVG9tZXIgYW5kIG90aGVyIGNvbnRyaWJ1dG9ycy5cbiAqIFRoaXMgY29kZSBpcyByZWxlYXNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKiBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogTUlUXG4gKi9cbmZ1bmN0aW9uIGUoKXt9ZnVuY3Rpb24gdChlKXtyZXR1cm5cIm9iamVjdFwiPT10eXBlb2YgZSYmbnVsbCE9PWV8fFwiZnVuY3Rpb25cIj09dHlwZW9mIGV9Y29uc3Qgcj1lO2Z1bmN0aW9uIG8oZSx0KXt0cnl7T2JqZWN0LmRlZmluZVByb3BlcnR5KGUsXCJuYW1lXCIse3ZhbHVlOnQsY29uZmlndXJhYmxlOiEwfSl9Y2F0Y2goZSl7fX1jb25zdCBuPVByb21pc2UsYT1Qcm9taXNlLnJlc29sdmUuYmluZChuKSxpPVByb21pc2UucHJvdG90eXBlLnRoZW4sbD1Qcm9taXNlLnJlamVjdC5iaW5kKG4pLHM9YTtmdW5jdGlvbiB1KGUpe3JldHVybiBuZXcgbihlKX1mdW5jdGlvbiBjKGUpe3JldHVybiB1KHQ9PnQoZSkpfWZ1bmN0aW9uIGQoZSl7cmV0dXJuIGwoZSl9ZnVuY3Rpb24gZihlLHQscil7cmV0dXJuIGkuY2FsbChlLHQscil9ZnVuY3Rpb24gYihlLHQsbyl7ZihmKGUsdCxvKSx2b2lkIDAscil9ZnVuY3Rpb24gaChlLHQpe2IoZSx0KX1mdW5jdGlvbiBtKGUsdCl7YihlLHZvaWQgMCx0KX1mdW5jdGlvbiBfKGUsdCxyKXtyZXR1cm4gZihlLHQscil9ZnVuY3Rpb24gcChlKXtmKGUsdm9pZCAwLHIpfWxldCB5PWU9PntpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBxdWV1ZU1pY3JvdGFzayl5PXF1ZXVlTWljcm90YXNrO2Vsc2V7Y29uc3QgZT1jKHZvaWQgMCk7eT10PT5mKGUsdCl9cmV0dXJuIHkoZSl9O2Z1bmN0aW9uIFMoZSx0LHIpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGUpdGhyb3cgbmV3IFR5cGVFcnJvcihcIkFyZ3VtZW50IGlzIG5vdCBhIGZ1bmN0aW9uXCIpO3JldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChlLHQscil9ZnVuY3Rpb24gZyhlLHQscil7dHJ5e3JldHVybiBjKFMoZSx0LHIpKX1jYXRjaChlKXtyZXR1cm4gZChlKX19Y2xhc3Mgdntjb25zdHJ1Y3Rvcigpe3RoaXMuX2N1cnNvcj0wLHRoaXMuX3NpemU9MCx0aGlzLl9mcm9udD17X2VsZW1lbnRzOltdLF9uZXh0OnZvaWQgMH0sdGhpcy5fYmFjaz10aGlzLl9mcm9udCx0aGlzLl9jdXJzb3I9MCx0aGlzLl9zaXplPTB9Z2V0IGxlbmd0aCgpe3JldHVybiB0aGlzLl9zaXplfXB1c2goZSl7Y29uc3QgdD10aGlzLl9iYWNrO2xldCByPXQ7MTYzODM9PT10Ll9lbGVtZW50cy5sZW5ndGgmJihyPXtfZWxlbWVudHM6W10sX25leHQ6dm9pZCAwfSksdC5fZWxlbWVudHMucHVzaChlKSxyIT09dCYmKHRoaXMuX2JhY2s9cix0Ll9uZXh0PXIpLCsrdGhpcy5fc2l6ZX1zaGlmdCgpe2NvbnN0IGU9dGhpcy5fZnJvbnQ7bGV0IHQ9ZTtjb25zdCByPXRoaXMuX2N1cnNvcjtsZXQgbz1yKzE7Y29uc3Qgbj1lLl9lbGVtZW50cyxhPW5bcl07cmV0dXJuIDE2Mzg0PT09byYmKHQ9ZS5fbmV4dCxvPTApLC0tdGhpcy5fc2l6ZSx0aGlzLl9jdXJzb3I9byxlIT09dCYmKHRoaXMuX2Zyb250PXQpLG5bcl09dm9pZCAwLGF9Zm9yRWFjaChlKXtsZXQgdD10aGlzLl9jdXJzb3Iscj10aGlzLl9mcm9udCxvPXIuX2VsZW1lbnRzO2Zvcig7ISh0PT09by5sZW5ndGgmJnZvaWQgMD09PXIuX25leHR8fHQ9PT1vLmxlbmd0aCYmKHI9ci5fbmV4dCxvPXIuX2VsZW1lbnRzLHQ9MCwwPT09by5sZW5ndGgpKTspZShvW3RdKSwrK3R9cGVlaygpe2NvbnN0IGU9dGhpcy5fZnJvbnQsdD10aGlzLl9jdXJzb3I7cmV0dXJuIGUuX2VsZW1lbnRzW3RdfX1jb25zdCB3PVN5bWJvbChcIltbQWJvcnRTdGVwc11dXCIpLFI9U3ltYm9sKFwiW1tFcnJvclN0ZXBzXV1cIiksVD1TeW1ib2woXCJbW0NhbmNlbFN0ZXBzXV1cIiksQz1TeW1ib2woXCJbW1B1bGxTdGVwc11dXCIpLFA9U3ltYm9sKFwiW1tSZWxlYXNlU3RlcHNdXVwiKTtmdW5jdGlvbiBxKGUsdCl7ZS5fb3duZXJSZWFkYWJsZVN0cmVhbT10LHQuX3JlYWRlcj1lLFwicmVhZGFibGVcIj09PXQuX3N0YXRlP0IoZSk6XCJjbG9zZWRcIj09PXQuX3N0YXRlP2Z1bmN0aW9uKGUpe0IoZSksQShlKX0oZSk6ayhlLHQuX3N0b3JlZEVycm9yKX1mdW5jdGlvbiBFKGUsdCl7cmV0dXJuIE9yKGUuX293bmVyUmVhZGFibGVTdHJlYW0sdCl9ZnVuY3Rpb24gVyhlKXtjb25zdCB0PWUuX293bmVyUmVhZGFibGVTdHJlYW07XCJyZWFkYWJsZVwiPT09dC5fc3RhdGU/aihlLG5ldyBUeXBlRXJyb3IoXCJSZWFkZXIgd2FzIHJlbGVhc2VkIGFuZCBjYW4gbm8gbG9uZ2VyIGJlIHVzZWQgdG8gbW9uaXRvciB0aGUgc3RyZWFtJ3MgY2xvc2VkbmVzc1wiKSk6ZnVuY3Rpb24oZSx0KXtrKGUsdCl9KGUsbmV3IFR5cGVFcnJvcihcIlJlYWRlciB3YXMgcmVsZWFzZWQgYW5kIGNhbiBubyBsb25nZXIgYmUgdXNlZCB0byBtb25pdG9yIHRoZSBzdHJlYW0ncyBjbG9zZWRuZXNzXCIpKSx0Ll9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXJbUF0oKSx0Ll9yZWFkZXI9dm9pZCAwLGUuX293bmVyUmVhZGFibGVTdHJlYW09dm9pZCAwfWZ1bmN0aW9uIE8oZSl7cmV0dXJuIG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgXCIrZStcIiBhIHN0cmVhbSB1c2luZyBhIHJlbGVhc2VkIHJlYWRlclwiKX1mdW5jdGlvbiBCKGUpe2UuX2Nsb3NlZFByb21pc2U9dSgodCxyKT0+e2UuX2Nsb3NlZFByb21pc2VfcmVzb2x2ZT10LGUuX2Nsb3NlZFByb21pc2VfcmVqZWN0PXJ9KX1mdW5jdGlvbiBrKGUsdCl7QihlKSxqKGUsdCl9ZnVuY3Rpb24gaihlLHQpe3ZvaWQgMCE9PWUuX2Nsb3NlZFByb21pc2VfcmVqZWN0JiYocChlLl9jbG9zZWRQcm9taXNlKSxlLl9jbG9zZWRQcm9taXNlX3JlamVjdCh0KSxlLl9jbG9zZWRQcm9taXNlX3Jlc29sdmU9dm9pZCAwLGUuX2Nsb3NlZFByb21pc2VfcmVqZWN0PXZvaWQgMCl9ZnVuY3Rpb24gQShlKXt2b2lkIDAhPT1lLl9jbG9zZWRQcm9taXNlX3Jlc29sdmUmJihlLl9jbG9zZWRQcm9taXNlX3Jlc29sdmUodm9pZCAwKSxlLl9jbG9zZWRQcm9taXNlX3Jlc29sdmU9dm9pZCAwLGUuX2Nsb3NlZFByb21pc2VfcmVqZWN0PXZvaWQgMCl9Y29uc3Qgej1OdW1iZXIuaXNGaW5pdGV8fGZ1bmN0aW9uKGUpe3JldHVyblwibnVtYmVyXCI9PXR5cGVvZiBlJiZpc0Zpbml0ZShlKX0sRD1NYXRoLnRydW5jfHxmdW5jdGlvbihlKXtyZXR1cm4gZTwwP01hdGguY2VpbChlKTpNYXRoLmZsb29yKGUpfTtmdW5jdGlvbiBMKGUsdCl7aWYodm9pZCAwIT09ZSYmKFwib2JqZWN0XCIhPXR5cGVvZihyPWUpJiZcImZ1bmN0aW9uXCIhPXR5cGVvZiByKSl0aHJvdyBuZXcgVHlwZUVycm9yKGAke3R9IGlzIG5vdCBhbiBvYmplY3QuYCk7dmFyIHJ9ZnVuY3Rpb24gRihlLHQpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGUpdGhyb3cgbmV3IFR5cGVFcnJvcihgJHt0fSBpcyBub3QgYSBmdW5jdGlvbi5gKX1mdW5jdGlvbiBJKGUsdCl7aWYoIWZ1bmN0aW9uKGUpe3JldHVyblwib2JqZWN0XCI9PXR5cGVvZiBlJiZudWxsIT09ZXx8XCJmdW5jdGlvblwiPT10eXBlb2YgZX0oZSkpdGhyb3cgbmV3IFR5cGVFcnJvcihgJHt0fSBpcyBub3QgYW4gb2JqZWN0LmApfWZ1bmN0aW9uICQoZSx0LHIpe2lmKHZvaWQgMD09PWUpdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyYW1ldGVyICR7dH0gaXMgcmVxdWlyZWQgaW4gJyR7cn0nLmApfWZ1bmN0aW9uIE0oZSx0LHIpe2lmKHZvaWQgMD09PWUpdGhyb3cgbmV3IFR5cGVFcnJvcihgJHt0fSBpcyByZXF1aXJlZCBpbiAnJHtyfScuYCl9ZnVuY3Rpb24gWShlKXtyZXR1cm4gTnVtYmVyKGUpfWZ1bmN0aW9uIHgoZSl7cmV0dXJuIDA9PT1lPzA6ZX1mdW5jdGlvbiBRKGUsdCl7Y29uc3Qgcj1OdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtsZXQgbz1OdW1iZXIoZSk7aWYobz14KG8pLCF6KG8pKXRocm93IG5ldyBUeXBlRXJyb3IoYCR7dH0gaXMgbm90IGEgZmluaXRlIG51bWJlcmApO2lmKG89ZnVuY3Rpb24oZSl7cmV0dXJuIHgoRChlKSl9KG8pLG88MHx8bz5yKXRocm93IG5ldyBUeXBlRXJyb3IoYCR7dH0gaXMgb3V0c2lkZSB0aGUgYWNjZXB0ZWQgcmFuZ2Ugb2YgMCB0byAke3J9LCBpbmNsdXNpdmVgKTtyZXR1cm4geihvKSYmMCE9PW8/bzowfWZ1bmN0aW9uIE4oZSx0KXtpZighRXIoZSkpdGhyb3cgbmV3IFR5cGVFcnJvcihgJHt0fSBpcyBub3QgYSBSZWFkYWJsZVN0cmVhbS5gKX1mdW5jdGlvbiBIKGUpe3JldHVybiBuZXcgUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyKGUpfWZ1bmN0aW9uIFYoZSx0KXtlLl9yZWFkZXIuX3JlYWRSZXF1ZXN0cy5wdXNoKHQpfWZ1bmN0aW9uIFUoZSx0LHIpe2NvbnN0IG89ZS5fcmVhZGVyLl9yZWFkUmVxdWVzdHMuc2hpZnQoKTtyP28uX2Nsb3NlU3RlcHMoKTpvLl9jaHVua1N0ZXBzKHQpfWZ1bmN0aW9uIEcoZSl7cmV0dXJuIGUuX3JlYWRlci5fcmVhZFJlcXVlc3RzLmxlbmd0aH1mdW5jdGlvbiBYKGUpe2NvbnN0IHQ9ZS5fcmVhZGVyO3JldHVybiB2b2lkIDAhPT10JiYhIUoodCl9Y2xhc3MgUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVye2NvbnN0cnVjdG9yKGUpe2lmKCQoZSwxLFwiUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyXCIpLE4oZSxcIkZpcnN0IHBhcmFtZXRlclwiKSxXcihlKSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhpcyBzdHJlYW0gaGFzIGFscmVhZHkgYmVlbiBsb2NrZWQgZm9yIGV4Y2x1c2l2ZSByZWFkaW5nIGJ5IGFub3RoZXIgcmVhZGVyXCIpO3EodGhpcyxlKSx0aGlzLl9yZWFkUmVxdWVzdHM9bmV3IHZ9Z2V0IGNsb3NlZCgpe3JldHVybiBKKHRoaXMpP3RoaXMuX2Nsb3NlZFByb21pc2U6ZChlZShcImNsb3NlZFwiKSl9Y2FuY2VsKGU9dm9pZCAwKXtyZXR1cm4gSih0aGlzKT92b2lkIDA9PT10aGlzLl9vd25lclJlYWRhYmxlU3RyZWFtP2QoTyhcImNhbmNlbFwiKSk6RSh0aGlzLGUpOmQoZWUoXCJjYW5jZWxcIikpfXJlYWQoKXtpZighSih0aGlzKSlyZXR1cm4gZChlZShcInJlYWRcIikpO2lmKHZvaWQgMD09PXRoaXMuX293bmVyUmVhZGFibGVTdHJlYW0pcmV0dXJuIGQoTyhcInJlYWQgZnJvbVwiKSk7bGV0IGUsdDtjb25zdCByPXUoKHIsbyk9PntlPXIsdD1vfSk7cmV0dXJuIEsodGhpcyx7X2NodW5rU3RlcHM6dD0+ZSh7dmFsdWU6dCxkb25lOiExfSksX2Nsb3NlU3RlcHM6KCk9PmUoe3ZhbHVlOnZvaWQgMCxkb25lOiEwfSksX2Vycm9yU3RlcHM6ZT0+dChlKX0pLHJ9cmVsZWFzZUxvY2soKXtpZighSih0aGlzKSl0aHJvdyBlZShcInJlbGVhc2VMb2NrXCIpO3ZvaWQgMCE9PXRoaXMuX293bmVyUmVhZGFibGVTdHJlYW0mJmZ1bmN0aW9uKGUpe1coZSk7Y29uc3QgdD1uZXcgVHlwZUVycm9yKFwiUmVhZGVyIHdhcyByZWxlYXNlZFwiKTtaKGUsdCl9KHRoaXMpfX1mdW5jdGlvbiBKKGUpe3JldHVybiEhdChlKSYmKCEhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGUsXCJfcmVhZFJlcXVlc3RzXCIpJiZlIGluc3RhbmNlb2YgUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyKX1mdW5jdGlvbiBLKGUsdCl7Y29uc3Qgcj1lLl9vd25lclJlYWRhYmxlU3RyZWFtO3IuX2Rpc3R1cmJlZD0hMCxcImNsb3NlZFwiPT09ci5fc3RhdGU/dC5fY2xvc2VTdGVwcygpOlwiZXJyb3JlZFwiPT09ci5fc3RhdGU/dC5fZXJyb3JTdGVwcyhyLl9zdG9yZWRFcnJvcik6ci5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyW0NdKHQpfWZ1bmN0aW9uIFooZSx0KXtjb25zdCByPWUuX3JlYWRSZXF1ZXN0cztlLl9yZWFkUmVxdWVzdHM9bmV3IHYsci5mb3JFYWNoKGU9PntlLl9lcnJvclN0ZXBzKHQpfSl9ZnVuY3Rpb24gZWUoZSl7cmV0dXJuIG5ldyBUeXBlRXJyb3IoYFJlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlci5wcm90b3R5cGUuJHtlfSBjYW4gb25seSBiZSB1c2VkIG9uIGEgUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyYCl9dmFyIHRlLHJlLG9lO2Z1bmN0aW9uIG5lKGUpe3JldHVybiBlLnNsaWNlKCl9ZnVuY3Rpb24gYWUoZSx0LHIsbyxuKXtuZXcgVWludDhBcnJheShlKS5zZXQobmV3IFVpbnQ4QXJyYXkocixvLG4pLHQpfU9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFJlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlci5wcm90b3R5cGUse2NhbmNlbDp7ZW51bWVyYWJsZTohMH0scmVhZDp7ZW51bWVyYWJsZTohMH0scmVsZWFzZUxvY2s6e2VudW1lcmFibGU6ITB9LGNsb3NlZDp7ZW51bWVyYWJsZTohMH19KSxvKFJlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlci5wcm90b3R5cGUuY2FuY2VsLFwiY2FuY2VsXCIpLG8oUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyLnByb3RvdHlwZS5yZWFkLFwicmVhZFwiKSxvKFJlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlci5wcm90b3R5cGUucmVsZWFzZUxvY2ssXCJyZWxlYXNlTG9ja1wiKSxcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLnRvU3RyaW5nVGFnJiZPYmplY3QuZGVmaW5lUHJvcGVydHkoUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyLnByb3RvdHlwZSxTeW1ib2wudG9TdHJpbmdUYWcse3ZhbHVlOlwiUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyXCIsY29uZmlndXJhYmxlOiEwfSk7bGV0IGllPWU9PihpZT1cImZ1bmN0aW9uXCI9PXR5cGVvZiBlLnRyYW5zZmVyP2U9PmUudHJhbnNmZXIoKTpcImZ1bmN0aW9uXCI9PXR5cGVvZiBzdHJ1Y3R1cmVkQ2xvbmU/ZT0+c3RydWN0dXJlZENsb25lKGUse3RyYW5zZmVyOltlXX0pOmU9PmUsaWUoZSkpLGxlPWU9PihsZT1cImJvb2xlYW5cIj09dHlwZW9mIGUuZGV0YWNoZWQ/ZT0+ZS5kZXRhY2hlZDplPT4wPT09ZS5ieXRlTGVuZ3RoLGxlKGUpKTtmdW5jdGlvbiBzZShlLHQscil7aWYoZS5zbGljZSlyZXR1cm4gZS5zbGljZSh0LHIpO2NvbnN0IG89ci10LG49bmV3IEFycmF5QnVmZmVyKG8pO3JldHVybiBhZShuLDAsZSx0LG8pLG59ZnVuY3Rpb24gdWUoZSx0KXtjb25zdCByPWVbdF07aWYobnVsbCE9cil7aWYoXCJmdW5jdGlvblwiIT10eXBlb2Ygcil0aHJvdyBuZXcgVHlwZUVycm9yKGAke1N0cmluZyh0KX0gaXMgbm90IGEgZnVuY3Rpb25gKTtyZXR1cm4gcn19ZnVuY3Rpb24gY2UoZSl7dHJ5e2NvbnN0IHQ9ZS5kb25lLHI9ZS52YWx1ZTtyZXR1cm4gZihzKHIpLGU9Pih7ZG9uZTp0LHZhbHVlOmV9KSl9Y2F0Y2goZSl7cmV0dXJuIGQoZSl9fWNvbnN0IGRlPW51bGwhPT0ob2U9bnVsbCE9PSh0ZT1TeW1ib2wuYXN5bmNJdGVyYXRvcikmJnZvaWQgMCE9PXRlP3RlOm51bGw9PT0ocmU9U3ltYm9sLmZvcil8fHZvaWQgMD09PXJlP3ZvaWQgMDpyZS5jYWxsKFN5bWJvbCxcIlN5bWJvbC5hc3luY0l0ZXJhdG9yXCIpKSYmdm9pZCAwIT09b2U/b2U6XCJAQGFzeW5jSXRlcmF0b3JcIjtmdW5jdGlvbiBmZShlLHI9XCJzeW5jXCIsbyl7aWYodm9pZCAwPT09bylpZihcImFzeW5jXCI9PT1yKXtpZih2b2lkIDA9PT0obz11ZShlLGRlKSkpe3JldHVybiBmdW5jdGlvbihlKXtjb25zdCByPXtuZXh0KCl7bGV0IHQ7dHJ5e3Q9YmUoZSl9Y2F0Y2goZSl7cmV0dXJuIGQoZSl9cmV0dXJuIGNlKHQpfSxyZXR1cm4ocil7bGV0IG87dHJ5e2NvbnN0IHQ9dWUoZS5pdGVyYXRvcixcInJldHVyblwiKTtpZih2b2lkIDA9PT10KXJldHVybiBjKHtkb25lOiEwLHZhbHVlOnJ9KTtvPVModCxlLml0ZXJhdG9yLFtyXSl9Y2F0Y2goZSl7cmV0dXJuIGQoZSl9cmV0dXJuIHQobyk/Y2Uobyk6ZChuZXcgVHlwZUVycm9yKFwiVGhlIGl0ZXJhdG9yLnJldHVybigpIG1ldGhvZCBtdXN0IHJldHVybiBhbiBvYmplY3RcIikpfX07cmV0dXJue2l0ZXJhdG9yOnIsbmV4dE1ldGhvZDpyLm5leHQsZG9uZTohMX19KGZlKGUsXCJzeW5jXCIsdWUoZSxTeW1ib2wuaXRlcmF0b3IpKSl9fWVsc2Ugbz11ZShlLFN5bWJvbC5pdGVyYXRvcik7aWYodm9pZCAwPT09byl0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhlIG9iamVjdCBpcyBub3QgaXRlcmFibGVcIik7Y29uc3Qgbj1TKG8sZSxbXSk7aWYoIXQobikpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBpdGVyYXRvciBtZXRob2QgbXVzdCByZXR1cm4gYW4gb2JqZWN0XCIpO3JldHVybntpdGVyYXRvcjpuLG5leHRNZXRob2Q6bi5uZXh0LGRvbmU6ITF9fWZ1bmN0aW9uIGJlKGUpe2NvbnN0IHI9UyhlLm5leHRNZXRob2QsZS5pdGVyYXRvcixbXSk7aWYoIXQocikpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBpdGVyYXRvci5uZXh0KCkgbWV0aG9kIG11c3QgcmV0dXJuIGFuIG9iamVjdFwiKTtyZXR1cm4gcn1jbGFzcyBoZXtjb25zdHJ1Y3RvcihlLHQpe3RoaXMuX29uZ29pbmdQcm9taXNlPXZvaWQgMCx0aGlzLl9pc0ZpbmlzaGVkPSExLHRoaXMuX3JlYWRlcj1lLHRoaXMuX3ByZXZlbnRDYW5jZWw9dH1uZXh0KCl7Y29uc3QgZT0oKT0+dGhpcy5fbmV4dFN0ZXBzKCk7cmV0dXJuIHRoaXMuX29uZ29pbmdQcm9taXNlPXRoaXMuX29uZ29pbmdQcm9taXNlP18odGhpcy5fb25nb2luZ1Byb21pc2UsZSxlKTplKCksdGhpcy5fb25nb2luZ1Byb21pc2V9cmV0dXJuKGUpe2NvbnN0IHQ9KCk9PnRoaXMuX3JldHVyblN0ZXBzKGUpO3JldHVybiB0aGlzLl9vbmdvaW5nUHJvbWlzZT10aGlzLl9vbmdvaW5nUHJvbWlzZT9fKHRoaXMuX29uZ29pbmdQcm9taXNlLHQsdCk6dCgpLHRoaXMuX29uZ29pbmdQcm9taXNlfV9uZXh0U3RlcHMoKXtpZih0aGlzLl9pc0ZpbmlzaGVkKXJldHVybiBQcm9taXNlLnJlc29sdmUoe3ZhbHVlOnZvaWQgMCxkb25lOiEwfSk7Y29uc3QgZT10aGlzLl9yZWFkZXI7bGV0IHQscjtjb25zdCBvPXUoKGUsbyk9Pnt0PWUscj1vfSk7cmV0dXJuIEsoZSx7X2NodW5rU3RlcHM6ZT0+e3RoaXMuX29uZ29pbmdQcm9taXNlPXZvaWQgMCx5KCgpPT50KHt2YWx1ZTplLGRvbmU6ITF9KSl9LF9jbG9zZVN0ZXBzOigpPT57dGhpcy5fb25nb2luZ1Byb21pc2U9dm9pZCAwLHRoaXMuX2lzRmluaXNoZWQ9ITAsVyhlKSx0KHt2YWx1ZTp2b2lkIDAsZG9uZTohMH0pfSxfZXJyb3JTdGVwczp0PT57dGhpcy5fb25nb2luZ1Byb21pc2U9dm9pZCAwLHRoaXMuX2lzRmluaXNoZWQ9ITAsVyhlKSxyKHQpfX0pLG99X3JldHVyblN0ZXBzKGUpe2lmKHRoaXMuX2lzRmluaXNoZWQpcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7dmFsdWU6ZSxkb25lOiEwfSk7dGhpcy5faXNGaW5pc2hlZD0hMDtjb25zdCB0PXRoaXMuX3JlYWRlcjtpZighdGhpcy5fcHJldmVudENhbmNlbCl7Y29uc3Qgcj1FKHQsZSk7cmV0dXJuIFcodCksXyhyLCgpPT4oe3ZhbHVlOmUsZG9uZTohMH0pKX1yZXR1cm4gVyh0KSxjKHt2YWx1ZTplLGRvbmU6ITB9KX19Y29uc3QgbWU9e25leHQoKXtyZXR1cm4gX2UodGhpcyk/dGhpcy5fYXN5bmNJdGVyYXRvckltcGwubmV4dCgpOmQocGUoXCJuZXh0XCIpKX0scmV0dXJuKGUpe3JldHVybiBfZSh0aGlzKT90aGlzLl9hc3luY0l0ZXJhdG9ySW1wbC5yZXR1cm4oZSk6ZChwZShcInJldHVyblwiKSl9LFtkZV0oKXtyZXR1cm4gdGhpc319O2Z1bmN0aW9uIF9lKGUpe2lmKCF0KGUpKXJldHVybiExO2lmKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxcIl9hc3luY0l0ZXJhdG9ySW1wbFwiKSlyZXR1cm4hMTt0cnl7cmV0dXJuIGUuX2FzeW5jSXRlcmF0b3JJbXBsIGluc3RhbmNlb2YgaGV9Y2F0Y2goZSl7cmV0dXJuITF9fWZ1bmN0aW9uIHBlKGUpe3JldHVybiBuZXcgVHlwZUVycm9yKGBSZWFkYWJsZVN0cmVhbUFzeW5jSXRlcmF0b3IuJHtlfSBjYW4gb25seSBiZSB1c2VkIG9uIGEgUmVhZGFibGVTdGVhbUFzeW5jSXRlcmF0b3JgKX1PYmplY3QuZGVmaW5lUHJvcGVydHkobWUsZGUse2VudW1lcmFibGU6ITF9KTtjb25zdCB5ZT1OdW1iZXIuaXNOYU58fGZ1bmN0aW9uKGUpe3JldHVybiBlIT1lfTtmdW5jdGlvbiBTZShlKXtjb25zdCB0PXNlKGUuYnVmZmVyLGUuYnl0ZU9mZnNldCxlLmJ5dGVPZmZzZXQrZS5ieXRlTGVuZ3RoKTtyZXR1cm4gbmV3IFVpbnQ4QXJyYXkodCl9ZnVuY3Rpb24gZ2UoZSl7Y29uc3QgdD1lLl9xdWV1ZS5zaGlmdCgpO3JldHVybiBlLl9xdWV1ZVRvdGFsU2l6ZS09dC5zaXplLGUuX3F1ZXVlVG90YWxTaXplPDAmJihlLl9xdWV1ZVRvdGFsU2l6ZT0wKSx0LnZhbHVlfWZ1bmN0aW9uIHZlKGUsdCxyKXtpZihcIm51bWJlclwiIT10eXBlb2Yobz1yKXx8eWUobyl8fG88MHx8cj09PTEvMCl0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlNpemUgbXVzdCBiZSBhIGZpbml0ZSwgbm9uLU5hTiwgbm9uLW5lZ2F0aXZlIG51bWJlci5cIik7dmFyIG87ZS5fcXVldWUucHVzaCh7dmFsdWU6dCxzaXplOnJ9KSxlLl9xdWV1ZVRvdGFsU2l6ZSs9cn1mdW5jdGlvbiB3ZShlKXtlLl9xdWV1ZT1uZXcgdixlLl9xdWV1ZVRvdGFsU2l6ZT0wfWZ1bmN0aW9uIFJlKGUpe3JldHVybiBlPT09RGF0YVZpZXd9Y2xhc3MgUmVhZGFibGVTdHJlYW1CWU9CUmVxdWVzdHtjb25zdHJ1Y3Rvcigpe3Rocm93IG5ldyBUeXBlRXJyb3IoXCJJbGxlZ2FsIGNvbnN0cnVjdG9yXCIpfWdldCB2aWV3KCl7aWYoIUNlKHRoaXMpKXRocm93IEtlKFwidmlld1wiKTtyZXR1cm4gdGhpcy5fdmlld31yZXNwb25kKGUpe2lmKCFDZSh0aGlzKSl0aHJvdyBLZShcInJlc3BvbmRcIik7aWYoJChlLDEsXCJyZXNwb25kXCIpLGU9UShlLFwiRmlyc3QgcGFyYW1ldGVyXCIpLHZvaWQgMD09PXRoaXMuX2Fzc29jaWF0ZWRSZWFkYWJsZUJ5dGVTdHJlYW1Db250cm9sbGVyKXRocm93IG5ldyBUeXBlRXJyb3IoXCJUaGlzIEJZT0IgcmVxdWVzdCBoYXMgYmVlbiBpbnZhbGlkYXRlZFwiKTtpZihsZSh0aGlzLl92aWV3LmJ1ZmZlcikpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBCWU9CIHJlcXVlc3QncyBidWZmZXIgaGFzIGJlZW4gZGV0YWNoZWQgYW5kIHNvIGNhbm5vdCBiZSB1c2VkIGFzIGEgcmVzcG9uc2VcIik7R2UodGhpcy5fYXNzb2NpYXRlZFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXIsZSl9cmVzcG9uZFdpdGhOZXdWaWV3KGUpe2lmKCFDZSh0aGlzKSl0aHJvdyBLZShcInJlc3BvbmRXaXRoTmV3Vmlld1wiKTtpZigkKGUsMSxcInJlc3BvbmRXaXRoTmV3Vmlld1wiKSwhQXJyYXlCdWZmZXIuaXNWaWV3KGUpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJZb3UgY2FuIG9ubHkgcmVzcG9uZCB3aXRoIGFycmF5IGJ1ZmZlciB2aWV3c1wiKTtpZih2b2lkIDA9PT10aGlzLl9hc3NvY2lhdGVkUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlcil0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhpcyBCWU9CIHJlcXVlc3QgaGFzIGJlZW4gaW52YWxpZGF0ZWRcIik7aWYobGUoZS5idWZmZXIpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJUaGUgZ2l2ZW4gdmlldydzIGJ1ZmZlciBoYXMgYmVlbiBkZXRhY2hlZCBhbmQgc28gY2Fubm90IGJlIHVzZWQgYXMgYSByZXNwb25zZVwiKTtYZSh0aGlzLl9hc3NvY2lhdGVkUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlcixlKX19T2JqZWN0LmRlZmluZVByb3BlcnRpZXMoUmVhZGFibGVTdHJlYW1CWU9CUmVxdWVzdC5wcm90b3R5cGUse3Jlc3BvbmQ6e2VudW1lcmFibGU6ITB9LHJlc3BvbmRXaXRoTmV3Vmlldzp7ZW51bWVyYWJsZTohMH0sdmlldzp7ZW51bWVyYWJsZTohMH19KSxvKFJlYWRhYmxlU3RyZWFtQllPQlJlcXVlc3QucHJvdG90eXBlLnJlc3BvbmQsXCJyZXNwb25kXCIpLG8oUmVhZGFibGVTdHJlYW1CWU9CUmVxdWVzdC5wcm90b3R5cGUucmVzcG9uZFdpdGhOZXdWaWV3LFwicmVzcG9uZFdpdGhOZXdWaWV3XCIpLFwic3ltYm9sXCI9PXR5cGVvZiBTeW1ib2wudG9TdHJpbmdUYWcmJk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSZWFkYWJsZVN0cmVhbUJZT0JSZXF1ZXN0LnByb3RvdHlwZSxTeW1ib2wudG9TdHJpbmdUYWcse3ZhbHVlOlwiUmVhZGFibGVTdHJlYW1CWU9CUmVxdWVzdFwiLGNvbmZpZ3VyYWJsZTohMH0pO2NsYXNzIFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXJ7Y29uc3RydWN0b3IoKXt0aHJvdyBuZXcgVHlwZUVycm9yKFwiSWxsZWdhbCBjb25zdHJ1Y3RvclwiKX1nZXQgYnlvYlJlcXVlc3QoKXtpZighVGUodGhpcykpdGhyb3cgWmUoXCJieW9iUmVxdWVzdFwiKTtyZXR1cm4gVmUodGhpcyl9Z2V0IGRlc2lyZWRTaXplKCl7aWYoIVRlKHRoaXMpKXRocm93IFplKFwiZGVzaXJlZFNpemVcIik7cmV0dXJuIFVlKHRoaXMpfWNsb3NlKCl7aWYoIVRlKHRoaXMpKXRocm93IFplKFwiY2xvc2VcIik7aWYodGhpcy5fY2xvc2VSZXF1ZXN0ZWQpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBzdHJlYW0gaGFzIGFscmVhZHkgYmVlbiBjbG9zZWQ7IGRvIG5vdCBjbG9zZSBpdCBhZ2FpbiFcIik7Y29uc3QgZT10aGlzLl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtLl9zdGF0ZTtpZihcInJlYWRhYmxlXCIhPT1lKXRocm93IG5ldyBUeXBlRXJyb3IoYFRoZSBzdHJlYW0gKGluICR7ZX0gc3RhdGUpIGlzIG5vdCBpbiB0aGUgcmVhZGFibGUgc3RhdGUgYW5kIGNhbm5vdCBiZSBjbG9zZWRgKTt4ZSh0aGlzKX1lbnF1ZXVlKGUpe2lmKCFUZSh0aGlzKSl0aHJvdyBaZShcImVucXVldWVcIik7aWYoJChlLDEsXCJlbnF1ZXVlXCIpLCFBcnJheUJ1ZmZlci5pc1ZpZXcoZSkpdGhyb3cgbmV3IFR5cGVFcnJvcihcImNodW5rIG11c3QgYmUgYW4gYXJyYXkgYnVmZmVyIHZpZXdcIik7aWYoMD09PWUuYnl0ZUxlbmd0aCl0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2h1bmsgbXVzdCBoYXZlIG5vbi16ZXJvIGJ5dGVMZW5ndGhcIik7aWYoMD09PWUuYnVmZmVyLmJ5dGVMZW5ndGgpdGhyb3cgbmV3IFR5cGVFcnJvcihcImNodW5rJ3MgYnVmZmVyIG11c3QgaGF2ZSBub24temVybyBieXRlTGVuZ3RoXCIpO2lmKHRoaXMuX2Nsb3NlUmVxdWVzdGVkKXRocm93IG5ldyBUeXBlRXJyb3IoXCJzdHJlYW0gaXMgY2xvc2VkIG9yIGRyYWluaW5nXCIpO2NvbnN0IHQ9dGhpcy5fY29udHJvbGxlZFJlYWRhYmxlQnl0ZVN0cmVhbS5fc3RhdGU7aWYoXCJyZWFkYWJsZVwiIT09dCl0aHJvdyBuZXcgVHlwZUVycm9yKGBUaGUgc3RyZWFtIChpbiAke3R9IHN0YXRlKSBpcyBub3QgaW4gdGhlIHJlYWRhYmxlIHN0YXRlIGFuZCBjYW5ub3QgYmUgZW5xdWV1ZWQgdG9gKTtRZSh0aGlzLGUpfWVycm9yKGU9dm9pZCAwKXtpZighVGUodGhpcykpdGhyb3cgWmUoXCJlcnJvclwiKTtOZSh0aGlzLGUpfVtUXShlKXtxZSh0aGlzKSx3ZSh0aGlzKTtjb25zdCB0PXRoaXMuX2NhbmNlbEFsZ29yaXRobShlKTtyZXR1cm4gWWUodGhpcyksdH1bQ10oZSl7Y29uc3QgdD10aGlzLl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtO2lmKHRoaXMuX3F1ZXVlVG90YWxTaXplPjApcmV0dXJuIHZvaWQgSGUodGhpcyxlKTtjb25zdCByPXRoaXMuX2F1dG9BbGxvY2F0ZUNodW5rU2l6ZTtpZih2b2lkIDAhPT1yKXtsZXQgdDt0cnl7dD1uZXcgQXJyYXlCdWZmZXIocil9Y2F0Y2godCl7cmV0dXJuIHZvaWQgZS5fZXJyb3JTdGVwcyh0KX1jb25zdCBvPXtidWZmZXI6dCxidWZmZXJCeXRlTGVuZ3RoOnIsYnl0ZU9mZnNldDowLGJ5dGVMZW5ndGg6cixieXRlc0ZpbGxlZDowLG1pbmltdW1GaWxsOjEsZWxlbWVudFNpemU6MSx2aWV3Q29uc3RydWN0b3I6VWludDhBcnJheSxyZWFkZXJUeXBlOlwiZGVmYXVsdFwifTt0aGlzLl9wZW5kaW5nUHVsbEludG9zLnB1c2gobyl9Vih0LGUpLFBlKHRoaXMpfVtQXSgpe2lmKHRoaXMuX3BlbmRpbmdQdWxsSW50b3MubGVuZ3RoPjApe2NvbnN0IGU9dGhpcy5fcGVuZGluZ1B1bGxJbnRvcy5wZWVrKCk7ZS5yZWFkZXJUeXBlPVwibm9uZVwiLHRoaXMuX3BlbmRpbmdQdWxsSW50b3M9bmV3IHYsdGhpcy5fcGVuZGluZ1B1bGxJbnRvcy5wdXNoKGUpfX19ZnVuY3Rpb24gVGUoZSl7cmV0dXJuISF0KGUpJiYoISFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxcIl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtXCIpJiZlIGluc3RhbmNlb2YgUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlcil9ZnVuY3Rpb24gQ2UoZSl7cmV0dXJuISF0KGUpJiYoISFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxcIl9hc3NvY2lhdGVkUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlclwiKSYmZSBpbnN0YW5jZW9mIFJlYWRhYmxlU3RyZWFtQllPQlJlcXVlc3QpfWZ1bmN0aW9uIFBlKGUpe2NvbnN0IHQ9ZnVuY3Rpb24oZSl7Y29uc3QgdD1lLl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtO2lmKFwicmVhZGFibGVcIiE9PXQuX3N0YXRlKXJldHVybiExO2lmKGUuX2Nsb3NlUmVxdWVzdGVkKXJldHVybiExO2lmKCFlLl9zdGFydGVkKXJldHVybiExO2lmKFgodCkmJkcodCk+MClyZXR1cm4hMDtpZihudCh0KSYmb3QodCk+MClyZXR1cm4hMDtjb25zdCByPVVlKGUpO2lmKHI+MClyZXR1cm4hMDtyZXR1cm4hMX0oZSk7aWYoIXQpcmV0dXJuO2lmKGUuX3B1bGxpbmcpcmV0dXJuIHZvaWQoZS5fcHVsbEFnYWluPSEwKTtlLl9wdWxsaW5nPSEwO2IoZS5fcHVsbEFsZ29yaXRobSgpLCgpPT4oZS5fcHVsbGluZz0hMSxlLl9wdWxsQWdhaW4mJihlLl9wdWxsQWdhaW49ITEsUGUoZSkpLG51bGwpLHQ9PihOZShlLHQpLG51bGwpKX1mdW5jdGlvbiBxZShlKXtMZShlKSxlLl9wZW5kaW5nUHVsbEludG9zPW5ldyB2fWZ1bmN0aW9uIEVlKGUsdCl7bGV0IHI9ITE7XCJjbG9zZWRcIj09PWUuX3N0YXRlJiYocj0hMCk7Y29uc3Qgbz1PZSh0KTtcImRlZmF1bHRcIj09PXQucmVhZGVyVHlwZT9VKGUsbyxyKTpmdW5jdGlvbihlLHQscil7Y29uc3Qgbz1lLl9yZWFkZXIsbj1vLl9yZWFkSW50b1JlcXVlc3RzLnNoaWZ0KCk7cj9uLl9jbG9zZVN0ZXBzKHQpOm4uX2NodW5rU3RlcHModCl9KGUsbyxyKX1mdW5jdGlvbiBXZShlLHQpe2ZvcihsZXQgcj0wO3I8dC5sZW5ndGg7KytyKUVlKGUsdFtyXSl9ZnVuY3Rpb24gT2UoZSl7Y29uc3QgdD1lLmJ5dGVzRmlsbGVkLHI9ZS5lbGVtZW50U2l6ZTtyZXR1cm4gbmV3IGUudmlld0NvbnN0cnVjdG9yKGUuYnVmZmVyLGUuYnl0ZU9mZnNldCx0L3IpfWZ1bmN0aW9uIEJlKGUsdCxyLG8pe2UuX3F1ZXVlLnB1c2goe2J1ZmZlcjp0LGJ5dGVPZmZzZXQ6cixieXRlTGVuZ3RoOm99KSxlLl9xdWV1ZVRvdGFsU2l6ZSs9b31mdW5jdGlvbiBrZShlLHQscixvKXtsZXQgbjt0cnl7bj1zZSh0LHIscitvKX1jYXRjaCh0KXt0aHJvdyBOZShlLHQpLHR9QmUoZSxuLDAsbyl9ZnVuY3Rpb24gamUoZSx0KXt0LmJ5dGVzRmlsbGVkPjAmJmtlKGUsdC5idWZmZXIsdC5ieXRlT2Zmc2V0LHQuYnl0ZXNGaWxsZWQpLE1lKGUpfWZ1bmN0aW9uIEFlKGUsdCl7Y29uc3Qgcj1NYXRoLm1pbihlLl9xdWV1ZVRvdGFsU2l6ZSx0LmJ5dGVMZW5ndGgtdC5ieXRlc0ZpbGxlZCksbz10LmJ5dGVzRmlsbGVkK3I7bGV0IG49cixhPSExO2NvbnN0IGk9by1vJXQuZWxlbWVudFNpemU7aT49dC5taW5pbXVtRmlsbCYmKG49aS10LmJ5dGVzRmlsbGVkLGE9ITApO2NvbnN0IGw9ZS5fcXVldWU7Zm9yKDtuPjA7KXtjb25zdCByPWwucGVlaygpLG89TWF0aC5taW4obixyLmJ5dGVMZW5ndGgpLGE9dC5ieXRlT2Zmc2V0K3QuYnl0ZXNGaWxsZWQ7YWUodC5idWZmZXIsYSxyLmJ1ZmZlcixyLmJ5dGVPZmZzZXQsbyksci5ieXRlTGVuZ3RoPT09bz9sLnNoaWZ0KCk6KHIuYnl0ZU9mZnNldCs9byxyLmJ5dGVMZW5ndGgtPW8pLGUuX3F1ZXVlVG90YWxTaXplLT1vLHplKGUsbyx0KSxuLT1vfXJldHVybiBhfWZ1bmN0aW9uIHplKGUsdCxyKXtyLmJ5dGVzRmlsbGVkKz10fWZ1bmN0aW9uIERlKGUpezA9PT1lLl9xdWV1ZVRvdGFsU2l6ZSYmZS5fY2xvc2VSZXF1ZXN0ZWQ/KFllKGUpLEJyKGUuX2NvbnRyb2xsZWRSZWFkYWJsZUJ5dGVTdHJlYW0pKTpQZShlKX1mdW5jdGlvbiBMZShlKXtudWxsIT09ZS5fYnlvYlJlcXVlc3QmJihlLl9ieW9iUmVxdWVzdC5fYXNzb2NpYXRlZFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXI9dm9pZCAwLGUuX2J5b2JSZXF1ZXN0Ll92aWV3PW51bGwsZS5fYnlvYlJlcXVlc3Q9bnVsbCl9ZnVuY3Rpb24gRmUoZSl7Y29uc3QgdD1bXTtmb3IoO2UuX3BlbmRpbmdQdWxsSW50b3MubGVuZ3RoPjAmJjAhPT1lLl9xdWV1ZVRvdGFsU2l6ZTspe2NvbnN0IHI9ZS5fcGVuZGluZ1B1bGxJbnRvcy5wZWVrKCk7QWUoZSxyKSYmKE1lKGUpLHQucHVzaChyKSl9cmV0dXJuIHR9ZnVuY3Rpb24gSWUoZSx0LHIsbyl7Y29uc3Qgbj1lLl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtLGE9dC5jb25zdHJ1Y3RvcixpPWZ1bmN0aW9uKGUpe3JldHVybiBSZShlKT8xOmUuQllURVNfUEVSX0VMRU1FTlR9KGEpLHtieXRlT2Zmc2V0OmwsYnl0ZUxlbmd0aDpzfT10LHU9cippO2xldCBjO3RyeXtjPWllKHQuYnVmZmVyKX1jYXRjaChlKXtyZXR1cm4gdm9pZCBvLl9lcnJvclN0ZXBzKGUpfWNvbnN0IGQ9e2J1ZmZlcjpjLGJ1ZmZlckJ5dGVMZW5ndGg6Yy5ieXRlTGVuZ3RoLGJ5dGVPZmZzZXQ6bCxieXRlTGVuZ3RoOnMsYnl0ZXNGaWxsZWQ6MCxtaW5pbXVtRmlsbDp1LGVsZW1lbnRTaXplOmksdmlld0NvbnN0cnVjdG9yOmEscmVhZGVyVHlwZTpcImJ5b2JcIn07aWYoZS5fcGVuZGluZ1B1bGxJbnRvcy5sZW5ndGg+MClyZXR1cm4gZS5fcGVuZGluZ1B1bGxJbnRvcy5wdXNoKGQpLHZvaWQgcnQobixvKTtpZihcImNsb3NlZFwiPT09bi5fc3RhdGUpe2NvbnN0IGU9bmV3IGEoZC5idWZmZXIsZC5ieXRlT2Zmc2V0LDApO3JldHVybiB2b2lkIG8uX2Nsb3NlU3RlcHMoZSl9aWYoZS5fcXVldWVUb3RhbFNpemU+MCl7aWYoQWUoZSxkKSl7Y29uc3QgdD1PZShkKTtyZXR1cm4gRGUoZSksdm9pZCBvLl9jaHVua1N0ZXBzKHQpfWlmKGUuX2Nsb3NlUmVxdWVzdGVkKXtjb25zdCB0PW5ldyBUeXBlRXJyb3IoXCJJbnN1ZmZpY2llbnQgYnl0ZXMgdG8gZmlsbCBlbGVtZW50cyBpbiB0aGUgZ2l2ZW4gYnVmZmVyXCIpO3JldHVybiBOZShlLHQpLHZvaWQgby5fZXJyb3JTdGVwcyh0KX19ZS5fcGVuZGluZ1B1bGxJbnRvcy5wdXNoKGQpLHJ0KG4sbyksUGUoZSl9ZnVuY3Rpb24gJGUoZSx0KXtjb25zdCByPWUuX3BlbmRpbmdQdWxsSW50b3MucGVlaygpO0xlKGUpO1wiY2xvc2VkXCI9PT1lLl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtLl9zdGF0ZT9mdW5jdGlvbihlLHQpe1wibm9uZVwiPT09dC5yZWFkZXJUeXBlJiZNZShlKTtjb25zdCByPWUuX2NvbnRyb2xsZWRSZWFkYWJsZUJ5dGVTdHJlYW07aWYobnQocikpe2NvbnN0IHQ9W107Zm9yKDt0Lmxlbmd0aDxvdChyKTspdC5wdXNoKE1lKGUpKTtXZShyLHQpfX0oZSxyKTpmdW5jdGlvbihlLHQscil7aWYoemUoMCx0LHIpLFwibm9uZVwiPT09ci5yZWFkZXJUeXBlKXtqZShlLHIpO2NvbnN0IHQ9RmUoZSk7cmV0dXJuIHZvaWQgV2UoZS5fY29udHJvbGxlZFJlYWRhYmxlQnl0ZVN0cmVhbSx0KX1pZihyLmJ5dGVzRmlsbGVkPHIubWluaW11bUZpbGwpcmV0dXJuO01lKGUpO2NvbnN0IG89ci5ieXRlc0ZpbGxlZCVyLmVsZW1lbnRTaXplO2lmKG8+MCl7Y29uc3QgdD1yLmJ5dGVPZmZzZXQrci5ieXRlc0ZpbGxlZDtrZShlLHIuYnVmZmVyLHQtbyxvKX1yLmJ5dGVzRmlsbGVkLT1vO2NvbnN0IG49RmUoZSk7RWUoZS5fY29udHJvbGxlZFJlYWRhYmxlQnl0ZVN0cmVhbSxyKSxXZShlLl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtLG4pfShlLHQsciksUGUoZSl9ZnVuY3Rpb24gTWUoZSl7cmV0dXJuIGUuX3BlbmRpbmdQdWxsSW50b3Muc2hpZnQoKX1mdW5jdGlvbiBZZShlKXtlLl9wdWxsQWxnb3JpdGhtPXZvaWQgMCxlLl9jYW5jZWxBbGdvcml0aG09dm9pZCAwfWZ1bmN0aW9uIHhlKGUpe2NvbnN0IHQ9ZS5fY29udHJvbGxlZFJlYWRhYmxlQnl0ZVN0cmVhbTtpZighZS5fY2xvc2VSZXF1ZXN0ZWQmJlwicmVhZGFibGVcIj09PXQuX3N0YXRlKWlmKGUuX3F1ZXVlVG90YWxTaXplPjApZS5fY2xvc2VSZXF1ZXN0ZWQ9ITA7ZWxzZXtpZihlLl9wZW5kaW5nUHVsbEludG9zLmxlbmd0aD4wKXtjb25zdCB0PWUuX3BlbmRpbmdQdWxsSW50b3MucGVlaygpO2lmKHQuYnl0ZXNGaWxsZWQldC5lbGVtZW50U2l6ZSE9PTApe2NvbnN0IHQ9bmV3IFR5cGVFcnJvcihcIkluc3VmZmljaWVudCBieXRlcyB0byBmaWxsIGVsZW1lbnRzIGluIHRoZSBnaXZlbiBidWZmZXJcIik7dGhyb3cgTmUoZSx0KSx0fX1ZZShlKSxCcih0KX19ZnVuY3Rpb24gUWUoZSx0KXtjb25zdCByPWUuX2NvbnRyb2xsZWRSZWFkYWJsZUJ5dGVTdHJlYW07aWYoZS5fY2xvc2VSZXF1ZXN0ZWR8fFwicmVhZGFibGVcIiE9PXIuX3N0YXRlKXJldHVybjtjb25zdHtidWZmZXI6byxieXRlT2Zmc2V0Om4sYnl0ZUxlbmd0aDphfT10O2lmKGxlKG8pKXRocm93IG5ldyBUeXBlRXJyb3IoXCJjaHVuaydzIGJ1ZmZlciBpcyBkZXRhY2hlZCBhbmQgc28gY2Fubm90IGJlIGVucXVldWVkXCIpO2NvbnN0IGk9aWUobyk7aWYoZS5fcGVuZGluZ1B1bGxJbnRvcy5sZW5ndGg+MCl7Y29uc3QgdD1lLl9wZW5kaW5nUHVsbEludG9zLnBlZWsoKTtpZihsZSh0LmJ1ZmZlcikpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBCWU9CIHJlcXVlc3QncyBidWZmZXIgaGFzIGJlZW4gZGV0YWNoZWQgYW5kIHNvIGNhbm5vdCBiZSBmaWxsZWQgd2l0aCBhbiBlbnF1ZXVlZCBjaHVua1wiKTtMZShlKSx0LmJ1ZmZlcj1pZSh0LmJ1ZmZlciksXCJub25lXCI9PT10LnJlYWRlclR5cGUmJmplKGUsdCl9aWYoWChyKSlpZihmdW5jdGlvbihlKXtjb25zdCB0PWUuX2NvbnRyb2xsZWRSZWFkYWJsZUJ5dGVTdHJlYW0uX3JlYWRlcjtmb3IoO3QuX3JlYWRSZXF1ZXN0cy5sZW5ndGg+MDspe2lmKDA9PT1lLl9xdWV1ZVRvdGFsU2l6ZSlyZXR1cm47SGUoZSx0Ll9yZWFkUmVxdWVzdHMuc2hpZnQoKSl9fShlKSwwPT09RyhyKSlCZShlLGksbixhKTtlbHNle2UuX3BlbmRpbmdQdWxsSW50b3MubGVuZ3RoPjAmJk1lKGUpO1UocixuZXcgVWludDhBcnJheShpLG4sYSksITEpfWVsc2UgaWYobnQocikpe0JlKGUsaSxuLGEpO1dlKHIsRmUoZSkpfWVsc2UgQmUoZSxpLG4sYSk7UGUoZSl9ZnVuY3Rpb24gTmUoZSx0KXtjb25zdCByPWUuX2NvbnRyb2xsZWRSZWFkYWJsZUJ5dGVTdHJlYW07XCJyZWFkYWJsZVwiPT09ci5fc3RhdGUmJihxZShlKSx3ZShlKSxZZShlKSxrcihyLHQpKX1mdW5jdGlvbiBIZShlLHQpe2NvbnN0IHI9ZS5fcXVldWUuc2hpZnQoKTtlLl9xdWV1ZVRvdGFsU2l6ZS09ci5ieXRlTGVuZ3RoLERlKGUpO2NvbnN0IG89bmV3IFVpbnQ4QXJyYXkoci5idWZmZXIsci5ieXRlT2Zmc2V0LHIuYnl0ZUxlbmd0aCk7dC5fY2h1bmtTdGVwcyhvKX1mdW5jdGlvbiBWZShlKXtpZihudWxsPT09ZS5fYnlvYlJlcXVlc3QmJmUuX3BlbmRpbmdQdWxsSW50b3MubGVuZ3RoPjApe2NvbnN0IHQ9ZS5fcGVuZGluZ1B1bGxJbnRvcy5wZWVrKCkscj1uZXcgVWludDhBcnJheSh0LmJ1ZmZlcix0LmJ5dGVPZmZzZXQrdC5ieXRlc0ZpbGxlZCx0LmJ5dGVMZW5ndGgtdC5ieXRlc0ZpbGxlZCksbz1PYmplY3QuY3JlYXRlKFJlYWRhYmxlU3RyZWFtQllPQlJlcXVlc3QucHJvdG90eXBlKTshZnVuY3Rpb24oZSx0LHIpe2UuX2Fzc29jaWF0ZWRSZWFkYWJsZUJ5dGVTdHJlYW1Db250cm9sbGVyPXQsZS5fdmlldz1yfShvLGUsciksZS5fYnlvYlJlcXVlc3Q9b31yZXR1cm4gZS5fYnlvYlJlcXVlc3R9ZnVuY3Rpb24gVWUoZSl7Y29uc3QgdD1lLl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtLl9zdGF0ZTtyZXR1cm5cImVycm9yZWRcIj09PXQ/bnVsbDpcImNsb3NlZFwiPT09dD8wOmUuX3N0cmF0ZWd5SFdNLWUuX3F1ZXVlVG90YWxTaXplfWZ1bmN0aW9uIEdlKGUsdCl7Y29uc3Qgcj1lLl9wZW5kaW5nUHVsbEludG9zLnBlZWsoKTtpZihcImNsb3NlZFwiPT09ZS5fY29udHJvbGxlZFJlYWRhYmxlQnl0ZVN0cmVhbS5fc3RhdGUpe2lmKDAhPT10KXRocm93IG5ldyBUeXBlRXJyb3IoXCJieXRlc1dyaXR0ZW4gbXVzdCBiZSAwIHdoZW4gY2FsbGluZyByZXNwb25kKCkgb24gYSBjbG9zZWQgc3RyZWFtXCIpfWVsc2V7aWYoMD09PXQpdGhyb3cgbmV3IFR5cGVFcnJvcihcImJ5dGVzV3JpdHRlbiBtdXN0IGJlIGdyZWF0ZXIgdGhhbiAwIHdoZW4gY2FsbGluZyByZXNwb25kKCkgb24gYSByZWFkYWJsZSBzdHJlYW1cIik7aWYoci5ieXRlc0ZpbGxlZCt0PnIuYnl0ZUxlbmd0aCl0aHJvdyBuZXcgUmFuZ2VFcnJvcihcImJ5dGVzV3JpdHRlbiBvdXQgb2YgcmFuZ2VcIil9ci5idWZmZXI9aWUoci5idWZmZXIpLCRlKGUsdCl9ZnVuY3Rpb24gWGUoZSx0KXtjb25zdCByPWUuX3BlbmRpbmdQdWxsSW50b3MucGVlaygpO2lmKFwiY2xvc2VkXCI9PT1lLl9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtLl9zdGF0ZSl7aWYoMCE9PXQuYnl0ZUxlbmd0aCl0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhlIHZpZXcncyBsZW5ndGggbXVzdCBiZSAwIHdoZW4gY2FsbGluZyByZXNwb25kV2l0aE5ld1ZpZXcoKSBvbiBhIGNsb3NlZCBzdHJlYW1cIil9ZWxzZSBpZigwPT09dC5ieXRlTGVuZ3RoKXRocm93IG5ldyBUeXBlRXJyb3IoXCJUaGUgdmlldydzIGxlbmd0aCBtdXN0IGJlIGdyZWF0ZXIgdGhhbiAwIHdoZW4gY2FsbGluZyByZXNwb25kV2l0aE5ld1ZpZXcoKSBvbiBhIHJlYWRhYmxlIHN0cmVhbVwiKTtpZihyLmJ5dGVPZmZzZXQrci5ieXRlc0ZpbGxlZCE9PXQuYnl0ZU9mZnNldCl0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSByZWdpb24gc3BlY2lmaWVkIGJ5IHZpZXcgZG9lcyBub3QgbWF0Y2ggYnlvYlJlcXVlc3RcIik7aWYoci5idWZmZXJCeXRlTGVuZ3RoIT09dC5idWZmZXIuYnl0ZUxlbmd0aCl0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBidWZmZXIgb2YgdmlldyBoYXMgZGlmZmVyZW50IGNhcGFjaXR5IHRoYW4gYnlvYlJlcXVlc3RcIik7aWYoci5ieXRlc0ZpbGxlZCt0LmJ5dGVMZW5ndGg+ci5ieXRlTGVuZ3RoKXRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIHJlZ2lvbiBzcGVjaWZpZWQgYnkgdmlldyBpcyBsYXJnZXIgdGhhbiBieW9iUmVxdWVzdFwiKTtjb25zdCBvPXQuYnl0ZUxlbmd0aDtyLmJ1ZmZlcj1pZSh0LmJ1ZmZlciksJGUoZSxvKX1mdW5jdGlvbiBKZShlLHQscixvLG4sYSxpKXt0Ll9jb250cm9sbGVkUmVhZGFibGVCeXRlU3RyZWFtPWUsdC5fcHVsbEFnYWluPSExLHQuX3B1bGxpbmc9ITEsdC5fYnlvYlJlcXVlc3Q9bnVsbCx0Ll9xdWV1ZT10Ll9xdWV1ZVRvdGFsU2l6ZT12b2lkIDAsd2UodCksdC5fY2xvc2VSZXF1ZXN0ZWQ9ITEsdC5fc3RhcnRlZD0hMSx0Ll9zdHJhdGVneUhXTT1hLHQuX3B1bGxBbGdvcml0aG09byx0Ll9jYW5jZWxBbGdvcml0aG09bix0Ll9hdXRvQWxsb2NhdGVDaHVua1NpemU9aSx0Ll9wZW5kaW5nUHVsbEludG9zPW5ldyB2LGUuX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlcj10O2IoYyhyKCkpLCgpPT4odC5fc3RhcnRlZD0hMCxQZSh0KSxudWxsKSxlPT4oTmUodCxlKSxudWxsKSl9ZnVuY3Rpb24gS2UoZSl7cmV0dXJuIG5ldyBUeXBlRXJyb3IoYFJlYWRhYmxlU3RyZWFtQllPQlJlcXVlc3QucHJvdG90eXBlLiR7ZX0gY2FuIG9ubHkgYmUgdXNlZCBvbiBhIFJlYWRhYmxlU3RyZWFtQllPQlJlcXVlc3RgKX1mdW5jdGlvbiBaZShlKXtyZXR1cm4gbmV3IFR5cGVFcnJvcihgUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlci5wcm90b3R5cGUuJHtlfSBjYW4gb25seSBiZSB1c2VkIG9uIGEgUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlcmApfWZ1bmN0aW9uIGV0KGUsdCl7aWYoXCJieW9iXCIhPT0oZT1gJHtlfWApKXRocm93IG5ldyBUeXBlRXJyb3IoYCR7dH0gJyR7ZX0nIGlzIG5vdCBhIHZhbGlkIGVudW1lcmF0aW9uIHZhbHVlIGZvciBSZWFkYWJsZVN0cmVhbVJlYWRlck1vZGVgKTtyZXR1cm4gZX1mdW5jdGlvbiB0dChlKXtyZXR1cm4gbmV3IFJlYWRhYmxlU3RyZWFtQllPQlJlYWRlcihlKX1mdW5jdGlvbiBydChlLHQpe2UuX3JlYWRlci5fcmVhZEludG9SZXF1ZXN0cy5wdXNoKHQpfWZ1bmN0aW9uIG90KGUpe3JldHVybiBlLl9yZWFkZXIuX3JlYWRJbnRvUmVxdWVzdHMubGVuZ3RofWZ1bmN0aW9uIG50KGUpe2NvbnN0IHQ9ZS5fcmVhZGVyO3JldHVybiB2b2lkIDAhPT10JiYhIWF0KHQpfU9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXIucHJvdG90eXBlLHtjbG9zZTp7ZW51bWVyYWJsZTohMH0sZW5xdWV1ZTp7ZW51bWVyYWJsZTohMH0sZXJyb3I6e2VudW1lcmFibGU6ITB9LGJ5b2JSZXF1ZXN0OntlbnVtZXJhYmxlOiEwfSxkZXNpcmVkU2l6ZTp7ZW51bWVyYWJsZTohMH19KSxvKFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXIucHJvdG90eXBlLmNsb3NlLFwiY2xvc2VcIiksbyhSZWFkYWJsZUJ5dGVTdHJlYW1Db250cm9sbGVyLnByb3RvdHlwZS5lbnF1ZXVlLFwiZW5xdWV1ZVwiKSxvKFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXIucHJvdG90eXBlLmVycm9yLFwiZXJyb3JcIiksXCJzeW1ib2xcIj09dHlwZW9mIFN5bWJvbC50b1N0cmluZ1RhZyYmT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXIucHJvdG90eXBlLFN5bWJvbC50b1N0cmluZ1RhZyx7dmFsdWU6XCJSZWFkYWJsZUJ5dGVTdHJlYW1Db250cm9sbGVyXCIsY29uZmlndXJhYmxlOiEwfSk7Y2xhc3MgUmVhZGFibGVTdHJlYW1CWU9CUmVhZGVye2NvbnN0cnVjdG9yKGUpe2lmKCQoZSwxLFwiUmVhZGFibGVTdHJlYW1CWU9CUmVhZGVyXCIpLE4oZSxcIkZpcnN0IHBhcmFtZXRlclwiKSxXcihlKSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhpcyBzdHJlYW0gaGFzIGFscmVhZHkgYmVlbiBsb2NrZWQgZm9yIGV4Y2x1c2l2ZSByZWFkaW5nIGJ5IGFub3RoZXIgcmVhZGVyXCIpO2lmKCFUZShlLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY29uc3RydWN0IGEgUmVhZGFibGVTdHJlYW1CWU9CUmVhZGVyIGZvciBhIHN0cmVhbSBub3QgY29uc3RydWN0ZWQgd2l0aCBhIGJ5dGUgc291cmNlXCIpO3EodGhpcyxlKSx0aGlzLl9yZWFkSW50b1JlcXVlc3RzPW5ldyB2fWdldCBjbG9zZWQoKXtyZXR1cm4gYXQodGhpcyk/dGhpcy5fY2xvc2VkUHJvbWlzZTpkKHN0KFwiY2xvc2VkXCIpKX1jYW5jZWwoZT12b2lkIDApe3JldHVybiBhdCh0aGlzKT92b2lkIDA9PT10aGlzLl9vd25lclJlYWRhYmxlU3RyZWFtP2QoTyhcImNhbmNlbFwiKSk6RSh0aGlzLGUpOmQoc3QoXCJjYW5jZWxcIikpfXJlYWQoZSx0PXt9KXtpZighYXQodGhpcykpcmV0dXJuIGQoc3QoXCJyZWFkXCIpKTtpZighQXJyYXlCdWZmZXIuaXNWaWV3KGUpKXJldHVybiBkKG5ldyBUeXBlRXJyb3IoXCJ2aWV3IG11c3QgYmUgYW4gYXJyYXkgYnVmZmVyIHZpZXdcIikpO2lmKDA9PT1lLmJ5dGVMZW5ndGgpcmV0dXJuIGQobmV3IFR5cGVFcnJvcihcInZpZXcgbXVzdCBoYXZlIG5vbi16ZXJvIGJ5dGVMZW5ndGhcIikpO2lmKDA9PT1lLmJ1ZmZlci5ieXRlTGVuZ3RoKXJldHVybiBkKG5ldyBUeXBlRXJyb3IoXCJ2aWV3J3MgYnVmZmVyIG11c3QgaGF2ZSBub24temVybyBieXRlTGVuZ3RoXCIpKTtpZihsZShlLmJ1ZmZlcikpcmV0dXJuIGQobmV3IFR5cGVFcnJvcihcInZpZXcncyBidWZmZXIgaGFzIGJlZW4gZGV0YWNoZWRcIikpO2xldCByO3RyeXtyPWZ1bmN0aW9uKGUsdCl7dmFyIHI7cmV0dXJuIEwoZSx0KSx7bWluOlEobnVsbCE9PShyPW51bGw9PWU/dm9pZCAwOmUubWluKSYmdm9pZCAwIT09cj9yOjEsYCR7dH0gaGFzIG1lbWJlciAnbWluJyB0aGF0YCl9fSh0LFwib3B0aW9uc1wiKX1jYXRjaChlKXtyZXR1cm4gZChlKX1jb25zdCBvPXIubWluO2lmKDA9PT1vKXJldHVybiBkKG5ldyBUeXBlRXJyb3IoXCJvcHRpb25zLm1pbiBtdXN0IGJlIGdyZWF0ZXIgdGhhbiAwXCIpKTtpZihmdW5jdGlvbihlKXtyZXR1cm4gUmUoZS5jb25zdHJ1Y3Rvcil9KGUpKXtpZihvPmUuYnl0ZUxlbmd0aClyZXR1cm4gZChuZXcgUmFuZ2VFcnJvcihcIm9wdGlvbnMubWluIG11c3QgYmUgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIHZpZXcncyBieXRlTGVuZ3RoXCIpKX1lbHNlIGlmKG8+ZS5sZW5ndGgpcmV0dXJuIGQobmV3IFJhbmdlRXJyb3IoXCJvcHRpb25zLm1pbiBtdXN0IGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byB2aWV3J3MgbGVuZ3RoXCIpKTtpZih2b2lkIDA9PT10aGlzLl9vd25lclJlYWRhYmxlU3RyZWFtKXJldHVybiBkKE8oXCJyZWFkIGZyb21cIikpO2xldCBuLGE7Y29uc3QgaT11KChlLHQpPT57bj1lLGE9dH0pO3JldHVybiBpdCh0aGlzLGUsbyx7X2NodW5rU3RlcHM6ZT0+bih7dmFsdWU6ZSxkb25lOiExfSksX2Nsb3NlU3RlcHM6ZT0+bih7dmFsdWU6ZSxkb25lOiEwfSksX2Vycm9yU3RlcHM6ZT0+YShlKX0pLGl9cmVsZWFzZUxvY2soKXtpZighYXQodGhpcykpdGhyb3cgc3QoXCJyZWxlYXNlTG9ja1wiKTt2b2lkIDAhPT10aGlzLl9vd25lclJlYWRhYmxlU3RyZWFtJiZmdW5jdGlvbihlKXtXKGUpO2NvbnN0IHQ9bmV3IFR5cGVFcnJvcihcIlJlYWRlciB3YXMgcmVsZWFzZWRcIik7bHQoZSx0KX0odGhpcyl9fWZ1bmN0aW9uIGF0KGUpe3JldHVybiEhdChlKSYmKCEhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGUsXCJfcmVhZEludG9SZXF1ZXN0c1wiKSYmZSBpbnN0YW5jZW9mIFJlYWRhYmxlU3RyZWFtQllPQlJlYWRlcil9ZnVuY3Rpb24gaXQoZSx0LHIsbyl7Y29uc3Qgbj1lLl9vd25lclJlYWRhYmxlU3RyZWFtO24uX2Rpc3R1cmJlZD0hMCxcImVycm9yZWRcIj09PW4uX3N0YXRlP28uX2Vycm9yU3RlcHMobi5fc3RvcmVkRXJyb3IpOkllKG4uX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlcix0LHIsbyl9ZnVuY3Rpb24gbHQoZSx0KXtjb25zdCByPWUuX3JlYWRJbnRvUmVxdWVzdHM7ZS5fcmVhZEludG9SZXF1ZXN0cz1uZXcgdixyLmZvckVhY2goZT0+e2UuX2Vycm9yU3RlcHModCl9KX1mdW5jdGlvbiBzdChlKXtyZXR1cm4gbmV3IFR5cGVFcnJvcihgUmVhZGFibGVTdHJlYW1CWU9CUmVhZGVyLnByb3RvdHlwZS4ke2V9IGNhbiBvbmx5IGJlIHVzZWQgb24gYSBSZWFkYWJsZVN0cmVhbUJZT0JSZWFkZXJgKX1mdW5jdGlvbiB1dChlLHQpe2NvbnN0e2hpZ2hXYXRlck1hcms6cn09ZTtpZih2b2lkIDA9PT1yKXJldHVybiB0O2lmKHllKHIpfHxyPDApdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJJbnZhbGlkIGhpZ2hXYXRlck1hcmtcIik7cmV0dXJuIHJ9ZnVuY3Rpb24gY3QoZSl7Y29uc3R7c2l6ZTp0fT1lO3JldHVybiB0fHwoKCk9PjEpfWZ1bmN0aW9uIGR0KGUsdCl7TChlLHQpO2NvbnN0IHI9bnVsbD09ZT92b2lkIDA6ZS5oaWdoV2F0ZXJNYXJrLG89bnVsbD09ZT92b2lkIDA6ZS5zaXplO3JldHVybntoaWdoV2F0ZXJNYXJrOnZvaWQgMD09PXI/dm9pZCAwOlkociksc2l6ZTp2b2lkIDA9PT1vP3ZvaWQgMDpmdChvLGAke3R9IGhhcyBtZW1iZXIgJ3NpemUnIHRoYXRgKX19ZnVuY3Rpb24gZnQoZSx0KXtyZXR1cm4gRihlLHQpLHQ9PlkoZSh0KSl9ZnVuY3Rpb24gYnQoZSx0LHIpe3JldHVybiBGKGUscikscj0+ZyhlLHQsW3JdKX1mdW5jdGlvbiBodChlLHQscil7cmV0dXJuIEYoZSxyKSwoKT0+ZyhlLHQsW10pfWZ1bmN0aW9uIG10KGUsdCxyKXtyZXR1cm4gRihlLHIpLHI9PlMoZSx0LFtyXSl9ZnVuY3Rpb24gX3QoZSx0LHIpe3JldHVybiBGKGUsciksKHIsbyk9PmcoZSx0LFtyLG9dKX1mdW5jdGlvbiBwdChlLHQpe2lmKCFndChlKSl0aHJvdyBuZXcgVHlwZUVycm9yKGAke3R9IGlzIG5vdCBhIFdyaXRhYmxlU3RyZWFtLmApfU9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFJlYWRhYmxlU3RyZWFtQllPQlJlYWRlci5wcm90b3R5cGUse2NhbmNlbDp7ZW51bWVyYWJsZTohMH0scmVhZDp7ZW51bWVyYWJsZTohMH0scmVsZWFzZUxvY2s6e2VudW1lcmFibGU6ITB9LGNsb3NlZDp7ZW51bWVyYWJsZTohMH19KSxvKFJlYWRhYmxlU3RyZWFtQllPQlJlYWRlci5wcm90b3R5cGUuY2FuY2VsLFwiY2FuY2VsXCIpLG8oUmVhZGFibGVTdHJlYW1CWU9CUmVhZGVyLnByb3RvdHlwZS5yZWFkLFwicmVhZFwiKSxvKFJlYWRhYmxlU3RyZWFtQllPQlJlYWRlci5wcm90b3R5cGUucmVsZWFzZUxvY2ssXCJyZWxlYXNlTG9ja1wiKSxcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLnRvU3RyaW5nVGFnJiZPYmplY3QuZGVmaW5lUHJvcGVydHkoUmVhZGFibGVTdHJlYW1CWU9CUmVhZGVyLnByb3RvdHlwZSxTeW1ib2wudG9TdHJpbmdUYWcse3ZhbHVlOlwiUmVhZGFibGVTdHJlYW1CWU9CUmVhZGVyXCIsY29uZmlndXJhYmxlOiEwfSk7Y2xhc3MgV3JpdGFibGVTdHJlYW17Y29uc3RydWN0b3IoZT17fSx0PXt9KXt2b2lkIDA9PT1lP2U9bnVsbDpJKGUsXCJGaXJzdCBwYXJhbWV0ZXJcIik7Y29uc3Qgcj1kdCh0LFwiU2Vjb25kIHBhcmFtZXRlclwiKSxvPWZ1bmN0aW9uKGUsdCl7TChlLHQpO2NvbnN0IHI9bnVsbD09ZT92b2lkIDA6ZS5hYm9ydCxvPW51bGw9PWU/dm9pZCAwOmUuY2xvc2Usbj1udWxsPT1lP3ZvaWQgMDplLnN0YXJ0LGE9bnVsbD09ZT92b2lkIDA6ZS50eXBlLGk9bnVsbD09ZT92b2lkIDA6ZS53cml0ZTtyZXR1cm57YWJvcnQ6dm9pZCAwPT09cj92b2lkIDA6YnQocixlLGAke3R9IGhhcyBtZW1iZXIgJ2Fib3J0JyB0aGF0YCksY2xvc2U6dm9pZCAwPT09bz92b2lkIDA6aHQobyxlLGAke3R9IGhhcyBtZW1iZXIgJ2Nsb3NlJyB0aGF0YCksc3RhcnQ6dm9pZCAwPT09bj92b2lkIDA6bXQobixlLGAke3R9IGhhcyBtZW1iZXIgJ3N0YXJ0JyB0aGF0YCksd3JpdGU6dm9pZCAwPT09aT92b2lkIDA6X3QoaSxlLGAke3R9IGhhcyBtZW1iZXIgJ3dyaXRlJyB0aGF0YCksdHlwZTphfX0oZSxcIkZpcnN0IHBhcmFtZXRlclwiKTtTdCh0aGlzKTtpZih2b2lkIDAhPT1vLnR5cGUpdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJJbnZhbGlkIHR5cGUgaXMgc3BlY2lmaWVkXCIpO2NvbnN0IG49Y3Qocik7IWZ1bmN0aW9uKGUsdCxyLG8pe2NvbnN0IG49T2JqZWN0LmNyZWF0ZShXcml0YWJsZVN0cmVhbURlZmF1bHRDb250cm9sbGVyLnByb3RvdHlwZSk7bGV0IGEsaSxsLHM7YT12b2lkIDAhPT10LnN0YXJ0PygpPT50LnN0YXJ0KG4pOigpPT57fTtpPXZvaWQgMCE9PXQud3JpdGU/ZT0+dC53cml0ZShlLG4pOigpPT5jKHZvaWQgMCk7bD12b2lkIDAhPT10LmNsb3NlPygpPT50LmNsb3NlKCk6KCk9PmModm9pZCAwKTtzPXZvaWQgMCE9PXQuYWJvcnQ/ZT0+dC5hYm9ydChlKTooKT0+Yyh2b2lkIDApO0Z0KGUsbixhLGksbCxzLHIsbyl9KHRoaXMsbyx1dChyLDEpLG4pfWdldCBsb2NrZWQoKXtpZighZ3QodGhpcykpdGhyb3cgTnQoXCJsb2NrZWRcIik7cmV0dXJuIHZ0KHRoaXMpfWFib3J0KGU9dm9pZCAwKXtyZXR1cm4gZ3QodGhpcyk/dnQodGhpcyk/ZChuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFib3J0IGEgc3RyZWFtIHRoYXQgYWxyZWFkeSBoYXMgYSB3cml0ZXJcIikpOnd0KHRoaXMsZSk6ZChOdChcImFib3J0XCIpKX1jbG9zZSgpe3JldHVybiBndCh0aGlzKT92dCh0aGlzKT9kKG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2xvc2UgYSBzdHJlYW0gdGhhdCBhbHJlYWR5IGhhcyBhIHdyaXRlclwiKSk6cXQodGhpcyk/ZChuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNsb3NlIGFuIGFscmVhZHktY2xvc2luZyBzdHJlYW1cIikpOlJ0KHRoaXMpOmQoTnQoXCJjbG9zZVwiKSl9Z2V0V3JpdGVyKCl7aWYoIWd0KHRoaXMpKXRocm93IE50KFwiZ2V0V3JpdGVyXCIpO3JldHVybiB5dCh0aGlzKX19ZnVuY3Rpb24geXQoZSl7cmV0dXJuIG5ldyBXcml0YWJsZVN0cmVhbURlZmF1bHRXcml0ZXIoZSl9ZnVuY3Rpb24gU3QoZSl7ZS5fc3RhdGU9XCJ3cml0YWJsZVwiLGUuX3N0b3JlZEVycm9yPXZvaWQgMCxlLl93cml0ZXI9dm9pZCAwLGUuX3dyaXRhYmxlU3RyZWFtQ29udHJvbGxlcj12b2lkIDAsZS5fd3JpdGVSZXF1ZXN0cz1uZXcgdixlLl9pbkZsaWdodFdyaXRlUmVxdWVzdD12b2lkIDAsZS5fY2xvc2VSZXF1ZXN0PXZvaWQgMCxlLl9pbkZsaWdodENsb3NlUmVxdWVzdD12b2lkIDAsZS5fcGVuZGluZ0Fib3J0UmVxdWVzdD12b2lkIDAsZS5fYmFja3ByZXNzdXJlPSExfWZ1bmN0aW9uIGd0KGUpe3JldHVybiEhdChlKSYmKCEhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGUsXCJfd3JpdGFibGVTdHJlYW1Db250cm9sbGVyXCIpJiZlIGluc3RhbmNlb2YgV3JpdGFibGVTdHJlYW0pfWZ1bmN0aW9uIHZ0KGUpe3JldHVybiB2b2lkIDAhPT1lLl93cml0ZXJ9ZnVuY3Rpb24gd3QoZSx0KXt2YXIgcjtpZihcImNsb3NlZFwiPT09ZS5fc3RhdGV8fFwiZXJyb3JlZFwiPT09ZS5fc3RhdGUpcmV0dXJuIGModm9pZCAwKTtlLl93cml0YWJsZVN0cmVhbUNvbnRyb2xsZXIuX2Fib3J0UmVhc29uPXQsbnVsbD09PShyPWUuX3dyaXRhYmxlU3RyZWFtQ29udHJvbGxlci5fYWJvcnRDb250cm9sbGVyKXx8dm9pZCAwPT09cnx8ci5hYm9ydCh0KTtjb25zdCBvPWUuX3N0YXRlO2lmKFwiY2xvc2VkXCI9PT1vfHxcImVycm9yZWRcIj09PW8pcmV0dXJuIGModm9pZCAwKTtpZih2b2lkIDAhPT1lLl9wZW5kaW5nQWJvcnRSZXF1ZXN0KXJldHVybiBlLl9wZW5kaW5nQWJvcnRSZXF1ZXN0Ll9wcm9taXNlO2xldCBuPSExO1wiZXJyb3JpbmdcIj09PW8mJihuPSEwLHQ9dm9pZCAwKTtjb25zdCBhPXUoKHIsbyk9PntlLl9wZW5kaW5nQWJvcnRSZXF1ZXN0PXtfcHJvbWlzZTp2b2lkIDAsX3Jlc29sdmU6cixfcmVqZWN0Om8sX3JlYXNvbjp0LF93YXNBbHJlYWR5RXJyb3Jpbmc6bn19KTtyZXR1cm4gZS5fcGVuZGluZ0Fib3J0UmVxdWVzdC5fcHJvbWlzZT1hLG58fEN0KGUsdCksYX1mdW5jdGlvbiBSdChlKXtjb25zdCB0PWUuX3N0YXRlO2lmKFwiY2xvc2VkXCI9PT10fHxcImVycm9yZWRcIj09PXQpcmV0dXJuIGQobmV3IFR5cGVFcnJvcihgVGhlIHN0cmVhbSAoaW4gJHt0fSBzdGF0ZSkgaXMgbm90IGluIHRoZSB3cml0YWJsZSBzdGF0ZSBhbmQgY2Fubm90IGJlIGNsb3NlZGApKTtjb25zdCByPXUoKHQscik9Pntjb25zdCBvPXtfcmVzb2x2ZTp0LF9yZWplY3Q6cn07ZS5fY2xvc2VSZXF1ZXN0PW99KSxvPWUuX3dyaXRlcjt2YXIgbjtyZXR1cm4gdm9pZCAwIT09byYmZS5fYmFja3ByZXNzdXJlJiZcIndyaXRhYmxlXCI9PT10JiZvcihvKSx2ZShuPWUuX3dyaXRhYmxlU3RyZWFtQ29udHJvbGxlcixEdCwwKSxNdChuKSxyfWZ1bmN0aW9uIFR0KGUsdCl7XCJ3cml0YWJsZVwiIT09ZS5fc3RhdGU/UHQoZSk6Q3QoZSx0KX1mdW5jdGlvbiBDdChlLHQpe2NvbnN0IHI9ZS5fd3JpdGFibGVTdHJlYW1Db250cm9sbGVyO2UuX3N0YXRlPVwiZXJyb3JpbmdcIixlLl9zdG9yZWRFcnJvcj10O2NvbnN0IG89ZS5fd3JpdGVyO3ZvaWQgMCE9PW8mJmp0KG8sdCksIWZ1bmN0aW9uKGUpe2lmKHZvaWQgMD09PWUuX2luRmxpZ2h0V3JpdGVSZXF1ZXN0JiZ2b2lkIDA9PT1lLl9pbkZsaWdodENsb3NlUmVxdWVzdClyZXR1cm4hMTtyZXR1cm4hMH0oZSkmJnIuX3N0YXJ0ZWQmJlB0KGUpfWZ1bmN0aW9uIFB0KGUpe2UuX3N0YXRlPVwiZXJyb3JlZFwiLGUuX3dyaXRhYmxlU3RyZWFtQ29udHJvbGxlcltSXSgpO2NvbnN0IHQ9ZS5fc3RvcmVkRXJyb3I7aWYoZS5fd3JpdGVSZXF1ZXN0cy5mb3JFYWNoKGU9PntlLl9yZWplY3QodCl9KSxlLl93cml0ZVJlcXVlc3RzPW5ldyB2LHZvaWQgMD09PWUuX3BlbmRpbmdBYm9ydFJlcXVlc3QpcmV0dXJuIHZvaWQgRXQoZSk7Y29uc3Qgcj1lLl9wZW5kaW5nQWJvcnRSZXF1ZXN0O2lmKGUuX3BlbmRpbmdBYm9ydFJlcXVlc3Q9dm9pZCAwLHIuX3dhc0FscmVhZHlFcnJvcmluZylyZXR1cm4gci5fcmVqZWN0KHQpLHZvaWQgRXQoZSk7YihlLl93cml0YWJsZVN0cmVhbUNvbnRyb2xsZXJbd10oci5fcmVhc29uKSwoKT0+KHIuX3Jlc29sdmUoKSxFdChlKSxudWxsKSx0PT4oci5fcmVqZWN0KHQpLEV0KGUpLG51bGwpKX1mdW5jdGlvbiBxdChlKXtyZXR1cm4gdm9pZCAwIT09ZS5fY2xvc2VSZXF1ZXN0fHx2b2lkIDAhPT1lLl9pbkZsaWdodENsb3NlUmVxdWVzdH1mdW5jdGlvbiBFdChlKXt2b2lkIDAhPT1lLl9jbG9zZVJlcXVlc3QmJihlLl9jbG9zZVJlcXVlc3QuX3JlamVjdChlLl9zdG9yZWRFcnJvciksZS5fY2xvc2VSZXF1ZXN0PXZvaWQgMCk7Y29uc3QgdD1lLl93cml0ZXI7dm9pZCAwIT09dCYmSnQodCxlLl9zdG9yZWRFcnJvcil9ZnVuY3Rpb24gV3QoZSx0KXtjb25zdCByPWUuX3dyaXRlcjt2b2lkIDAhPT1yJiZ0IT09ZS5fYmFja3ByZXNzdXJlJiYodD9mdW5jdGlvbihlKXtadChlKX0ocik6b3IocikpLGUuX2JhY2twcmVzc3VyZT10fU9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFdyaXRhYmxlU3RyZWFtLnByb3RvdHlwZSx7YWJvcnQ6e2VudW1lcmFibGU6ITB9LGNsb3NlOntlbnVtZXJhYmxlOiEwfSxnZXRXcml0ZXI6e2VudW1lcmFibGU6ITB9LGxvY2tlZDp7ZW51bWVyYWJsZTohMH19KSxvKFdyaXRhYmxlU3RyZWFtLnByb3RvdHlwZS5hYm9ydCxcImFib3J0XCIpLG8oV3JpdGFibGVTdHJlYW0ucHJvdG90eXBlLmNsb3NlLFwiY2xvc2VcIiksbyhXcml0YWJsZVN0cmVhbS5wcm90b3R5cGUuZ2V0V3JpdGVyLFwiZ2V0V3JpdGVyXCIpLFwic3ltYm9sXCI9PXR5cGVvZiBTeW1ib2wudG9TdHJpbmdUYWcmJk9iamVjdC5kZWZpbmVQcm9wZXJ0eShXcml0YWJsZVN0cmVhbS5wcm90b3R5cGUsU3ltYm9sLnRvU3RyaW5nVGFnLHt2YWx1ZTpcIldyaXRhYmxlU3RyZWFtXCIsY29uZmlndXJhYmxlOiEwfSk7Y2xhc3MgV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVye2NvbnN0cnVjdG9yKGUpe2lmKCQoZSwxLFwiV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVyXCIpLHB0KGUsXCJGaXJzdCBwYXJhbWV0ZXJcIiksdnQoZSkpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoaXMgc3RyZWFtIGhhcyBhbHJlYWR5IGJlZW4gbG9ja2VkIGZvciBleGNsdXNpdmUgd3JpdGluZyBieSBhbm90aGVyIHdyaXRlclwiKTt0aGlzLl9vd25lcldyaXRhYmxlU3RyZWFtPWUsZS5fd3JpdGVyPXRoaXM7Y29uc3QgdD1lLl9zdGF0ZTtpZihcIndyaXRhYmxlXCI9PT10KSFxdChlKSYmZS5fYmFja3ByZXNzdXJlP1p0KHRoaXMpOnRyKHRoaXMpLEd0KHRoaXMpO2Vsc2UgaWYoXCJlcnJvcmluZ1wiPT09dCllcih0aGlzLGUuX3N0b3JlZEVycm9yKSxHdCh0aGlzKTtlbHNlIGlmKFwiY2xvc2VkXCI9PT10KXRyKHRoaXMpLEd0KHI9dGhpcyksS3Qocik7ZWxzZXtjb25zdCB0PWUuX3N0b3JlZEVycm9yO2VyKHRoaXMsdCksWHQodGhpcyx0KX12YXIgcn1nZXQgY2xvc2VkKCl7cmV0dXJuIE90KHRoaXMpP3RoaXMuX2Nsb3NlZFByb21pc2U6ZChWdChcImNsb3NlZFwiKSl9Z2V0IGRlc2lyZWRTaXplKCl7aWYoIU90KHRoaXMpKXRocm93IFZ0KFwiZGVzaXJlZFNpemVcIik7aWYodm9pZCAwPT09dGhpcy5fb3duZXJXcml0YWJsZVN0cmVhbSl0aHJvdyBVdChcImRlc2lyZWRTaXplXCIpO3JldHVybiBmdW5jdGlvbihlKXtjb25zdCB0PWUuX293bmVyV3JpdGFibGVTdHJlYW0scj10Ll9zdGF0ZTtpZihcImVycm9yZWRcIj09PXJ8fFwiZXJyb3JpbmdcIj09PXIpcmV0dXJuIG51bGw7aWYoXCJjbG9zZWRcIj09PXIpcmV0dXJuIDA7cmV0dXJuICR0KHQuX3dyaXRhYmxlU3RyZWFtQ29udHJvbGxlcil9KHRoaXMpfWdldCByZWFkeSgpe3JldHVybiBPdCh0aGlzKT90aGlzLl9yZWFkeVByb21pc2U6ZChWdChcInJlYWR5XCIpKX1hYm9ydChlPXZvaWQgMCl7cmV0dXJuIE90KHRoaXMpP3ZvaWQgMD09PXRoaXMuX293bmVyV3JpdGFibGVTdHJlYW0/ZChVdChcImFib3J0XCIpKTpmdW5jdGlvbihlLHQpe3JldHVybiB3dChlLl9vd25lcldyaXRhYmxlU3RyZWFtLHQpfSh0aGlzLGUpOmQoVnQoXCJhYm9ydFwiKSl9Y2xvc2UoKXtpZighT3QodGhpcykpcmV0dXJuIGQoVnQoXCJjbG9zZVwiKSk7Y29uc3QgZT10aGlzLl9vd25lcldyaXRhYmxlU3RyZWFtO3JldHVybiB2b2lkIDA9PT1lP2QoVXQoXCJjbG9zZVwiKSk6cXQoZSk/ZChuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNsb3NlIGFuIGFscmVhZHktY2xvc2luZyBzdHJlYW1cIikpOkJ0KHRoaXMpfXJlbGVhc2VMb2NrKCl7aWYoIU90KHRoaXMpKXRocm93IFZ0KFwicmVsZWFzZUxvY2tcIik7dm9pZCAwIT09dGhpcy5fb3duZXJXcml0YWJsZVN0cmVhbSYmQXQodGhpcyl9d3JpdGUoZT12b2lkIDApe3JldHVybiBPdCh0aGlzKT92b2lkIDA9PT10aGlzLl9vd25lcldyaXRhYmxlU3RyZWFtP2QoVXQoXCJ3cml0ZSB0b1wiKSk6enQodGhpcyxlKTpkKFZ0KFwid3JpdGVcIikpfX1mdW5jdGlvbiBPdChlKXtyZXR1cm4hIXQoZSkmJighIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChlLFwiX293bmVyV3JpdGFibGVTdHJlYW1cIikmJmUgaW5zdGFuY2VvZiBXcml0YWJsZVN0cmVhbURlZmF1bHRXcml0ZXIpfWZ1bmN0aW9uIEJ0KGUpe3JldHVybiBSdChlLl9vd25lcldyaXRhYmxlU3RyZWFtKX1mdW5jdGlvbiBrdChlLHQpe1wicGVuZGluZ1wiPT09ZS5fY2xvc2VkUHJvbWlzZVN0YXRlP0p0KGUsdCk6ZnVuY3Rpb24oZSx0KXtYdChlLHQpfShlLHQpfWZ1bmN0aW9uIGp0KGUsdCl7XCJwZW5kaW5nXCI9PT1lLl9yZWFkeVByb21pc2VTdGF0ZT9ycihlLHQpOmZ1bmN0aW9uKGUsdCl7ZXIoZSx0KX0oZSx0KX1mdW5jdGlvbiBBdChlKXtjb25zdCB0PWUuX293bmVyV3JpdGFibGVTdHJlYW0scj1uZXcgVHlwZUVycm9yKFwiV3JpdGVyIHdhcyByZWxlYXNlZCBhbmQgY2FuIG5vIGxvbmdlciBiZSB1c2VkIHRvIG1vbml0b3IgdGhlIHN0cmVhbSdzIGNsb3NlZG5lc3NcIik7anQoZSxyKSxrdChlLHIpLHQuX3dyaXRlcj12b2lkIDAsZS5fb3duZXJXcml0YWJsZVN0cmVhbT12b2lkIDB9ZnVuY3Rpb24genQoZSx0KXtjb25zdCByPWUuX293bmVyV3JpdGFibGVTdHJlYW0sbz1yLl93cml0YWJsZVN0cmVhbUNvbnRyb2xsZXIsbj1mdW5jdGlvbihlLHQpe2lmKHZvaWQgMD09PWUuX3N0cmF0ZWd5U2l6ZUFsZ29yaXRobSlyZXR1cm4gMTt0cnl7cmV0dXJuIGUuX3N0cmF0ZWd5U2l6ZUFsZ29yaXRobSh0KX1jYXRjaCh0KXtyZXR1cm4gWXQoZSx0KSwxfX0obyx0KTtpZihyIT09ZS5fb3duZXJXcml0YWJsZVN0cmVhbSlyZXR1cm4gZChVdChcIndyaXRlIHRvXCIpKTtjb25zdCBhPXIuX3N0YXRlO2lmKFwiZXJyb3JlZFwiPT09YSlyZXR1cm4gZChyLl9zdG9yZWRFcnJvcik7aWYocXQocil8fFwiY2xvc2VkXCI9PT1hKXJldHVybiBkKG5ldyBUeXBlRXJyb3IoXCJUaGUgc3RyZWFtIGlzIGNsb3Npbmcgb3IgY2xvc2VkIGFuZCBjYW5ub3QgYmUgd3JpdHRlbiB0b1wiKSk7aWYoXCJlcnJvcmluZ1wiPT09YSlyZXR1cm4gZChyLl9zdG9yZWRFcnJvcik7Y29uc3QgaT1mdW5jdGlvbihlKXtyZXR1cm4gdSgodCxyKT0+e2NvbnN0IG89e19yZXNvbHZlOnQsX3JlamVjdDpyfTtlLl93cml0ZVJlcXVlc3RzLnB1c2gobyl9KX0ocik7cmV0dXJuIGZ1bmN0aW9uKGUsdCxyKXt0cnl7dmUoZSx0LHIpfWNhdGNoKHQpe3JldHVybiB2b2lkIFl0KGUsdCl9Y29uc3Qgbz1lLl9jb250cm9sbGVkV3JpdGFibGVTdHJlYW07aWYoIXF0KG8pJiZcIndyaXRhYmxlXCI9PT1vLl9zdGF0ZSl7V3Qobyx4dChlKSl9TXQoZSl9KG8sdCxuKSxpfU9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlci5wcm90b3R5cGUse2Fib3J0OntlbnVtZXJhYmxlOiEwfSxjbG9zZTp7ZW51bWVyYWJsZTohMH0scmVsZWFzZUxvY2s6e2VudW1lcmFibGU6ITB9LHdyaXRlOntlbnVtZXJhYmxlOiEwfSxjbG9zZWQ6e2VudW1lcmFibGU6ITB9LGRlc2lyZWRTaXplOntlbnVtZXJhYmxlOiEwfSxyZWFkeTp7ZW51bWVyYWJsZTohMH19KSxvKFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlci5wcm90b3R5cGUuYWJvcnQsXCJhYm9ydFwiKSxvKFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlci5wcm90b3R5cGUuY2xvc2UsXCJjbG9zZVwiKSxvKFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlci5wcm90b3R5cGUucmVsZWFzZUxvY2ssXCJyZWxlYXNlTG9ja1wiKSxvKFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlci5wcm90b3R5cGUud3JpdGUsXCJ3cml0ZVwiKSxcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLnRvU3RyaW5nVGFnJiZPYmplY3QuZGVmaW5lUHJvcGVydHkoV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVyLnByb3RvdHlwZSxTeW1ib2wudG9TdHJpbmdUYWcse3ZhbHVlOlwiV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVyXCIsY29uZmlndXJhYmxlOiEwfSk7Y29uc3QgRHQ9e307Y2xhc3MgV3JpdGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlcntjb25zdHJ1Y3Rvcigpe3Rocm93IG5ldyBUeXBlRXJyb3IoXCJJbGxlZ2FsIGNvbnN0cnVjdG9yXCIpfWdldCBhYm9ydFJlYXNvbigpe2lmKCFMdCh0aGlzKSl0aHJvdyBIdChcImFib3J0UmVhc29uXCIpO3JldHVybiB0aGlzLl9hYm9ydFJlYXNvbn1nZXQgc2lnbmFsKCl7aWYoIUx0KHRoaXMpKXRocm93IEh0KFwic2lnbmFsXCIpO2lmKHZvaWQgMD09PXRoaXMuX2Fib3J0Q29udHJvbGxlcil0aHJvdyBuZXcgVHlwZUVycm9yKFwiV3JpdGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlci5wcm90b3R5cGUuc2lnbmFsIGlzIG5vdCBzdXBwb3J0ZWRcIik7cmV0dXJuIHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWx9ZXJyb3IoZT12b2lkIDApe2lmKCFMdCh0aGlzKSl0aHJvdyBIdChcImVycm9yXCIpO1wid3JpdGFibGVcIj09PXRoaXMuX2NvbnRyb2xsZWRXcml0YWJsZVN0cmVhbS5fc3RhdGUmJlF0KHRoaXMsZSl9W3ddKGUpe2NvbnN0IHQ9dGhpcy5fYWJvcnRBbGdvcml0aG0oZSk7cmV0dXJuIEl0KHRoaXMpLHR9W1JdKCl7d2UodGhpcyl9fWZ1bmN0aW9uIEx0KGUpe3JldHVybiEhdChlKSYmKCEhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGUsXCJfY29udHJvbGxlZFdyaXRhYmxlU3RyZWFtXCIpJiZlIGluc3RhbmNlb2YgV3JpdGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlcil9ZnVuY3Rpb24gRnQoZSx0LHIsbyxuLGEsaSxsKXt0Ll9jb250cm9sbGVkV3JpdGFibGVTdHJlYW09ZSxlLl93cml0YWJsZVN0cmVhbUNvbnRyb2xsZXI9dCx0Ll9xdWV1ZT12b2lkIDAsdC5fcXVldWVUb3RhbFNpemU9dm9pZCAwLHdlKHQpLHQuX2Fib3J0UmVhc29uPXZvaWQgMCx0Ll9hYm9ydENvbnRyb2xsZXI9ZnVuY3Rpb24oKXtpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBBYm9ydENvbnRyb2xsZXIpcmV0dXJuIG5ldyBBYm9ydENvbnRyb2xsZXJ9KCksdC5fc3RhcnRlZD0hMSx0Ll9zdHJhdGVneVNpemVBbGdvcml0aG09bCx0Ll9zdHJhdGVneUhXTT1pLHQuX3dyaXRlQWxnb3JpdGhtPW8sdC5fY2xvc2VBbGdvcml0aG09bix0Ll9hYm9ydEFsZ29yaXRobT1hO2NvbnN0IHM9eHQodCk7V3QoZSxzKTtiKGMocigpKSwoKT0+KHQuX3N0YXJ0ZWQ9ITAsTXQodCksbnVsbCkscj0+KHQuX3N0YXJ0ZWQ9ITAsVHQoZSxyKSxudWxsKSl9ZnVuY3Rpb24gSXQoZSl7ZS5fd3JpdGVBbGdvcml0aG09dm9pZCAwLGUuX2Nsb3NlQWxnb3JpdGhtPXZvaWQgMCxlLl9hYm9ydEFsZ29yaXRobT12b2lkIDAsZS5fc3RyYXRlZ3lTaXplQWxnb3JpdGhtPXZvaWQgMH1mdW5jdGlvbiAkdChlKXtyZXR1cm4gZS5fc3RyYXRlZ3lIV00tZS5fcXVldWVUb3RhbFNpemV9ZnVuY3Rpb24gTXQoZSl7Y29uc3QgdD1lLl9jb250cm9sbGVkV3JpdGFibGVTdHJlYW07aWYoIWUuX3N0YXJ0ZWQpcmV0dXJuO2lmKHZvaWQgMCE9PXQuX2luRmxpZ2h0V3JpdGVSZXF1ZXN0KXJldHVybjtpZihcImVycm9yaW5nXCI9PT10Ll9zdGF0ZSlyZXR1cm4gdm9pZCBQdCh0KTtpZigwPT09ZS5fcXVldWUubGVuZ3RoKXJldHVybjtjb25zdCByPWUuX3F1ZXVlLnBlZWsoKS52YWx1ZTtyPT09RHQ/ZnVuY3Rpb24oZSl7Y29uc3QgdD1lLl9jb250cm9sbGVkV3JpdGFibGVTdHJlYW07KGZ1bmN0aW9uKGUpe2UuX2luRmxpZ2h0Q2xvc2VSZXF1ZXN0PWUuX2Nsb3NlUmVxdWVzdCxlLl9jbG9zZVJlcXVlc3Q9dm9pZCAwfSkodCksZ2UoZSk7Y29uc3Qgcj1lLl9jbG9zZUFsZ29yaXRobSgpO0l0KGUpLGIociwoKT0+KGZ1bmN0aW9uKGUpe2UuX2luRmxpZ2h0Q2xvc2VSZXF1ZXN0Ll9yZXNvbHZlKHZvaWQgMCksZS5faW5GbGlnaHRDbG9zZVJlcXVlc3Q9dm9pZCAwLFwiZXJyb3JpbmdcIj09PWUuX3N0YXRlJiYoZS5fc3RvcmVkRXJyb3I9dm9pZCAwLHZvaWQgMCE9PWUuX3BlbmRpbmdBYm9ydFJlcXVlc3QmJihlLl9wZW5kaW5nQWJvcnRSZXF1ZXN0Ll9yZXNvbHZlKCksZS5fcGVuZGluZ0Fib3J0UmVxdWVzdD12b2lkIDApKSxlLl9zdGF0ZT1cImNsb3NlZFwiO2NvbnN0IHQ9ZS5fd3JpdGVyO3ZvaWQgMCE9PXQmJkt0KHQpfSh0KSxudWxsKSxlPT4oZnVuY3Rpb24oZSx0KXtlLl9pbkZsaWdodENsb3NlUmVxdWVzdC5fcmVqZWN0KHQpLGUuX2luRmxpZ2h0Q2xvc2VSZXF1ZXN0PXZvaWQgMCx2b2lkIDAhPT1lLl9wZW5kaW5nQWJvcnRSZXF1ZXN0JiYoZS5fcGVuZGluZ0Fib3J0UmVxdWVzdC5fcmVqZWN0KHQpLGUuX3BlbmRpbmdBYm9ydFJlcXVlc3Q9dm9pZCAwKSxUdChlLHQpfSh0LGUpLG51bGwpKX0oZSk6ZnVuY3Rpb24oZSx0KXtjb25zdCByPWUuX2NvbnRyb2xsZWRXcml0YWJsZVN0cmVhbTshZnVuY3Rpb24oZSl7ZS5faW5GbGlnaHRXcml0ZVJlcXVlc3Q9ZS5fd3JpdGVSZXF1ZXN0cy5zaGlmdCgpfShyKTtjb25zdCBvPWUuX3dyaXRlQWxnb3JpdGhtKHQpO2IobywoKT0+eyFmdW5jdGlvbihlKXtlLl9pbkZsaWdodFdyaXRlUmVxdWVzdC5fcmVzb2x2ZSh2b2lkIDApLGUuX2luRmxpZ2h0V3JpdGVSZXF1ZXN0PXZvaWQgMH0ocik7Y29uc3QgdD1yLl9zdGF0ZTtpZihnZShlKSwhcXQocikmJlwid3JpdGFibGVcIj09PXQpe2NvbnN0IHQ9eHQoZSk7V3Qocix0KX1yZXR1cm4gTXQoZSksbnVsbH0sdD0+KFwid3JpdGFibGVcIj09PXIuX3N0YXRlJiZJdChlKSxmdW5jdGlvbihlLHQpe2UuX2luRmxpZ2h0V3JpdGVSZXF1ZXN0Ll9yZWplY3QodCksZS5faW5GbGlnaHRXcml0ZVJlcXVlc3Q9dm9pZCAwLFR0KGUsdCl9KHIsdCksbnVsbCkpfShlLHIpfWZ1bmN0aW9uIFl0KGUsdCl7XCJ3cml0YWJsZVwiPT09ZS5fY29udHJvbGxlZFdyaXRhYmxlU3RyZWFtLl9zdGF0ZSYmUXQoZSx0KX1mdW5jdGlvbiB4dChlKXtyZXR1cm4gJHQoZSk8PTB9ZnVuY3Rpb24gUXQoZSx0KXtjb25zdCByPWUuX2NvbnRyb2xsZWRXcml0YWJsZVN0cmVhbTtJdChlKSxDdChyLHQpfWZ1bmN0aW9uIE50KGUpe3JldHVybiBuZXcgVHlwZUVycm9yKGBXcml0YWJsZVN0cmVhbS5wcm90b3R5cGUuJHtlfSBjYW4gb25seSBiZSB1c2VkIG9uIGEgV3JpdGFibGVTdHJlYW1gKX1mdW5jdGlvbiBIdChlKXtyZXR1cm4gbmV3IFR5cGVFcnJvcihgV3JpdGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlci5wcm90b3R5cGUuJHtlfSBjYW4gb25seSBiZSB1c2VkIG9uIGEgV3JpdGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlcmApfWZ1bmN0aW9uIFZ0KGUpe3JldHVybiBuZXcgVHlwZUVycm9yKGBXcml0YWJsZVN0cmVhbURlZmF1bHRXcml0ZXIucHJvdG90eXBlLiR7ZX0gY2FuIG9ubHkgYmUgdXNlZCBvbiBhIFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlcmApfWZ1bmN0aW9uIFV0KGUpe3JldHVybiBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IFwiK2UrXCIgYSBzdHJlYW0gdXNpbmcgYSByZWxlYXNlZCB3cml0ZXJcIil9ZnVuY3Rpb24gR3QoZSl7ZS5fY2xvc2VkUHJvbWlzZT11KCh0LHIpPT57ZS5fY2xvc2VkUHJvbWlzZV9yZXNvbHZlPXQsZS5fY2xvc2VkUHJvbWlzZV9yZWplY3Q9cixlLl9jbG9zZWRQcm9taXNlU3RhdGU9XCJwZW5kaW5nXCJ9KX1mdW5jdGlvbiBYdChlLHQpe0d0KGUpLEp0KGUsdCl9ZnVuY3Rpb24gSnQoZSx0KXt2b2lkIDAhPT1lLl9jbG9zZWRQcm9taXNlX3JlamVjdCYmKHAoZS5fY2xvc2VkUHJvbWlzZSksZS5fY2xvc2VkUHJvbWlzZV9yZWplY3QodCksZS5fY2xvc2VkUHJvbWlzZV9yZXNvbHZlPXZvaWQgMCxlLl9jbG9zZWRQcm9taXNlX3JlamVjdD12b2lkIDAsZS5fY2xvc2VkUHJvbWlzZVN0YXRlPVwicmVqZWN0ZWRcIil9ZnVuY3Rpb24gS3QoZSl7dm9pZCAwIT09ZS5fY2xvc2VkUHJvbWlzZV9yZXNvbHZlJiYoZS5fY2xvc2VkUHJvbWlzZV9yZXNvbHZlKHZvaWQgMCksZS5fY2xvc2VkUHJvbWlzZV9yZXNvbHZlPXZvaWQgMCxlLl9jbG9zZWRQcm9taXNlX3JlamVjdD12b2lkIDAsZS5fY2xvc2VkUHJvbWlzZVN0YXRlPVwicmVzb2x2ZWRcIil9ZnVuY3Rpb24gWnQoZSl7ZS5fcmVhZHlQcm9taXNlPXUoKHQscik9PntlLl9yZWFkeVByb21pc2VfcmVzb2x2ZT10LGUuX3JlYWR5UHJvbWlzZV9yZWplY3Q9cn0pLGUuX3JlYWR5UHJvbWlzZVN0YXRlPVwicGVuZGluZ1wifWZ1bmN0aW9uIGVyKGUsdCl7WnQoZSkscnIoZSx0KX1mdW5jdGlvbiB0cihlKXtadChlKSxvcihlKX1mdW5jdGlvbiBycihlLHQpe3ZvaWQgMCE9PWUuX3JlYWR5UHJvbWlzZV9yZWplY3QmJihwKGUuX3JlYWR5UHJvbWlzZSksZS5fcmVhZHlQcm9taXNlX3JlamVjdCh0KSxlLl9yZWFkeVByb21pc2VfcmVzb2x2ZT12b2lkIDAsZS5fcmVhZHlQcm9taXNlX3JlamVjdD12b2lkIDAsZS5fcmVhZHlQcm9taXNlU3RhdGU9XCJyZWplY3RlZFwiKX1mdW5jdGlvbiBvcihlKXt2b2lkIDAhPT1lLl9yZWFkeVByb21pc2VfcmVzb2x2ZSYmKGUuX3JlYWR5UHJvbWlzZV9yZXNvbHZlKHZvaWQgMCksZS5fcmVhZHlQcm9taXNlX3Jlc29sdmU9dm9pZCAwLGUuX3JlYWR5UHJvbWlzZV9yZWplY3Q9dm9pZCAwLGUuX3JlYWR5UHJvbWlzZVN0YXRlPVwiZnVsZmlsbGVkXCIpfU9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFdyaXRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXIucHJvdG90eXBlLHthYm9ydFJlYXNvbjp7ZW51bWVyYWJsZTohMH0sc2lnbmFsOntlbnVtZXJhYmxlOiEwfSxlcnJvcjp7ZW51bWVyYWJsZTohMH19KSxcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLnRvU3RyaW5nVGFnJiZPYmplY3QuZGVmaW5lUHJvcGVydHkoV3JpdGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlci5wcm90b3R5cGUsU3ltYm9sLnRvU3RyaW5nVGFnLHt2YWx1ZTpcIldyaXRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXJcIixjb25maWd1cmFibGU6ITB9KTtjb25zdCBucj1cInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsVGhpcz9nbG9iYWxUaGlzOlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmP3NlbGY6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9nbG9iYWw6dm9pZCAwO2NvbnN0IGFyPWZ1bmN0aW9uKCl7Y29uc3QgZT1udWxsPT1ucj92b2lkIDA6bnIuRE9NRXhjZXB0aW9uO3JldHVybiBmdW5jdGlvbihlKXtpZihcImZ1bmN0aW9uXCIhPXR5cGVvZiBlJiZcIm9iamVjdFwiIT10eXBlb2YgZSlyZXR1cm4hMTtpZihcIkRPTUV4Y2VwdGlvblwiIT09ZS5uYW1lKXJldHVybiExO3RyeXtyZXR1cm4gbmV3IGUsITB9Y2F0Y2goZSl7cmV0dXJuITF9fShlKT9lOnZvaWQgMH0oKXx8ZnVuY3Rpb24oKXtjb25zdCBlPWZ1bmN0aW9uKGUsdCl7dGhpcy5tZXNzYWdlPWV8fFwiXCIsdGhpcy5uYW1lPXR8fFwiRXJyb3JcIixFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSYmRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcyx0aGlzLmNvbnN0cnVjdG9yKX07cmV0dXJuIG8oZSxcIkRPTUV4Y2VwdGlvblwiKSxlLnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSksT2JqZWN0LmRlZmluZVByb3BlcnR5KGUucHJvdG90eXBlLFwiY29uc3RydWN0b3JcIix7dmFsdWU6ZSx3cml0YWJsZTohMCxjb25maWd1cmFibGU6ITB9KSxlfSgpO2Z1bmN0aW9uIGlyKHQscixvLG4sYSxpKXtjb25zdCBsPUgodCkscz15dChyKTt0Ll9kaXN0dXJiZWQ9ITA7bGV0IF89ITEseT1jKHZvaWQgMCk7cmV0dXJuIHUoKFMsZyk9PntsZXQgdjtpZih2b2lkIDAhPT1pKXtpZih2PSgpPT57Y29uc3QgZT12b2lkIDAhPT1pLnJlYXNvbj9pLnJlYXNvbjpuZXcgYXIoXCJBYm9ydGVkXCIsXCJBYm9ydEVycm9yXCIpLG89W107bnx8by5wdXNoKCgpPT5cIndyaXRhYmxlXCI9PT1yLl9zdGF0ZT93dChyLGUpOmModm9pZCAwKSksYXx8by5wdXNoKCgpPT5cInJlYWRhYmxlXCI9PT10Ll9zdGF0ZT9Pcih0LGUpOmModm9pZCAwKSkscSgoKT0+UHJvbWlzZS5hbGwoby5tYXAoZT0+ZSgpKSksITAsZSl9LGkuYWJvcnRlZClyZXR1cm4gdm9pZCB2KCk7aS5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIix2KX12YXIgdyxSLFQ7aWYoUCh0LGwuX2Nsb3NlZFByb21pc2UsZT0+KG4/RSghMCxlKTpxKCgpPT53dChyLGUpLCEwLGUpLG51bGwpKSxQKHIscy5fY2xvc2VkUHJvbWlzZSxlPT4oYT9FKCEwLGUpOnEoKCk9Pk9yKHQsZSksITAsZSksbnVsbCkpLHc9dCxSPWwuX2Nsb3NlZFByb21pc2UsVD0oKT0+KG8/RSgpOnEoKCk9PmZ1bmN0aW9uKGUpe2NvbnN0IHQ9ZS5fb3duZXJXcml0YWJsZVN0cmVhbSxyPXQuX3N0YXRlO3JldHVybiBxdCh0KXx8XCJjbG9zZWRcIj09PXI/Yyh2b2lkIDApOlwiZXJyb3JlZFwiPT09cj9kKHQuX3N0b3JlZEVycm9yKTpCdChlKX0ocykpLG51bGwpLFwiY2xvc2VkXCI9PT13Ll9zdGF0ZT9UKCk6aChSLFQpLHF0KHIpfHxcImNsb3NlZFwiPT09ci5fc3RhdGUpe2NvbnN0IGU9bmV3IFR5cGVFcnJvcihcInRoZSBkZXN0aW5hdGlvbiB3cml0YWJsZSBzdHJlYW0gY2xvc2VkIGJlZm9yZSBhbGwgZGF0YSBjb3VsZCBiZSBwaXBlZCB0byBpdFwiKTthP0UoITAsZSk6cSgoKT0+T3IodCxlKSwhMCxlKX1mdW5jdGlvbiBDKCl7Y29uc3QgZT15O3JldHVybiBmKHksKCk9PmUhPT15P0MoKTp2b2lkIDApfWZ1bmN0aW9uIFAoZSx0LHIpe1wiZXJyb3JlZFwiPT09ZS5fc3RhdGU/cihlLl9zdG9yZWRFcnJvcik6bSh0LHIpfWZ1bmN0aW9uIHEoZSx0LG8pe2Z1bmN0aW9uIG4oKXtyZXR1cm4gYihlKCksKCk9Pk8odCxvKSxlPT5PKCEwLGUpKSxudWxsfV98fChfPSEwLFwid3JpdGFibGVcIiE9PXIuX3N0YXRlfHxxdChyKT9uKCk6aChDKCksbikpfWZ1bmN0aW9uIEUoZSx0KXtffHwoXz0hMCxcIndyaXRhYmxlXCIhPT1yLl9zdGF0ZXx8cXQocik/TyhlLHQpOmgoQygpLCgpPT5PKGUsdCkpKX1mdW5jdGlvbiBPKGUsdCl7cmV0dXJuIEF0KHMpLFcobCksdm9pZCAwIT09aSYmaS5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIix2KSxlP2codCk6Uyh2b2lkIDApLG51bGx9cCh1KCh0LHIpPT57IWZ1bmN0aW9uIG8obil7bj90KCk6ZihfP2MoITApOmYocy5fcmVhZHlQcm9taXNlLCgpPT51KCh0LHIpPT57SyhsLHtfY2h1bmtTdGVwczpyPT57eT1mKHp0KHMsciksdm9pZCAwLGUpLHQoITEpfSxfY2xvc2VTdGVwczooKT0+dCghMCksX2Vycm9yU3RlcHM6cn0pfSkpLG8scil9KCExKX0pKX0pfWNsYXNzIFJlYWRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXJ7Y29uc3RydWN0b3IoKXt0aHJvdyBuZXcgVHlwZUVycm9yKFwiSWxsZWdhbCBjb25zdHJ1Y3RvclwiKX1nZXQgZGVzaXJlZFNpemUoKXtpZighbHIodGhpcykpdGhyb3cgcHIoXCJkZXNpcmVkU2l6ZVwiKTtyZXR1cm4gaHIodGhpcyl9Y2xvc2UoKXtpZighbHIodGhpcykpdGhyb3cgcHIoXCJjbG9zZVwiKTtpZighbXIodGhpcykpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBzdHJlYW0gaXMgbm90IGluIGEgc3RhdGUgdGhhdCBwZXJtaXRzIGNsb3NlXCIpO2RyKHRoaXMpfWVucXVldWUoZT12b2lkIDApe2lmKCFscih0aGlzKSl0aHJvdyBwcihcImVucXVldWVcIik7aWYoIW1yKHRoaXMpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJUaGUgc3RyZWFtIGlzIG5vdCBpbiBhIHN0YXRlIHRoYXQgcGVybWl0cyBlbnF1ZXVlXCIpO3JldHVybiBmcih0aGlzLGUpfWVycm9yKGU9dm9pZCAwKXtpZighbHIodGhpcykpdGhyb3cgcHIoXCJlcnJvclwiKTticih0aGlzLGUpfVtUXShlKXt3ZSh0aGlzKTtjb25zdCB0PXRoaXMuX2NhbmNlbEFsZ29yaXRobShlKTtyZXR1cm4gY3IodGhpcyksdH1bQ10oZSl7Y29uc3QgdD10aGlzLl9jb250cm9sbGVkUmVhZGFibGVTdHJlYW07aWYodGhpcy5fcXVldWUubGVuZ3RoPjApe2NvbnN0IHI9Z2UodGhpcyk7dGhpcy5fY2xvc2VSZXF1ZXN0ZWQmJjA9PT10aGlzLl9xdWV1ZS5sZW5ndGg/KGNyKHRoaXMpLEJyKHQpKTpzcih0aGlzKSxlLl9jaHVua1N0ZXBzKHIpfWVsc2UgVih0LGUpLHNyKHRoaXMpfVtQXSgpe319ZnVuY3Rpb24gbHIoZSl7cmV0dXJuISF0KGUpJiYoISFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxcIl9jb250cm9sbGVkUmVhZGFibGVTdHJlYW1cIikmJmUgaW5zdGFuY2VvZiBSZWFkYWJsZVN0cmVhbURlZmF1bHRDb250cm9sbGVyKX1mdW5jdGlvbiBzcihlKXtpZighdXIoZSkpcmV0dXJuO2lmKGUuX3B1bGxpbmcpcmV0dXJuIHZvaWQoZS5fcHVsbEFnYWluPSEwKTtlLl9wdWxsaW5nPSEwO2IoZS5fcHVsbEFsZ29yaXRobSgpLCgpPT4oZS5fcHVsbGluZz0hMSxlLl9wdWxsQWdhaW4mJihlLl9wdWxsQWdhaW49ITEsc3IoZSkpLG51bGwpLHQ9PihicihlLHQpLG51bGwpKX1mdW5jdGlvbiB1cihlKXtjb25zdCB0PWUuX2NvbnRyb2xsZWRSZWFkYWJsZVN0cmVhbTtpZighbXIoZSkpcmV0dXJuITE7aWYoIWUuX3N0YXJ0ZWQpcmV0dXJuITE7aWYoV3IodCkmJkcodCk+MClyZXR1cm4hMDtyZXR1cm4gaHIoZSk+MH1mdW5jdGlvbiBjcihlKXtlLl9wdWxsQWxnb3JpdGhtPXZvaWQgMCxlLl9jYW5jZWxBbGdvcml0aG09dm9pZCAwLGUuX3N0cmF0ZWd5U2l6ZUFsZ29yaXRobT12b2lkIDB9ZnVuY3Rpb24gZHIoZSl7aWYoIW1yKGUpKXJldHVybjtjb25zdCB0PWUuX2NvbnRyb2xsZWRSZWFkYWJsZVN0cmVhbTtlLl9jbG9zZVJlcXVlc3RlZD0hMCwwPT09ZS5fcXVldWUubGVuZ3RoJiYoY3IoZSksQnIodCkpfWZ1bmN0aW9uIGZyKGUsdCl7aWYoIW1yKGUpKXJldHVybjtjb25zdCByPWUuX2NvbnRyb2xsZWRSZWFkYWJsZVN0cmVhbTtpZihXcihyKSYmRyhyKT4wKVUocix0LCExKTtlbHNle2xldCByO3RyeXtyPWUuX3N0cmF0ZWd5U2l6ZUFsZ29yaXRobSh0KX1jYXRjaCh0KXt0aHJvdyBicihlLHQpLHR9dHJ5e3ZlKGUsdCxyKX1jYXRjaCh0KXt0aHJvdyBicihlLHQpLHR9fXNyKGUpfWZ1bmN0aW9uIGJyKGUsdCl7Y29uc3Qgcj1lLl9jb250cm9sbGVkUmVhZGFibGVTdHJlYW07XCJyZWFkYWJsZVwiPT09ci5fc3RhdGUmJih3ZShlKSxjcihlKSxrcihyLHQpKX1mdW5jdGlvbiBocihlKXtjb25zdCB0PWUuX2NvbnRyb2xsZWRSZWFkYWJsZVN0cmVhbS5fc3RhdGU7cmV0dXJuXCJlcnJvcmVkXCI9PT10P251bGw6XCJjbG9zZWRcIj09PXQ/MDplLl9zdHJhdGVneUhXTS1lLl9xdWV1ZVRvdGFsU2l6ZX1mdW5jdGlvbiBtcihlKXtjb25zdCB0PWUuX2NvbnRyb2xsZWRSZWFkYWJsZVN0cmVhbS5fc3RhdGU7cmV0dXJuIWUuX2Nsb3NlUmVxdWVzdGVkJiZcInJlYWRhYmxlXCI9PT10fWZ1bmN0aW9uIF9yKGUsdCxyLG8sbixhLGkpe3QuX2NvbnRyb2xsZWRSZWFkYWJsZVN0cmVhbT1lLHQuX3F1ZXVlPXZvaWQgMCx0Ll9xdWV1ZVRvdGFsU2l6ZT12b2lkIDAsd2UodCksdC5fc3RhcnRlZD0hMSx0Ll9jbG9zZVJlcXVlc3RlZD0hMSx0Ll9wdWxsQWdhaW49ITEsdC5fcHVsbGluZz0hMSx0Ll9zdHJhdGVneVNpemVBbGdvcml0aG09aSx0Ll9zdHJhdGVneUhXTT1hLHQuX3B1bGxBbGdvcml0aG09byx0Ll9jYW5jZWxBbGdvcml0aG09bixlLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXI9dDtiKGMocigpKSwoKT0+KHQuX3N0YXJ0ZWQ9ITAsc3IodCksbnVsbCksZT0+KGJyKHQsZSksbnVsbCkpfWZ1bmN0aW9uIHByKGUpe3JldHVybiBuZXcgVHlwZUVycm9yKGBSZWFkYWJsZVN0cmVhbURlZmF1bHRDb250cm9sbGVyLnByb3RvdHlwZS4ke2V9IGNhbiBvbmx5IGJlIHVzZWQgb24gYSBSZWFkYWJsZVN0cmVhbURlZmF1bHRDb250cm9sbGVyYCl9ZnVuY3Rpb24geXIoZSx0KXtyZXR1cm4gVGUoZS5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyKT9mdW5jdGlvbihlKXtsZXQgdCxyLG8sbixhLGk9SChlKSxsPSExLHM9ITEsZD0hMSxmPSExLGI9ITE7Y29uc3QgaD11KGU9PnthPWV9KTtmdW5jdGlvbiBfKGUpe20oZS5fY2xvc2VkUHJvbWlzZSx0PT4oZSE9PWl8fChOZShvLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsdCksTmUobi5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLHQpLGYmJmJ8fGEodm9pZCAwKSksbnVsbCkpfWZ1bmN0aW9uIHAoKXthdChpKSYmKFcoaSksaT1IKGUpLF8oaSkpO0soaSx7X2NodW5rU3RlcHM6dD0+e3koKCk9PntzPSExLGQ9ITE7Y29uc3Qgcj10O2xldCBpPXQ7aWYoIWYmJiFiKXRyeXtpPVNlKHQpfWNhdGNoKHQpe3JldHVybiBOZShvLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsdCksTmUobi5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLHQpLHZvaWQgYShPcihlLHQpKX1mfHxRZShvLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsciksYnx8UWUobi5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLGkpLGw9ITEscz9nKCk6ZCYmdigpfSl9LF9jbG9zZVN0ZXBzOigpPT57bD0hMSxmfHx4ZShvLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIpLGJ8fHhlKG4uX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlciksby5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLl9wZW5kaW5nUHVsbEludG9zLmxlbmd0aD4wJiZHZShvLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsMCksbi5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLl9wZW5kaW5nUHVsbEludG9zLmxlbmd0aD4wJiZHZShuLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsMCksZiYmYnx8YSh2b2lkIDApfSxfZXJyb3JTdGVwczooKT0+e2w9ITF9fSl9ZnVuY3Rpb24gUyh0LHIpe0ooaSkmJihXKGkpLGk9dHQoZSksXyhpKSk7Y29uc3QgdT1yP246byxjPXI/bzpuO2l0KGksdCwxLHtfY2h1bmtTdGVwczp0PT57eSgoKT0+e3M9ITEsZD0hMTtjb25zdCBvPXI/YjpmO2lmKHI/ZjpiKW98fFhlKHUuX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlcix0KTtlbHNle2xldCByO3RyeXtyPVNlKHQpfWNhdGNoKHQpe3JldHVybiBOZSh1Ll9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsdCksTmUoYy5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLHQpLHZvaWQgYShPcihlLHQpKX1vfHxYZSh1Ll9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsdCksUWUoYy5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLHIpfWw9ITEscz9nKCk6ZCYmdigpfSl9LF9jbG9zZVN0ZXBzOmU9PntsPSExO2NvbnN0IHQ9cj9iOmYsbz1yP2Y6Yjt0fHx4ZSh1Ll9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIpLG98fHhlKGMuX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlciksdm9pZCAwIT09ZSYmKHR8fFhlKHUuX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlcixlKSwhbyYmYy5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLl9wZW5kaW5nUHVsbEludG9zLmxlbmd0aD4wJiZHZShjLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsMCkpLHQmJm98fGEodm9pZCAwKX0sX2Vycm9yU3RlcHM6KCk9PntsPSExfX0pfWZ1bmN0aW9uIGcoKXtpZihsKXJldHVybiBzPSEwLGModm9pZCAwKTtsPSEwO2NvbnN0IGU9VmUoby5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyKTtyZXR1cm4gbnVsbD09PWU/cCgpOlMoZS5fdmlldywhMSksYyh2b2lkIDApfWZ1bmN0aW9uIHYoKXtpZihsKXJldHVybiBkPSEwLGModm9pZCAwKTtsPSEwO2NvbnN0IGU9VmUobi5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyKTtyZXR1cm4gbnVsbD09PWU/cCgpOlMoZS5fdmlldywhMCksYyh2b2lkIDApfWZ1bmN0aW9uIHcobyl7aWYoZj0hMCx0PW8sYil7Y29uc3Qgbz1uZShbdCxyXSksbj1PcihlLG8pO2Eobil9cmV0dXJuIGh9ZnVuY3Rpb24gUihvKXtpZihiPSEwLHI9byxmKXtjb25zdCBvPW5lKFt0LHJdKSxuPU9yKGUsbyk7YShuKX1yZXR1cm4gaH1mdW5jdGlvbiBUKCl7fXJldHVybiBvPVByKFQsZyx3KSxuPVByKFQsdixSKSxfKGkpLFtvLG5dfShlKTpmdW5jdGlvbihlKXtjb25zdCB0PUgoZSk7bGV0IHIsbyxuLGEsaSxsPSExLHM9ITEsZD0hMSxmPSExO2NvbnN0IGI9dShlPT57aT1lfSk7ZnVuY3Rpb24gaCgpe2lmKGwpcmV0dXJuIHM9ITAsYyh2b2lkIDApO2w9ITA7cmV0dXJuIEsodCx7X2NodW5rU3RlcHM6ZT0+e3koKCk9PntzPSExO2NvbnN0IHQ9ZSxyPWU7ZHx8ZnIobi5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLHQpLGZ8fGZyKGEuX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlcixyKSxsPSExLHMmJmgoKX0pfSxfY2xvc2VTdGVwczooKT0+e2w9ITEsZHx8ZHIobi5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyKSxmfHxkcihhLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIpLGQmJmZ8fGkodm9pZCAwKX0sX2Vycm9yU3RlcHM6KCk9PntsPSExfX0pLGModm9pZCAwKX1mdW5jdGlvbiBfKHQpe2lmKGQ9ITAscj10LGYpe2NvbnN0IHQ9bmUoW3Isb10pLG49T3IoZSx0KTtpKG4pfXJldHVybiBifWZ1bmN0aW9uIHAodCl7aWYoZj0hMCxvPXQsZCl7Y29uc3QgdD1uZShbcixvXSksbj1PcihlLHQpO2kobil9cmV0dXJuIGJ9ZnVuY3Rpb24gUygpe31yZXR1cm4gbj1DcihTLGgsXyksYT1DcihTLGgscCksbSh0Ll9jbG9zZWRQcm9taXNlLGU9PihicihuLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsZSksYnIoYS5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLGUpLGQmJmZ8fGkodm9pZCAwKSxudWxsKSksW24sYV19KGUpfWZ1bmN0aW9uIFNyKHIpe3JldHVybiB0KG89cikmJnZvaWQgMCE9PW8uZ2V0UmVhZGVyP2Z1bmN0aW9uKHIpe2xldCBvO2Z1bmN0aW9uIG4oKXtsZXQgZTt0cnl7ZT1yLnJlYWQoKX1jYXRjaChlKXtyZXR1cm4gZChlKX1yZXR1cm4gXyhlLGU9PntpZighdChlKSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhlIHByb21pc2UgcmV0dXJuZWQgYnkgdGhlIHJlYWRlci5yZWFkKCkgbWV0aG9kIG11c3QgZnVsZmlsbCB3aXRoIGFuIG9iamVjdFwiKTtpZihlLmRvbmUpZHIoby5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyKTtlbHNle2NvbnN0IHQ9ZS52YWx1ZTtmcihvLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsdCl9fSl9ZnVuY3Rpb24gYShlKXt0cnl7cmV0dXJuIGMoci5jYW5jZWwoZSkpfWNhdGNoKGUpe3JldHVybiBkKGUpfX1yZXR1cm4gbz1DcihlLG4sYSwwKSxvfShyLmdldFJlYWRlcigpKTpmdW5jdGlvbihyKXtsZXQgbztjb25zdCBuPWZlKHIsXCJhc3luY1wiKTtmdW5jdGlvbiBhKCl7bGV0IGU7dHJ5e2U9YmUobil9Y2F0Y2goZSl7cmV0dXJuIGQoZSl9cmV0dXJuIF8oYyhlKSxlPT57aWYoIXQoZSkpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBpdGVyYXRvci5uZXh0KCkgbWV0aG9kIG11c3QgZnVsZmlsbCB3aXRoIGFuIG9iamVjdFwiKTtpZihlLmRvbmUpZHIoby5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyKTtlbHNle2NvbnN0IHQ9ZS52YWx1ZTtmcihvLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsdCl9fSl9ZnVuY3Rpb24gaShlKXtjb25zdCByPW4uaXRlcmF0b3I7bGV0IG87dHJ5e289dWUocixcInJldHVyblwiKX1jYXRjaChlKXtyZXR1cm4gZChlKX1pZih2b2lkIDA9PT1vKXJldHVybiBjKHZvaWQgMCk7cmV0dXJuIF8oZyhvLHIsW2VdKSxlPT57aWYoIXQoZSkpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBpdGVyYXRvci5yZXR1cm4oKSBtZXRob2QgbXVzdCBmdWxmaWxsIHdpdGggYW4gb2JqZWN0XCIpfSl9cmV0dXJuIG89Q3IoZSxhLGksMCksb30ocik7dmFyIG99ZnVuY3Rpb24gZ3IoZSx0LHIpe3JldHVybiBGKGUscikscj0+ZyhlLHQsW3JdKX1mdW5jdGlvbiB2cihlLHQscil7cmV0dXJuIEYoZSxyKSxyPT5nKGUsdCxbcl0pfWZ1bmN0aW9uIHdyKGUsdCxyKXtyZXR1cm4gRihlLHIpLHI9PlMoZSx0LFtyXSl9ZnVuY3Rpb24gUnIoZSx0KXtpZihcImJ5dGVzXCIhPT0oZT1gJHtlfWApKXRocm93IG5ldyBUeXBlRXJyb3IoYCR7dH0gJyR7ZX0nIGlzIG5vdCBhIHZhbGlkIGVudW1lcmF0aW9uIHZhbHVlIGZvciBSZWFkYWJsZVN0cmVhbVR5cGVgKTtyZXR1cm4gZX1mdW5jdGlvbiBUcihlLHQpe0woZSx0KTtjb25zdCByPW51bGw9PWU/dm9pZCAwOmUucHJldmVudEFib3J0LG89bnVsbD09ZT92b2lkIDA6ZS5wcmV2ZW50Q2FuY2VsLG49bnVsbD09ZT92b2lkIDA6ZS5wcmV2ZW50Q2xvc2UsYT1udWxsPT1lP3ZvaWQgMDplLnNpZ25hbDtyZXR1cm4gdm9pZCAwIT09YSYmZnVuY3Rpb24oZSx0KXtpZighZnVuY3Rpb24oZSl7aWYoXCJvYmplY3RcIiE9dHlwZW9mIGV8fG51bGw9PT1lKXJldHVybiExO3RyeXtyZXR1cm5cImJvb2xlYW5cIj09dHlwZW9mIGUuYWJvcnRlZH1jYXRjaChlKXtyZXR1cm4hMX19KGUpKXRocm93IG5ldyBUeXBlRXJyb3IoYCR7dH0gaXMgbm90IGFuIEFib3J0U2lnbmFsLmApfShhLGAke3R9IGhhcyBtZW1iZXIgJ3NpZ25hbCcgdGhhdGApLHtwcmV2ZW50QWJvcnQ6Qm9vbGVhbihyKSxwcmV2ZW50Q2FuY2VsOkJvb2xlYW4obykscHJldmVudENsb3NlOkJvb2xlYW4obiksc2lnbmFsOmF9fU9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFJlYWRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXIucHJvdG90eXBlLHtjbG9zZTp7ZW51bWVyYWJsZTohMH0sZW5xdWV1ZTp7ZW51bWVyYWJsZTohMH0sZXJyb3I6e2VudW1lcmFibGU6ITB9LGRlc2lyZWRTaXplOntlbnVtZXJhYmxlOiEwfX0pLG8oUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlci5wcm90b3R5cGUuY2xvc2UsXCJjbG9zZVwiKSxvKFJlYWRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXIucHJvdG90eXBlLmVucXVldWUsXCJlbnF1ZXVlXCIpLG8oUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlci5wcm90b3R5cGUuZXJyb3IsXCJlcnJvclwiKSxcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLnRvU3RyaW5nVGFnJiZPYmplY3QuZGVmaW5lUHJvcGVydHkoUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlci5wcm90b3R5cGUsU3ltYm9sLnRvU3RyaW5nVGFnLHt2YWx1ZTpcIlJlYWRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXJcIixjb25maWd1cmFibGU6ITB9KTtjbGFzcyBSZWFkYWJsZVN0cmVhbXtjb25zdHJ1Y3RvcihlPXt9LHQ9e30pe3ZvaWQgMD09PWU/ZT1udWxsOkkoZSxcIkZpcnN0IHBhcmFtZXRlclwiKTtjb25zdCByPWR0KHQsXCJTZWNvbmQgcGFyYW1ldGVyXCIpLG89ZnVuY3Rpb24oZSx0KXtMKGUsdCk7Y29uc3Qgcj1lLG89bnVsbD09cj92b2lkIDA6ci5hdXRvQWxsb2NhdGVDaHVua1NpemUsbj1udWxsPT1yP3ZvaWQgMDpyLmNhbmNlbCxhPW51bGw9PXI/dm9pZCAwOnIucHVsbCxpPW51bGw9PXI/dm9pZCAwOnIuc3RhcnQsbD1udWxsPT1yP3ZvaWQgMDpyLnR5cGU7cmV0dXJue2F1dG9BbGxvY2F0ZUNodW5rU2l6ZTp2b2lkIDA9PT1vP3ZvaWQgMDpRKG8sYCR7dH0gaGFzIG1lbWJlciAnYXV0b0FsbG9jYXRlQ2h1bmtTaXplJyB0aGF0YCksY2FuY2VsOnZvaWQgMD09PW4/dm9pZCAwOmdyKG4scixgJHt0fSBoYXMgbWVtYmVyICdjYW5jZWwnIHRoYXRgKSxwdWxsOnZvaWQgMD09PWE/dm9pZCAwOnZyKGEscixgJHt0fSBoYXMgbWVtYmVyICdwdWxsJyB0aGF0YCksc3RhcnQ6dm9pZCAwPT09aT92b2lkIDA6d3IoaSxyLGAke3R9IGhhcyBtZW1iZXIgJ3N0YXJ0JyB0aGF0YCksdHlwZTp2b2lkIDA9PT1sP3ZvaWQgMDpScihsLGAke3R9IGhhcyBtZW1iZXIgJ3R5cGUnIHRoYXRgKX19KGUsXCJGaXJzdCBwYXJhbWV0ZXJcIik7aWYocXIodGhpcyksXCJieXRlc1wiPT09by50eXBlKXtpZih2b2lkIDAhPT1yLnNpemUpdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgc3RyYXRlZ3kgZm9yIGEgYnl0ZSBzdHJlYW0gY2Fubm90IGhhdmUgYSBzaXplIGZ1bmN0aW9uXCIpOyFmdW5jdGlvbihlLHQscil7Y29uc3Qgbz1PYmplY3QuY3JlYXRlKFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXIucHJvdG90eXBlKTtsZXQgbixhLGk7bj12b2lkIDAhPT10LnN0YXJ0PygpPT50LnN0YXJ0KG8pOigpPT57fSxhPXZvaWQgMCE9PXQucHVsbD8oKT0+dC5wdWxsKG8pOigpPT5jKHZvaWQgMCksaT12b2lkIDAhPT10LmNhbmNlbD9lPT50LmNhbmNlbChlKTooKT0+Yyh2b2lkIDApO2NvbnN0IGw9dC5hdXRvQWxsb2NhdGVDaHVua1NpemU7aWYoMD09PWwpdGhyb3cgbmV3IFR5cGVFcnJvcihcImF1dG9BbGxvY2F0ZUNodW5rU2l6ZSBtdXN0IGJlIGdyZWF0ZXIgdGhhbiAwXCIpO0plKGUsbyxuLGEsaSxyLGwpfSh0aGlzLG8sdXQociwwKSl9ZWxzZXtjb25zdCBlPWN0KHIpOyFmdW5jdGlvbihlLHQscixvKXtjb25zdCBuPU9iamVjdC5jcmVhdGUoUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlci5wcm90b3R5cGUpO2xldCBhLGksbDthPXZvaWQgMCE9PXQuc3RhcnQ/KCk9PnQuc3RhcnQobik6KCk9Pnt9LGk9dm9pZCAwIT09dC5wdWxsPygpPT50LnB1bGwobik6KCk9PmModm9pZCAwKSxsPXZvaWQgMCE9PXQuY2FuY2VsP2U9PnQuY2FuY2VsKGUpOigpPT5jKHZvaWQgMCksX3IoZSxuLGEsaSxsLHIsbyl9KHRoaXMsbyx1dChyLDEpLGUpfX1nZXQgbG9ja2VkKCl7aWYoIUVyKHRoaXMpKXRocm93IGpyKFwibG9ja2VkXCIpO3JldHVybiBXcih0aGlzKX1jYW5jZWwoZT12b2lkIDApe3JldHVybiBFcih0aGlzKT9Xcih0aGlzKT9kKG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FuY2VsIGEgc3RyZWFtIHRoYXQgYWxyZWFkeSBoYXMgYSByZWFkZXJcIikpOk9yKHRoaXMsZSk6ZChqcihcImNhbmNlbFwiKSl9Z2V0UmVhZGVyKGU9dm9pZCAwKXtpZighRXIodGhpcykpdGhyb3cganIoXCJnZXRSZWFkZXJcIik7cmV0dXJuIHZvaWQgMD09PWZ1bmN0aW9uKGUsdCl7TChlLHQpO2NvbnN0IHI9bnVsbD09ZT92b2lkIDA6ZS5tb2RlO3JldHVybnttb2RlOnZvaWQgMD09PXI/dm9pZCAwOmV0KHIsYCR7dH0gaGFzIG1lbWJlciAnbW9kZScgdGhhdGApfX0oZSxcIkZpcnN0IHBhcmFtZXRlclwiKS5tb2RlP0godGhpcyk6dHQodGhpcyl9cGlwZVRocm91Z2goZSx0PXt9KXtpZighRXIodGhpcykpdGhyb3cganIoXCJwaXBlVGhyb3VnaFwiKTskKGUsMSxcInBpcGVUaHJvdWdoXCIpO2NvbnN0IHI9ZnVuY3Rpb24oZSx0KXtMKGUsdCk7Y29uc3Qgcj1udWxsPT1lP3ZvaWQgMDplLnJlYWRhYmxlO00ocixcInJlYWRhYmxlXCIsXCJSZWFkYWJsZVdyaXRhYmxlUGFpclwiKSxOKHIsYCR7dH0gaGFzIG1lbWJlciAncmVhZGFibGUnIHRoYXRgKTtjb25zdCBvPW51bGw9PWU/dm9pZCAwOmUud3JpdGFibGU7cmV0dXJuIE0obyxcIndyaXRhYmxlXCIsXCJSZWFkYWJsZVdyaXRhYmxlUGFpclwiKSxwdChvLGAke3R9IGhhcyBtZW1iZXIgJ3dyaXRhYmxlJyB0aGF0YCkse3JlYWRhYmxlOnIsd3JpdGFibGU6b319KGUsXCJGaXJzdCBwYXJhbWV0ZXJcIiksbz1Ucih0LFwiU2Vjb25kIHBhcmFtZXRlclwiKTtpZihXcih0aGlzKSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiUmVhZGFibGVTdHJlYW0ucHJvdG90eXBlLnBpcGVUaHJvdWdoIGNhbm5vdCBiZSB1c2VkIG9uIGEgbG9ja2VkIFJlYWRhYmxlU3RyZWFtXCIpO2lmKHZ0KHIud3JpdGFibGUpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJSZWFkYWJsZVN0cmVhbS5wcm90b3R5cGUucGlwZVRocm91Z2ggY2Fubm90IGJlIHVzZWQgb24gYSBsb2NrZWQgV3JpdGFibGVTdHJlYW1cIik7cmV0dXJuIHAoaXIodGhpcyxyLndyaXRhYmxlLG8ucHJldmVudENsb3NlLG8ucHJldmVudEFib3J0LG8ucHJldmVudENhbmNlbCxvLnNpZ25hbCkpLHIucmVhZGFibGV9cGlwZVRvKGUsdD17fSl7aWYoIUVyKHRoaXMpKXJldHVybiBkKGpyKFwicGlwZVRvXCIpKTtpZih2b2lkIDA9PT1lKXJldHVybiBkKFwiUGFyYW1ldGVyIDEgaXMgcmVxdWlyZWQgaW4gJ3BpcGVUbycuXCIpO2lmKCFndChlKSlyZXR1cm4gZChuZXcgVHlwZUVycm9yKFwiUmVhZGFibGVTdHJlYW0ucHJvdG90eXBlLnBpcGVUbydzIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBXcml0YWJsZVN0cmVhbVwiKSk7bGV0IHI7dHJ5e3I9VHIodCxcIlNlY29uZCBwYXJhbWV0ZXJcIil9Y2F0Y2goZSl7cmV0dXJuIGQoZSl9cmV0dXJuIFdyKHRoaXMpP2QobmV3IFR5cGVFcnJvcihcIlJlYWRhYmxlU3RyZWFtLnByb3RvdHlwZS5waXBlVG8gY2Fubm90IGJlIHVzZWQgb24gYSBsb2NrZWQgUmVhZGFibGVTdHJlYW1cIikpOnZ0KGUpP2QobmV3IFR5cGVFcnJvcihcIlJlYWRhYmxlU3RyZWFtLnByb3RvdHlwZS5waXBlVG8gY2Fubm90IGJlIHVzZWQgb24gYSBsb2NrZWQgV3JpdGFibGVTdHJlYW1cIikpOmlyKHRoaXMsZSxyLnByZXZlbnRDbG9zZSxyLnByZXZlbnRBYm9ydCxyLnByZXZlbnRDYW5jZWwsci5zaWduYWwpfXRlZSgpe2lmKCFFcih0aGlzKSl0aHJvdyBqcihcInRlZVwiKTtyZXR1cm4gbmUoeXIodGhpcykpfXZhbHVlcyhlPXZvaWQgMCl7aWYoIUVyKHRoaXMpKXRocm93IGpyKFwidmFsdWVzXCIpO3JldHVybiBmdW5jdGlvbihlLHQpe2NvbnN0IHI9SChlKSxvPW5ldyBoZShyLHQpLG49T2JqZWN0LmNyZWF0ZShtZSk7cmV0dXJuIG4uX2FzeW5jSXRlcmF0b3JJbXBsPW8sbn0odGhpcyxmdW5jdGlvbihlLHQpe0woZSx0KTtjb25zdCByPW51bGw9PWU/dm9pZCAwOmUucHJldmVudENhbmNlbDtyZXR1cm57cHJldmVudENhbmNlbDpCb29sZWFuKHIpfX0oZSxcIkZpcnN0IHBhcmFtZXRlclwiKS5wcmV2ZW50Q2FuY2VsKX1bZGVdKGUpe3JldHVybiB0aGlzLnZhbHVlcyhlKX1zdGF0aWMgZnJvbShlKXtyZXR1cm4gU3IoZSl9fWZ1bmN0aW9uIENyKGUsdCxyLG89MSxuPSgpPT4xKXtjb25zdCBhPU9iamVjdC5jcmVhdGUoUmVhZGFibGVTdHJlYW0ucHJvdG90eXBlKTtxcihhKTtyZXR1cm4gX3IoYSxPYmplY3QuY3JlYXRlKFJlYWRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXIucHJvdG90eXBlKSxlLHQscixvLG4pLGF9ZnVuY3Rpb24gUHIoZSx0LHIpe2NvbnN0IG89T2JqZWN0LmNyZWF0ZShSZWFkYWJsZVN0cmVhbS5wcm90b3R5cGUpO3FyKG8pO3JldHVybiBKZShvLE9iamVjdC5jcmVhdGUoUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlci5wcm90b3R5cGUpLGUsdCxyLDAsdm9pZCAwKSxvfWZ1bmN0aW9uIHFyKGUpe2UuX3N0YXRlPVwicmVhZGFibGVcIixlLl9yZWFkZXI9dm9pZCAwLGUuX3N0b3JlZEVycm9yPXZvaWQgMCxlLl9kaXN0dXJiZWQ9ITF9ZnVuY3Rpb24gRXIoZSl7cmV0dXJuISF0KGUpJiYoISFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxcIl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXJcIikmJmUgaW5zdGFuY2VvZiBSZWFkYWJsZVN0cmVhbSl9ZnVuY3Rpb24gV3IoZSl7cmV0dXJuIHZvaWQgMCE9PWUuX3JlYWRlcn1mdW5jdGlvbiBPcih0LHIpe2lmKHQuX2Rpc3R1cmJlZD0hMCxcImNsb3NlZFwiPT09dC5fc3RhdGUpcmV0dXJuIGModm9pZCAwKTtpZihcImVycm9yZWRcIj09PXQuX3N0YXRlKXJldHVybiBkKHQuX3N0b3JlZEVycm9yKTtCcih0KTtjb25zdCBvPXQuX3JlYWRlcjtpZih2b2lkIDAhPT1vJiZhdChvKSl7Y29uc3QgZT1vLl9yZWFkSW50b1JlcXVlc3RzO28uX3JlYWRJbnRvUmVxdWVzdHM9bmV3IHYsZS5mb3JFYWNoKGU9PntlLl9jbG9zZVN0ZXBzKHZvaWQgMCl9KX1yZXR1cm4gXyh0Ll9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXJbVF0ociksZSl9ZnVuY3Rpb24gQnIoZSl7ZS5fc3RhdGU9XCJjbG9zZWRcIjtjb25zdCB0PWUuX3JlYWRlcjtpZih2b2lkIDAhPT10JiYoQSh0KSxKKHQpKSl7Y29uc3QgZT10Ll9yZWFkUmVxdWVzdHM7dC5fcmVhZFJlcXVlc3RzPW5ldyB2LGUuZm9yRWFjaChlPT57ZS5fY2xvc2VTdGVwcygpfSl9fWZ1bmN0aW9uIGtyKGUsdCl7ZS5fc3RhdGU9XCJlcnJvcmVkXCIsZS5fc3RvcmVkRXJyb3I9dDtjb25zdCByPWUuX3JlYWRlcjt2b2lkIDAhPT1yJiYoaihyLHQpLEoocik/WihyLHQpOmx0KHIsdCkpfWZ1bmN0aW9uIGpyKGUpe3JldHVybiBuZXcgVHlwZUVycm9yKGBSZWFkYWJsZVN0cmVhbS5wcm90b3R5cGUuJHtlfSBjYW4gb25seSBiZSB1c2VkIG9uIGEgUmVhZGFibGVTdHJlYW1gKX1mdW5jdGlvbiBBcihlLHQpe0woZSx0KTtjb25zdCByPW51bGw9PWU/dm9pZCAwOmUuaGlnaFdhdGVyTWFyaztyZXR1cm4gTShyLFwiaGlnaFdhdGVyTWFya1wiLFwiUXVldWluZ1N0cmF0ZWd5SW5pdFwiKSx7aGlnaFdhdGVyTWFyazpZKHIpfX1PYmplY3QuZGVmaW5lUHJvcGVydGllcyhSZWFkYWJsZVN0cmVhbSx7ZnJvbTp7ZW51bWVyYWJsZTohMH19KSxPYmplY3QuZGVmaW5lUHJvcGVydGllcyhSZWFkYWJsZVN0cmVhbS5wcm90b3R5cGUse2NhbmNlbDp7ZW51bWVyYWJsZTohMH0sZ2V0UmVhZGVyOntlbnVtZXJhYmxlOiEwfSxwaXBlVGhyb3VnaDp7ZW51bWVyYWJsZTohMH0scGlwZVRvOntlbnVtZXJhYmxlOiEwfSx0ZWU6e2VudW1lcmFibGU6ITB9LHZhbHVlczp7ZW51bWVyYWJsZTohMH0sbG9ja2VkOntlbnVtZXJhYmxlOiEwfX0pLG8oUmVhZGFibGVTdHJlYW0uZnJvbSxcImZyb21cIiksbyhSZWFkYWJsZVN0cmVhbS5wcm90b3R5cGUuY2FuY2VsLFwiY2FuY2VsXCIpLG8oUmVhZGFibGVTdHJlYW0ucHJvdG90eXBlLmdldFJlYWRlcixcImdldFJlYWRlclwiKSxvKFJlYWRhYmxlU3RyZWFtLnByb3RvdHlwZS5waXBlVGhyb3VnaCxcInBpcGVUaHJvdWdoXCIpLG8oUmVhZGFibGVTdHJlYW0ucHJvdG90eXBlLnBpcGVUbyxcInBpcGVUb1wiKSxvKFJlYWRhYmxlU3RyZWFtLnByb3RvdHlwZS50ZWUsXCJ0ZWVcIiksbyhSZWFkYWJsZVN0cmVhbS5wcm90b3R5cGUudmFsdWVzLFwidmFsdWVzXCIpLFwic3ltYm9sXCI9PXR5cGVvZiBTeW1ib2wudG9TdHJpbmdUYWcmJk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSZWFkYWJsZVN0cmVhbS5wcm90b3R5cGUsU3ltYm9sLnRvU3RyaW5nVGFnLHt2YWx1ZTpcIlJlYWRhYmxlU3RyZWFtXCIsY29uZmlndXJhYmxlOiEwfSksT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlYWRhYmxlU3RyZWFtLnByb3RvdHlwZSxkZSx7dmFsdWU6UmVhZGFibGVTdHJlYW0ucHJvdG90eXBlLnZhbHVlcyx3cml0YWJsZTohMCxjb25maWd1cmFibGU6ITB9KTtjb25zdCB6cj1lPT5lLmJ5dGVMZW5ndGg7byh6cixcInNpemVcIik7Y2xhc3MgQnl0ZUxlbmd0aFF1ZXVpbmdTdHJhdGVneXtjb25zdHJ1Y3RvcihlKXskKGUsMSxcIkJ5dGVMZW5ndGhRdWV1aW5nU3RyYXRlZ3lcIiksZT1BcihlLFwiRmlyc3QgcGFyYW1ldGVyXCIpLHRoaXMuX2J5dGVMZW5ndGhRdWV1aW5nU3RyYXRlZ3lIaWdoV2F0ZXJNYXJrPWUuaGlnaFdhdGVyTWFya31nZXQgaGlnaFdhdGVyTWFyaygpe2lmKCFMcih0aGlzKSl0aHJvdyBEcihcImhpZ2hXYXRlck1hcmtcIik7cmV0dXJuIHRoaXMuX2J5dGVMZW5ndGhRdWV1aW5nU3RyYXRlZ3lIaWdoV2F0ZXJNYXJrfWdldCBzaXplKCl7aWYoIUxyKHRoaXMpKXRocm93IERyKFwic2l6ZVwiKTtyZXR1cm4genJ9fWZ1bmN0aW9uIERyKGUpe3JldHVybiBuZXcgVHlwZUVycm9yKGBCeXRlTGVuZ3RoUXVldWluZ1N0cmF0ZWd5LnByb3RvdHlwZS4ke2V9IGNhbiBvbmx5IGJlIHVzZWQgb24gYSBCeXRlTGVuZ3RoUXVldWluZ1N0cmF0ZWd5YCl9ZnVuY3Rpb24gTHIoZSl7cmV0dXJuISF0KGUpJiYoISFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxcIl9ieXRlTGVuZ3RoUXVldWluZ1N0cmF0ZWd5SGlnaFdhdGVyTWFya1wiKSYmZSBpbnN0YW5jZW9mIEJ5dGVMZW5ndGhRdWV1aW5nU3RyYXRlZ3kpfU9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKEJ5dGVMZW5ndGhRdWV1aW5nU3RyYXRlZ3kucHJvdG90eXBlLHtoaWdoV2F0ZXJNYXJrOntlbnVtZXJhYmxlOiEwfSxzaXplOntlbnVtZXJhYmxlOiEwfX0pLFwic3ltYm9sXCI9PXR5cGVvZiBTeW1ib2wudG9TdHJpbmdUYWcmJk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCeXRlTGVuZ3RoUXVldWluZ1N0cmF0ZWd5LnByb3RvdHlwZSxTeW1ib2wudG9TdHJpbmdUYWcse3ZhbHVlOlwiQnl0ZUxlbmd0aFF1ZXVpbmdTdHJhdGVneVwiLGNvbmZpZ3VyYWJsZTohMH0pO2NvbnN0IEZyPSgpPT4xO28oRnIsXCJzaXplXCIpO2NsYXNzIENvdW50UXVldWluZ1N0cmF0ZWd5e2NvbnN0cnVjdG9yKGUpeyQoZSwxLFwiQ291bnRRdWV1aW5nU3RyYXRlZ3lcIiksZT1BcihlLFwiRmlyc3QgcGFyYW1ldGVyXCIpLHRoaXMuX2NvdW50UXVldWluZ1N0cmF0ZWd5SGlnaFdhdGVyTWFyaz1lLmhpZ2hXYXRlck1hcmt9Z2V0IGhpZ2hXYXRlck1hcmsoKXtpZighJHIodGhpcykpdGhyb3cgSXIoXCJoaWdoV2F0ZXJNYXJrXCIpO3JldHVybiB0aGlzLl9jb3VudFF1ZXVpbmdTdHJhdGVneUhpZ2hXYXRlck1hcmt9Z2V0IHNpemUoKXtpZighJHIodGhpcykpdGhyb3cgSXIoXCJzaXplXCIpO3JldHVybiBGcn19ZnVuY3Rpb24gSXIoZSl7cmV0dXJuIG5ldyBUeXBlRXJyb3IoYENvdW50UXVldWluZ1N0cmF0ZWd5LnByb3RvdHlwZS4ke2V9IGNhbiBvbmx5IGJlIHVzZWQgb24gYSBDb3VudFF1ZXVpbmdTdHJhdGVneWApfWZ1bmN0aW9uICRyKGUpe3JldHVybiEhdChlKSYmKCEhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGUsXCJfY291bnRRdWV1aW5nU3RyYXRlZ3lIaWdoV2F0ZXJNYXJrXCIpJiZlIGluc3RhbmNlb2YgQ291bnRRdWV1aW5nU3RyYXRlZ3kpfWZ1bmN0aW9uIE1yKGUsdCxyKXtyZXR1cm4gRihlLHIpLHI9PmcoZSx0LFtyXSl9ZnVuY3Rpb24gWXIoZSx0LHIpe3JldHVybiBGKGUscikscj0+UyhlLHQsW3JdKX1mdW5jdGlvbiB4cihlLHQscil7cmV0dXJuIEYoZSxyKSwocixvKT0+ZyhlLHQsW3Isb10pfWZ1bmN0aW9uIFFyKGUsdCxyKXtyZXR1cm4gRihlLHIpLHI9PmcoZSx0LFtyXSl9T2JqZWN0LmRlZmluZVByb3BlcnRpZXMoQ291bnRRdWV1aW5nU3RyYXRlZ3kucHJvdG90eXBlLHtoaWdoV2F0ZXJNYXJrOntlbnVtZXJhYmxlOiEwfSxzaXplOntlbnVtZXJhYmxlOiEwfX0pLFwic3ltYm9sXCI9PXR5cGVvZiBTeW1ib2wudG9TdHJpbmdUYWcmJk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb3VudFF1ZXVpbmdTdHJhdGVneS5wcm90b3R5cGUsU3ltYm9sLnRvU3RyaW5nVGFnLHt2YWx1ZTpcIkNvdW50UXVldWluZ1N0cmF0ZWd5XCIsY29uZmlndXJhYmxlOiEwfSk7Y2xhc3MgVHJhbnNmb3JtU3RyZWFte2NvbnN0cnVjdG9yKGU9e30sdD17fSxyPXt9KXt2b2lkIDA9PT1lJiYoZT1udWxsKTtjb25zdCBvPWR0KHQsXCJTZWNvbmQgcGFyYW1ldGVyXCIpLG49ZHQocixcIlRoaXJkIHBhcmFtZXRlclwiKSxhPWZ1bmN0aW9uKGUsdCl7TChlLHQpO2NvbnN0IHI9bnVsbD09ZT92b2lkIDA6ZS5jYW5jZWwsbz1udWxsPT1lP3ZvaWQgMDplLmZsdXNoLG49bnVsbD09ZT92b2lkIDA6ZS5yZWFkYWJsZVR5cGUsYT1udWxsPT1lP3ZvaWQgMDplLnN0YXJ0LGk9bnVsbD09ZT92b2lkIDA6ZS50cmFuc2Zvcm0sbD1udWxsPT1lP3ZvaWQgMDplLndyaXRhYmxlVHlwZTtyZXR1cm57Y2FuY2VsOnZvaWQgMD09PXI/dm9pZCAwOlFyKHIsZSxgJHt0fSBoYXMgbWVtYmVyICdjYW5jZWwnIHRoYXRgKSxmbHVzaDp2b2lkIDA9PT1vP3ZvaWQgMDpNcihvLGUsYCR7dH0gaGFzIG1lbWJlciAnZmx1c2gnIHRoYXRgKSxyZWFkYWJsZVR5cGU6bixzdGFydDp2b2lkIDA9PT1hP3ZvaWQgMDpZcihhLGUsYCR7dH0gaGFzIG1lbWJlciAnc3RhcnQnIHRoYXRgKSx0cmFuc2Zvcm06dm9pZCAwPT09aT92b2lkIDA6eHIoaSxlLGAke3R9IGhhcyBtZW1iZXIgJ3RyYW5zZm9ybScgdGhhdGApLHdyaXRhYmxlVHlwZTpsfX0oZSxcIkZpcnN0IHBhcmFtZXRlclwiKTtpZih2b2lkIDAhPT1hLnJlYWRhYmxlVHlwZSl0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkludmFsaWQgcmVhZGFibGVUeXBlIHNwZWNpZmllZFwiKTtpZih2b2lkIDAhPT1hLndyaXRhYmxlVHlwZSl0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkludmFsaWQgd3JpdGFibGVUeXBlIHNwZWNpZmllZFwiKTtjb25zdCBpPXV0KG4sMCksbD1jdChuKSxzPXV0KG8sMSksZj1jdChvKTtsZXQgaDshZnVuY3Rpb24oZSx0LHIsbyxuLGEpe2Z1bmN0aW9uIGkoKXtyZXR1cm4gdH1mdW5jdGlvbiBsKHQpe3JldHVybiBmdW5jdGlvbihlLHQpe2NvbnN0IHI9ZS5fdHJhbnNmb3JtU3RyZWFtQ29udHJvbGxlcjtpZihlLl9iYWNrcHJlc3N1cmUpe3JldHVybiBfKGUuX2JhY2twcmVzc3VyZUNoYW5nZVByb21pc2UsKCk9Pntjb25zdCBvPWUuX3dyaXRhYmxlO2lmKFwiZXJyb3JpbmdcIj09PW8uX3N0YXRlKXRocm93IG8uX3N0b3JlZEVycm9yO3JldHVybiBacihyLHQpfSl9cmV0dXJuIFpyKHIsdCl9KGUsdCl9ZnVuY3Rpb24gcyh0KXtyZXR1cm4gZnVuY3Rpb24oZSx0KXtjb25zdCByPWUuX3RyYW5zZm9ybVN0cmVhbUNvbnRyb2xsZXI7aWYodm9pZCAwIT09ci5fZmluaXNoUHJvbWlzZSlyZXR1cm4gci5fZmluaXNoUHJvbWlzZTtjb25zdCBvPWUuX3JlYWRhYmxlO3IuX2ZpbmlzaFByb21pc2U9dSgoZSx0KT0+e3IuX2ZpbmlzaFByb21pc2VfcmVzb2x2ZT1lLHIuX2ZpbmlzaFByb21pc2VfcmVqZWN0PXR9KTtjb25zdCBuPXIuX2NhbmNlbEFsZ29yaXRobSh0KTtyZXR1cm4gSnIociksYihuLCgpPT4oXCJlcnJvcmVkXCI9PT1vLl9zdGF0ZT9ybyhyLG8uX3N0b3JlZEVycm9yKTooYnIoby5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLHQpLHRvKHIpKSxudWxsKSxlPT4oYnIoby5fcmVhZGFibGVTdHJlYW1Db250cm9sbGVyLGUpLHJvKHIsZSksbnVsbCkpLHIuX2ZpbmlzaFByb21pc2V9KGUsdCl9ZnVuY3Rpb24gYygpe3JldHVybiBmdW5jdGlvbihlKXtjb25zdCB0PWUuX3RyYW5zZm9ybVN0cmVhbUNvbnRyb2xsZXI7aWYodm9pZCAwIT09dC5fZmluaXNoUHJvbWlzZSlyZXR1cm4gdC5fZmluaXNoUHJvbWlzZTtjb25zdCByPWUuX3JlYWRhYmxlO3QuX2ZpbmlzaFByb21pc2U9dSgoZSxyKT0+e3QuX2ZpbmlzaFByb21pc2VfcmVzb2x2ZT1lLHQuX2ZpbmlzaFByb21pc2VfcmVqZWN0PXJ9KTtjb25zdCBvPXQuX2ZsdXNoQWxnb3JpdGhtKCk7cmV0dXJuIEpyKHQpLGIobywoKT0+KFwiZXJyb3JlZFwiPT09ci5fc3RhdGU/cm8odCxyLl9zdG9yZWRFcnJvcik6KGRyKHIuX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlciksdG8odCkpLG51bGwpLGU9PihicihyLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsZSkscm8odCxlKSxudWxsKSksdC5fZmluaXNoUHJvbWlzZX0oZSl9ZnVuY3Rpb24gZCgpe3JldHVybiBmdW5jdGlvbihlKXtyZXR1cm4gR3IoZSwhMSksZS5fYmFja3ByZXNzdXJlQ2hhbmdlUHJvbWlzZX0oZSl9ZnVuY3Rpb24gZih0KXtyZXR1cm4gZnVuY3Rpb24oZSx0KXtjb25zdCByPWUuX3RyYW5zZm9ybVN0cmVhbUNvbnRyb2xsZXI7aWYodm9pZCAwIT09ci5fZmluaXNoUHJvbWlzZSlyZXR1cm4gci5fZmluaXNoUHJvbWlzZTtjb25zdCBvPWUuX3dyaXRhYmxlO3IuX2ZpbmlzaFByb21pc2U9dSgoZSx0KT0+e3IuX2ZpbmlzaFByb21pc2VfcmVzb2x2ZT1lLHIuX2ZpbmlzaFByb21pc2VfcmVqZWN0PXR9KTtjb25zdCBuPXIuX2NhbmNlbEFsZ29yaXRobSh0KTtyZXR1cm4gSnIociksYihuLCgpPT4oXCJlcnJvcmVkXCI9PT1vLl9zdGF0ZT9ybyhyLG8uX3N0b3JlZEVycm9yKTooWXQoby5fd3JpdGFibGVTdHJlYW1Db250cm9sbGVyLHQpLFVyKGUpLHRvKHIpKSxudWxsKSx0PT4oWXQoby5fd3JpdGFibGVTdHJlYW1Db250cm9sbGVyLHQpLFVyKGUpLHJvKHIsdCksbnVsbCkpLHIuX2ZpbmlzaFByb21pc2V9KGUsdCl9ZS5fd3JpdGFibGU9ZnVuY3Rpb24oZSx0LHIsbyxuPTEsYT0oKT0+MSl7Y29uc3QgaT1PYmplY3QuY3JlYXRlKFdyaXRhYmxlU3RyZWFtLnByb3RvdHlwZSk7cmV0dXJuIFN0KGkpLEZ0KGksT2JqZWN0LmNyZWF0ZShXcml0YWJsZVN0cmVhbURlZmF1bHRDb250cm9sbGVyLnByb3RvdHlwZSksZSx0LHIsbyxuLGEpLGl9KGksbCxjLHMscixvKSxlLl9yZWFkYWJsZT1DcihpLGQsZixuLGEpLGUuX2JhY2twcmVzc3VyZT12b2lkIDAsZS5fYmFja3ByZXNzdXJlQ2hhbmdlUHJvbWlzZT12b2lkIDAsZS5fYmFja3ByZXNzdXJlQ2hhbmdlUHJvbWlzZV9yZXNvbHZlPXZvaWQgMCxHcihlLCEwKSxlLl90cmFuc2Zvcm1TdHJlYW1Db250cm9sbGVyPXZvaWQgMH0odGhpcyx1KGU9PntoPWV9KSxzLGYsaSxsKSxmdW5jdGlvbihlLHQpe2NvbnN0IHI9T2JqZWN0LmNyZWF0ZShUcmFuc2Zvcm1TdHJlYW1EZWZhdWx0Q29udHJvbGxlci5wcm90b3R5cGUpO2xldCBvLG4sYTtvPXZvaWQgMCE9PXQudHJhbnNmb3JtP2U9PnQudHJhbnNmb3JtKGUscik6ZT0+e3RyeXtyZXR1cm4gS3IocixlKSxjKHZvaWQgMCl9Y2F0Y2goZSl7cmV0dXJuIGQoZSl9fTtuPXZvaWQgMCE9PXQuZmx1c2g/KCk9PnQuZmx1c2gocik6KCk9PmModm9pZCAwKTthPXZvaWQgMCE9PXQuY2FuY2VsP2U9PnQuY2FuY2VsKGUpOigpPT5jKHZvaWQgMCk7IWZ1bmN0aW9uKGUsdCxyLG8sbil7dC5fY29udHJvbGxlZFRyYW5zZm9ybVN0cmVhbT1lLGUuX3RyYW5zZm9ybVN0cmVhbUNvbnRyb2xsZXI9dCx0Ll90cmFuc2Zvcm1BbGdvcml0aG09cix0Ll9mbHVzaEFsZ29yaXRobT1vLHQuX2NhbmNlbEFsZ29yaXRobT1uLHQuX2ZpbmlzaFByb21pc2U9dm9pZCAwLHQuX2ZpbmlzaFByb21pc2VfcmVzb2x2ZT12b2lkIDAsdC5fZmluaXNoUHJvbWlzZV9yZWplY3Q9dm9pZCAwfShlLHIsbyxuLGEpfSh0aGlzLGEpLHZvaWQgMCE9PWEuc3RhcnQ/aChhLnN0YXJ0KHRoaXMuX3RyYW5zZm9ybVN0cmVhbUNvbnRyb2xsZXIpKTpoKHZvaWQgMCl9Z2V0IHJlYWRhYmxlKCl7aWYoIU5yKHRoaXMpKXRocm93IG9vKFwicmVhZGFibGVcIik7cmV0dXJuIHRoaXMuX3JlYWRhYmxlfWdldCB3cml0YWJsZSgpe2lmKCFOcih0aGlzKSl0aHJvdyBvbyhcIndyaXRhYmxlXCIpO3JldHVybiB0aGlzLl93cml0YWJsZX19ZnVuY3Rpb24gTnIoZSl7cmV0dXJuISF0KGUpJiYoISFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxcIl90cmFuc2Zvcm1TdHJlYW1Db250cm9sbGVyXCIpJiZlIGluc3RhbmNlb2YgVHJhbnNmb3JtU3RyZWFtKX1mdW5jdGlvbiBIcihlLHQpe2JyKGUuX3JlYWRhYmxlLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIsdCksVnIoZSx0KX1mdW5jdGlvbiBWcihlLHQpe0pyKGUuX3RyYW5zZm9ybVN0cmVhbUNvbnRyb2xsZXIpLFl0KGUuX3dyaXRhYmxlLl93cml0YWJsZVN0cmVhbUNvbnRyb2xsZXIsdCksVXIoZSl9ZnVuY3Rpb24gVXIoZSl7ZS5fYmFja3ByZXNzdXJlJiZHcihlLCExKX1mdW5jdGlvbiBHcihlLHQpe3ZvaWQgMCE9PWUuX2JhY2twcmVzc3VyZUNoYW5nZVByb21pc2UmJmUuX2JhY2twcmVzc3VyZUNoYW5nZVByb21pc2VfcmVzb2x2ZSgpLGUuX2JhY2twcmVzc3VyZUNoYW5nZVByb21pc2U9dSh0PT57ZS5fYmFja3ByZXNzdXJlQ2hhbmdlUHJvbWlzZV9yZXNvbHZlPXR9KSxlLl9iYWNrcHJlc3N1cmU9dH1PYmplY3QuZGVmaW5lUHJvcGVydGllcyhUcmFuc2Zvcm1TdHJlYW0ucHJvdG90eXBlLHtyZWFkYWJsZTp7ZW51bWVyYWJsZTohMH0sd3JpdGFibGU6e2VudW1lcmFibGU6ITB9fSksXCJzeW1ib2xcIj09dHlwZW9mIFN5bWJvbC50b1N0cmluZ1RhZyYmT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyYW5zZm9ybVN0cmVhbS5wcm90b3R5cGUsU3ltYm9sLnRvU3RyaW5nVGFnLHt2YWx1ZTpcIlRyYW5zZm9ybVN0cmVhbVwiLGNvbmZpZ3VyYWJsZTohMH0pO2NsYXNzIFRyYW5zZm9ybVN0cmVhbURlZmF1bHRDb250cm9sbGVye2NvbnN0cnVjdG9yKCl7dGhyb3cgbmV3IFR5cGVFcnJvcihcIklsbGVnYWwgY29uc3RydWN0b3JcIil9Z2V0IGRlc2lyZWRTaXplKCl7aWYoIVhyKHRoaXMpKXRocm93IGVvKFwiZGVzaXJlZFNpemVcIik7cmV0dXJuIGhyKHRoaXMuX2NvbnRyb2xsZWRUcmFuc2Zvcm1TdHJlYW0uX3JlYWRhYmxlLl9yZWFkYWJsZVN0cmVhbUNvbnRyb2xsZXIpfWVucXVldWUoZT12b2lkIDApe2lmKCFYcih0aGlzKSl0aHJvdyBlbyhcImVucXVldWVcIik7S3IodGhpcyxlKX1lcnJvcihlPXZvaWQgMCl7aWYoIVhyKHRoaXMpKXRocm93IGVvKFwiZXJyb3JcIik7dmFyIHQ7dD1lLEhyKHRoaXMuX2NvbnRyb2xsZWRUcmFuc2Zvcm1TdHJlYW0sdCl9dGVybWluYXRlKCl7aWYoIVhyKHRoaXMpKXRocm93IGVvKFwidGVybWluYXRlXCIpOyFmdW5jdGlvbihlKXtjb25zdCB0PWUuX2NvbnRyb2xsZWRUcmFuc2Zvcm1TdHJlYW07ZHIodC5fcmVhZGFibGUuX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlcik7Y29uc3Qgcj1uZXcgVHlwZUVycm9yKFwiVHJhbnNmb3JtU3RyZWFtIHRlcm1pbmF0ZWRcIik7VnIodCxyKX0odGhpcyl9fWZ1bmN0aW9uIFhyKGUpe3JldHVybiEhdChlKSYmKCEhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGUsXCJfY29udHJvbGxlZFRyYW5zZm9ybVN0cmVhbVwiKSYmZSBpbnN0YW5jZW9mIFRyYW5zZm9ybVN0cmVhbURlZmF1bHRDb250cm9sbGVyKX1mdW5jdGlvbiBKcihlKXtlLl90cmFuc2Zvcm1BbGdvcml0aG09dm9pZCAwLGUuX2ZsdXNoQWxnb3JpdGhtPXZvaWQgMCxlLl9jYW5jZWxBbGdvcml0aG09dm9pZCAwfWZ1bmN0aW9uIEtyKGUsdCl7Y29uc3Qgcj1lLl9jb250cm9sbGVkVHJhbnNmb3JtU3RyZWFtLG89ci5fcmVhZGFibGUuX3JlYWRhYmxlU3RyZWFtQ29udHJvbGxlcjtpZighbXIobykpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlJlYWRhYmxlIHNpZGUgaXMgbm90IGluIGEgc3RhdGUgdGhhdCBwZXJtaXRzIGVucXVldWVcIik7dHJ5e2ZyKG8sdCl9Y2F0Y2goZSl7dGhyb3cgVnIocixlKSxyLl9yZWFkYWJsZS5fc3RvcmVkRXJyb3J9Y29uc3Qgbj1mdW5jdGlvbihlKXtyZXR1cm4hdXIoZSl9KG8pO24hPT1yLl9iYWNrcHJlc3N1cmUmJkdyKHIsITApfWZ1bmN0aW9uIFpyKGUsdCl7cmV0dXJuIF8oZS5fdHJhbnNmb3JtQWxnb3JpdGhtKHQpLHZvaWQgMCx0PT57dGhyb3cgSHIoZS5fY29udHJvbGxlZFRyYW5zZm9ybVN0cmVhbSx0KSx0fSl9ZnVuY3Rpb24gZW8oZSl7cmV0dXJuIG5ldyBUeXBlRXJyb3IoYFRyYW5zZm9ybVN0cmVhbURlZmF1bHRDb250cm9sbGVyLnByb3RvdHlwZS4ke2V9IGNhbiBvbmx5IGJlIHVzZWQgb24gYSBUcmFuc2Zvcm1TdHJlYW1EZWZhdWx0Q29udHJvbGxlcmApfWZ1bmN0aW9uIHRvKGUpe3ZvaWQgMCE9PWUuX2ZpbmlzaFByb21pc2VfcmVzb2x2ZSYmKGUuX2ZpbmlzaFByb21pc2VfcmVzb2x2ZSgpLGUuX2ZpbmlzaFByb21pc2VfcmVzb2x2ZT12b2lkIDAsZS5fZmluaXNoUHJvbWlzZV9yZWplY3Q9dm9pZCAwKX1mdW5jdGlvbiBybyhlLHQpe3ZvaWQgMCE9PWUuX2ZpbmlzaFByb21pc2VfcmVqZWN0JiYocChlLl9maW5pc2hQcm9taXNlKSxlLl9maW5pc2hQcm9taXNlX3JlamVjdCh0KSxlLl9maW5pc2hQcm9taXNlX3Jlc29sdmU9dm9pZCAwLGUuX2ZpbmlzaFByb21pc2VfcmVqZWN0PXZvaWQgMCl9ZnVuY3Rpb24gb28oZSl7cmV0dXJuIG5ldyBUeXBlRXJyb3IoYFRyYW5zZm9ybVN0cmVhbS5wcm90b3R5cGUuJHtlfSBjYW4gb25seSBiZSB1c2VkIG9uIGEgVHJhbnNmb3JtU3RyZWFtYCl9T2JqZWN0LmRlZmluZVByb3BlcnRpZXMoVHJhbnNmb3JtU3RyZWFtRGVmYXVsdENvbnRyb2xsZXIucHJvdG90eXBlLHtlbnF1ZXVlOntlbnVtZXJhYmxlOiEwfSxlcnJvcjp7ZW51bWVyYWJsZTohMH0sdGVybWluYXRlOntlbnVtZXJhYmxlOiEwfSxkZXNpcmVkU2l6ZTp7ZW51bWVyYWJsZTohMH19KSxvKFRyYW5zZm9ybVN0cmVhbURlZmF1bHRDb250cm9sbGVyLnByb3RvdHlwZS5lbnF1ZXVlLFwiZW5xdWV1ZVwiKSxvKFRyYW5zZm9ybVN0cmVhbURlZmF1bHRDb250cm9sbGVyLnByb3RvdHlwZS5lcnJvcixcImVycm9yXCIpLG8oVHJhbnNmb3JtU3RyZWFtRGVmYXVsdENvbnRyb2xsZXIucHJvdG90eXBlLnRlcm1pbmF0ZSxcInRlcm1pbmF0ZVwiKSxcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLnRvU3RyaW5nVGFnJiZPYmplY3QuZGVmaW5lUHJvcGVydHkoVHJhbnNmb3JtU3RyZWFtRGVmYXVsdENvbnRyb2xsZXIucHJvdG90eXBlLFN5bWJvbC50b1N0cmluZ1RhZyx7dmFsdWU6XCJUcmFuc2Zvcm1TdHJlYW1EZWZhdWx0Q29udHJvbGxlclwiLGNvbmZpZ3VyYWJsZTohMH0pO2V4cG9ydHtCeXRlTGVuZ3RoUXVldWluZ1N0cmF0ZWd5LENvdW50UXVldWluZ1N0cmF0ZWd5LFJlYWRhYmxlQnl0ZVN0cmVhbUNvbnRyb2xsZXIsUmVhZGFibGVTdHJlYW0sUmVhZGFibGVTdHJlYW1CWU9CUmVhZGVyLFJlYWRhYmxlU3RyZWFtQllPQlJlcXVlc3QsUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlcixSZWFkYWJsZVN0cmVhbURlZmF1bHRSZWFkZXIsVHJhbnNmb3JtU3RyZWFtLFRyYW5zZm9ybVN0cmVhbURlZmF1bHRDb250cm9sbGVyLFdyaXRhYmxlU3RyZWFtLFdyaXRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXIsV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVyfTtcbiIsIi8qKlxuICogU2FmYXJpIFBvbHlmaWxsIGZvciBSU0MgU3RyZWFtc1xuICpcbiAqIFNhZmFyaSBkb2Vzbid0IGltcGxlbWVudCBSZWFkYWJsZUJ5dGVTdHJlYW1Db250cm9sbGVyLCB3aGljaCBSU0MgcmVxdWlyZXMuXG4gKiBUaGlzIHBvbHlmaWxsIG11c3QgYmUgYXdhaXRlZCBCRUZPUkUgYW55IFJTQyBvcGVyYXRpb25zLlxuICpcbiAqIFVzYWdlOlxuICogYGBgdHNcbiAqIGF3YWl0IHBvbHlmaWxsUmVhZHk7XG4gKiAvLyBOb3cgc2FmZSB0byB1c2UgUlNDXG4gKiBgYGBcbiAqL1xuXG4vKipcbiAqIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBwb2x5ZmlsbCBpcyBsb2FkZWQgKGlmIG5lZWRlZClcbiAqIFNhZmUgdG8gYXdhaXQgbXVsdGlwbGUgdGltZXMgLSByZXNvbHZlcyBpbW1lZGlhdGVseSBpZiBwb2x5ZmlsbCBub3QgbmVlZGVkXG4gKi9cbmV4cG9ydCBjb25zdCBwb2x5ZmlsbFJlYWR5OiBQcm9taXNlPHZvaWQ+ID1cbiAgdHlwZW9mIGdsb2JhbFRoaXMuUmVhZGFibGVCeXRlU3RyZWFtQ29udHJvbGxlciA9PT0gXCJ1bmRlZmluZWRcIlxuICAgID8gaW1wb3J0KFwid2ViLXN0cmVhbXMtcG9seWZpbGxcIikudGhlbigoeyBSZWFkYWJsZVN0cmVhbSB9KSA9PiB7XG4gICAgICAgIGdsb2JhbFRoaXMuUmVhZGFibGVTdHJlYW0gPSBSZWFkYWJsZVN0cmVhbSBhcyB0eXBlb2YgZ2xvYmFsVGhpcy5SZWFkYWJsZVN0cmVhbTtcbiAgICAgIH0pXG4gICAgOiBQcm9taXNlLnJlc29sdmUoKTtcblxuLyoqXG4gKiBDaGVjayBpZiBwb2x5ZmlsbCB3YXMgbmVlZGVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1BvbHlmaWxsUmVxdWlyZWQoKTogYm9vbGVhbiB7XG4gIHJldHVybiB0eXBlb2YgZ2xvYmFsVGhpcy5SZWFkYWJsZUJ5dGVTdHJlYW1Db250cm9sbGVyID09PSBcInVuZGVmaW5lZFwiO1xufVxuIiwiLyoqXG4gKiBAbGljZW5zZSBSZWFjdFxuICogcmVhY3QuZGV2ZWxvcG1lbnQuanNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIE1ldGEgUGxhdGZvcm1zLCBJbmMuIGFuZCBhZmZpbGlhdGVzLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLlxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXCJwcm9kdWN0aW9uXCIgIT09IHByb2Nlc3MuZW52Lk5PREVfRU5WICYmXG4gIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gZGVmaW5lRGVwcmVjYXRpb25XYXJuaW5nKG1ldGhvZE5hbWUsIGluZm8pIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb21wb25lbnQucHJvdG90eXBlLCBtZXRob2ROYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIFwiJXMoLi4uKSBpcyBkZXByZWNhdGVkIGluIHBsYWluIEphdmFTY3JpcHQgUmVhY3QgY2xhc3Nlcy4gJXNcIixcbiAgICAgICAgICAgIGluZm9bMF0sXG4gICAgICAgICAgICBpbmZvWzFdXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldEl0ZXJhdG9yRm4obWF5YmVJdGVyYWJsZSkge1xuICAgICAgaWYgKG51bGwgPT09IG1heWJlSXRlcmFibGUgfHwgXCJvYmplY3RcIiAhPT0gdHlwZW9mIG1heWJlSXRlcmFibGUpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgbWF5YmVJdGVyYWJsZSA9XG4gICAgICAgIChNQVlCRV9JVEVSQVRPUl9TWU1CT0wgJiYgbWF5YmVJdGVyYWJsZVtNQVlCRV9JVEVSQVRPUl9TWU1CT0xdKSB8fFxuICAgICAgICBtYXliZUl0ZXJhYmxlW1wiQEBpdGVyYXRvclwiXTtcbiAgICAgIHJldHVybiBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBtYXliZUl0ZXJhYmxlID8gbWF5YmVJdGVyYWJsZSA6IG51bGw7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCBjYWxsZXJOYW1lKSB7XG4gICAgICBwdWJsaWNJbnN0YW5jZSA9XG4gICAgICAgICgocHVibGljSW5zdGFuY2UgPSBwdWJsaWNJbnN0YW5jZS5jb25zdHJ1Y3RvcikgJiZcbiAgICAgICAgICAocHVibGljSW5zdGFuY2UuZGlzcGxheU5hbWUgfHwgcHVibGljSW5zdGFuY2UubmFtZSkpIHx8XG4gICAgICAgIFwiUmVhY3RDbGFzc1wiO1xuICAgICAgdmFyIHdhcm5pbmdLZXkgPSBwdWJsaWNJbnN0YW5jZSArIFwiLlwiICsgY2FsbGVyTmFtZTtcbiAgICAgIGRpZFdhcm5TdGF0ZVVwZGF0ZUZvclVubW91bnRlZENvbXBvbmVudFt3YXJuaW5nS2V5XSB8fFxuICAgICAgICAoY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIkNhbid0IGNhbGwgJXMgb24gYSBjb21wb25lbnQgdGhhdCBpcyBub3QgeWV0IG1vdW50ZWQuIFRoaXMgaXMgYSBuby1vcCwgYnV0IGl0IG1pZ2h0IGluZGljYXRlIGEgYnVnIGluIHlvdXIgYXBwbGljYXRpb24uIEluc3RlYWQsIGFzc2lnbiB0byBgdGhpcy5zdGF0ZWAgZGlyZWN0bHkgb3IgZGVmaW5lIGEgYHN0YXRlID0ge307YCBjbGFzcyBwcm9wZXJ0eSB3aXRoIHRoZSBkZXNpcmVkIHN0YXRlIGluIHRoZSAlcyBjb21wb25lbnQuXCIsXG4gICAgICAgICAgY2FsbGVyTmFtZSxcbiAgICAgICAgICBwdWJsaWNJbnN0YW5jZVxuICAgICAgICApLFxuICAgICAgICAoZGlkV2FyblN0YXRlVXBkYXRlRm9yVW5tb3VudGVkQ29tcG9uZW50W3dhcm5pbmdLZXldID0gITApKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gQ29tcG9uZW50KHByb3BzLCBjb250ZXh0LCB1cGRhdGVyKSB7XG4gICAgICB0aGlzLnByb3BzID0gcHJvcHM7XG4gICAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgICAgdGhpcy5yZWZzID0gZW1wdHlPYmplY3Q7XG4gICAgICB0aGlzLnVwZGF0ZXIgPSB1cGRhdGVyIHx8IFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBDb21wb25lbnREdW1teSgpIHt9XG4gICAgZnVuY3Rpb24gUHVyZUNvbXBvbmVudChwcm9wcywgY29udGV4dCwgdXBkYXRlcikge1xuICAgICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuICAgICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgIHRoaXMucmVmcyA9IGVtcHR5T2JqZWN0O1xuICAgICAgdGhpcy51cGRhdGVyID0gdXBkYXRlciB8fCBSZWFjdE5vb3BVcGRhdGVRdWV1ZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbm9vcCgpIHt9XG4gICAgZnVuY3Rpb24gdGVzdFN0cmluZ0NvZXJjaW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gXCJcIiArIHZhbHVlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjaGVja0tleVN0cmluZ0NvZXJjaW9uKHZhbHVlKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0ZXN0U3RyaW5nQ29lcmNpb24odmFsdWUpO1xuICAgICAgICB2YXIgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gITE7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9ICEwO1xuICAgICAgfVxuICAgICAgaWYgKEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCkge1xuICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQgPSBjb25zb2xlO1xuICAgICAgICB2YXIgSlNDb21waWxlcl90ZW1wX2NvbnN0ID0gSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0LmVycm9yO1xuICAgICAgICB2YXIgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0JGpzY29tcCQwID1cbiAgICAgICAgICAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgU3ltYm9sICYmXG4gICAgICAgICAgICBTeW1ib2wudG9TdHJpbmdUYWcgJiZcbiAgICAgICAgICAgIHZhbHVlW1N5bWJvbC50b1N0cmluZ1RhZ10pIHx8XG4gICAgICAgICAgdmFsdWUuY29uc3RydWN0b3IubmFtZSB8fFxuICAgICAgICAgIFwiT2JqZWN0XCI7XG4gICAgICAgIEpTQ29tcGlsZXJfdGVtcF9jb25zdC5jYWxsKFxuICAgICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCxcbiAgICAgICAgICBcIlRoZSBwcm92aWRlZCBrZXkgaXMgYW4gdW5zdXBwb3J0ZWQgdHlwZSAlcy4gVGhpcyB2YWx1ZSBtdXN0IGJlIGNvZXJjZWQgdG8gYSBzdHJpbmcgYmVmb3JlIHVzaW5nIGl0IGhlcmUuXCIsXG4gICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0JGpzY29tcCQwXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiB0ZXN0U3RyaW5nQ29lcmNpb24odmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSkge1xuICAgICAgaWYgKG51bGwgPT0gdHlwZSkgcmV0dXJuIG51bGw7XG4gICAgICBpZiAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgdHlwZSlcbiAgICAgICAgcmV0dXJuIHR5cGUuJCR0eXBlb2YgPT09IFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0VcbiAgICAgICAgICA/IG51bGxcbiAgICAgICAgICA6IHR5cGUuZGlzcGxheU5hbWUgfHwgdHlwZS5uYW1lIHx8IG51bGw7XG4gICAgICBpZiAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIHR5cGUpIHJldHVybiB0eXBlO1xuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgUkVBQ1RfRlJBR01FTlRfVFlQRTpcbiAgICAgICAgICByZXR1cm4gXCJGcmFnbWVudFwiO1xuICAgICAgICBjYXNlIFJFQUNUX1BST0ZJTEVSX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiUHJvZmlsZXJcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN0cmljdE1vZGVcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVVNQRU5TRV9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN1c3BlbnNlXCI7XG4gICAgICAgIGNhc2UgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN1c3BlbnNlTGlzdFwiO1xuICAgICAgICBjYXNlIFJFQUNUX0FDVElWSVRZX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiQWN0aXZpdHlcIjtcbiAgICAgIH1cbiAgICAgIGlmIChcIm9iamVjdFwiID09PSB0eXBlb2YgdHlwZSlcbiAgICAgICAgc3dpdGNoIChcbiAgICAgICAgICAoXCJudW1iZXJcIiA9PT0gdHlwZW9mIHR5cGUudGFnICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcIlJlY2VpdmVkIGFuIHVuZXhwZWN0ZWQgb2JqZWN0IGluIGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSgpLiBUaGlzIGlzIGxpa2VseSBhIGJ1ZyBpbiBSZWFjdC4gUGxlYXNlIGZpbGUgYW4gaXNzdWUuXCJcbiAgICAgICAgICAgICksXG4gICAgICAgICAgdHlwZS4kJHR5cGVvZilcbiAgICAgICAgKSB7XG4gICAgICAgICAgY2FzZSBSRUFDVF9QT1JUQUxfVFlQRTpcbiAgICAgICAgICAgIHJldHVybiBcIlBvcnRhbFwiO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfQ09OVEVYVF9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIHR5cGUuZGlzcGxheU5hbWUgfHwgXCJDb250ZXh0XCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9DT05TVU1FUl9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuICh0eXBlLl9jb250ZXh0LmRpc3BsYXlOYW1lIHx8IFwiQ29udGV4dFwiKSArIFwiLkNvbnN1bWVyXCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFOlxuICAgICAgICAgICAgdmFyIGlubmVyVHlwZSA9IHR5cGUucmVuZGVyO1xuICAgICAgICAgICAgdHlwZSA9IHR5cGUuZGlzcGxheU5hbWU7XG4gICAgICAgICAgICB0eXBlIHx8XG4gICAgICAgICAgICAgICgodHlwZSA9IGlubmVyVHlwZS5kaXNwbGF5TmFtZSB8fCBpbm5lclR5cGUubmFtZSB8fCBcIlwiKSxcbiAgICAgICAgICAgICAgKHR5cGUgPSBcIlwiICE9PSB0eXBlID8gXCJGb3J3YXJkUmVmKFwiICsgdHlwZSArIFwiKVwiIDogXCJGb3J3YXJkUmVmXCIpKTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfTUVNT19UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgKGlubmVyVHlwZSA9IHR5cGUuZGlzcGxheU5hbWUgfHwgbnVsbCksXG4gICAgICAgICAgICAgIG51bGwgIT09IGlubmVyVHlwZVxuICAgICAgICAgICAgICAgID8gaW5uZXJUeXBlXG4gICAgICAgICAgICAgICAgOiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZS50eXBlKSB8fCBcIk1lbW9cIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICBjYXNlIFJFQUNUX0xBWllfVFlQRTpcbiAgICAgICAgICAgIGlubmVyVHlwZSA9IHR5cGUuX3BheWxvYWQ7XG4gICAgICAgICAgICB0eXBlID0gdHlwZS5faW5pdDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZShpbm5lclR5cGUpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHgpIHt9XG4gICAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRUYXNrTmFtZSh0eXBlKSB7XG4gICAgICBpZiAodHlwZSA9PT0gUkVBQ1RfRlJBR01FTlRfVFlQRSkgcmV0dXJuIFwiPD5cIjtcbiAgICAgIGlmIChcbiAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHR5cGUgJiZcbiAgICAgICAgbnVsbCAhPT0gdHlwZSAmJlxuICAgICAgICB0eXBlLiQkdHlwZW9mID09PSBSRUFDVF9MQVpZX1RZUEVcbiAgICAgIClcbiAgICAgICAgcmV0dXJuIFwiPC4uLj5cIjtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBuYW1lID0gZ2V0Q29tcG9uZW50TmFtZUZyb21UeXBlKHR5cGUpO1xuICAgICAgICByZXR1cm4gbmFtZSA/IFwiPFwiICsgbmFtZSArIFwiPlwiIDogXCI8Li4uPlwiO1xuICAgICAgfSBjYXRjaCAoeCkge1xuICAgICAgICByZXR1cm4gXCI8Li4uPlwiO1xuICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRPd25lcigpIHtcbiAgICAgIHZhciBkaXNwYXRjaGVyID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuQTtcbiAgICAgIHJldHVybiBudWxsID09PSBkaXNwYXRjaGVyID8gbnVsbCA6IGRpc3BhdGNoZXIuZ2V0T3duZXIoKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gVW5rbm93bk93bmVyKCkge1xuICAgICAgcmV0dXJuIEVycm9yKFwicmVhY3Qtc3RhY2stdG9wLWZyYW1lXCIpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBoYXNWYWxpZEtleShjb25maWcpIHtcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgXCJrZXlcIikpIHtcbiAgICAgICAgdmFyIGdldHRlciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoY29uZmlnLCBcImtleVwiKS5nZXQ7XG4gICAgICAgIGlmIChnZXR0ZXIgJiYgZ2V0dGVyLmlzUmVhY3RXYXJuaW5nKSByZXR1cm4gITE7XG4gICAgICB9XG4gICAgICByZXR1cm4gdm9pZCAwICE9PSBjb25maWcua2V5O1xuICAgIH1cbiAgICBmdW5jdGlvbiBkZWZpbmVLZXlQcm9wV2FybmluZ0dldHRlcihwcm9wcywgZGlzcGxheU5hbWUpIHtcbiAgICAgIGZ1bmN0aW9uIHdhcm5BYm91dEFjY2Vzc2luZ0tleSgpIHtcbiAgICAgICAgc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd24gfHxcbiAgICAgICAgICAoKHNwZWNpYWxQcm9wS2V5V2FybmluZ1Nob3duID0gITApLFxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBcIiVzOiBga2V5YCBpcyBub3QgYSBwcm9wLiBUcnlpbmcgdG8gYWNjZXNzIGl0IHdpbGwgcmVzdWx0IGluIGB1bmRlZmluZWRgIGJlaW5nIHJldHVybmVkLiBJZiB5b3UgbmVlZCB0byBhY2Nlc3MgdGhlIHNhbWUgdmFsdWUgd2l0aGluIHRoZSBjaGlsZCBjb21wb25lbnQsIHlvdSBzaG91bGQgcGFzcyBpdCBhcyBhIGRpZmZlcmVudCBwcm9wLiAoaHR0cHM6Ly9yZWFjdC5kZXYvbGluay9zcGVjaWFsLXByb3BzKVwiLFxuICAgICAgICAgICAgZGlzcGxheU5hbWVcbiAgICAgICAgICApKTtcbiAgICAgIH1cbiAgICAgIHdhcm5BYm91dEFjY2Vzc2luZ0tleS5pc1JlYWN0V2FybmluZyA9ICEwO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3BzLCBcImtleVwiLCB7XG4gICAgICAgIGdldDogd2FybkFib3V0QWNjZXNzaW5nS2V5LFxuICAgICAgICBjb25maWd1cmFibGU6ICEwXG4gICAgICB9KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZWxlbWVudFJlZkdldHRlcldpdGhEZXByZWNhdGlvbldhcm5pbmcoKSB7XG4gICAgICB2YXIgY29tcG9uZW50TmFtZSA9IGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0aGlzLnR5cGUpO1xuICAgICAgZGlkV2FybkFib3V0RWxlbWVudFJlZltjb21wb25lbnROYW1lXSB8fFxuICAgICAgICAoKGRpZFdhcm5BYm91dEVsZW1lbnRSZWZbY29tcG9uZW50TmFtZV0gPSAhMCksXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJBY2Nlc3NpbmcgZWxlbWVudC5yZWYgd2FzIHJlbW92ZWQgaW4gUmVhY3QgMTkuIHJlZiBpcyBub3cgYSByZWd1bGFyIHByb3AuIEl0IHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBKU1ggRWxlbWVudCB0eXBlIGluIGEgZnV0dXJlIHJlbGVhc2UuXCJcbiAgICAgICAgKSk7XG4gICAgICBjb21wb25lbnROYW1lID0gdGhpcy5wcm9wcy5yZWY7XG4gICAgICByZXR1cm4gdm9pZCAwICE9PSBjb21wb25lbnROYW1lID8gY29tcG9uZW50TmFtZSA6IG51bGw7XG4gICAgfVxuICAgIGZ1bmN0aW9uIFJlYWN0RWxlbWVudCh0eXBlLCBrZXksIHByb3BzLCBvd25lciwgZGVidWdTdGFjaywgZGVidWdUYXNrKSB7XG4gICAgICB2YXIgcmVmUHJvcCA9IHByb3BzLnJlZjtcbiAgICAgIHR5cGUgPSB7XG4gICAgICAgICQkdHlwZW9mOiBSRUFDVF9FTEVNRU5UX1RZUEUsXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGtleToga2V5LFxuICAgICAgICBwcm9wczogcHJvcHMsXG4gICAgICAgIF9vd25lcjogb3duZXJcbiAgICAgIH07XG4gICAgICBudWxsICE9PSAodm9pZCAwICE9PSByZWZQcm9wID8gcmVmUHJvcCA6IG51bGwpXG4gICAgICAgID8gT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwicmVmXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICAgICAgZ2V0OiBlbGVtZW50UmVmR2V0dGVyV2l0aERlcHJlY2F0aW9uV2FybmluZ1xuICAgICAgICAgIH0pXG4gICAgICAgIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwicmVmXCIsIHsgZW51bWVyYWJsZTogITEsIHZhbHVlOiBudWxsIH0pO1xuICAgICAgdHlwZS5fc3RvcmUgPSB7fTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLl9zdG9yZSwgXCJ2YWxpZGF0ZWRcIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogMFxuICAgICAgfSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJfZGVidWdJbmZvXCIsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiAhMSxcbiAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgIHdyaXRhYmxlOiAhMCxcbiAgICAgICAgdmFsdWU6IG51bGxcbiAgICAgIH0pO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwiX2RlYnVnU3RhY2tcIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogZGVidWdTdGFja1xuICAgICAgfSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJfZGVidWdUYXNrXCIsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiAhMSxcbiAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgIHdyaXRhYmxlOiAhMCxcbiAgICAgICAgdmFsdWU6IGRlYnVnVGFza1xuICAgICAgfSk7XG4gICAgICBPYmplY3QuZnJlZXplICYmIChPYmplY3QuZnJlZXplKHR5cGUucHJvcHMpLCBPYmplY3QuZnJlZXplKHR5cGUpKTtcbiAgICAgIHJldHVybiB0eXBlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjbG9uZUFuZFJlcGxhY2VLZXkob2xkRWxlbWVudCwgbmV3S2V5KSB7XG4gICAgICBuZXdLZXkgPSBSZWFjdEVsZW1lbnQoXG4gICAgICAgIG9sZEVsZW1lbnQudHlwZSxcbiAgICAgICAgbmV3S2V5LFxuICAgICAgICBvbGRFbGVtZW50LnByb3BzLFxuICAgICAgICBvbGRFbGVtZW50Ll9vd25lcixcbiAgICAgICAgb2xkRWxlbWVudC5fZGVidWdTdGFjayxcbiAgICAgICAgb2xkRWxlbWVudC5fZGVidWdUYXNrXG4gICAgICApO1xuICAgICAgb2xkRWxlbWVudC5fc3RvcmUgJiZcbiAgICAgICAgKG5ld0tleS5fc3RvcmUudmFsaWRhdGVkID0gb2xkRWxlbWVudC5fc3RvcmUudmFsaWRhdGVkKTtcbiAgICAgIHJldHVybiBuZXdLZXk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlQ2hpbGRLZXlzKG5vZGUpIHtcbiAgICAgIGlzVmFsaWRFbGVtZW50KG5vZGUpXG4gICAgICAgID8gbm9kZS5fc3RvcmUgJiYgKG5vZGUuX3N0b3JlLnZhbGlkYXRlZCA9IDEpXG4gICAgICAgIDogXCJvYmplY3RcIiA9PT0gdHlwZW9mIG5vZGUgJiZcbiAgICAgICAgICBudWxsICE9PSBub2RlICYmXG4gICAgICAgICAgbm9kZS4kJHR5cGVvZiA9PT0gUkVBQ1RfTEFaWV9UWVBFICYmXG4gICAgICAgICAgKFwiZnVsZmlsbGVkXCIgPT09IG5vZGUuX3BheWxvYWQuc3RhdHVzXG4gICAgICAgICAgICA/IGlzVmFsaWRFbGVtZW50KG5vZGUuX3BheWxvYWQudmFsdWUpICYmXG4gICAgICAgICAgICAgIG5vZGUuX3BheWxvYWQudmFsdWUuX3N0b3JlICYmXG4gICAgICAgICAgICAgIChub2RlLl9wYXlsb2FkLnZhbHVlLl9zdG9yZS52YWxpZGF0ZWQgPSAxKVxuICAgICAgICAgICAgOiBub2RlLl9zdG9yZSAmJiAobm9kZS5fc3RvcmUudmFsaWRhdGVkID0gMSkpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1ZhbGlkRWxlbWVudChvYmplY3QpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiBvYmplY3QgJiZcbiAgICAgICAgbnVsbCAhPT0gb2JqZWN0ICYmXG4gICAgICAgIG9iamVjdC4kJHR5cGVvZiA9PT0gUkVBQ1RfRUxFTUVOVF9UWVBFXG4gICAgICApO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlc2NhcGUoa2V5KSB7XG4gICAgICB2YXIgZXNjYXBlckxvb2t1cCA9IHsgXCI9XCI6IFwiPTBcIiwgXCI6XCI6IFwiPTJcIiB9O1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgXCIkXCIgK1xuICAgICAgICBrZXkucmVwbGFjZSgvWz06XS9nLCBmdW5jdGlvbiAobWF0Y2gpIHtcbiAgICAgICAgICByZXR1cm4gZXNjYXBlckxvb2t1cFttYXRjaF07XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRFbGVtZW50S2V5KGVsZW1lbnQsIGluZGV4KSB7XG4gICAgICByZXR1cm4gXCJvYmplY3RcIiA9PT0gdHlwZW9mIGVsZW1lbnQgJiZcbiAgICAgICAgbnVsbCAhPT0gZWxlbWVudCAmJlxuICAgICAgICBudWxsICE9IGVsZW1lbnQua2V5XG4gICAgICAgID8gKGNoZWNrS2V5U3RyaW5nQ29lcmNpb24oZWxlbWVudC5rZXkpLCBlc2NhcGUoXCJcIiArIGVsZW1lbnQua2V5KSlcbiAgICAgICAgOiBpbmRleC50b1N0cmluZygzNik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlc29sdmVUaGVuYWJsZSh0aGVuYWJsZSkge1xuICAgICAgc3dpdGNoICh0aGVuYWJsZS5zdGF0dXMpIHtcbiAgICAgICAgY2FzZSBcImZ1bGZpbGxlZFwiOlxuICAgICAgICAgIHJldHVybiB0aGVuYWJsZS52YWx1ZTtcbiAgICAgICAgY2FzZSBcInJlamVjdGVkXCI6XG4gICAgICAgICAgdGhyb3cgdGhlbmFibGUucmVhc29uO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHN3aXRjaCAoXG4gICAgICAgICAgICAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIHRoZW5hYmxlLnN0YXR1c1xuICAgICAgICAgICAgICA/IHRoZW5hYmxlLnRoZW4obm9vcCwgbm9vcClcbiAgICAgICAgICAgICAgOiAoKHRoZW5hYmxlLnN0YXR1cyA9IFwicGVuZGluZ1wiKSxcbiAgICAgICAgICAgICAgICB0aGVuYWJsZS50aGVuKFxuICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKGZ1bGZpbGxlZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIFwicGVuZGluZ1wiID09PSB0aGVuYWJsZS5zdGF0dXMgJiZcbiAgICAgICAgICAgICAgICAgICAgICAoKHRoZW5hYmxlLnN0YXR1cyA9IFwiZnVsZmlsbGVkXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICh0aGVuYWJsZS52YWx1ZSA9IGZ1bGZpbGxlZFZhbHVlKSk7XG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIFwicGVuZGluZ1wiID09PSB0aGVuYWJsZS5zdGF0dXMgJiZcbiAgICAgICAgICAgICAgICAgICAgICAoKHRoZW5hYmxlLnN0YXR1cyA9IFwicmVqZWN0ZWRcIiksXG4gICAgICAgICAgICAgICAgICAgICAgKHRoZW5hYmxlLnJlYXNvbiA9IGVycm9yKSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKSksXG4gICAgICAgICAgICB0aGVuYWJsZS5zdGF0dXMpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjYXNlIFwiZnVsZmlsbGVkXCI6XG4gICAgICAgICAgICAgIHJldHVybiB0aGVuYWJsZS52YWx1ZTtcbiAgICAgICAgICAgIGNhc2UgXCJyZWplY3RlZFwiOlxuICAgICAgICAgICAgICB0aHJvdyB0aGVuYWJsZS5yZWFzb247XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3cgdGhlbmFibGU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG1hcEludG9BcnJheShjaGlsZHJlbiwgYXJyYXksIGVzY2FwZWRQcmVmaXgsIG5hbWVTb0ZhciwgY2FsbGJhY2spIHtcbiAgICAgIHZhciB0eXBlID0gdHlwZW9mIGNoaWxkcmVuO1xuICAgICAgaWYgKFwidW5kZWZpbmVkXCIgPT09IHR5cGUgfHwgXCJib29sZWFuXCIgPT09IHR5cGUpIGNoaWxkcmVuID0gbnVsbDtcbiAgICAgIHZhciBpbnZva2VDYWxsYmFjayA9ICExO1xuICAgICAgaWYgKG51bGwgPT09IGNoaWxkcmVuKSBpbnZva2VDYWxsYmFjayA9ICEwO1xuICAgICAgZWxzZVxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICBjYXNlIFwiYmlnaW50XCI6XG4gICAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgICAgICAgIGludm9rZUNhbGxiYWNrID0gITA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICAgICAgICBzd2l0Y2ggKGNoaWxkcmVuLiQkdHlwZW9mKSB7XG4gICAgICAgICAgICAgIGNhc2UgUkVBQ1RfRUxFTUVOVF9UWVBFOlxuICAgICAgICAgICAgICBjYXNlIFJFQUNUX1BPUlRBTF9UWVBFOlxuICAgICAgICAgICAgICAgIGludm9rZUNhbGxiYWNrID0gITA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgUkVBQ1RfTEFaWV9UWVBFOlxuICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAoaW52b2tlQ2FsbGJhY2sgPSBjaGlsZHJlbi5faW5pdCksXG4gICAgICAgICAgICAgICAgICBtYXBJbnRvQXJyYXkoXG4gICAgICAgICAgICAgICAgICAgIGludm9rZUNhbGxiYWNrKGNoaWxkcmVuLl9wYXlsb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgYXJyYXksXG4gICAgICAgICAgICAgICAgICAgIGVzY2FwZWRQcmVmaXgsXG4gICAgICAgICAgICAgICAgICAgIG5hbWVTb0ZhcixcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBpZiAoaW52b2tlQ2FsbGJhY2spIHtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2sgPSBjaGlsZHJlbjtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayhpbnZva2VDYWxsYmFjayk7XG4gICAgICAgIHZhciBjaGlsZEtleSA9XG4gICAgICAgICAgXCJcIiA9PT0gbmFtZVNvRmFyID8gXCIuXCIgKyBnZXRFbGVtZW50S2V5KGludm9rZUNhbGxiYWNrLCAwKSA6IG5hbWVTb0ZhcjtcbiAgICAgICAgaXNBcnJheUltcGwoY2FsbGJhY2spXG4gICAgICAgICAgPyAoKGVzY2FwZWRQcmVmaXggPSBcIlwiKSxcbiAgICAgICAgICAgIG51bGwgIT0gY2hpbGRLZXkgJiZcbiAgICAgICAgICAgICAgKGVzY2FwZWRQcmVmaXggPVxuICAgICAgICAgICAgICAgIGNoaWxkS2V5LnJlcGxhY2UodXNlclByb3ZpZGVkS2V5RXNjYXBlUmVnZXgsIFwiJCYvXCIpICsgXCIvXCIpLFxuICAgICAgICAgICAgbWFwSW50b0FycmF5KGNhbGxiYWNrLCBhcnJheSwgZXNjYXBlZFByZWZpeCwgXCJcIiwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGM7XG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICA6IG51bGwgIT0gY2FsbGJhY2sgJiZcbiAgICAgICAgICAgIChpc1ZhbGlkRWxlbWVudChjYWxsYmFjaykgJiZcbiAgICAgICAgICAgICAgKG51bGwgIT0gY2FsbGJhY2sua2V5ICYmXG4gICAgICAgICAgICAgICAgKChpbnZva2VDYWxsYmFjayAmJiBpbnZva2VDYWxsYmFjay5rZXkgPT09IGNhbGxiYWNrLmtleSkgfHxcbiAgICAgICAgICAgICAgICAgIGNoZWNrS2V5U3RyaW5nQ29lcmNpb24oY2FsbGJhY2sua2V5KSksXG4gICAgICAgICAgICAgIChlc2NhcGVkUHJlZml4ID0gY2xvbmVBbmRSZXBsYWNlS2V5KFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrLFxuICAgICAgICAgICAgICAgIGVzY2FwZWRQcmVmaXggK1xuICAgICAgICAgICAgICAgICAgKG51bGwgPT0gY2FsbGJhY2sua2V5IHx8XG4gICAgICAgICAgICAgICAgICAoaW52b2tlQ2FsbGJhY2sgJiYgaW52b2tlQ2FsbGJhY2sua2V5ID09PSBjYWxsYmFjay5rZXkpXG4gICAgICAgICAgICAgICAgICAgID8gXCJcIlxuICAgICAgICAgICAgICAgICAgICA6IChcIlwiICsgY2FsbGJhY2sua2V5KS5yZXBsYWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlclByb3ZpZGVkS2V5RXNjYXBlUmVnZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiQmL1wiXG4gICAgICAgICAgICAgICAgICAgICAgKSArIFwiL1wiKSArXG4gICAgICAgICAgICAgICAgICBjaGlsZEtleVxuICAgICAgICAgICAgICApKSxcbiAgICAgICAgICAgICAgXCJcIiAhPT0gbmFtZVNvRmFyICYmXG4gICAgICAgICAgICAgICAgbnVsbCAhPSBpbnZva2VDYWxsYmFjayAmJlxuICAgICAgICAgICAgICAgIGlzVmFsaWRFbGVtZW50KGludm9rZUNhbGxiYWNrKSAmJlxuICAgICAgICAgICAgICAgIG51bGwgPT0gaW52b2tlQ2FsbGJhY2sua2V5ICYmXG4gICAgICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2suX3N0b3JlICYmXG4gICAgICAgICAgICAgICAgIWludm9rZUNhbGxiYWNrLl9zdG9yZS52YWxpZGF0ZWQgJiZcbiAgICAgICAgICAgICAgICAoZXNjYXBlZFByZWZpeC5fc3RvcmUudmFsaWRhdGVkID0gMiksXG4gICAgICAgICAgICAgIChjYWxsYmFjayA9IGVzY2FwZWRQcmVmaXgpKSxcbiAgICAgICAgICAgIGFycmF5LnB1c2goY2FsbGJhY2spKTtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9XG4gICAgICBpbnZva2VDYWxsYmFjayA9IDA7XG4gICAgICBjaGlsZEtleSA9IFwiXCIgPT09IG5hbWVTb0ZhciA/IFwiLlwiIDogbmFtZVNvRmFyICsgXCI6XCI7XG4gICAgICBpZiAoaXNBcnJheUltcGwoY2hpbGRyZW4pKVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKVxuICAgICAgICAgIChuYW1lU29GYXIgPSBjaGlsZHJlbltpXSksXG4gICAgICAgICAgICAodHlwZSA9IGNoaWxkS2V5ICsgZ2V0RWxlbWVudEtleShuYW1lU29GYXIsIGkpKSxcbiAgICAgICAgICAgIChpbnZva2VDYWxsYmFjayArPSBtYXBJbnRvQXJyYXkoXG4gICAgICAgICAgICAgIG5hbWVTb0ZhcixcbiAgICAgICAgICAgICAgYXJyYXksXG4gICAgICAgICAgICAgIGVzY2FwZWRQcmVmaXgsXG4gICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgIGNhbGxiYWNrXG4gICAgICAgICAgICApKTtcbiAgICAgIGVsc2UgaWYgKCgoaSA9IGdldEl0ZXJhdG9yRm4oY2hpbGRyZW4pKSwgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgaSkpXG4gICAgICAgIGZvciAoXG4gICAgICAgICAgaSA9PT0gY2hpbGRyZW4uZW50cmllcyAmJlxuICAgICAgICAgICAgKGRpZFdhcm5BYm91dE1hcHMgfHxcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgIFwiVXNpbmcgTWFwcyBhcyBjaGlsZHJlbiBpcyBub3Qgc3VwcG9ydGVkLiBVc2UgYW4gYXJyYXkgb2Yga2V5ZWQgUmVhY3RFbGVtZW50cyBpbnN0ZWFkLlwiXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICAoZGlkV2FybkFib3V0TWFwcyA9ICEwKSksXG4gICAgICAgICAgICBjaGlsZHJlbiA9IGkuY2FsbChjaGlsZHJlbiksXG4gICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAhKG5hbWVTb0ZhciA9IGNoaWxkcmVuLm5leHQoKSkuZG9uZTtcblxuICAgICAgICApXG4gICAgICAgICAgKG5hbWVTb0ZhciA9IG5hbWVTb0Zhci52YWx1ZSksXG4gICAgICAgICAgICAodHlwZSA9IGNoaWxkS2V5ICsgZ2V0RWxlbWVudEtleShuYW1lU29GYXIsIGkrKykpLFxuICAgICAgICAgICAgKGludm9rZUNhbGxiYWNrICs9IG1hcEludG9BcnJheShcbiAgICAgICAgICAgICAgbmFtZVNvRmFyLFxuICAgICAgICAgICAgICBhcnJheSxcbiAgICAgICAgICAgICAgZXNjYXBlZFByZWZpeCxcbiAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgY2FsbGJhY2tcbiAgICAgICAgICAgICkpO1xuICAgICAgZWxzZSBpZiAoXCJvYmplY3RcIiA9PT0gdHlwZSkge1xuICAgICAgICBpZiAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgY2hpbGRyZW4udGhlbilcbiAgICAgICAgICByZXR1cm4gbWFwSW50b0FycmF5KFxuICAgICAgICAgICAgcmVzb2x2ZVRoZW5hYmxlKGNoaWxkcmVuKSxcbiAgICAgICAgICAgIGFycmF5LFxuICAgICAgICAgICAgZXNjYXBlZFByZWZpeCxcbiAgICAgICAgICAgIG5hbWVTb0ZhcixcbiAgICAgICAgICAgIGNhbGxiYWNrXG4gICAgICAgICAgKTtcbiAgICAgICAgYXJyYXkgPSBTdHJpbmcoY2hpbGRyZW4pO1xuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBcIk9iamVjdHMgYXJlIG5vdCB2YWxpZCBhcyBhIFJlYWN0IGNoaWxkIChmb3VuZDogXCIgK1xuICAgICAgICAgICAgKFwiW29iamVjdCBPYmplY3RdXCIgPT09IGFycmF5XG4gICAgICAgICAgICAgID8gXCJvYmplY3Qgd2l0aCBrZXlzIHtcIiArIE9iamVjdC5rZXlzKGNoaWxkcmVuKS5qb2luKFwiLCBcIikgKyBcIn1cIlxuICAgICAgICAgICAgICA6IGFycmF5KSArXG4gICAgICAgICAgICBcIikuIElmIHlvdSBtZWFudCB0byByZW5kZXIgYSBjb2xsZWN0aW9uIG9mIGNoaWxkcmVuLCB1c2UgYW4gYXJyYXkgaW5zdGVhZC5cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGludm9rZUNhbGxiYWNrO1xuICAgIH1cbiAgICBmdW5jdGlvbiBtYXBDaGlsZHJlbihjaGlsZHJlbiwgZnVuYywgY29udGV4dCkge1xuICAgICAgaWYgKG51bGwgPT0gY2hpbGRyZW4pIHJldHVybiBjaGlsZHJlbjtcbiAgICAgIHZhciByZXN1bHQgPSBbXSxcbiAgICAgICAgY291bnQgPSAwO1xuICAgICAgbWFwSW50b0FycmF5KGNoaWxkcmVuLCByZXN1bHQsIFwiXCIsIFwiXCIsIGZ1bmN0aW9uIChjaGlsZCkge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIGNoaWxkLCBjb3VudCsrKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgZnVuY3Rpb24gbGF6eUluaXRpYWxpemVyKHBheWxvYWQpIHtcbiAgICAgIGlmICgtMSA9PT0gcGF5bG9hZC5fc3RhdHVzKSB7XG4gICAgICAgIHZhciBpb0luZm8gPSBwYXlsb2FkLl9pb0luZm87XG4gICAgICAgIG51bGwgIT0gaW9JbmZvICYmIChpb0luZm8uc3RhcnQgPSBpb0luZm8uZW5kID0gcGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICBpb0luZm8gPSBwYXlsb2FkLl9yZXN1bHQ7XG4gICAgICAgIHZhciB0aGVuYWJsZSA9IGlvSW5mbygpO1xuICAgICAgICB0aGVuYWJsZS50aGVuKFxuICAgICAgICAgIGZ1bmN0aW9uIChtb2R1bGVPYmplY3QpIHtcbiAgICAgICAgICAgIGlmICgwID09PSBwYXlsb2FkLl9zdGF0dXMgfHwgLTEgPT09IHBheWxvYWQuX3N0YXR1cykge1xuICAgICAgICAgICAgICBwYXlsb2FkLl9zdGF0dXMgPSAxO1xuICAgICAgICAgICAgICBwYXlsb2FkLl9yZXN1bHQgPSBtb2R1bGVPYmplY3Q7XG4gICAgICAgICAgICAgIHZhciBfaW9JbmZvID0gcGF5bG9hZC5faW9JbmZvO1xuICAgICAgICAgICAgICBudWxsICE9IF9pb0luZm8gJiYgKF9pb0luZm8uZW5kID0gcGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICAgICAgICB2b2lkIDAgPT09IHRoZW5hYmxlLnN0YXR1cyAmJlxuICAgICAgICAgICAgICAgICgodGhlbmFibGUuc3RhdHVzID0gXCJmdWxmaWxsZWRcIiksXG4gICAgICAgICAgICAgICAgKHRoZW5hYmxlLnZhbHVlID0gbW9kdWxlT2JqZWN0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGlmICgwID09PSBwYXlsb2FkLl9zdGF0dXMgfHwgLTEgPT09IHBheWxvYWQuX3N0YXR1cykge1xuICAgICAgICAgICAgICBwYXlsb2FkLl9zdGF0dXMgPSAyO1xuICAgICAgICAgICAgICBwYXlsb2FkLl9yZXN1bHQgPSBlcnJvcjtcbiAgICAgICAgICAgICAgdmFyIF9pb0luZm8yID0gcGF5bG9hZC5faW9JbmZvO1xuICAgICAgICAgICAgICBudWxsICE9IF9pb0luZm8yICYmIChfaW9JbmZvMi5lbmQgPSBwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgICAgICAgIHZvaWQgMCA9PT0gdGhlbmFibGUuc3RhdHVzICYmXG4gICAgICAgICAgICAgICAgKCh0aGVuYWJsZS5zdGF0dXMgPSBcInJlamVjdGVkXCIpLCAodGhlbmFibGUucmVhc29uID0gZXJyb3IpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIGlvSW5mbyA9IHBheWxvYWQuX2lvSW5mbztcbiAgICAgICAgaWYgKG51bGwgIT0gaW9JbmZvKSB7XG4gICAgICAgICAgaW9JbmZvLnZhbHVlID0gdGhlbmFibGU7XG4gICAgICAgICAgdmFyIGRpc3BsYXlOYW1lID0gdGhlbmFibGUuZGlzcGxheU5hbWU7XG4gICAgICAgICAgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIGRpc3BsYXlOYW1lICYmIChpb0luZm8ubmFtZSA9IGRpc3BsYXlOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICAtMSA9PT0gcGF5bG9hZC5fc3RhdHVzICYmXG4gICAgICAgICAgKChwYXlsb2FkLl9zdGF0dXMgPSAwKSwgKHBheWxvYWQuX3Jlc3VsdCA9IHRoZW5hYmxlKSk7XG4gICAgICB9XG4gICAgICBpZiAoMSA9PT0gcGF5bG9hZC5fc3RhdHVzKVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIChpb0luZm8gPSBwYXlsb2FkLl9yZXN1bHQpLFxuICAgICAgICAgIHZvaWQgMCA9PT0gaW9JbmZvICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcImxhenk6IEV4cGVjdGVkIHRoZSByZXN1bHQgb2YgYSBkeW5hbWljIGltcG9ydCgpIGNhbGwuIEluc3RlYWQgcmVjZWl2ZWQ6ICVzXFxuXFxuWW91ciBjb2RlIHNob3VsZCBsb29rIGxpa2U6IFxcbiAgY29uc3QgTXlDb21wb25lbnQgPSBsYXp5KCgpID0+IGltcG9ydCgnLi9NeUNvbXBvbmVudCcpKVxcblxcbkRpZCB5b3UgYWNjaWRlbnRhbGx5IHB1dCBjdXJseSBicmFjZXMgYXJvdW5kIHRoZSBpbXBvcnQ/XCIsXG4gICAgICAgICAgICAgIGlvSW5mb1xuICAgICAgICAgICAgKSxcbiAgICAgICAgICBcImRlZmF1bHRcIiBpbiBpb0luZm8gfHxcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwibGF6eTogRXhwZWN0ZWQgdGhlIHJlc3VsdCBvZiBhIGR5bmFtaWMgaW1wb3J0KCkgY2FsbC4gSW5zdGVhZCByZWNlaXZlZDogJXNcXG5cXG5Zb3VyIGNvZGUgc2hvdWxkIGxvb2sgbGlrZTogXFxuICBjb25zdCBNeUNvbXBvbmVudCA9IGxhenkoKCkgPT4gaW1wb3J0KCcuL015Q29tcG9uZW50JykpXCIsXG4gICAgICAgICAgICAgIGlvSW5mb1xuICAgICAgICAgICAgKSxcbiAgICAgICAgICBpb0luZm8uZGVmYXVsdFxuICAgICAgICApO1xuICAgICAgdGhyb3cgcGF5bG9hZC5fcmVzdWx0O1xuICAgIH1cbiAgICBmdW5jdGlvbiByZXNvbHZlRGlzcGF0Y2hlcigpIHtcbiAgICAgIHZhciBkaXNwYXRjaGVyID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuSDtcbiAgICAgIG51bGwgPT09IGRpc3BhdGNoZXIgJiZcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIkludmFsaWQgaG9vayBjYWxsLiBIb29rcyBjYW4gb25seSBiZSBjYWxsZWQgaW5zaWRlIG9mIHRoZSBib2R5IG9mIGEgZnVuY3Rpb24gY29tcG9uZW50LiBUaGlzIGNvdWxkIGhhcHBlbiBmb3Igb25lIG9mIHRoZSBmb2xsb3dpbmcgcmVhc29uczpcXG4xLiBZb3UgbWlnaHQgaGF2ZSBtaXNtYXRjaGluZyB2ZXJzaW9ucyBvZiBSZWFjdCBhbmQgdGhlIHJlbmRlcmVyIChzdWNoIGFzIFJlYWN0IERPTSlcXG4yLiBZb3UgbWlnaHQgYmUgYnJlYWtpbmcgdGhlIFJ1bGVzIG9mIEhvb2tzXFxuMy4gWW91IG1pZ2h0IGhhdmUgbW9yZSB0aGFuIG9uZSBjb3B5IG9mIFJlYWN0IGluIHRoZSBzYW1lIGFwcFxcblNlZSBodHRwczovL3JlYWN0LmRldi9saW5rL2ludmFsaWQtaG9vay1jYWxsIGZvciB0aXBzIGFib3V0IGhvdyB0byBkZWJ1ZyBhbmQgZml4IHRoaXMgcHJvYmxlbS5cIlxuICAgICAgICApO1xuICAgICAgcmV0dXJuIGRpc3BhdGNoZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlbGVhc2VBc3luY1RyYW5zaXRpb24oKSB7XG4gICAgICBSZWFjdFNoYXJlZEludGVybmFscy5hc3luY1RyYW5zaXRpb25zLS07XG4gICAgfVxuICAgIGZ1bmN0aW9uIGVucXVldWVUYXNrKHRhc2spIHtcbiAgICAgIGlmIChudWxsID09PSBlbnF1ZXVlVGFza0ltcGwpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIHJlcXVpcmVTdHJpbmcgPSAoXCJyZXF1aXJlXCIgKyBNYXRoLnJhbmRvbSgpKS5zbGljZSgwLCA3KTtcbiAgICAgICAgICBlbnF1ZXVlVGFza0ltcGwgPSAobW9kdWxlICYmIG1vZHVsZVtyZXF1aXJlU3RyaW5nXSkuY2FsbChcbiAgICAgICAgICAgIG1vZHVsZSxcbiAgICAgICAgICAgIFwidGltZXJzXCJcbiAgICAgICAgICApLnNldEltbWVkaWF0ZTtcbiAgICAgICAgfSBjYXRjaCAoX2Vycikge1xuICAgICAgICAgIGVucXVldWVUYXNrSW1wbCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgITEgPT09IGRpZFdhcm5BYm91dE1lc3NhZ2VDaGFubmVsICYmXG4gICAgICAgICAgICAgICgoZGlkV2FybkFib3V0TWVzc2FnZUNoYW5uZWwgPSAhMCksXG4gICAgICAgICAgICAgIFwidW5kZWZpbmVkXCIgPT09IHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAmJlxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgICAgICBcIlRoaXMgYnJvd3NlciBkb2VzIG5vdCBoYXZlIGEgTWVzc2FnZUNoYW5uZWwgaW1wbGVtZW50YXRpb24sIHNvIGVucXVldWluZyB0YXNrcyB2aWEgYXdhaXQgYWN0KGFzeW5jICgpID0+IC4uLikgd2lsbCBmYWlsLiBQbGVhc2UgZmlsZSBhbiBpc3N1ZSBhdCBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QvaXNzdWVzIGlmIHlvdSBlbmNvdW50ZXIgdGhpcyB3YXJuaW5nLlwiXG4gICAgICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgICAgICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBjYWxsYmFjaztcbiAgICAgICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2Uodm9pZCAwKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICByZXR1cm4gZW5xdWV1ZVRhc2tJbXBsKHRhc2spO1xuICAgIH1cbiAgICBmdW5jdGlvbiBhZ2dyZWdhdGVFcnJvcnMoZXJyb3JzKSB7XG4gICAgICByZXR1cm4gMSA8IGVycm9ycy5sZW5ndGggJiYgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgQWdncmVnYXRlRXJyb3JcbiAgICAgICAgPyBuZXcgQWdncmVnYXRlRXJyb3IoZXJyb3JzKVxuICAgICAgICA6IGVycm9yc1swXTtcbiAgICB9XG4gICAgZnVuY3Rpb24gcG9wQWN0U2NvcGUocHJldkFjdFF1ZXVlLCBwcmV2QWN0U2NvcGVEZXB0aCkge1xuICAgICAgcHJldkFjdFNjb3BlRGVwdGggIT09IGFjdFNjb3BlRGVwdGggLSAxICYmXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJZb3Ugc2VlbSB0byBoYXZlIG92ZXJsYXBwaW5nIGFjdCgpIGNhbGxzLCB0aGlzIGlzIG5vdCBzdXBwb3J0ZWQuIEJlIHN1cmUgdG8gYXdhaXQgcHJldmlvdXMgYWN0KCkgY2FsbHMgYmVmb3JlIG1ha2luZyBhIG5ldyBvbmUuIFwiXG4gICAgICAgICk7XG4gICAgICBhY3RTY29wZURlcHRoID0gcHJldkFjdFNjb3BlRGVwdGg7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlY3Vyc2l2ZWx5Rmx1c2hBc3luY0FjdFdvcmsocmV0dXJuVmFsdWUsIHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIHF1ZXVlID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuYWN0UXVldWU7XG4gICAgICBpZiAobnVsbCAhPT0gcXVldWUpXG4gICAgICAgIGlmICgwICE9PSBxdWV1ZS5sZW5ndGgpXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZsdXNoQWN0UXVldWUocXVldWUpO1xuICAgICAgICAgICAgZW5xdWV1ZVRhc2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICByZXR1cm4gcmVjdXJzaXZlbHlGbHVzaEFzeW5jQWN0V29yayhyZXR1cm5WYWx1ZSwgcmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICBlbHNlIFJlYWN0U2hhcmVkSW50ZXJuYWxzLmFjdFF1ZXVlID0gbnVsbDtcbiAgICAgIDAgPCBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoXG4gICAgICAgID8gKChxdWV1ZSA9IGFnZ3JlZ2F0ZUVycm9ycyhSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMpKSxcbiAgICAgICAgICAoUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aCA9IDApLFxuICAgICAgICAgIHJlamVjdChxdWV1ZSkpXG4gICAgICAgIDogcmVzb2x2ZShyZXR1cm5WYWx1ZSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGZsdXNoQWN0UXVldWUocXVldWUpIHtcbiAgICAgIGlmICghaXNGbHVzaGluZykge1xuICAgICAgICBpc0ZsdXNoaW5nID0gITA7XG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBmb3IgKDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBxdWV1ZVtpXTtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMuZGlkVXNlUHJvbWlzZSA9ICExO1xuICAgICAgICAgICAgICB2YXIgY29udGludWF0aW9uID0gY2FsbGJhY2soITEpO1xuICAgICAgICAgICAgICBpZiAobnVsbCAhPT0gY29udGludWF0aW9uKSB7XG4gICAgICAgICAgICAgICAgaWYgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLmRpZFVzZVByb21pc2UpIHtcbiAgICAgICAgICAgICAgICAgIHF1ZXVlW2ldID0gY2FsbGJhY2s7XG4gICAgICAgICAgICAgICAgICBxdWV1ZS5zcGxpY2UoMCwgaSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gY29udGludWF0aW9uO1xuICAgICAgICAgICAgICB9IGVsc2UgYnJlYWs7XG4gICAgICAgICAgICB9IHdoaWxlICgxKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBxdWV1ZS5zcGxpY2UoMCwgaSArIDEpLCBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgaXNGbHVzaGluZyA9ICExO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFwidW5kZWZpbmVkXCIgIT09IHR5cGVvZiBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18gJiZcbiAgICAgIFwiZnVuY3Rpb25cIiA9PT1cbiAgICAgICAgdHlwZW9mIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RhcnQgJiZcbiAgICAgIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RhcnQoRXJyb3IoKSk7XG4gICAgdmFyIFJFQUNUX0VMRU1FTlRfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC50cmFuc2l0aW9uYWwuZWxlbWVudFwiKSxcbiAgICAgIFJFQUNUX1BPUlRBTF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnBvcnRhbFwiKSxcbiAgICAgIFJFQUNUX0ZSQUdNRU5UX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZnJhZ21lbnRcIiksXG4gICAgICBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN0cmljdF9tb2RlXCIpLFxuICAgICAgUkVBQ1RfUFJPRklMRVJfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5wcm9maWxlclwiKSxcbiAgICAgIFJFQUNUX0NPTlNVTUVSX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuY29uc3VtZXJcIiksXG4gICAgICBSRUFDVF9DT05URVhUX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuY29udGV4dFwiKSxcbiAgICAgIFJFQUNUX0ZPUldBUkRfUkVGX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZm9yd2FyZF9yZWZcIiksXG4gICAgICBSRUFDVF9TVVNQRU5TRV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlXCIpLFxuICAgICAgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlX2xpc3RcIiksXG4gICAgICBSRUFDVF9NRU1PX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QubWVtb1wiKSxcbiAgICAgIFJFQUNUX0xBWllfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5sYXp5XCIpLFxuICAgICAgUkVBQ1RfQUNUSVZJVFlfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5hY3Rpdml0eVwiKSxcbiAgICAgIE1BWUJFX0lURVJBVE9SX1NZTUJPTCA9IFN5bWJvbC5pdGVyYXRvcixcbiAgICAgIGRpZFdhcm5TdGF0ZVVwZGF0ZUZvclVubW91bnRlZENvbXBvbmVudCA9IHt9LFxuICAgICAgUmVhY3ROb29wVXBkYXRlUXVldWUgPSB7XG4gICAgICAgIGlzTW91bnRlZDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAhMTtcbiAgICAgICAgfSxcbiAgICAgICAgZW5xdWV1ZUZvcmNlVXBkYXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UpIHtcbiAgICAgICAgICB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgXCJmb3JjZVVwZGF0ZVwiKTtcbiAgICAgICAgfSxcbiAgICAgICAgZW5xdWV1ZVJlcGxhY2VTdGF0ZTogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlKSB7XG4gICAgICAgICAgd2Fybk5vb3AocHVibGljSW5zdGFuY2UsIFwicmVwbGFjZVN0YXRlXCIpO1xuICAgICAgICB9LFxuICAgICAgICBlbnF1ZXVlU2V0U3RhdGU6IGZ1bmN0aW9uIChwdWJsaWNJbnN0YW5jZSkge1xuICAgICAgICAgIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCBcInNldFN0YXRlXCIpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYXNzaWduID0gT2JqZWN0LmFzc2lnbixcbiAgICAgIGVtcHR5T2JqZWN0ID0ge307XG4gICAgT2JqZWN0LmZyZWV6ZShlbXB0eU9iamVjdCk7XG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5pc1JlYWN0Q29tcG9uZW50ID0ge307XG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5zZXRTdGF0ZSA9IGZ1bmN0aW9uIChwYXJ0aWFsU3RhdGUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAoXG4gICAgICAgIFwib2JqZWN0XCIgIT09IHR5cGVvZiBwYXJ0aWFsU3RhdGUgJiZcbiAgICAgICAgXCJmdW5jdGlvblwiICE9PSB0eXBlb2YgcGFydGlhbFN0YXRlICYmXG4gICAgICAgIG51bGwgIT0gcGFydGlhbFN0YXRlXG4gICAgICApXG4gICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgIFwidGFrZXMgYW4gb2JqZWN0IG9mIHN0YXRlIHZhcmlhYmxlcyB0byB1cGRhdGUgb3IgYSBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFuIG9iamVjdCBvZiBzdGF0ZSB2YXJpYWJsZXMuXCJcbiAgICAgICAgKTtcbiAgICAgIHRoaXMudXBkYXRlci5lbnF1ZXVlU2V0U3RhdGUodGhpcywgcGFydGlhbFN0YXRlLCBjYWxsYmFjaywgXCJzZXRTdGF0ZVwiKTtcbiAgICB9O1xuICAgIENvbXBvbmVudC5wcm90b3R5cGUuZm9yY2VVcGRhdGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHRoaXMudXBkYXRlci5lbnF1ZXVlRm9yY2VVcGRhdGUodGhpcywgY2FsbGJhY2ssIFwiZm9yY2VVcGRhdGVcIik7XG4gICAgfTtcbiAgICB2YXIgZGVwcmVjYXRlZEFQSXMgPSB7XG4gICAgICBpc01vdW50ZWQ6IFtcbiAgICAgICAgXCJpc01vdW50ZWRcIixcbiAgICAgICAgXCJJbnN0ZWFkLCBtYWtlIHN1cmUgdG8gY2xlYW4gdXAgc3Vic2NyaXB0aW9ucyBhbmQgcGVuZGluZyByZXF1ZXN0cyBpbiBjb21wb25lbnRXaWxsVW5tb3VudCB0byBwcmV2ZW50IG1lbW9yeSBsZWFrcy5cIlxuICAgICAgXSxcbiAgICAgIHJlcGxhY2VTdGF0ZTogW1xuICAgICAgICBcInJlcGxhY2VTdGF0ZVwiLFxuICAgICAgICBcIlJlZmFjdG9yIHlvdXIgY29kZSB0byB1c2Ugc2V0U3RhdGUgaW5zdGVhZCAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9pc3N1ZXMvMzIzNikuXCJcbiAgICAgIF1cbiAgICB9O1xuICAgIGZvciAoZm5OYW1lIGluIGRlcHJlY2F0ZWRBUElzKVxuICAgICAgZGVwcmVjYXRlZEFQSXMuaGFzT3duUHJvcGVydHkoZm5OYW1lKSAmJlxuICAgICAgICBkZWZpbmVEZXByZWNhdGlvbldhcm5pbmcoZm5OYW1lLCBkZXByZWNhdGVkQVBJc1tmbk5hbWVdKTtcbiAgICBDb21wb25lbnREdW1teS5wcm90b3R5cGUgPSBDb21wb25lbnQucHJvdG90eXBlO1xuICAgIGRlcHJlY2F0ZWRBUElzID0gUHVyZUNvbXBvbmVudC5wcm90b3R5cGUgPSBuZXcgQ29tcG9uZW50RHVtbXkoKTtcbiAgICBkZXByZWNhdGVkQVBJcy5jb25zdHJ1Y3RvciA9IFB1cmVDb21wb25lbnQ7XG4gICAgYXNzaWduKGRlcHJlY2F0ZWRBUElzLCBDb21wb25lbnQucHJvdG90eXBlKTtcbiAgICBkZXByZWNhdGVkQVBJcy5pc1B1cmVSZWFjdENvbXBvbmVudCA9ICEwO1xuICAgIHZhciBpc0FycmF5SW1wbCA9IEFycmF5LmlzQXJyYXksXG4gICAgICBSRUFDVF9DTElFTlRfUkVGRVJFTkNFID0gU3ltYm9sLmZvcihcInJlYWN0LmNsaWVudC5yZWZlcmVuY2VcIiksXG4gICAgICBSZWFjdFNoYXJlZEludGVybmFscyA9IHtcbiAgICAgICAgSDogbnVsbCxcbiAgICAgICAgQTogbnVsbCxcbiAgICAgICAgVDogbnVsbCxcbiAgICAgICAgUzogbnVsbCxcbiAgICAgICAgYWN0UXVldWU6IG51bGwsXG4gICAgICAgIGFzeW5jVHJhbnNpdGlvbnM6IDAsXG4gICAgICAgIGlzQmF0Y2hpbmdMZWdhY3k6ICExLFxuICAgICAgICBkaWRTY2hlZHVsZUxlZ2FjeVVwZGF0ZTogITEsXG4gICAgICAgIGRpZFVzZVByb21pc2U6ICExLFxuICAgICAgICB0aHJvd25FcnJvcnM6IFtdLFxuICAgICAgICBnZXRDdXJyZW50U3RhY2s6IG51bGwsXG4gICAgICAgIHJlY2VudGx5Q3JlYXRlZE93bmVyU3RhY2tzOiAwXG4gICAgICB9LFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LFxuICAgICAgY3JlYXRlVGFzayA9IGNvbnNvbGUuY3JlYXRlVGFza1xuICAgICAgICA/IGNvbnNvbGUuY3JlYXRlVGFza1xuICAgICAgICA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH07XG4gICAgZGVwcmVjYXRlZEFQSXMgPSB7XG4gICAgICByZWFjdF9zdGFja19ib3R0b21fZnJhbWU6IGZ1bmN0aW9uIChjYWxsU3RhY2tGb3JFcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbFN0YWNrRm9yRXJyb3IoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93biwgZGlkV2FybkFib3V0T2xkSlNYUnVudGltZTtcbiAgICB2YXIgZGlkV2FybkFib3V0RWxlbWVudFJlZiA9IHt9O1xuICAgIHZhciB1bmtub3duT3duZXJEZWJ1Z1N0YWNrID0gZGVwcmVjYXRlZEFQSXMucmVhY3Rfc3RhY2tfYm90dG9tX2ZyYW1lLmJpbmQoXG4gICAgICBkZXByZWNhdGVkQVBJcyxcbiAgICAgIFVua25vd25Pd25lclxuICAgICkoKTtcbiAgICB2YXIgdW5rbm93bk93bmVyRGVidWdUYXNrID0gY3JlYXRlVGFzayhnZXRUYXNrTmFtZShVbmtub3duT3duZXIpKTtcbiAgICB2YXIgZGlkV2FybkFib3V0TWFwcyA9ICExLFxuICAgICAgdXNlclByb3ZpZGVkS2V5RXNjYXBlUmVnZXggPSAvXFwvKy9nLFxuICAgICAgcmVwb3J0R2xvYmFsRXJyb3IgPVxuICAgICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiByZXBvcnRFcnJvclxuICAgICAgICAgID8gcmVwb3J0RXJyb3JcbiAgICAgICAgICA6IGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHdpbmRvdyAmJlxuICAgICAgICAgICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHdpbmRvdy5FcnJvckV2ZW50XG4gICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHZhciBldmVudCA9IG5ldyB3aW5kb3cuRXJyb3JFdmVudChcImVycm9yXCIsIHtcbiAgICAgICAgICAgICAgICAgIGJ1YmJsZXM6ICEwLFxuICAgICAgICAgICAgICAgICAgY2FuY2VsYWJsZTogITAsXG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOlxuICAgICAgICAgICAgICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2YgZXJyb3IgJiZcbiAgICAgICAgICAgICAgICAgICAgbnVsbCAhPT0gZXJyb3IgJiZcbiAgICAgICAgICAgICAgICAgICAgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIGVycm9yLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgICA/IFN0cmluZyhlcnJvci5tZXNzYWdlKVxuICAgICAgICAgICAgICAgICAgICAgIDogU3RyaW5nKGVycm9yKSxcbiAgICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvclxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICghd2luZG93LmRpc3BhdGNoRXZlbnQoZXZlbnQpKSByZXR1cm47XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHByb2Nlc3MgJiZcbiAgICAgICAgICAgICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBwcm9jZXNzLmVtaXRcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5lbWl0KFwidW5jYXVnaHRFeGNlcHRpb25cIiwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0sXG4gICAgICBkaWRXYXJuQWJvdXRNZXNzYWdlQ2hhbm5lbCA9ICExLFxuICAgICAgZW5xdWV1ZVRhc2tJbXBsID0gbnVsbCxcbiAgICAgIGFjdFNjb3BlRGVwdGggPSAwLFxuICAgICAgZGlkV2Fybk5vQXdhaXRBY3QgPSAhMSxcbiAgICAgIGlzRmx1c2hpbmcgPSAhMSxcbiAgICAgIHF1ZXVlU2V2ZXJhbE1pY3JvdGFza3MgPVxuICAgICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBxdWV1ZU1pY3JvdGFza1xuICAgICAgICAgID8gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIHF1ZXVlTWljcm90YXNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVldWVNaWNyb3Rhc2soY2FsbGJhY2spO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICA6IGVucXVldWVUYXNrO1xuICAgIGRlcHJlY2F0ZWRBUElzID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgICBfX3Byb3RvX186IG51bGwsXG4gICAgICBjOiBmdW5jdGlvbiAoc2l6ZSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VNZW1vQ2FjaGUoc2l6ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdmFyIGZuTmFtZSA9IHtcbiAgICAgIG1hcDogbWFwQ2hpbGRyZW4sXG4gICAgICBmb3JFYWNoOiBmdW5jdGlvbiAoY2hpbGRyZW4sIGZvckVhY2hGdW5jLCBmb3JFYWNoQ29udGV4dCkge1xuICAgICAgICBtYXBDaGlsZHJlbihcbiAgICAgICAgICBjaGlsZHJlbixcbiAgICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBmb3JFYWNoRnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZm9yRWFjaENvbnRleHRcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBjb3VudDogZnVuY3Rpb24gKGNoaWxkcmVuKSB7XG4gICAgICAgIHZhciBuID0gMDtcbiAgICAgICAgbWFwQ2hpbGRyZW4oY2hpbGRyZW4sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBuKys7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbjtcbiAgICAgIH0sXG4gICAgICB0b0FycmF5OiBmdW5jdGlvbiAoY2hpbGRyZW4pIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBtYXBDaGlsZHJlbihjaGlsZHJlbiwgZnVuY3Rpb24gKGNoaWxkKSB7XG4gICAgICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICAgICAgfSkgfHwgW11cbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBvbmx5OiBmdW5jdGlvbiAoY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKCFpc1ZhbGlkRWxlbWVudChjaGlsZHJlbikpXG4gICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICBcIlJlYWN0LkNoaWxkcmVuLm9ubHkgZXhwZWN0ZWQgdG8gcmVjZWl2ZSBhIHNpbmdsZSBSZWFjdCBlbGVtZW50IGNoaWxkLlwiXG4gICAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgICAgfVxuICAgIH07XG4gICAgZXhwb3J0cy5BY3Rpdml0eSA9IFJFQUNUX0FDVElWSVRZX1RZUEU7XG4gICAgZXhwb3J0cy5DaGlsZHJlbiA9IGZuTmFtZTtcbiAgICBleHBvcnRzLkNvbXBvbmVudCA9IENvbXBvbmVudDtcbiAgICBleHBvcnRzLkZyYWdtZW50ID0gUkVBQ1RfRlJBR01FTlRfVFlQRTtcbiAgICBleHBvcnRzLlByb2ZpbGVyID0gUkVBQ1RfUFJPRklMRVJfVFlQRTtcbiAgICBleHBvcnRzLlB1cmVDb21wb25lbnQgPSBQdXJlQ29tcG9uZW50O1xuICAgIGV4cG9ydHMuU3RyaWN0TW9kZSA9IFJFQUNUX1NUUklDVF9NT0RFX1RZUEU7XG4gICAgZXhwb3J0cy5TdXNwZW5zZSA9IFJFQUNUX1NVU1BFTlNFX1RZUEU7XG4gICAgZXhwb3J0cy5fX0NMSUVOVF9JTlRFUk5BTFNfRE9fTk9UX1VTRV9PUl9XQVJOX1VTRVJTX1RIRVlfQ0FOTk9UX1VQR1JBREUgPVxuICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHM7XG4gICAgZXhwb3J0cy5fX0NPTVBJTEVSX1JVTlRJTUUgPSBkZXByZWNhdGVkQVBJcztcbiAgICBleHBvcnRzLmFjdCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgdmFyIHByZXZBY3RRdWV1ZSA9IFJlYWN0U2hhcmVkSW50ZXJuYWxzLmFjdFF1ZXVlLFxuICAgICAgICBwcmV2QWN0U2NvcGVEZXB0aCA9IGFjdFNjb3BlRGVwdGg7XG4gICAgICBhY3RTY29wZURlcHRoKys7XG4gICAgICB2YXIgcXVldWUgPSAoUmVhY3RTaGFyZWRJbnRlcm5hbHMuYWN0UXVldWUgPVxuICAgICAgICAgIG51bGwgIT09IHByZXZBY3RRdWV1ZSA/IHByZXZBY3RRdWV1ZSA6IFtdKSxcbiAgICAgICAgZGlkQXdhaXRBY3RDYWxsID0gITE7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gY2FsbGJhY2soKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5wdXNoKGVycm9yKTtcbiAgICAgIH1cbiAgICAgIGlmICgwIDwgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aClcbiAgICAgICAgdGhyb3cgKFxuICAgICAgICAgIChwb3BBY3RTY29wZShwcmV2QWN0UXVldWUsIHByZXZBY3RTY29wZURlcHRoKSxcbiAgICAgICAgICAoY2FsbGJhY2sgPSBhZ2dyZWdhdGVFcnJvcnMoUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzKSksXG4gICAgICAgICAgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGggPSAwKSxcbiAgICAgICAgICBjYWxsYmFjaylcbiAgICAgICAgKTtcbiAgICAgIGlmIChcbiAgICAgICAgbnVsbCAhPT0gcmVzdWx0ICYmXG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiByZXN1bHQgJiZcbiAgICAgICAgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgcmVzdWx0LnRoZW5cbiAgICAgICkge1xuICAgICAgICB2YXIgdGhlbmFibGUgPSByZXN1bHQ7XG4gICAgICAgIHF1ZXVlU2V2ZXJhbE1pY3JvdGFza3MoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGRpZEF3YWl0QWN0Q2FsbCB8fFxuICAgICAgICAgICAgZGlkV2Fybk5vQXdhaXRBY3QgfHxcbiAgICAgICAgICAgICgoZGlkV2Fybk5vQXdhaXRBY3QgPSAhMCksXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcIllvdSBjYWxsZWQgYWN0KGFzeW5jICgpID0+IC4uLikgd2l0aG91dCBhd2FpdC4gVGhpcyBjb3VsZCBsZWFkIHRvIHVuZXhwZWN0ZWQgdGVzdGluZyBiZWhhdmlvdXIsIGludGVybGVhdmluZyBtdWx0aXBsZSBhY3QgY2FsbHMgYW5kIG1peGluZyB0aGVpciBzY29wZXMuIFlvdSBzaG91bGQgLSBhd2FpdCBhY3QoYXN5bmMgKCkgPT4gLi4uKTtcIlxuICAgICAgICAgICAgKSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRoZW46IGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGRpZEF3YWl0QWN0Q2FsbCA9ICEwO1xuICAgICAgICAgICAgdGhlbmFibGUudGhlbihcbiAgICAgICAgICAgICAgZnVuY3Rpb24gKHJldHVyblZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcG9wQWN0U2NvcGUocHJldkFjdFF1ZXVlLCBwcmV2QWN0U2NvcGVEZXB0aCk7XG4gICAgICAgICAgICAgICAgaWYgKDAgPT09IHByZXZBY3RTY29wZURlcHRoKSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmbHVzaEFjdFF1ZXVlKHF1ZXVlKSxcbiAgICAgICAgICAgICAgICAgICAgICBlbnF1ZXVlVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVjdXJzaXZlbHlGbHVzaEFzeW5jQWN0V29yayhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yJDApIHtcbiAgICAgICAgICAgICAgICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLnB1c2goZXJyb3IkMCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoMCA8IFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIF90aHJvd25FcnJvciA9IGFnZ3JlZ2F0ZUVycm9ycyhcbiAgICAgICAgICAgICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnNcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChfdGhyb3duRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSByZXNvbHZlKHJldHVyblZhbHVlKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgcG9wQWN0U2NvcGUocHJldkFjdFF1ZXVlLCBwcmV2QWN0U2NvcGVEZXB0aCk7XG4gICAgICAgICAgICAgICAgMCA8IFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGhcbiAgICAgICAgICAgICAgICAgID8gKChlcnJvciA9IGFnZ3JlZ2F0ZUVycm9ycyhcbiAgICAgICAgICAgICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnNcbiAgICAgICAgICAgICAgICAgICAgKSksXG4gICAgICAgICAgICAgICAgICAgIChSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoID0gMCksXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcikpXG4gICAgICAgICAgICAgICAgICA6IHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdmFyIHJldHVyblZhbHVlJGpzY29tcCQwID0gcmVzdWx0O1xuICAgICAgcG9wQWN0U2NvcGUocHJldkFjdFF1ZXVlLCBwcmV2QWN0U2NvcGVEZXB0aCk7XG4gICAgICAwID09PSBwcmV2QWN0U2NvcGVEZXB0aCAmJlxuICAgICAgICAoZmx1c2hBY3RRdWV1ZShxdWV1ZSksXG4gICAgICAgIDAgIT09IHF1ZXVlLmxlbmd0aCAmJlxuICAgICAgICAgIHF1ZXVlU2V2ZXJhbE1pY3JvdGFza3MoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZGlkQXdhaXRBY3RDYWxsIHx8XG4gICAgICAgICAgICAgIGRpZFdhcm5Ob0F3YWl0QWN0IHx8XG4gICAgICAgICAgICAgICgoZGlkV2Fybk5vQXdhaXRBY3QgPSAhMCksXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgICAgXCJBIGNvbXBvbmVudCBzdXNwZW5kZWQgaW5zaWRlIGFuIGBhY3RgIHNjb3BlLCBidXQgdGhlIGBhY3RgIGNhbGwgd2FzIG5vdCBhd2FpdGVkLiBXaGVuIHRlc3RpbmcgUmVhY3QgY29tcG9uZW50cyB0aGF0IGRlcGVuZCBvbiBhc3luY2hyb25vdXMgZGF0YSwgeW91IG11c3QgYXdhaXQgdGhlIHJlc3VsdDpcXG5cXG5hd2FpdCBhY3QoKCkgPT4gLi4uKVwiXG4gICAgICAgICAgICAgICkpO1xuICAgICAgICAgIH0pLFxuICAgICAgICAoUmVhY3RTaGFyZWRJbnRlcm5hbHMuYWN0UXVldWUgPSBudWxsKSk7XG4gICAgICBpZiAoMCA8IFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGgpXG4gICAgICAgIHRocm93IChcbiAgICAgICAgICAoKGNhbGxiYWNrID0gYWdncmVnYXRlRXJyb3JzKFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycykpLFxuICAgICAgICAgIChSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoID0gMCksXG4gICAgICAgICAgY2FsbGJhY2spXG4gICAgICAgICk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0aGVuOiBmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgZGlkQXdhaXRBY3RDYWxsID0gITA7XG4gICAgICAgICAgMCA9PT0gcHJldkFjdFNjb3BlRGVwdGhcbiAgICAgICAgICAgID8gKChSZWFjdFNoYXJlZEludGVybmFscy5hY3RRdWV1ZSA9IHF1ZXVlKSxcbiAgICAgICAgICAgICAgZW5xdWV1ZVRhc2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWN1cnNpdmVseUZsdXNoQXN5bmNBY3RXb3JrKFxuICAgICAgICAgICAgICAgICAgcmV0dXJuVmFsdWUkanNjb21wJDAsXG4gICAgICAgICAgICAgICAgICByZXNvbHZlLFxuICAgICAgICAgICAgICAgICAgcmVqZWN0XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICA6IHJlc29sdmUocmV0dXJuVmFsdWUkanNjb21wJDApO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH07XG4gICAgZXhwb3J0cy5jYWNoZSA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH07XG4gICAgZXhwb3J0cy5jYWNoZVNpZ25hbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG4gICAgZXhwb3J0cy5jYXB0dXJlT3duZXJTdGFjayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBnZXRDdXJyZW50U3RhY2sgPSBSZWFjdFNoYXJlZEludGVybmFscy5nZXRDdXJyZW50U3RhY2s7XG4gICAgICByZXR1cm4gbnVsbCA9PT0gZ2V0Q3VycmVudFN0YWNrID8gbnVsbCA6IGdldEN1cnJlbnRTdGFjaygpO1xuICAgIH07XG4gICAgZXhwb3J0cy5jbG9uZUVsZW1lbnQgPSBmdW5jdGlvbiAoZWxlbWVudCwgY29uZmlnLCBjaGlsZHJlbikge1xuICAgICAgaWYgKG51bGwgPT09IGVsZW1lbnQgfHwgdm9pZCAwID09PSBlbGVtZW50KVxuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBcIlRoZSBhcmd1bWVudCBtdXN0IGJlIGEgUmVhY3QgZWxlbWVudCwgYnV0IHlvdSBwYXNzZWQgXCIgK1xuICAgICAgICAgICAgZWxlbWVudCArXG4gICAgICAgICAgICBcIi5cIlxuICAgICAgICApO1xuICAgICAgdmFyIHByb3BzID0gYXNzaWduKHt9LCBlbGVtZW50LnByb3BzKSxcbiAgICAgICAga2V5ID0gZWxlbWVudC5rZXksXG4gICAgICAgIG93bmVyID0gZWxlbWVudC5fb3duZXI7XG4gICAgICBpZiAobnVsbCAhPSBjb25maWcpIHtcbiAgICAgICAgdmFyIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdDtcbiAgICAgICAgYToge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBcInJlZlwiKSAmJlxuICAgICAgICAgICAgKEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXG4gICAgICAgICAgICAgIGNvbmZpZyxcbiAgICAgICAgICAgICAgXCJyZWZcIlxuICAgICAgICAgICAgKS5nZXQpICYmXG4gICAgICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQuaXNSZWFjdFdhcm5pbmdcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9ICExO1xuICAgICAgICAgICAgYnJlYWsgYTtcbiAgICAgICAgICB9XG4gICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gdm9pZCAwICE9PSBjb25maWcucmVmO1xuICAgICAgICB9XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCAmJiAob3duZXIgPSBnZXRPd25lcigpKTtcbiAgICAgICAgaGFzVmFsaWRLZXkoY29uZmlnKSAmJlxuICAgICAgICAgIChjaGVja0tleVN0cmluZ0NvZXJjaW9uKGNvbmZpZy5rZXkpLCAoa2V5ID0gXCJcIiArIGNvbmZpZy5rZXkpKTtcbiAgICAgICAgZm9yIChwcm9wTmFtZSBpbiBjb25maWcpXG4gICAgICAgICAgIWhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBwcm9wTmFtZSkgfHxcbiAgICAgICAgICAgIFwia2V5XCIgPT09IHByb3BOYW1lIHx8XG4gICAgICAgICAgICBcIl9fc2VsZlwiID09PSBwcm9wTmFtZSB8fFxuICAgICAgICAgICAgXCJfX3NvdXJjZVwiID09PSBwcm9wTmFtZSB8fFxuICAgICAgICAgICAgKFwicmVmXCIgPT09IHByb3BOYW1lICYmIHZvaWQgMCA9PT0gY29uZmlnLnJlZikgfHxcbiAgICAgICAgICAgIChwcm9wc1twcm9wTmFtZV0gPSBjb25maWdbcHJvcE5hbWVdKTtcbiAgICAgIH1cbiAgICAgIHZhciBwcm9wTmFtZSA9IGFyZ3VtZW50cy5sZW5ndGggLSAyO1xuICAgICAgaWYgKDEgPT09IHByb3BOYW1lKSBwcm9wcy5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgICAgZWxzZSBpZiAoMSA8IHByb3BOYW1lKSB7XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9IEFycmF5KHByb3BOYW1lKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wTmFtZTsgaSsrKVxuICAgICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdFtpXSA9IGFyZ3VtZW50c1tpICsgMl07XG4gICAgICAgIHByb3BzLmNoaWxkcmVuID0gSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0O1xuICAgICAgfVxuICAgICAgcHJvcHMgPSBSZWFjdEVsZW1lbnQoXG4gICAgICAgIGVsZW1lbnQudHlwZSxcbiAgICAgICAga2V5LFxuICAgICAgICBwcm9wcyxcbiAgICAgICAgb3duZXIsXG4gICAgICAgIGVsZW1lbnQuX2RlYnVnU3RhY2ssXG4gICAgICAgIGVsZW1lbnQuX2RlYnVnVGFza1xuICAgICAgKTtcbiAgICAgIGZvciAoa2V5ID0gMjsga2V5IDwgYXJndW1lbnRzLmxlbmd0aDsga2V5KyspXG4gICAgICAgIHZhbGlkYXRlQ2hpbGRLZXlzKGFyZ3VtZW50c1trZXldKTtcbiAgICAgIHJldHVybiBwcm9wcztcbiAgICB9O1xuICAgIGV4cG9ydHMuY3JlYXRlQ29udGV4dCA9IGZ1bmN0aW9uIChkZWZhdWx0VmFsdWUpIHtcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0NPTlRFWFRfVFlQRSxcbiAgICAgICAgX2N1cnJlbnRWYWx1ZTogZGVmYXVsdFZhbHVlLFxuICAgICAgICBfY3VycmVudFZhbHVlMjogZGVmYXVsdFZhbHVlLFxuICAgICAgICBfdGhyZWFkQ291bnQ6IDAsXG4gICAgICAgIFByb3ZpZGVyOiBudWxsLFxuICAgICAgICBDb25zdW1lcjogbnVsbFxuICAgICAgfTtcbiAgICAgIGRlZmF1bHRWYWx1ZS5Qcm92aWRlciA9IGRlZmF1bHRWYWx1ZTtcbiAgICAgIGRlZmF1bHRWYWx1ZS5Db25zdW1lciA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0NPTlNVTUVSX1RZUEUsXG4gICAgICAgIF9jb250ZXh0OiBkZWZhdWx0VmFsdWVcbiAgICAgIH07XG4gICAgICBkZWZhdWx0VmFsdWUuX2N1cnJlbnRSZW5kZXJlciA9IG51bGw7XG4gICAgICBkZWZhdWx0VmFsdWUuX2N1cnJlbnRSZW5kZXJlcjIgPSBudWxsO1xuICAgICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICB9O1xuICAgIGV4cG9ydHMuY3JlYXRlRWxlbWVudCA9IGZ1bmN0aW9uICh0eXBlLCBjb25maWcsIGNoaWxkcmVuKSB7XG4gICAgICBmb3IgKHZhciBpID0gMjsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcbiAgICAgICAgdmFsaWRhdGVDaGlsZEtleXMoYXJndW1lbnRzW2ldKTtcbiAgICAgIGkgPSB7fTtcbiAgICAgIHZhciBrZXkgPSBudWxsO1xuICAgICAgaWYgKG51bGwgIT0gY29uZmlnKVxuICAgICAgICBmb3IgKHByb3BOYW1lIGluIChkaWRXYXJuQWJvdXRPbGRKU1hSdW50aW1lIHx8XG4gICAgICAgICAgIShcIl9fc2VsZlwiIGluIGNvbmZpZykgfHxcbiAgICAgICAgICBcImtleVwiIGluIGNvbmZpZyB8fFxuICAgICAgICAgICgoZGlkV2FybkFib3V0T2xkSlNYUnVudGltZSA9ICEwKSxcbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBcIllvdXIgYXBwIChvciBvbmUgb2YgaXRzIGRlcGVuZGVuY2llcykgaXMgdXNpbmcgYW4gb3V0ZGF0ZWQgSlNYIHRyYW5zZm9ybS4gVXBkYXRlIHRvIHRoZSBtb2Rlcm4gSlNYIHRyYW5zZm9ybSBmb3IgZmFzdGVyIHBlcmZvcm1hbmNlOiBodHRwczovL3JlYWN0LmRldi9saW5rL25ldy1qc3gtdHJhbnNmb3JtXCJcbiAgICAgICAgICApKSxcbiAgICAgICAgaGFzVmFsaWRLZXkoY29uZmlnKSAmJlxuICAgICAgICAgIChjaGVja0tleVN0cmluZ0NvZXJjaW9uKGNvbmZpZy5rZXkpLCAoa2V5ID0gXCJcIiArIGNvbmZpZy5rZXkpKSxcbiAgICAgICAgY29uZmlnKSlcbiAgICAgICAgICBoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgcHJvcE5hbWUpICYmXG4gICAgICAgICAgICBcImtleVwiICE9PSBwcm9wTmFtZSAmJlxuICAgICAgICAgICAgXCJfX3NlbGZcIiAhPT0gcHJvcE5hbWUgJiZcbiAgICAgICAgICAgIFwiX19zb3VyY2VcIiAhPT0gcHJvcE5hbWUgJiZcbiAgICAgICAgICAgIChpW3Byb3BOYW1lXSA9IGNvbmZpZ1twcm9wTmFtZV0pO1xuICAgICAgdmFyIGNoaWxkcmVuTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCAtIDI7XG4gICAgICBpZiAoMSA9PT0gY2hpbGRyZW5MZW5ndGgpIGkuY2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgICAgIGVsc2UgaWYgKDEgPCBjaGlsZHJlbkxlbmd0aCkge1xuICAgICAgICBmb3IgKFxuICAgICAgICAgIHZhciBjaGlsZEFycmF5ID0gQXJyYXkoY2hpbGRyZW5MZW5ndGgpLCBfaSA9IDA7XG4gICAgICAgICAgX2kgPCBjaGlsZHJlbkxlbmd0aDtcbiAgICAgICAgICBfaSsrXG4gICAgICAgIClcbiAgICAgICAgICBjaGlsZEFycmF5W19pXSA9IGFyZ3VtZW50c1tfaSArIDJdO1xuICAgICAgICBPYmplY3QuZnJlZXplICYmIE9iamVjdC5mcmVlemUoY2hpbGRBcnJheSk7XG4gICAgICAgIGkuY2hpbGRyZW4gPSBjaGlsZEFycmF5O1xuICAgICAgfVxuICAgICAgaWYgKHR5cGUgJiYgdHlwZS5kZWZhdWx0UHJvcHMpXG4gICAgICAgIGZvciAocHJvcE5hbWUgaW4gKChjaGlsZHJlbkxlbmd0aCA9IHR5cGUuZGVmYXVsdFByb3BzKSwgY2hpbGRyZW5MZW5ndGgpKVxuICAgICAgICAgIHZvaWQgMCA9PT0gaVtwcm9wTmFtZV0gJiYgKGlbcHJvcE5hbWVdID0gY2hpbGRyZW5MZW5ndGhbcHJvcE5hbWVdKTtcbiAgICAgIGtleSAmJlxuICAgICAgICBkZWZpbmVLZXlQcm9wV2FybmluZ0dldHRlcihcbiAgICAgICAgICBpLFxuICAgICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHR5cGVcbiAgICAgICAgICAgID8gdHlwZS5kaXNwbGF5TmFtZSB8fCB0eXBlLm5hbWUgfHwgXCJVbmtub3duXCJcbiAgICAgICAgICAgIDogdHlwZVxuICAgICAgICApO1xuICAgICAgdmFyIHByb3BOYW1lID0gMWU0ID4gUmVhY3RTaGFyZWRJbnRlcm5hbHMucmVjZW50bHlDcmVhdGVkT3duZXJTdGFja3MrKztcbiAgICAgIHJldHVybiBSZWFjdEVsZW1lbnQoXG4gICAgICAgIHR5cGUsXG4gICAgICAgIGtleSxcbiAgICAgICAgaSxcbiAgICAgICAgZ2V0T3duZXIoKSxcbiAgICAgICAgcHJvcE5hbWUgPyBFcnJvcihcInJlYWN0LXN0YWNrLXRvcC1mcmFtZVwiKSA6IHVua25vd25Pd25lckRlYnVnU3RhY2ssXG4gICAgICAgIHByb3BOYW1lID8gY3JlYXRlVGFzayhnZXRUYXNrTmFtZSh0eXBlKSkgOiB1bmtub3duT3duZXJEZWJ1Z1Rhc2tcbiAgICAgICk7XG4gICAgfTtcbiAgICBleHBvcnRzLmNyZWF0ZVJlZiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciByZWZPYmplY3QgPSB7IGN1cnJlbnQ6IG51bGwgfTtcbiAgICAgIE9iamVjdC5zZWFsKHJlZk9iamVjdCk7XG4gICAgICByZXR1cm4gcmVmT2JqZWN0O1xuICAgIH07XG4gICAgZXhwb3J0cy5mb3J3YXJkUmVmID0gZnVuY3Rpb24gKHJlbmRlcikge1xuICAgICAgbnVsbCAhPSByZW5kZXIgJiYgcmVuZGVyLiQkdHlwZW9mID09PSBSRUFDVF9NRU1PX1RZUEVcbiAgICAgICAgPyBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgXCJmb3J3YXJkUmVmIHJlcXVpcmVzIGEgcmVuZGVyIGZ1bmN0aW9uIGJ1dCByZWNlaXZlZCBhIGBtZW1vYCBjb21wb25lbnQuIEluc3RlYWQgb2YgZm9yd2FyZFJlZihtZW1vKC4uLikpLCB1c2UgbWVtbyhmb3J3YXJkUmVmKC4uLikpLlwiXG4gICAgICAgICAgKVxuICAgICAgICA6IFwiZnVuY3Rpb25cIiAhPT0gdHlwZW9mIHJlbmRlclxuICAgICAgICAgID8gY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgXCJmb3J3YXJkUmVmIHJlcXVpcmVzIGEgcmVuZGVyIGZ1bmN0aW9uIGJ1dCB3YXMgZ2l2ZW4gJXMuXCIsXG4gICAgICAgICAgICAgIG51bGwgPT09IHJlbmRlciA/IFwibnVsbFwiIDogdHlwZW9mIHJlbmRlclxuICAgICAgICAgICAgKVxuICAgICAgICAgIDogMCAhPT0gcmVuZGVyLmxlbmd0aCAmJlxuICAgICAgICAgICAgMiAhPT0gcmVuZGVyLmxlbmd0aCAmJlxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgXCJmb3J3YXJkUmVmIHJlbmRlciBmdW5jdGlvbnMgYWNjZXB0IGV4YWN0bHkgdHdvIHBhcmFtZXRlcnM6IHByb3BzIGFuZCByZWYuICVzXCIsXG4gICAgICAgICAgICAgIDEgPT09IHJlbmRlci5sZW5ndGhcbiAgICAgICAgICAgICAgICA/IFwiRGlkIHlvdSBmb3JnZXQgdG8gdXNlIHRoZSByZWYgcGFyYW1ldGVyP1wiXG4gICAgICAgICAgICAgICAgOiBcIkFueSBhZGRpdGlvbmFsIHBhcmFtZXRlciB3aWxsIGJlIHVuZGVmaW5lZC5cIlxuICAgICAgICAgICAgKTtcbiAgICAgIG51bGwgIT0gcmVuZGVyICYmXG4gICAgICAgIG51bGwgIT0gcmVuZGVyLmRlZmF1bHRQcm9wcyAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiZm9yd2FyZFJlZiByZW5kZXIgZnVuY3Rpb25zIGRvIG5vdCBzdXBwb3J0IGRlZmF1bHRQcm9wcy4gRGlkIHlvdSBhY2NpZGVudGFsbHkgcGFzcyBhIFJlYWN0IGNvbXBvbmVudD9cIlxuICAgICAgICApO1xuICAgICAgdmFyIGVsZW1lbnRUeXBlID0geyAkJHR5cGVvZjogUkVBQ1RfRk9SV0FSRF9SRUZfVFlQRSwgcmVuZGVyOiByZW5kZXIgfSxcbiAgICAgICAgb3duTmFtZTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlbGVtZW50VHlwZSwgXCJkaXNwbGF5TmFtZVwiLCB7XG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICBjb25maWd1cmFibGU6ICEwLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gb3duTmFtZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgIG93bk5hbWUgPSBuYW1lO1xuICAgICAgICAgIHJlbmRlci5uYW1lIHx8XG4gICAgICAgICAgICByZW5kZXIuZGlzcGxheU5hbWUgfHxcbiAgICAgICAgICAgIChPYmplY3QuZGVmaW5lUHJvcGVydHkocmVuZGVyLCBcIm5hbWVcIiwgeyB2YWx1ZTogbmFtZSB9KSxcbiAgICAgICAgICAgIChyZW5kZXIuZGlzcGxheU5hbWUgPSBuYW1lKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGVsZW1lbnRUeXBlO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc1ZhbGlkRWxlbWVudCA9IGlzVmFsaWRFbGVtZW50O1xuICAgIGV4cG9ydHMubGF6eSA9IGZ1bmN0aW9uIChjdG9yKSB7XG4gICAgICBjdG9yID0geyBfc3RhdHVzOiAtMSwgX3Jlc3VsdDogY3RvciB9O1xuICAgICAgdmFyIGxhenlUeXBlID0ge1xuICAgICAgICAgICQkdHlwZW9mOiBSRUFDVF9MQVpZX1RZUEUsXG4gICAgICAgICAgX3BheWxvYWQ6IGN0b3IsXG4gICAgICAgICAgX2luaXQ6IGxhenlJbml0aWFsaXplclxuICAgICAgICB9LFxuICAgICAgICBpb0luZm8gPSB7XG4gICAgICAgICAgbmFtZTogXCJsYXp5XCIsXG4gICAgICAgICAgc3RhcnQ6IC0xLFxuICAgICAgICAgIGVuZDogLTEsXG4gICAgICAgICAgdmFsdWU6IG51bGwsXG4gICAgICAgICAgb3duZXI6IG51bGwsXG4gICAgICAgICAgZGVidWdTdGFjazogRXJyb3IoXCJyZWFjdC1zdGFjay10b3AtZnJhbWVcIiksXG4gICAgICAgICAgZGVidWdUYXNrOiBjb25zb2xlLmNyZWF0ZVRhc2sgPyBjb25zb2xlLmNyZWF0ZVRhc2soXCJsYXp5KClcIikgOiBudWxsXG4gICAgICAgIH07XG4gICAgICBjdG9yLl9pb0luZm8gPSBpb0luZm87XG4gICAgICBsYXp5VHlwZS5fZGVidWdJbmZvID0gW3sgYXdhaXRlZDogaW9JbmZvIH1dO1xuICAgICAgcmV0dXJuIGxhenlUeXBlO1xuICAgIH07XG4gICAgZXhwb3J0cy5tZW1vID0gZnVuY3Rpb24gKHR5cGUsIGNvbXBhcmUpIHtcbiAgICAgIG51bGwgPT0gdHlwZSAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwibWVtbzogVGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBjb21wb25lbnQuIEluc3RlYWQgcmVjZWl2ZWQ6ICVzXCIsXG4gICAgICAgICAgbnVsbCA9PT0gdHlwZSA/IFwibnVsbFwiIDogdHlwZW9mIHR5cGVcbiAgICAgICAgKTtcbiAgICAgIGNvbXBhcmUgPSB7XG4gICAgICAgICQkdHlwZW9mOiBSRUFDVF9NRU1PX1RZUEUsXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGNvbXBhcmU6IHZvaWQgMCA9PT0gY29tcGFyZSA/IG51bGwgOiBjb21wYXJlXG4gICAgICB9O1xuICAgICAgdmFyIG93bk5hbWU7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29tcGFyZSwgXCJkaXNwbGF5TmFtZVwiLCB7XG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICBjb25maWd1cmFibGU6ICEwLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gb3duTmFtZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgIG93bk5hbWUgPSBuYW1lO1xuICAgICAgICAgIHR5cGUubmFtZSB8fFxuICAgICAgICAgICAgdHlwZS5kaXNwbGF5TmFtZSB8fFxuICAgICAgICAgICAgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIm5hbWVcIiwgeyB2YWx1ZTogbmFtZSB9KSxcbiAgICAgICAgICAgICh0eXBlLmRpc3BsYXlOYW1lID0gbmFtZSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBjb21wYXJlO1xuICAgIH07XG4gICAgZXhwb3J0cy5zdGFydFRyYW5zaXRpb24gPSBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICAgIHZhciBwcmV2VHJhbnNpdGlvbiA9IFJlYWN0U2hhcmVkSW50ZXJuYWxzLlQsXG4gICAgICAgIGN1cnJlbnRUcmFuc2l0aW9uID0ge307XG4gICAgICBjdXJyZW50VHJhbnNpdGlvbi5fdXBkYXRlZEZpYmVycyA9IG5ldyBTZXQoKTtcbiAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzLlQgPSBjdXJyZW50VHJhbnNpdGlvbjtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciByZXR1cm5WYWx1ZSA9IHNjb3BlKCksXG4gICAgICAgICAgb25TdGFydFRyYW5zaXRpb25GaW5pc2ggPSBSZWFjdFNoYXJlZEludGVybmFscy5TO1xuICAgICAgICBudWxsICE9PSBvblN0YXJ0VHJhbnNpdGlvbkZpbmlzaCAmJlxuICAgICAgICAgIG9uU3RhcnRUcmFuc2l0aW9uRmluaXNoKGN1cnJlbnRUcmFuc2l0aW9uLCByZXR1cm5WYWx1ZSk7XG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiByZXR1cm5WYWx1ZSAmJlxuICAgICAgICAgIG51bGwgIT09IHJldHVyblZhbHVlICYmXG4gICAgICAgICAgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgcmV0dXJuVmFsdWUudGhlbiAmJlxuICAgICAgICAgIChSZWFjdFNoYXJlZEludGVybmFscy5hc3luY1RyYW5zaXRpb25zKyssXG4gICAgICAgICAgcmV0dXJuVmFsdWUudGhlbihyZWxlYXNlQXN5bmNUcmFuc2l0aW9uLCByZWxlYXNlQXN5bmNUcmFuc2l0aW9uKSxcbiAgICAgICAgICByZXR1cm5WYWx1ZS50aGVuKG5vb3AsIHJlcG9ydEdsb2JhbEVycm9yKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZXBvcnRHbG9iYWxFcnJvcihlcnJvcik7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBudWxsID09PSBwcmV2VHJhbnNpdGlvbiAmJlxuICAgICAgICAgIGN1cnJlbnRUcmFuc2l0aW9uLl91cGRhdGVkRmliZXJzICYmXG4gICAgICAgICAgKChzY29wZSA9IGN1cnJlbnRUcmFuc2l0aW9uLl91cGRhdGVkRmliZXJzLnNpemUpLFxuICAgICAgICAgIGN1cnJlbnRUcmFuc2l0aW9uLl91cGRhdGVkRmliZXJzLmNsZWFyKCksXG4gICAgICAgICAgMTAgPCBzY29wZSAmJlxuICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICBcIkRldGVjdGVkIGEgbGFyZ2UgbnVtYmVyIG9mIHVwZGF0ZXMgaW5zaWRlIHN0YXJ0VHJhbnNpdGlvbi4gSWYgdGhpcyBpcyBkdWUgdG8gYSBzdWJzY3JpcHRpb24gcGxlYXNlIHJlLXdyaXRlIGl0IHRvIHVzZSBSZWFjdCBwcm92aWRlZCBob29rcy4gT3RoZXJ3aXNlIGNvbmN1cnJlbnQgbW9kZSBndWFyYW50ZWVzIGFyZSBvZmYgdGhlIHRhYmxlLlwiXG4gICAgICAgICAgICApKSxcbiAgICAgICAgICBudWxsICE9PSBwcmV2VHJhbnNpdGlvbiAmJlxuICAgICAgICAgICAgbnVsbCAhPT0gY3VycmVudFRyYW5zaXRpb24udHlwZXMgJiZcbiAgICAgICAgICAgIChudWxsICE9PSBwcmV2VHJhbnNpdGlvbi50eXBlcyAmJlxuICAgICAgICAgICAgICBwcmV2VHJhbnNpdGlvbi50eXBlcyAhPT0gY3VycmVudFRyYW5zaXRpb24udHlwZXMgJiZcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgICBcIldlIGV4cGVjdGVkIGlubmVyIFRyYW5zaXRpb25zIHRvIGhhdmUgdHJhbnNmZXJyZWQgdGhlIG91dGVyIHR5cGVzIHNldCBhbmQgdGhhdCB5b3UgY2Fubm90IGFkZCB0byB0aGUgb3V0ZXIgVHJhbnNpdGlvbiB3aGlsZSBpbnNpZGUgdGhlIGlubmVyLlRoaXMgaXMgYSBidWcgaW4gUmVhY3QuXCJcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIChwcmV2VHJhbnNpdGlvbi50eXBlcyA9IGN1cnJlbnRUcmFuc2l0aW9uLnR5cGVzKSksXG4gICAgICAgICAgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLlQgPSBwcmV2VHJhbnNpdGlvbik7XG4gICAgICB9XG4gICAgfTtcbiAgICBleHBvcnRzLnVuc3RhYmxlX3VzZUNhY2hlUmVmcmVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUNhY2hlUmVmcmVzaCgpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2UgPSBmdW5jdGlvbiAodXNhYmxlKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2UodXNhYmxlKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlQWN0aW9uU3RhdGUgPSBmdW5jdGlvbiAoYWN0aW9uLCBpbml0aWFsU3RhdGUsIHBlcm1hbGluaykge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlQWN0aW9uU3RhdGUoXG4gICAgICAgIGFjdGlvbixcbiAgICAgICAgaW5pdGlhbFN0YXRlLFxuICAgICAgICBwZXJtYWxpbmtcbiAgICAgICk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZUNhbGxiYWNrID0gZnVuY3Rpb24gKGNhbGxiYWNrLCBkZXBzKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VDYWxsYmFjayhjYWxsYmFjaywgZGVwcyk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZUNvbnRleHQgPSBmdW5jdGlvbiAoQ29udGV4dCkge1xuICAgICAgdmFyIGRpc3BhdGNoZXIgPSByZXNvbHZlRGlzcGF0Y2hlcigpO1xuICAgICAgQ29udGV4dC4kJHR5cGVvZiA9PT0gUkVBQ1RfQ09OU1VNRVJfVFlQRSAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiQ2FsbGluZyB1c2VDb250ZXh0KENvbnRleHQuQ29uc3VtZXIpIGlzIG5vdCBzdXBwb3J0ZWQgYW5kIHdpbGwgY2F1c2UgYnVncy4gRGlkIHlvdSBtZWFuIHRvIGNhbGwgdXNlQ29udGV4dChDb250ZXh0KSBpbnN0ZWFkP1wiXG4gICAgICAgICk7XG4gICAgICByZXR1cm4gZGlzcGF0Y2hlci51c2VDb250ZXh0KENvbnRleHQpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VEZWJ1Z1ZhbHVlID0gZnVuY3Rpb24gKHZhbHVlLCBmb3JtYXR0ZXJGbikge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlRGVidWdWYWx1ZSh2YWx1ZSwgZm9ybWF0dGVyRm4pO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VEZWZlcnJlZFZhbHVlID0gZnVuY3Rpb24gKHZhbHVlLCBpbml0aWFsVmFsdWUpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZURlZmVycmVkVmFsdWUodmFsdWUsIGluaXRpYWxWYWx1ZSk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZUVmZmVjdCA9IGZ1bmN0aW9uIChjcmVhdGUsIGRlcHMpIHtcbiAgICAgIG51bGwgPT0gY3JlYXRlICYmXG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBcIlJlYWN0IEhvb2sgdXNlRWZmZWN0IHJlcXVpcmVzIGFuIGVmZmVjdCBjYWxsYmFjay4gRGlkIHlvdSBmb3JnZXQgdG8gcGFzcyBhIGNhbGxiYWNrIHRvIHRoZSBob29rP1wiXG4gICAgICAgICk7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VFZmZlY3QoY3JlYXRlLCBkZXBzKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlRWZmZWN0RXZlbnQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUVmZmVjdEV2ZW50KGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlSWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VJZCgpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VJbXBlcmF0aXZlSGFuZGxlID0gZnVuY3Rpb24gKHJlZiwgY3JlYXRlLCBkZXBzKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VJbXBlcmF0aXZlSGFuZGxlKHJlZiwgY3JlYXRlLCBkZXBzKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlSW5zZXJ0aW9uRWZmZWN0ID0gZnVuY3Rpb24gKGNyZWF0ZSwgZGVwcykge1xuICAgICAgbnVsbCA9PSBjcmVhdGUgJiZcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIFwiUmVhY3QgSG9vayB1c2VJbnNlcnRpb25FZmZlY3QgcmVxdWlyZXMgYW4gZWZmZWN0IGNhbGxiYWNrLiBEaWQgeW91IGZvcmdldCB0byBwYXNzIGEgY2FsbGJhY2sgdG8gdGhlIGhvb2s/XCJcbiAgICAgICAgKTtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUluc2VydGlvbkVmZmVjdChjcmVhdGUsIGRlcHMpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VMYXlvdXRFZmZlY3QgPSBmdW5jdGlvbiAoY3JlYXRlLCBkZXBzKSB7XG4gICAgICBudWxsID09IGNyZWF0ZSAmJlxuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgXCJSZWFjdCBIb29rIHVzZUxheW91dEVmZmVjdCByZXF1aXJlcyBhbiBlZmZlY3QgY2FsbGJhY2suIERpZCB5b3UgZm9yZ2V0IHRvIHBhc3MgYSBjYWxsYmFjayB0byB0aGUgaG9vaz9cIlxuICAgICAgICApO1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlTGF5b3V0RWZmZWN0KGNyZWF0ZSwgZGVwcyk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZU1lbW8gPSBmdW5jdGlvbiAoY3JlYXRlLCBkZXBzKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VNZW1vKGNyZWF0ZSwgZGVwcyk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZU9wdGltaXN0aWMgPSBmdW5jdGlvbiAocGFzc3Rocm91Z2gsIHJlZHVjZXIpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZU9wdGltaXN0aWMocGFzc3Rocm91Z2gsIHJlZHVjZXIpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VSZWR1Y2VyID0gZnVuY3Rpb24gKHJlZHVjZXIsIGluaXRpYWxBcmcsIGluaXQpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZVJlZHVjZXIocmVkdWNlciwgaW5pdGlhbEFyZywgaW5pdCk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZVJlZiA9IGZ1bmN0aW9uIChpbml0aWFsVmFsdWUpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZVJlZihpbml0aWFsVmFsdWUpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VTdGF0ZSA9IGZ1bmN0aW9uIChpbml0aWFsU3RhdGUpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZVN0YXRlKGluaXRpYWxTdGF0ZSk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZVN5bmNFeHRlcm5hbFN0b3JlID0gZnVuY3Rpb24gKFxuICAgICAgc3Vic2NyaWJlLFxuICAgICAgZ2V0U25hcHNob3QsXG4gICAgICBnZXRTZXJ2ZXJTbmFwc2hvdFxuICAgICkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlU3luY0V4dGVybmFsU3RvcmUoXG4gICAgICAgIHN1YnNjcmliZSxcbiAgICAgICAgZ2V0U25hcHNob3QsXG4gICAgICAgIGdldFNlcnZlclNuYXBzaG90XG4gICAgICApO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VUcmFuc2l0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlVHJhbnNpdGlvbigpO1xuICAgIH07XG4gICAgZXhwb3J0cy52ZXJzaW9uID0gXCIxOS4yLjBcIjtcbiAgICBcInVuZGVmaW5lZFwiICE9PSB0eXBlb2YgX19SRUFDVF9ERVZUT09MU19HTE9CQUxfSE9PS19fICYmXG4gICAgICBcImZ1bmN0aW9uXCIgPT09XG4gICAgICAgIHR5cGVvZiBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18ucmVnaXN0ZXJJbnRlcm5hbE1vZHVsZVN0b3AgJiZcbiAgICAgIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RvcChFcnJvcigpKTtcbiAgfSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2Nqcy9yZWFjdC5wcm9kdWN0aW9uLmpzJyk7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LmRldmVsb3BtZW50LmpzJyk7XG59XG4iLCIvKipcbiAqIFJTQyBDbGllbnQgTW9kdWxlIC0gRm9yIE1haW4gVGhyZWFkXG4gKlxuICogUHJvdmlkZXMgdXRpbGl0aWVzIGZvciBjb25zdW1pbmcgUlNDIHN0cmVhbXMgYW5kIGNhbGxpbmcgc2VydmVyIGFjdGlvbnMuXG4gKlxuICogSU1QT1JUQU5UOiBJbXBvcnQgd2VicGFjay1zaGltIGJlZm9yZSB0aGlzIG1vZHVsZTpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgJy4vcnNjL3dlYnBhY2stc2hpbSc7XG4gKiBpbXBvcnQgeyBjb25zdW1lUlNDIH0gZnJvbSAnLi9yc2MvY2xpZW50JztcbiAqIGBgYFxuICovXG5cbmltcG9ydCB0eXBlIHsgRW5jb2RlZEFjdGlvbkFyZ3MgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vKipcbiAqIFdhaXQgZm9yIHNlcnZpY2Ugd29ya2VyIHRvIGJlIGNvbnRyb2xsaW5nIHRoZSBwYWdlLlxuICogUmVzb2x2ZXMgd2hlbiB0aGUgU1cgaXMgYWN0aXZlIEFORCBoYXMgY2xhaW1lZCB0aGlzIGNsaWVudC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGF3YWl0IGVuc3VyZVdvcmtlclJlYWR5KCk7XG4gKiAvLyBOb3cgc2FmZSB0byBtYWtlIHJlcXVlc3RzIHRoYXQgdGhlIFNXIHdpbGwgaW50ZXJjZXB0XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuc3VyZVdvcmtlclJlYWR5KCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIShcInNlcnZpY2VXb3JrZXJcIiBpbiBuYXZpZ2F0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiU2VydmljZSBXb3JrZXJzIG5vdCBzdXBwb3J0ZWRcIik7XG4gIH1cblxuICBhd2FpdCBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWFkeTtcblxuICAvLyBJZiBhbHJlYWR5IGNvbnRyb2xsZWQsIHdlJ3JlIGdvb2RcbiAgaWYgKG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBXYWl0IGZvciBjb250cm9sbGVyIHRvIGJlIHNldCAoYWZ0ZXIgY2xpZW50cy5jbGFpbSgpKVxuICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgIGNvbnN0IG9uQ2hhbmdlID0gKCkgPT4ge1xuICAgICAgaWYgKG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNvbnRyb2xsZXJjaGFuZ2VcIiwgb25DaGFuZ2UpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5hZGRFdmVudExpc3RlbmVyKFwiY29udHJvbGxlcmNoYW5nZVwiLCBvbkNoYW5nZSk7XG4gICAgLy8gQ2hlY2sgYWdhaW4gaW4gY2FzZSBpdCB3YXMgc2V0IGJldHdlZW4gcmVhZHkgYW5kIGFkZEV2ZW50TGlzdGVuZXJcbiAgICBpZiAobmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuY29udHJvbGxlcikge1xuICAgICAgbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNvbnRyb2xsZXJjaGFuZ2VcIiwgb25DaGFuZ2UpO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIExhenkgaW1wb3J0cyB0byBlbnN1cmUgd2VicGFjay1zaGltIGxvYWRzIGZpcnN0XG5sZXQgX2NyZWF0ZUZyb21SZWFkYWJsZVN0cmVhbTogdHlwZW9mIGltcG9ydChcInJlYWN0LXNlcnZlci1kb20td2VicGFjay9jbGllbnRcIikuY3JlYXRlRnJvbVJlYWRhYmxlU3RyZWFtO1xubGV0IF9lbmNvZGVSZXBseTogdHlwZW9mIGltcG9ydChcInJlYWN0LXNlcnZlci1kb20td2VicGFjay9jbGllbnRcIikuZW5jb2RlUmVwbHk7XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUltcG9ydHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghX2NyZWF0ZUZyb21SZWFkYWJsZVN0cmVhbSkge1xuICAgIGNvbnN0IG1vZCA9IGF3YWl0IGltcG9ydChcInJlYWN0LXNlcnZlci1kb20td2VicGFjay9jbGllbnRcIik7XG4gICAgX2NyZWF0ZUZyb21SZWFkYWJsZVN0cmVhbSA9IG1vZC5jcmVhdGVGcm9tUmVhZGFibGVTdHJlYW07XG4gICAgX2VuY29kZVJlcGx5ID0gbW9kLmVuY29kZVJlcGx5O1xuICB9XG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgY29uc3VtaW5nIGFuIFJTQyBzdHJlYW1cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb25zdW1lUlNDT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBGdW5jdGlvbiB0byBjYWxsIHNlcnZlciBhY3Rpb25zXG4gICAqIFJlcXVpcmVkIGlmIHRoZSBSU0MgcGF5bG9hZCBjb250YWlucyBzZXJ2ZXIgYWN0aW9uIHJlZmVyZW5jZXNcbiAgICovXG4gIGNhbGxTZXJ2ZXI/OiAoYWN0aW9uSWQ6IHN0cmluZywgYXJnczogdW5rbm93bltdKSA9PiBQcm9taXNlPHVua25vd24+O1xufVxuXG4vKipcbiAqIENvbnN1bWUgYW4gUlNDIHN0cmVhbSBhbmQgcmV0dXJuIHRoZSBSZWFjdCBlbGVtZW50IHRyZWVcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJy9yc2MnKTtcbiAqIGNvbnN0IGVsZW1lbnQgPSBhd2FpdCBjb25zdW1lUlNDKHJlc3BvbnNlLmJvZHkhKTtcbiAqIHJvb3QucmVuZGVyKGVsZW1lbnQpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb25zdW1lUlNDPFQgPSB1bmtub3duPihcbiAgc3RyZWFtOiBSZWFkYWJsZVN0cmVhbTxVaW50OEFycmF5PixcbiAgb3B0aW9ucz86IENvbnN1bWVSU0NPcHRpb25zLFxuKTogUHJvbWlzZTxUPiB7XG4gIGF3YWl0IGVuc3VyZUltcG9ydHMoKTtcbiAgcmV0dXJuIF9jcmVhdGVGcm9tUmVhZGFibGVTdHJlYW08VD4oXG4gICAgc3RyZWFtLFxuICAgIG9wdGlvbnM/LmNhbGxTZXJ2ZXIgPyB7IGNhbGxTZXJ2ZXI6IG9wdGlvbnMuY2FsbFNlcnZlciB9IDoge30sXG4gICk7XG59XG5cbi8qKlxuICogQ29uc3VtZSBhbiBSU0MgUmVzcG9uc2UgYW5kIHJldHVybiB0aGUgUmVhY3QgZWxlbWVudCB0cmVlXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb25zdW1lUlNDUmVzcG9uc2U8VCA9IHVua25vd24+KFxuICByZXNwb25zZTogUmVzcG9uc2UsXG4gIG9wdGlvbnM/OiBDb25zdW1lUlNDT3B0aW9ucyxcbik6IFByb21pc2U8VD4ge1xuICBpZiAoIXJlc3BvbnNlLmJvZHkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZXNwb25zZSBoYXMgbm8gYm9keVwiKTtcbiAgfVxuICByZXR1cm4gY29uc3VtZVJTQzxUPihyZXNwb25zZS5ib2R5LCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBFbmNvZGUgYWN0aW9uIGFyZ3VtZW50cyBmb3Igc2VuZGluZyB0byB0aGUgc2VydmVyXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBjb25zdCBlbmNvZGVkID0gYXdhaXQgZW5jb2RlQWN0aW9uQXJncyhbY291bnQsIHsgaW5jcmVtZW50OiB0cnVlIH1dKTtcbiAqIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJy9yc2MvYWN0aW9uJywge1xuICogICBtZXRob2Q6ICdQT1NUJyxcbiAqICAgYm9keTogZW5jb2RlZC5kYXRhLFxuICogICBoZWFkZXJzOiB7ICd4LXJzYy1hY3Rpb24nOiAnaW5jcmVtZW50Q291bnQnIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmNvZGVBY3Rpb25BcmdzKGFyZ3M6IHVua25vd25bXSk6IFByb21pc2U8RW5jb2RlZEFjdGlvbkFyZ3M+IHtcbiAgYXdhaXQgZW5zdXJlSW1wb3J0cygpO1xuICBjb25zdCBlbmNvZGVkID0gYXdhaXQgX2VuY29kZVJlcGx5KGFyZ3MpO1xuXG4gIGlmIChlbmNvZGVkIGluc3RhbmNlb2YgRm9ybURhdGEpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogXCJmb3JtZGF0YVwiLFxuICAgICAgZGF0YTogbmV3IFVSTFNlYXJjaFBhcmFtcyhlbmNvZGVkIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPikudG9TdHJpbmcoKSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHsgdHlwZTogXCJzdHJpbmdcIiwgZGF0YTogZW5jb2RlZCBhcyBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBjYWxsU2VydmVyIGZ1bmN0aW9uIGZvciB1c2Ugd2l0aCBjb25zdW1lUlNDXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBjb25zdCBjYWxsU2VydmVyID0gY3JlYXRlQ2FsbFNlcnZlcignL3JzYy9hY3Rpb24nKTtcbiAqIGNvbnN0IGVsZW1lbnQgPSBhd2FpdCBjb25zdW1lUlNDKHN0cmVhbSwgeyBjYWxsU2VydmVyIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDYWxsU2VydmVyKFxuICBhY3Rpb25FbmRwb2ludDogc3RyaW5nLFxuICBvcHRpb25zPzogUmVxdWVzdEluaXQsXG4pOiAoYWN0aW9uSWQ6IHN0cmluZywgYXJnczogdW5rbm93bltdKSA9PiBQcm9taXNlPHVua25vd24+IHtcbiAgY29uc3QgY2FsbFNlcnZlciA9IGFzeW5jIChhY3Rpb25JZDogc3RyaW5nLCBhcmdzOiB1bmtub3duW10pOiBQcm9taXNlPHVua25vd24+ID0+IHtcbiAgICBjb25zdCBlbmNvZGVkQXJncyA9IGF3YWl0IGVuY29kZUFjdGlvbkFyZ3MoYXJncyk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGFjdGlvbkVuZHBvaW50LCB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgYm9keTogZW5jb2RlZEFyZ3MuZGF0YSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjpcbiAgICAgICAgICBlbmNvZGVkQXJncy50eXBlID09PSBcImZvcm1kYXRhXCIgPyBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIDogXCJ0ZXh0L3BsYWluXCIsXG4gICAgICAgIFwieC1yc2MtYWN0aW9uXCI6IGFjdGlvbklkLFxuICAgICAgICAuLi5vcHRpb25zPy5oZWFkZXJzLFxuICAgICAgfSxcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFjdGlvbiByZXF1ZXN0IGZhaWxlZDogJHtyZXNwb25zZS5zdGF0dXN9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnN1bWVSU0MocmVzcG9uc2UuYm9keSEsIHsgY2FsbFNlcnZlciB9KTtcbiAgfTtcblxuICByZXR1cm4gY2FsbFNlcnZlcjtcbn1cblxuLyoqXG4gKiBGZXRjaCBhbmQgY29uc3VtZSBhbiBSU0MgZW5kcG9pbnRcbiAqXG4gKiBBdXRvbWF0aWNhbGx5IHdhaXRzIGZvciB0aGUgc2VydmljZSB3b3JrZXIgdG8gYmUgY29udHJvbGxpbmcgdGhlIHBhZ2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBjb25zdCBlbGVtZW50ID0gYXdhaXQgZmV0Y2hSU0MoJy9yc2MnKTtcbiAqIHJvb3QucmVuZGVyKGVsZW1lbnQpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFJTQzxUID0gdW5rbm93bj4oXG4gIHVybDogc3RyaW5nLFxuICBvcHRpb25zPzogUmVxdWVzdEluaXQgJiBDb25zdW1lUlNDT3B0aW9ucyxcbik6IFByb21pc2U8VD4ge1xuICBhd2FpdCBlbnN1cmVXb3JrZXJSZWFkeSgpO1xuXG4gIGNvbnN0IHsgY2FsbFNlcnZlciwgLi4uZmV0Y2hPcHRpb25zIH0gPSBvcHRpb25zID8/IHt9O1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgaGVhZGVyczoge1xuICAgICAgQWNjZXB0OiBcInRleHQveC1jb21wb25lbnRcIixcbiAgICAgIC4uLmZldGNoT3B0aW9ucz8uaGVhZGVycyxcbiAgICB9LFxuICAgIC4uLmZldGNoT3B0aW9ucyxcbiAgfSk7XG5cbiAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgIHRocm93IG5ldyBFcnJvcihgUlNDIGZldGNoIGZhaWxlZDogJHtyZXNwb25zZS5zdGF0dXN9YCk7XG4gIH1cblxuICByZXR1cm4gY29uc3VtZVJTQzxUPihyZXNwb25zZS5ib2R5ISwgeyBjYWxsU2VydmVyIH0pO1xufVxuXG4vKipcbiAqIE9wdGlvbnMgZm9yIGNhbGxpbmcgYSBzZXJ2ZXIgYWN0aW9uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ2FsbEFjdGlvbk9wdGlvbnMgZXh0ZW5kcyBPbWl0PFJlcXVlc3RJbml0LCBcIm1ldGhvZFwiIHwgXCJib2R5XCI+IHtcbiAgLyoqXG4gICAqIElmIHRydWUsIHRoZSByZXNwb25zZSB3aWxsIGJlIHBhcnNlZCBhcyBSU0MgYW5kIHJldHVybmVkXG4gICAqIElmIGZhbHNlIChkZWZhdWx0KSwgb25seSBzdWNjZXNzL2ZhaWx1cmUgaXMgY2hlY2tlZFxuICAgKi9cbiAgcGFyc2VSZXNwb25zZT86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQ2FsbCBhIHNlcnZlciBhY3Rpb24gZnJvbSB0aGUgY2xpZW50XG4gKlxuICogQXV0b21hdGljYWxseSB3YWl0cyBmb3IgdGhlIHNlcnZpY2Ugd29ya2VyIHRvIGJlIGNvbnRyb2xsaW5nIHRoZSBwYWdlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogLy8gU2ltcGxlIGFjdGlvbiBjYWxsIChqdXN0IGNoZWNrIHN1Y2Nlc3MpXG4gKiBhd2FpdCBjYWxsQWN0aW9uKCcvcnNjL21vdmllcycsICd1cGRhdGVSYXRpbmcnLCBbbW92aWVJZCwgNV0pO1xuICpcbiAqIC8vIEFjdGlvbiB0aGF0IHJldHVybnMgUlNDIGRhdGFcbiAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhbGxBY3Rpb24oJy9yc2MvbW92aWVzJywgJ2dldERldGFpbHMnLCBbbW92aWVJZF0sIHsgcGFyc2VSZXNwb25zZTogdHJ1ZSB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbEFjdGlvbjxUID0gdm9pZD4oXG4gIGVuZHBvaW50OiBzdHJpbmcsXG4gIGFjdGlvbklkOiBzdHJpbmcsXG4gIGFyZ3M6IHVua25vd25bXSxcbiAgb3B0aW9ucz86IENhbGxBY3Rpb25PcHRpb25zLFxuKTogUHJvbWlzZTxUPiB7XG4gIGF3YWl0IGVuc3VyZVdvcmtlclJlYWR5KCk7XG5cbiAgY29uc3QgeyBwYXJzZVJlc3BvbnNlID0gZmFsc2UsIC4uLmZldGNoT3B0aW9ucyB9ID0gb3B0aW9ucyA/PyB7fTtcbiAgY29uc3QgZW5jb2RlZEFyZ3MgPSBhd2FpdCBlbmNvZGVBY3Rpb25BcmdzKGFyZ3MpO1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goZW5kcG9pbnQsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGJvZHk6IGVuY29kZWRBcmdzLmRhdGEsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJDb250ZW50LVR5cGVcIjpcbiAgICAgICAgZW5jb2RlZEFyZ3MudHlwZSA9PT0gXCJmb3JtZGF0YVwiID8gXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIiA6IFwidGV4dC9wbGFpblwiLFxuICAgICAgXCJ4LXJzYy1hY3Rpb25cIjogYWN0aW9uSWQsXG4gICAgICAuLi5mZXRjaE9wdGlvbnM/LmhlYWRlcnMsXG4gICAgfSxcbiAgICAuLi5mZXRjaE9wdGlvbnMsXG4gIH0pO1xuXG4gIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEFjdGlvbiAnJHthY3Rpb25JZH0nIGZhaWxlZDogJHtyZXNwb25zZS5zdGF0dXN9YCk7XG4gIH1cblxuICBpZiAocGFyc2VSZXNwb25zZSAmJiByZXNwb25zZS5ib2R5KSB7XG4gICAgcmV0dXJuIGNvbnN1bWVSU0M8VD4ocmVzcG9uc2UuYm9keSk7XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkIGFzIFQ7XG59XG5cbi8vIFJlLWV4cG9ydCB0eXBlc1xuZXhwb3J0IHR5cGUgeyBFbmNvZGVkQWN0aW9uQXJncyB9O1xuIiwiLyoqXG4gKiBAbGljZW5zZSBSZWFjdFxuICogcmVhY3QtaXMuZGV2ZWxvcG1lbnQuanNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIE1ldGEgUGxhdGZvcm1zLCBJbmMuIGFuZCBhZmZpbGlhdGVzLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLlxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXCJwcm9kdWN0aW9uXCIgIT09IHByb2Nlc3MuZW52Lk5PREVfRU5WICYmXG4gIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gdHlwZU9mKG9iamVjdCkge1xuICAgICAgaWYgKFwib2JqZWN0XCIgPT09IHR5cGVvZiBvYmplY3QgJiYgbnVsbCAhPT0gb2JqZWN0KSB7XG4gICAgICAgIHZhciAkJHR5cGVvZiA9IG9iamVjdC4kJHR5cGVvZjtcbiAgICAgICAgc3dpdGNoICgkJHR5cGVvZikge1xuICAgICAgICAgIGNhc2UgUkVBQ1RfRUxFTUVOVF9UWVBFOlxuICAgICAgICAgICAgc3dpdGNoICgoKG9iamVjdCA9IG9iamVjdC50eXBlKSwgb2JqZWN0KSkge1xuICAgICAgICAgICAgICBjYXNlIFJFQUNUX0ZSQUdNRU5UX1RZUEU6XG4gICAgICAgICAgICAgIGNhc2UgUkVBQ1RfUFJPRklMRVJfVFlQRTpcbiAgICAgICAgICAgICAgY2FzZSBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFOlxuICAgICAgICAgICAgICBjYXNlIFJFQUNUX1NVU1BFTlNFX1RZUEU6XG4gICAgICAgICAgICAgIGNhc2UgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFOlxuICAgICAgICAgICAgICBjYXNlIFJFQUNUX1ZJRVdfVFJBTlNJVElPTl9UWVBFOlxuICAgICAgICAgICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgc3dpdGNoICgoKG9iamVjdCA9IG9iamVjdCAmJiBvYmplY3QuJCR0eXBlb2YpLCBvYmplY3QpKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlIFJFQUNUX0NPTlRFWFRfVFlQRTpcbiAgICAgICAgICAgICAgICAgIGNhc2UgUkVBQ1RfRk9SV0FSRF9SRUZfVFlQRTpcbiAgICAgICAgICAgICAgICAgIGNhc2UgUkVBQ1RfTEFaWV9UWVBFOlxuICAgICAgICAgICAgICAgICAgY2FzZSBSRUFDVF9NRU1PX1RZUEU6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgICAgICAgICAgICAgICBjYXNlIFJFQUNUX0NPTlNVTUVSX1RZUEU6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJCR0eXBlb2Y7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIGNhc2UgUkVBQ1RfUE9SVEFMX1RZUEU6XG4gICAgICAgICAgICByZXR1cm4gJCR0eXBlb2Y7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIFJFQUNUX0VMRU1FTlRfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC50cmFuc2l0aW9uYWwuZWxlbWVudFwiKSxcbiAgICAgIFJFQUNUX1BPUlRBTF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnBvcnRhbFwiKSxcbiAgICAgIFJFQUNUX0ZSQUdNRU5UX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZnJhZ21lbnRcIiksXG4gICAgICBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN0cmljdF9tb2RlXCIpLFxuICAgICAgUkVBQ1RfUFJPRklMRVJfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5wcm9maWxlclwiKSxcbiAgICAgIFJFQUNUX0NPTlNVTUVSX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuY29uc3VtZXJcIiksXG4gICAgICBSRUFDVF9DT05URVhUX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuY29udGV4dFwiKSxcbiAgICAgIFJFQUNUX0ZPUldBUkRfUkVGX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZm9yd2FyZF9yZWZcIiksXG4gICAgICBSRUFDVF9TVVNQRU5TRV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlXCIpLFxuICAgICAgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlX2xpc3RcIiksXG4gICAgICBSRUFDVF9NRU1PX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QubWVtb1wiKSxcbiAgICAgIFJFQUNUX0xBWllfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5sYXp5XCIpLFxuICAgICAgUkVBQ1RfVklFV19UUkFOU0lUSU9OX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3Qudmlld190cmFuc2l0aW9uXCIpLFxuICAgICAgUkVBQ1RfQ0xJRU5UX1JFRkVSRU5DRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5jbGllbnQucmVmZXJlbmNlXCIpO1xuICAgIGV4cG9ydHMuQ29udGV4dENvbnN1bWVyID0gUkVBQ1RfQ09OU1VNRVJfVFlQRTtcbiAgICBleHBvcnRzLkNvbnRleHRQcm92aWRlciA9IFJFQUNUX0NPTlRFWFRfVFlQRTtcbiAgICBleHBvcnRzLkVsZW1lbnQgPSBSRUFDVF9FTEVNRU5UX1RZUEU7XG4gICAgZXhwb3J0cy5Gb3J3YXJkUmVmID0gUkVBQ1RfRk9SV0FSRF9SRUZfVFlQRTtcbiAgICBleHBvcnRzLkZyYWdtZW50ID0gUkVBQ1RfRlJBR01FTlRfVFlQRTtcbiAgICBleHBvcnRzLkxhenkgPSBSRUFDVF9MQVpZX1RZUEU7XG4gICAgZXhwb3J0cy5NZW1vID0gUkVBQ1RfTUVNT19UWVBFO1xuICAgIGV4cG9ydHMuUG9ydGFsID0gUkVBQ1RfUE9SVEFMX1RZUEU7XG4gICAgZXhwb3J0cy5Qcm9maWxlciA9IFJFQUNUX1BST0ZJTEVSX1RZUEU7XG4gICAgZXhwb3J0cy5TdHJpY3RNb2RlID0gUkVBQ1RfU1RSSUNUX01PREVfVFlQRTtcbiAgICBleHBvcnRzLlN1c3BlbnNlID0gUkVBQ1RfU1VTUEVOU0VfVFlQRTtcbiAgICBleHBvcnRzLlN1c3BlbnNlTGlzdCA9IFJFQUNUX1NVU1BFTlNFX0xJU1RfVFlQRTtcbiAgICBleHBvcnRzLmlzQ29udGV4dENvbnN1bWVyID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgcmV0dXJuIHR5cGVPZihvYmplY3QpID09PSBSRUFDVF9DT05TVU1FUl9UWVBFO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc0NvbnRleHRQcm92aWRlciA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgIHJldHVybiB0eXBlT2Yob2JqZWN0KSA9PT0gUkVBQ1RfQ09OVEVYVF9UWVBFO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc0VsZW1lbnQgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2Ygb2JqZWN0ICYmXG4gICAgICAgIG51bGwgIT09IG9iamVjdCAmJlxuICAgICAgICBvYmplY3QuJCR0eXBlb2YgPT09IFJFQUNUX0VMRU1FTlRfVFlQRVxuICAgICAgKTtcbiAgICB9O1xuICAgIGV4cG9ydHMuaXNGb3J3YXJkUmVmID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgcmV0dXJuIHR5cGVPZihvYmplY3QpID09PSBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc0ZyYWdtZW50ID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgcmV0dXJuIHR5cGVPZihvYmplY3QpID09PSBSRUFDVF9GUkFHTUVOVF9UWVBFO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc0xhenkgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICByZXR1cm4gdHlwZU9mKG9iamVjdCkgPT09IFJFQUNUX0xBWllfVFlQRTtcbiAgICB9O1xuICAgIGV4cG9ydHMuaXNNZW1vID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgcmV0dXJuIHR5cGVPZihvYmplY3QpID09PSBSRUFDVF9NRU1PX1RZUEU7XG4gICAgfTtcbiAgICBleHBvcnRzLmlzUG9ydGFsID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgcmV0dXJuIHR5cGVPZihvYmplY3QpID09PSBSRUFDVF9QT1JUQUxfVFlQRTtcbiAgICB9O1xuICAgIGV4cG9ydHMuaXNQcm9maWxlciA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgIHJldHVybiB0eXBlT2Yob2JqZWN0KSA9PT0gUkVBQ1RfUFJPRklMRVJfVFlQRTtcbiAgICB9O1xuICAgIGV4cG9ydHMuaXNTdHJpY3RNb2RlID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgcmV0dXJuIHR5cGVPZihvYmplY3QpID09PSBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc1N1c3BlbnNlID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgcmV0dXJuIHR5cGVPZihvYmplY3QpID09PSBSRUFDVF9TVVNQRU5TRV9UWVBFO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc1N1c3BlbnNlTGlzdCA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgIHJldHVybiB0eXBlT2Yob2JqZWN0KSA9PT0gUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc1ZhbGlkRWxlbWVudFR5cGUgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgcmV0dXJuIFwic3RyaW5nXCIgPT09IHR5cGVvZiB0eXBlIHx8XG4gICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHR5cGUgfHxcbiAgICAgICAgdHlwZSA9PT0gUkVBQ1RfRlJBR01FTlRfVFlQRSB8fFxuICAgICAgICB0eXBlID09PSBSRUFDVF9QUk9GSUxFUl9UWVBFIHx8XG4gICAgICAgIHR5cGUgPT09IFJFQUNUX1NUUklDVF9NT0RFX1RZUEUgfHxcbiAgICAgICAgdHlwZSA9PT0gUkVBQ1RfU1VTUEVOU0VfVFlQRSB8fFxuICAgICAgICB0eXBlID09PSBSRUFDVF9TVVNQRU5TRV9MSVNUX1RZUEUgfHxcbiAgICAgICAgKFwib2JqZWN0XCIgPT09IHR5cGVvZiB0eXBlICYmXG4gICAgICAgICAgbnVsbCAhPT0gdHlwZSAmJlxuICAgICAgICAgICh0eXBlLiQkdHlwZW9mID09PSBSRUFDVF9MQVpZX1RZUEUgfHxcbiAgICAgICAgICAgIHR5cGUuJCR0eXBlb2YgPT09IFJFQUNUX01FTU9fVFlQRSB8fFxuICAgICAgICAgICAgdHlwZS4kJHR5cGVvZiA9PT0gUkVBQ1RfQ09OVEVYVF9UWVBFIHx8XG4gICAgICAgICAgICB0eXBlLiQkdHlwZW9mID09PSBSRUFDVF9DT05TVU1FUl9UWVBFIHx8XG4gICAgICAgICAgICB0eXBlLiQkdHlwZW9mID09PSBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFIHx8XG4gICAgICAgICAgICB0eXBlLiQkdHlwZW9mID09PSBSRUFDVF9DTElFTlRfUkVGRVJFTkNFIHx8XG4gICAgICAgICAgICB2b2lkIDAgIT09IHR5cGUuZ2V0TW9kdWxlSWQpKVxuICAgICAgICA/ICEwXG4gICAgICAgIDogITE7XG4gICAgfTtcbiAgICBleHBvcnRzLnR5cGVPZiA9IHR5cGVPZjtcbiAgfSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2Nqcy9yZWFjdC1pcy5wcm9kdWN0aW9uLmpzJyk7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LWlzLmRldmVsb3BtZW50LmpzJyk7XG59XG4iLCIvKipcbiAqIEN1c3RvbSBSU0MgRmxpZ2h0IFNlcmlhbGl6ZXIgZm9yIFNlcnZpY2UgV29ya2VyXG4gKlxuICogVGhpcyBpcyBhIG1pbmltYWwgaW1wbGVtZW50YXRpb24gb2YgdGhlIFJTQyB3aXJlIGZvcm1hdCB0aGF0IHdvcmtzXG4gKiBpbiBhbnkgSmF2YVNjcmlwdCBlbnZpcm9ubWVudCAoaW5jbHVkaW5nIHNlcnZpY2Ugd29ya2VycykuXG4gKlxuICogVGhlIHdpcmUgZm9ybWF0IGlzIGEgc2VyaWVzIG9mIG5ld2xpbmUtZGVsaW1pdGVkIEpTT04gcm93czpcbiAqIC0gYDA6e1widHlwZVwiOlwiZWxlbWVudFwiLC4uLn1gIC0gUm9vdCBlbGVtZW50XG4gKiAtIGAxOltcIiRcIixcImRpdlwiLG51bGwsey4uLn1dYCAtIEVsZW1lbnQgcmVmZXJlbmNlXG4gKiAtIGBNMTp7XCJpZFwiOlwiY2xpZW50XCIsXCJuYW1lXCI6XCJDb3VudGVyXCIsLi4ufWAgLSBNb2R1bGUgcmVmZXJlbmNlXG4gKlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QvYmxvYi9tYWluL3BhY2thZ2VzL3JlYWN0LXNlcnZlci9zcmMvUmVhY3RGbGlnaHRTZXJ2ZXIuanNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFJlYWN0Tm9kZSwgUmVhY3RFbGVtZW50IH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgeyBpc0ZyYWdtZW50IH0gZnJvbSBcInJlYWN0LWlzXCI7XG5pbXBvcnQgdHlwZSB7IENsaWVudE1hbmlmZXN0IH0gZnJvbSBcIi4vdHlwZXNcIjtcblxudHlwZSBGbGlnaHRWYWx1ZSA9XG4gIHwgc3RyaW5nXG4gIHwgbnVtYmVyXG4gIHwgYm9vbGVhblxuICB8IG51bGxcbiAgfCB1bmRlZmluZWRcbiAgfCBGbGlnaHRWYWx1ZVtdXG4gIHwgeyBba2V5OiBzdHJpbmddOiBGbGlnaHRWYWx1ZSB9XG4gIHwgRmxpZ2h0RWxlbWVudFxuICB8IEZsaWdodE1vZHVsZVJlZjtcblxuaW50ZXJmYWNlIEZsaWdodEVsZW1lbnQge1xuICAkJHR5cGVvZjogc3ltYm9sO1xuICB0eXBlOiBzdHJpbmcgfCBGbGlnaHRNb2R1bGVSZWYgfCAoKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdW5rbm93bik7XG4gIGtleTogc3RyaW5nIHwgbnVsbDtcbiAgcHJvcHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xufVxuXG5pbnRlcmZhY2UgRmxpZ2h0TW9kdWxlUmVmIHtcbiAgJCR0eXBlb2Y6IHN5bWJvbDtcbiAgbmFtZTogc3RyaW5nO1xuICBpZDogc3RyaW5nO1xufVxuXG4vLyBSZWFjdCBpbnRlcm5hbCBzeW1ib2xzXG5jb25zdCBSRUFDVF9FTEVNRU5UX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZWxlbWVudFwiKTtcbmNvbnN0IFJFQUNUX1RSQU5TSVRJT05BTF9FTEVNRU5UX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QudHJhbnNpdGlvbmFsLmVsZW1lbnRcIik7XG5jb25zdCBSRUFDVF9DTElFTlRfUkVGRVJFTkNFID0gU3ltYm9sLmZvcihcInJlYWN0LmNsaWVudC5yZWZlcmVuY2VcIik7XG5jb25zdCBSRUFDVF9TRVJWRVJfUkVGRVJFTkNFID0gU3ltYm9sLmZvcihcInJlYWN0LnNlcnZlci5yZWZlcmVuY2VcIik7XG5cbi8vIEZsaWdodCBlbmNvZGluZyBwcmVmaXhlc1xuY29uc3QgRUxFTUVOVF9QUkVGSVggPSBcIiRcIjtcbmNvbnN0IE1PRFVMRV9QUkVGSVggPSBcIiRMXCI7XG5jb25zdCBGVU5DVElPTl9QUkVGSVggPSBcIiRGXCI7XG5cbi8qKlxuICogU2VydmVyIGFjdGlvbiByZWdpc3RyeSAtIHN0b3JlcyBhY3Rpb24gZnVuY3Rpb25zIGJ5IElEXG4gKi9cbmNvbnN0IHNlcnZlckFjdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdW5rbm93bj4oKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBzZXJ2ZXIgYWN0aW9uIHJlZmVyZW5jZSB0aGF0IGNhbiBiZSBwYXNzZWQgdG8gY2xpZW50IGNvbXBvbmVudHNcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGNvbnN0IGluY3JlbWVudCA9IGNyZWF0ZVNlcnZlckFjdGlvbihcImluY3JlbWVudFwiLCBhc3luYyAoY291bnQ6IG51bWJlcikgPT4gY291bnQgKyAxKTtcbiAqIC8vIFBhc3MgdG8gY2xpZW50IGNvbXBvbmVudDpcbiAqIDxDb3VudGVyIG9uSW5jcmVtZW50PXtpbmNyZW1lbnR9IC8+XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlckFjdGlvbjxUIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KGlkOiBzdHJpbmcsIGZuOiBUKTogVCB7XG4gIHNlcnZlckFjdGlvbnMuc2V0KGlkLCBmbiBhcyAoLi4uYXJnczogdW5rbm93bltdKSA9PiB1bmtub3duKTtcblxuICBjb25zdCByZWYgPSB7XG4gICAgJCR0eXBlb2Y6IFJFQUNUX1NFUlZFUl9SRUZFUkVOQ0UsXG4gICAgJCRpZDogaWQsXG4gICAgJCRib3VuZDogbnVsbCxcbiAgfTtcblxuICByZXR1cm4gcmVmIGFzIHVua25vd24gYXMgVDtcbn1cblxuLyoqXG4gKiBHZXQgYSByZWdpc3RlcmVkIHNlcnZlciBhY3Rpb24gYnkgSURcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFNlcnZlckFjdGlvbihpZDogc3RyaW5nKTogKCguLi5hcmdzOiB1bmtub3duW10pID0+IHVua25vd24pIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIHNlcnZlckFjdGlvbnMuZ2V0KGlkKTtcbn1cblxuLyoqXG4gKiBFeGVjdXRlIGEgc2VydmVyIGFjdGlvbiBhbmQgcmV0dXJuIHRoZSByZXN1bHQgc2VyaWFsaXplZCBhcyBSU0NcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGVTZXJ2ZXJBY3Rpb24oXG4gIGFjdGlvbklkOiBzdHJpbmcsXG4gIGFyZ3M6IHVua25vd25bXSxcbiAgbWFuaWZlc3Q6IENsaWVudE1hbmlmZXN0LFxuKTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICBjb25zdCBhY3Rpb24gPSBzZXJ2ZXJBY3Rpb25zLmdldChhY3Rpb25JZCk7XG4gIGlmICghYWN0aW9uKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBgQWN0aW9uIFwiJHthY3Rpb25JZH1cIiBub3QgZm91bmRgIH0pLCB7XG4gICAgICBzdGF0dXM6IDQwNCxcbiAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYWN0aW9uKC4uLmFyZ3MpO1xuICAgIC8vIFNlcmlhbGl6ZSB0aGUgcmVzdWx0IGFzIGFuIFJTQyBzdHJlYW1cbiAgICByZXR1cm4gY3JlYXRlRmxpZ2h0UmVzcG9uc2UocmVzdWx0IGFzIFJlYWN0Tm9kZSwgbWFuaWZlc3QpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogbWVzc2FnZSB9KSwge1xuICAgICAgc3RhdHVzOiA1MDAsXG4gICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXJpYWxpemUgYSBSZWFjdCBlbGVtZW50IHRvIFJTQyB3aXJlIGZvcm1hdCAocmV0dXJucyBzdHJpbmcpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVUb0ZsaWdodFBheWxvYWQoZWxlbWVudDogUmVhY3ROb2RlLCBtYW5pZmVzdDogQ2xpZW50TWFuaWZlc3QpOiBzdHJpbmcge1xuICAvLyBTdGFydCBtb2R1bGUgSURzIGZyb20gMSB0byBsZWF2ZSAwIGZvciB0aGUgcm9vdFxuICBsZXQgbW9kdWxlUm93SWQgPSAxO1xuICBjb25zdCByb3dzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBtb2R1bGVSZWZzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgY29uc3QgYWN0aW9uUmVmcyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cbiAgZnVuY3Rpb24gZ2V0TW9kdWxlUmVmSWQobW9kdWxlSWQ6IHN0cmluZywgZXhwb3J0TmFtZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICBjb25zdCBrZXkgPSBgJHttb2R1bGVJZH0jJHtleHBvcnROYW1lfWA7XG4gICAgaWYgKG1vZHVsZVJlZnMuaGFzKGtleSkpIHtcbiAgICAgIHJldHVybiBtb2R1bGVSZWZzLmdldChrZXkpITtcbiAgICB9XG4gICAgY29uc3QgaWQgPSBtb2R1bGVSb3dJZCsrO1xuICAgIG1vZHVsZVJlZnMuc2V0KGtleSwgaWQpO1xuXG4gICAgLy8gRW1pdCBtb2R1bGUgcm93IChJID0gaW1wb3J0KVxuICAgIC8vIEZvcm1hdDogSVttb2R1bGVJZCwgY2h1bmtzLCBleHBvcnROYW1lXSB3aGVyZSBjaHVua3MgaXMgYW4gYXJyYXkgb2YgY2h1bmsgSURzXG4gICAgY29uc3QgbWFuaWZlc3RLZXkgPSBleHBvcnROYW1lID09PSBcIipcIiA/IG1vZHVsZUlkIDogYCR7bW9kdWxlSWR9IyR7ZXhwb3J0TmFtZX1gO1xuICAgIGNvbnN0IGVudHJ5ID0gbWFuaWZlc3RbbWFuaWZlc3RLZXldO1xuICAgIGNvbnN0IG1vZElkID0gZW50cnk/LmlkID8/IG1vZHVsZUlkO1xuICAgIGNvbnN0IG1vZE5hbWUgPSBlbnRyeT8ubmFtZSA/PyBleHBvcnROYW1lO1xuICAgIGNvbnN0IGNodW5rcyA9IGVudHJ5Py5jaHVua3MgPz8gW107XG5cbiAgICAvLyBGb3JtYXQ6IFtcIm1vZHVsZUlkXCIsIFtjaHVuazEsIGNodW5rMiwgLi4uXSwgXCJleHBvcnROYW1lXCJdXG4gICAgcm93cy5wdXNoKGAke2lkfTpJJHtKU09OLnN0cmluZ2lmeShbbW9kSWQsIGNodW5rcywgbW9kTmFtZV0pfVxcbmApO1xuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEFjdGlvblJlZklkKGFjdGlvbklkOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIGlmIChhY3Rpb25SZWZzLmhhcyhhY3Rpb25JZCkpIHtcbiAgICAgIHJldHVybiBhY3Rpb25SZWZzLmdldChhY3Rpb25JZCkhO1xuICAgIH1cbiAgICBjb25zdCBpZCA9IG1vZHVsZVJvd0lkKys7XG4gICAgYWN0aW9uUmVmcy5zZXQoYWN0aW9uSWQsIGlkKTtcblxuICAgIC8vIEVtaXQgc2VydmVyIHJlZmVyZW5jZSByb3dcbiAgICAvLyBGb3JtYXQ6IHtcImlkXCI6XCJhY3Rpb25JZFwiLFwiYm91bmRcIjpudWxsfVxuICAgIHJvd3MucHVzaChgJHtpZH06e1wiaWRcIjpcIiR7YWN0aW9uSWR9XCIsXCJib3VuZFwiOm51bGx9XFxuYCk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VyaWFsaXplVmFsdWUodmFsdWU6IHVua25vd24pOiBGbGlnaHRWYWx1ZSB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZSBhcyBudWxsIHwgdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiIHx8IHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiB2YWx1ZS5tYXAoc2VyaWFsaXplVmFsdWUpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHZhbHVlIGFzIFJlY29yZDxzdHJpbmcgfCBzeW1ib2wsIHVua25vd24+O1xuXG4gICAgICAvLyBDaGVjayBmb3IgUmVhY3QgZWxlbWVudFxuICAgICAgaWYgKG9iai4kJHR5cGVvZiA9PT0gUkVBQ1RfRUxFTUVOVF9UWVBFIHx8IG9iai4kJHR5cGVvZiA9PT0gUkVBQ1RfVFJBTlNJVElPTkFMX0VMRU1FTlRfVFlQRSkge1xuICAgICAgICByZXR1cm4gc2VyaWFsaXplRWxlbWVudChvYmogYXMgdW5rbm93biBhcyBSZWFjdEVsZW1lbnQ8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgZm9yIHNlcnZlciBhY3Rpb24gcmVmZXJlbmNlXG4gICAgICBpZiAob2JqLiQkdHlwZW9mID09PSBSRUFDVF9TRVJWRVJfUkVGRVJFTkNFKSB7XG4gICAgICAgIGNvbnN0IHJlZiA9IG9iaiBhcyB7ICQkaWQ/OiBzdHJpbmcgfTtcbiAgICAgICAgY29uc3QgYWN0aW9uSWQgPSByZWYuJCRpZCA/PyBcIlwiO1xuICAgICAgICBjb25zdCByZWZJZCA9IGdldEFjdGlvblJlZklkKGFjdGlvbklkKTtcbiAgICAgICAgLy8gU2VydmVyIGFjdGlvbiByZWZlcmVuY2U6ICRGIGZvbGxvd2VkIGJ5IHRoZSByb3cgSURcbiAgICAgICAgcmV0dXJuIGAke0ZVTkNUSU9OX1BSRUZJWH0ke3JlZklkLnRvU3RyaW5nKDE2KX1gIGFzIHVua25vd24gYXMgRmxpZ2h0VmFsdWU7XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGZvciBjbGllbnQgcmVmZXJlbmNlIChmcm9tIGNyZWF0ZUNsaWVudE1vZHVsZVByb3h5KVxuICAgICAgaWYgKG9iai4kJHR5cGVvZiA9PT0gUkVBQ1RfQ0xJRU5UX1JFRkVSRU5DRSkge1xuICAgICAgICBjb25zdCByZWYgPSBvYmogYXMgeyAkJGlkPzogc3RyaW5nOyBuYW1lPzogc3RyaW5nIH07XG4gICAgICAgIGNvbnN0IGlkID0gcmVmLiQkaWQgPz8gXCJcIjtcbiAgICAgICAgY29uc3QgbmFtZSA9IHJlZi5uYW1lID8/IFwiKlwiO1xuICAgICAgICBjb25zdCBtb2R1bGVJZCA9IGlkLmluY2x1ZGVzKFwiI1wiKSA/IGlkLnNwbGl0KFwiI1wiKVswXSEgOiBpZDtcbiAgICAgICAgY29uc3QgZXhwb3J0TmFtZSA9IGlkLmluY2x1ZGVzKFwiI1wiKSA/IGlkLnNwbGl0KFwiI1wiKVsxXSEgOiBuYW1lO1xuICAgICAgICBjb25zdCByZWZJZCA9IGdldE1vZHVsZVJlZklkKG1vZHVsZUlkLCBleHBvcnROYW1lKTtcbiAgICAgICAgcmV0dXJuIGAke01PRFVMRV9QUkVGSVh9JHtyZWZJZC50b1N0cmluZygxNil9YCBhcyB1bmtub3duIGFzIEZsaWdodFZhbHVlO1xuICAgICAgfVxuXG4gICAgICAvLyBSZWd1bGFyIG9iamVjdFxuICAgICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCBGbGlnaHRWYWx1ZT4gPSB7fTtcbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9iaikpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSBzZXJpYWxpemVWYWx1ZShvYmpba2V5XSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgLy8gQ2hlY2sgaWYgaXQncyBhIHNlcnZlciBhY3Rpb25cbiAgICAgIGNvbnN0IGZuID0gdmFsdWUgYXMgeyAkJHR5cGVvZj86IHN5bWJvbDsgJCRpZD86IHN0cmluZyB9O1xuICAgICAgaWYgKGZuLiQkdHlwZW9mID09PSBSRUFDVF9TRVJWRVJfUkVGRVJFTkNFKSB7XG4gICAgICAgIGNvbnN0IGFjdGlvbklkID0gZm4uJCRpZCA/PyBcIlwiO1xuICAgICAgICBjb25zdCByZWZJZCA9IGdldEFjdGlvblJlZklkKGFjdGlvbklkKTtcbiAgICAgICAgcmV0dXJuIGAke0ZVTkNUSU9OX1BSRUZJWH0ke3JlZklkLnRvU3RyaW5nKDE2KX1gIGFzIHVua25vd24gYXMgRmxpZ2h0VmFsdWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFNlcnZlciBjb21wb25lbnQgLSBleGVjdXRlIGl0XG4gICAgICBjb25zdCBDb21wb25lbnQgPSB2YWx1ZSBhcyAocHJvcHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiBSZWFjdE5vZGU7XG4gICAgICByZXR1cm4gc2VyaWFsaXplVmFsdWUoQ29tcG9uZW50KHt9KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBmdW5jdGlvbiBzZXJpYWxpemVFbGVtZW50KGVsZW1lbnQ6IFJlYWN0RWxlbWVudDxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4pOiBGbGlnaHRWYWx1ZSB7XG4gICAgY29uc3QgeyB0eXBlLCBrZXksIHByb3BzIH0gPSBlbGVtZW50O1xuXG4gICAgLy8gSGFuZGxlIGZyYWdtZW50c1xuICAgIGlmIChpc0ZyYWdtZW50KHR5cGUpKSB7XG4gICAgICBjb25zdCBjaGlsZHJlbiA9IHByb3BzLmNoaWxkcmVuO1xuICAgICAgcmV0dXJuIHNlcmlhbGl6ZVZhbHVlKGNoaWxkcmVuKTtcbiAgICB9XG5cbiAgICAvLyBIZWxwZXIgdG8gc2VyaWFsaXplIHByb3BzXG4gICAgZnVuY3Rpb24gc2VyaWFsaXplUHJvcHMocHJvcHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUmVjb3JkPHN0cmluZywgRmxpZ2h0VmFsdWU+IHtcbiAgICAgIGNvbnN0IHNlcmlhbGl6ZWRQcm9wczogUmVjb3JkPHN0cmluZywgRmxpZ2h0VmFsdWU+ID0ge307XG4gICAgICBmb3IgKGNvbnN0IHByb3BLZXkgb2YgT2JqZWN0LmtleXMocHJvcHMpKSB7XG4gICAgICAgIGlmIChwcm9wS2V5ICE9PSBcImNoaWxkcmVuXCIpIHtcbiAgICAgICAgICBzZXJpYWxpemVkUHJvcHNbcHJvcEtleV0gPSBzZXJpYWxpemVWYWx1ZShwcm9wc1twcm9wS2V5XSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChwcm9wcy5jaGlsZHJlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNlcmlhbGl6ZWRQcm9wcy5jaGlsZHJlbiA9IHNlcmlhbGl6ZVZhbHVlKHByb3BzLmNoaWxkcmVuKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzZXJpYWxpemVkUHJvcHM7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdHlwZSBpcyBhIGNsaWVudCByZWZlcmVuY2UgKG9iamVjdCB3aXRoICQkdHlwZW9mKVxuICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gXCJvYmplY3RcIiAmJiB0eXBlICE9PSBudWxsKSB7XG4gICAgICBjb25zdCByZWYgPSB0eXBlIGFzIHsgJCR0eXBlb2Y/OiBzeW1ib2w7ICQkaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmcgfTtcbiAgICAgIGlmIChyZWYuJCR0eXBlb2YgPT09IFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0UpIHtcbiAgICAgICAgY29uc3QgaWQgPSByZWYuJCRpZCA/PyBcIlwiO1xuICAgICAgICBjb25zdCBuYW1lID0gcmVmLm5hbWUgPz8gXCIqXCI7XG4gICAgICAgIGNvbnN0IG1vZHVsZUlkID0gaWQuaW5jbHVkZXMoXCIjXCIpID8gaWQuc3BsaXQoXCIjXCIpWzBdISA6IGlkO1xuICAgICAgICBjb25zdCBleHBvcnROYW1lID0gaWQuaW5jbHVkZXMoXCIjXCIpID8gaWQuc3BsaXQoXCIjXCIpWzFdISA6IG5hbWU7XG4gICAgICAgIGNvbnN0IHJlZklkID0gZ2V0TW9kdWxlUmVmSWQobW9kdWxlSWQsIGV4cG9ydE5hbWUpO1xuXG4gICAgICAgIC8vIFJldHVybiBlbGVtZW50IHR1cGxlOiBbXCIkXCIsIFwiJEw8cmVmPlwiLCBrZXksIHByb3BzXVxuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgIEVMRU1FTlRfUFJFRklYLFxuICAgICAgICAgIGAke01PRFVMRV9QUkVGSVh9JHtyZWZJZC50b1N0cmluZygxNil9YCxcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgc2VyaWFsaXplUHJvcHMocHJvcHMpLFxuICAgICAgICBdIGFzIEZsaWdodFZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhhbmRsZSBzZXJ2ZXIgY29tcG9uZW50IChmdW5jdGlvbiB0eXBlKVxuICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAvLyBDaGVjayBpZiBpdCdzIGEgY2xpZW50IHJlZmVyZW5jZSBmdW5jdGlvblxuICAgICAgY29uc3QgZm4gPSB0eXBlIGFzIHsgJCR0eXBlb2Y/OiBzeW1ib2w7ICQkaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmcgfTtcbiAgICAgIGlmIChmbi4kJHR5cGVvZiA9PT0gUkVBQ1RfQ0xJRU5UX1JFRkVSRU5DRSkge1xuICAgICAgICBjb25zdCBpZCA9IGZuLiQkaWQgPz8gXCJcIjtcbiAgICAgICAgY29uc3QgbmFtZSA9IGZuLm5hbWUgPz8gXCIqXCI7XG4gICAgICAgIGNvbnN0IG1vZHVsZUlkID0gaWQuaW5jbHVkZXMoXCIjXCIpID8gaWQuc3BsaXQoXCIjXCIpWzBdISA6IGlkO1xuICAgICAgICBjb25zdCBleHBvcnROYW1lID0gaWQuaW5jbHVkZXMoXCIjXCIpID8gaWQuc3BsaXQoXCIjXCIpWzFdISA6IG5hbWU7XG4gICAgICAgIGNvbnN0IHJlZklkID0gZ2V0TW9kdWxlUmVmSWQobW9kdWxlSWQsIGV4cG9ydE5hbWUpO1xuXG4gICAgICAgIC8vIFJldHVybiBlbGVtZW50IHR1cGxlOiBbXCIkXCIsIFwiJEw8cmVmPlwiLCBrZXksIHByb3BzXVxuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgIEVMRU1FTlRfUFJFRklYLFxuICAgICAgICAgIGAke01PRFVMRV9QUkVGSVh9JHtyZWZJZC50b1N0cmluZygxNil9YCxcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgc2VyaWFsaXplUHJvcHMocHJvcHMpLFxuICAgICAgICBdIGFzIEZsaWdodFZhbHVlO1xuICAgICAgfVxuXG4gICAgICAvLyBTZXJ2ZXIgY29tcG9uZW50IC0gcmVuZGVyIGl0XG4gICAgICBjb25zdCByZW5kZXJlZCA9ICh0eXBlIGFzIChwcm9wczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IFJlYWN0Tm9kZSkocHJvcHMpO1xuICAgICAgcmV0dXJuIHNlcmlhbGl6ZVZhbHVlKHJlbmRlcmVkKTtcbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgaW50cmluc2ljIGVsZW1lbnQgKGRpdiwgc3BhbiwgZXRjLilcbiAgICBpZiAodHlwZW9mIHR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIC8vIFJldHVybiBlbGVtZW50IHR1cGxlOiBbXCIkXCIsIFwiZGl2XCIsIGtleSwgcHJvcHNdXG4gICAgICByZXR1cm4gW0VMRU1FTlRfUFJFRklYLCB0eXBlLCBrZXksIHNlcmlhbGl6ZVByb3BzKHByb3BzKV0gYXMgRmxpZ2h0VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBTZXJpYWxpemUgdGhlIHJvb3QgZWxlbWVudFxuICBjb25zdCByb290VmFsdWUgPSBzZXJpYWxpemVWYWx1ZShlbGVtZW50KTtcbiAgY29uc3Qgcm9vdFJvdyA9IGAwOiR7SlNPTi5zdHJpbmdpZnkocm9vdFZhbHVlKX1cXG5gO1xuXG4gIC8vIFJldHVybiBhbGwgcm93cyBhcyBhIHNpbmdsZSBzdHJpbmdcbiAgLy8gTm90ZTogTW9kdWxlL2ltcG9ydCByb3dzIGNvbWUgZmlyc3QsIHRoZW4gdGhlIHJvb3QgZWxlbWVudCByb3dcbiAgcmV0dXJuIFsuLi5yb3dzLCByb290Um93XS5qb2luKFwiXCIpO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZSBhIFJlYWN0IGVsZW1lbnQgdG8gUlNDIHdpcmUgZm9ybWF0IChyZXR1cm5zIFJlYWRhYmxlU3RyZWFtKVxuICogQGRlcHJlY2F0ZWQgVXNlIHNlcmlhbGl6ZVRvRmxpZ2h0UGF5bG9hZCBmb3IgYmV0dGVyIFNhZmFyaSBjb21wYXRpYmlsaXR5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVUb0ZsaWdodFN0cmVhbShcbiAgZWxlbWVudDogUmVhY3ROb2RlLFxuICBtYW5pZmVzdDogQ2xpZW50TWFuaWZlc3QsXG4pOiBSZWFkYWJsZVN0cmVhbTxVaW50OEFycmF5PiB7XG4gIGNvbnN0IHBheWxvYWQgPSBzZXJpYWxpemVUb0ZsaWdodFBheWxvYWQoZWxlbWVudCwgbWFuaWZlc3QpO1xuICBjb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gIGNvbnN0IGRhdGEgPSBlbmNvZGVyLmVuY29kZShwYXlsb2FkKTtcblxuICBsZXQgc2VudCA9IGZhbHNlO1xuICByZXR1cm4gbmV3IFJlYWRhYmxlU3RyZWFtKHtcbiAgICBwdWxsKGNvbnRyb2xsZXIpIHtcbiAgICAgIGlmICghc2VudCkge1xuICAgICAgICBjb250cm9sbGVyLmVucXVldWUoZGF0YSk7XG4gICAgICAgIHNlbnQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgY29udHJvbGxlci5jbG9zZSgpO1xuICAgIH0sXG4gIH0pO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIFJlc3BvbnNlIGZyb20gYSBzZXJpYWxpemVkIFJTQyBwYXlsb2FkXG4gKlxuICogVXNlcyBzdHJpbmcgYm9keSBpbnN0ZWFkIG9mIFJlYWRhYmxlU3RyZWFtIGZvciBTYWZhcmkgc2VydmljZSB3b3JrZXIgY29tcGF0aWJpbGl0eS5cbiAqIFNhZmFyaSdzIHNlcnZpY2Ugd29ya2VyIGltcGxlbWVudGF0aW9uIGRvZXNuJ3QgcHJvcGVybHkgaGFuZGxlIFJlYWRhYmxlU3RyZWFtXG4gKiBpbiBSZXNwb25zZSBjb25zdHJ1Y3RvciwgcmVzdWx0aW5nIGluIFwiW29iamVjdCBSZWFkYWJsZVN0cmVhbV1cIiBhcyBib2R5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRmxpZ2h0UmVzcG9uc2UoXG4gIGVsZW1lbnQ6IFJlYWN0Tm9kZSxcbiAgbWFuaWZlc3Q6IENsaWVudE1hbmlmZXN0LFxuICBpbml0PzogUmVzcG9uc2VJbml0LFxuKTogUmVzcG9uc2Uge1xuICBjb25zdCBwYXlsb2FkID0gc2VyaWFsaXplVG9GbGlnaHRQYXlsb2FkKGVsZW1lbnQsIG1hbmlmZXN0KTtcblxuICByZXR1cm4gbmV3IFJlc3BvbnNlKHBheWxvYWQsIHtcbiAgICAuLi5pbml0LFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwidGV4dC94LWNvbXBvbmVudDsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGVcIixcbiAgICAgIFwiWC1Db250ZW50LVR5cGUtT3B0aW9uc1wiOiBcIm5vc25pZmZcIixcbiAgICAgIC4uLmluaXQ/LmhlYWRlcnMsXG4gICAgfSxcbiAgfSk7XG59XG4iLCIvKipcbiAqIFJTQyBNb2R1bGUgZm9yIFNlcnZpY2UgV29ya2VyIEJGRlxuICpcbiAqIFJlYWN0IFNlcnZlciBDb21wb25lbnRzIHN1cHBvcnQgZm9yIHNlcnZpY2Ugd29ya2Vycy5cbiAqXG4gKiAjIyBRdWljayBTdGFydFxuICpcbiAqICMjIyBTZXJ2aWNlIFdvcmtlciBTZXR1cFxuICpcbiAqIGBgYHRzXG4gKiAvLyBzdy50c1xuICogaW1wb3J0IHsgc2V0dXBXb3JrZXIsIGh0dHAsIGpzb24gfSBmcm9tICdAbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYnO1xuICogaW1wb3J0IHtcbiAqICAgY3JlYXRlUlNDSGFuZGxlcixcbiAqICAgcnNjR2V0LFxuICogICByc2NQb3N0LFxuICogfSBmcm9tICdAbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvcnNjJztcbiAqIGltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCc7XG4gKlxuICogLy8gRGVmaW5lIHlvdXIgc2VydmVyIGNvbXBvbmVudFxuICogZnVuY3Rpb24gQXBwKCkge1xuICogICByZXR1cm4gPGRpdj5IZWxsbyBmcm9tIFJTQyE8L2Rpdj47XG4gKiB9XG4gKlxuICogLy8gQ3JlYXRlIGhhbmRsZXIgd2l0aCBtYW5pZmVzdCBhbmQgYWN0aW9uc1xuICogY29uc3QgcnNjID0gY3JlYXRlUlNDSGFuZGxlcih7XG4gKiAgIG1hbmlmZXN0OiB7XG4gKiAgICAgJ2NsaWVudCc6IHsgaWQ6ICdjbGllbnQnLCBjaHVua3M6IFtdLCBuYW1lOiAnKicgfSxcbiAqICAgfSxcbiAqICAgYWN0aW9uczoge1xuICogICAgIGFzeW5jIGluY3JlbWVudChjb3VudDogbnVtYmVyKSB7IHJldHVybiBjb3VudCArIDE7IH0sXG4gKiAgIH0sXG4gKiB9KTtcbiAqXG4gKiBzZXR1cFdvcmtlcihbXG4gKiAgIHJzY0dldCgnL3JzYycsIHJzYywgKCkgPT4gPEFwcCAvPiksXG4gKiAgIHJzY1Bvc3QoJy9yc2MnLCByc2MpLFxuICogXSk7XG4gKiBgYGBcbiAqXG4gKiAjIyMgQ2xpZW50IFNldHVwXG4gKlxuICogYGBgdHNcbiAqIC8vIG1haW4udHNcbiAqIGltcG9ydCAnLi9yc2Mvd2VicGFjay1zaGltJztcbiAqIGltcG9ydCB7IHJlZ2lzdGVyQ2xpZW50TW9kdWxlLCBmZXRjaFJTQywgY3JlYXRlQ2FsbFNlcnZlciB9IGZyb20gJ0BsaWIvcnNjLXNlcnZpY2Utd29ya2VyLWJmZi9yc2MnO1xuICogaW1wb3J0ICogYXMgQ2xpZW50Q29tcG9uZW50cyBmcm9tICcuL2NvbXBvbmVudHMnO1xuICpcbiAqIC8vIFJlZ2lzdGVyIGNsaWVudCBjb21wb25lbnRzXG4gKiByZWdpc3RlckNsaWVudE1vZHVsZSgnY2xpZW50JywgQ2xpZW50Q29tcG9uZW50cyk7XG4gKlxuICogLy8gRmV0Y2ggYW5kIHJlbmRlciBSU0NcbiAqIGNvbnN0IGNhbGxTZXJ2ZXIgPSBjcmVhdGVDYWxsU2VydmVyKCcvcnNjJyk7XG4gKiBjb25zdCBlbGVtZW50ID0gYXdhaXQgZmV0Y2hSU0MoJy9yc2MnLCB7IGNhbGxTZXJ2ZXIgfSk7XG4gKiByb290LnJlbmRlcihlbGVtZW50KTtcbiAqIGBgYFxuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBJTVBPUlRBTlQ6IEltcG9ydCBvcmRlciBtYXR0ZXJzIVxuLy8gQWx3YXlzIGltcG9ydCB3ZWJwYWNrLXNoaW0gZmlyc3QgaW4geW91ciBlbnRyeSBmaWxlc1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gV2VicGFjayBzaGltIC0gbXVzdCBiZSBpbXBvcnRlZCBmaXJzdFxuZXhwb3J0IHsgbW9kdWxlQ2FjaGUgfSBmcm9tIFwiLi93ZWJwYWNrLXNoaW1cIjtcblxuLy8gUG9seWZpbGxcbmV4cG9ydCB7IHBvbHlmaWxsUmVhZHksIGlzUG9seWZpbGxSZXF1aXJlZCB9IGZyb20gXCIuL3BvbHlmaWxsXCI7XG5cbi8vIFR5cGVzXG5leHBvcnQgdHlwZSB7XG4gIENsaWVudE1hbmlmZXN0LFxuICBDbGllbnRNYW5pZmVzdEVudHJ5LFxuICBFbmNvZGVkQWN0aW9uQXJncyxcbiAgU2VydmVyTW9kdWxlLFxuICBSU0NSZW5kZXJPcHRpb25zLFxuICBTZXJ2ZXJBY3Rpb25FbnRyeSxcbiAgUlNDQ29udGV4dCxcbiAgUlNDSGFuZGxlck9wdGlvbnMsXG4gIFJTQ1Jlc3BvbnNlT3B0aW9ucyxcbn0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gU2VydmVyIChmb3Igc2VydmljZSB3b3JrZXIpXG5leHBvcnQge1xuICBjcmVhdGVSU0NDb250ZXh0LFxuICByZWdpc3RlckFjdGlvbixcbiAgcmVnaXN0ZXJBY3Rpb25zLFxuICBjcmVhdGVDbGllbnRQcm94eSxcbiAgcmVuZGVyUlNDLFxuICBkZWNvZGVBY3Rpb25BcmdzLFxuICBoYW5kbGVBY3Rpb24sXG4gIGdldEFjdGlvbklkRnJvbVJlcXVlc3QsXG4gIGlzQWN0aW9uUmVxdWVzdCxcbn0gZnJvbSBcIi4vc2VydmVyXCI7XG5cbi8vIENsaWVudCAoZm9yIG1haW4gdGhyZWFkKVxuZXhwb3J0IHtcbiAgZW5zdXJlV29ya2VyUmVhZHksXG4gIGNvbnN1bWVSU0MsXG4gIGNvbnN1bWVSU0NSZXNwb25zZSxcbiAgZW5jb2RlQWN0aW9uQXJncyxcbiAgY3JlYXRlQ2FsbFNlcnZlcixcbiAgZmV0Y2hSU0MsXG4gIGNhbGxBY3Rpb24sXG4gIHR5cGUgQ29uc3VtZVJTQ09wdGlvbnMsXG4gIHR5cGUgQ2FsbEFjdGlvbk9wdGlvbnMsXG59IGZyb20gXCIuL2NsaWVudFwiO1xuXG4vLyBNb2R1bGUgcmVnaXN0cnlcbmV4cG9ydCB7XG4gIHJlZ2lzdGVyQ2xpZW50TW9kdWxlLFxuICByZWdpc3RlckNsaWVudE1vZHVsZXMsXG4gIGhhc01vZHVsZSxcbiAgZ2V0TW9kdWxlLFxuICBidWlsZENsaWVudE1hbmlmZXN0LFxuICBidWlsZENsaWVudE1hbmlmZXN0RnJvbU1vZHVsZSxcbiAgbWVyZ2VNYW5pZmVzdHMsXG59IGZyb20gXCIuL21vZHVsZS1yZWdpc3RyeVwiO1xuXG4vLyBSZXNwb25zZSBoZWxwZXJzXG5leHBvcnQge1xuICBSU0NfQ09OVEVOVF9UWVBFLFxuICByc2MsXG4gIHJzY1dpdGhDb250ZXh0LFxuICByc2NBY3Rpb24sXG4gIHJzY0Vycm9yLFxuICBjcmVhdGVSU0NIYW5kbGVyLFxuICB0eXBlIENyZWF0ZVJTQ0hhbmRsZXJPcHRpb25zLFxufSBmcm9tIFwiLi9yZXNwb25zZVwiO1xuXG4vLyBIVFRQIHJvdXRlIGhlbHBlcnNcbmV4cG9ydCB7XG4gIHJzY0dldCxcbiAgcnNjUG9zdCxcbiAgcnNjUm91dGVzLFxuICBjcmVhdGVSU0NSb3V0ZXMsXG4gIHR5cGUgUlNDUm91dGVDb250ZXh0LFxuICB0eXBlIFJTQ1JlbmRlckhhbmRsZXIsXG59IGZyb20gXCIuL2h0dHBcIjtcblxuLy8gRmxpZ2h0IHNlcmlhbGl6ZXIgKGN1c3RvbSBSU0Mgc2VyaWFsaXphdGlvbiBmb3IgU1cgZW52aXJvbm1lbnQpXG5leHBvcnQge1xuICBzZXJpYWxpemVUb0ZsaWdodFN0cmVhbSxcbiAgY3JlYXRlRmxpZ2h0UmVzcG9uc2UsXG4gIGNyZWF0ZVNlcnZlckFjdGlvbixcbiAgZ2V0U2VydmVyQWN0aW9uLFxuICBleGVjdXRlU2VydmVyQWN0aW9uLFxufSBmcm9tIFwiLi9mbGlnaHQtc2VyaWFsaXplclwiO1xuIiwiLyoqXG4gKiBDbGllbnQgUmVmZXJlbmNlIFV0aWxpdGllc1xuICpcbiAqIENyZWF0ZSB0eXBlZCBjbGllbnQgY29tcG9uZW50IHJlZmVyZW5jZXMgZm9yIHVzZSBpbiBzZXJ2ZXIgY29tcG9uZW50cy5cbiAqIFRoZXNlIHdvcmsgd2l0aCBKU1ggYW5kIHByb3ZpZGUgZnVsbCB0eXBlIHNhZmV0eS5cbiAqL1xuaW1wb3J0IHR5cGUgeyBDb21wb25lbnRUeXBlLCBDb21wb25lbnRQcm9wcyB9IGZyb20gXCJyZWFjdFwiO1xuaW1wb3J0IHR5cGUgeyBDbGllbnRNYW5pZmVzdCB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmNvbnN0IFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0UgPSBTeW1ib2wuZm9yKFwicmVhY3QuY2xpZW50LnJlZmVyZW5jZVwiKTtcblxuLyoqXG4gKiBBIGNsaWVudCByZWZlcmVuY2UgdGhhdCBjYW4gYmUgdXNlZCBpbiBKU1hcbiAqL1xuZXhwb3J0IHR5cGUgQ2xpZW50UmVmZXJlbmNlPFAgPSB1bmtub3duPiA9IENvbXBvbmVudFR5cGU8UD4gJiB7XG4gICQkdHlwZW9mOiB0eXBlb2YgUkVBQ1RfQ0xJRU5UX1JFRkVSRU5DRTtcbiAgJCRpZDogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBzaW5nbGUgY2xpZW50IGNvbXBvbmVudCByZWZlcmVuY2VcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHN4XG4gKiAvLyBUeXBlLXNhZmUgcmVmZXJlbmNlXG4gKiBjb25zdCBDb3VudGVyID0gY2xpZW50UmVmPHsgY291bnQ6IG51bWJlciB9PihcImNsaWVudFwiLCBcIkNvdW50ZXJcIik7XG4gKlxuICogLy8gSW4gc2VydmVyIGNvbXBvbmVudCBKU1g6XG4gKiA8Q291bnRlciBjb3VudD17NDJ9IC8+XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsaWVudFJlZjxQID0gUmVjb3JkPHN0cmluZywgdW5rbm93bj4+KFxuICBtb2R1bGVJZDogc3RyaW5nLFxuICBleHBvcnROYW1lOiBzdHJpbmcsXG4pOiBDbGllbnRSZWZlcmVuY2U8UD4ge1xuICByZXR1cm4ge1xuICAgICQkdHlwZW9mOiBSRUFDVF9DTElFTlRfUkVGRVJFTkNFLFxuICAgICQkaWQ6IGAke21vZHVsZUlkfSMke2V4cG9ydE5hbWV9YCxcbiAgfSBhcyBDbGllbnRSZWZlcmVuY2U8UD47XG59XG5cbi8qKlxuICogVHlwZSBoZWxwZXI6IEV4dHJhY3QgY29tcG9uZW50IHR5cGUgZnJvbSBhIG1vZHVsZVxuICovXG50eXBlIENvbXBvbmVudE1vZHVsZSA9IFJlY29yZDxzdHJpbmcsIENvbXBvbmVudFR5cGU8YW55Pj47XG5cbi8qKlxuICogVHlwZSBoZWxwZXI6IENvbnZlcnQgY29tcG9uZW50IG1vZHVsZSB0byBjbGllbnQgcmVmZXJlbmNlc1xuICovXG50eXBlIENsaWVudFJlZmVyZW5jZXM8TSBleHRlbmRzIENvbXBvbmVudE1vZHVsZT4gPSB7XG4gIFtLIGluIGtleW9mIE1dOiBDbGllbnRSZWZlcmVuY2U8Q29tcG9uZW50UHJvcHM8TVtLXT4+O1xufTtcblxuLyoqXG4gKiBDcmVhdGUgdHlwZWQgY2xpZW50IHJlZmVyZW5jZXMgZnJvbSBhIG1vZHVsZSB0eXBlXG4gKlxuICogVGhpcyBnaXZlcyB5b3UgZnVsbCB0eXBlIHNhZmV0eSAtIHByb3BzIGFyZSBpbmZlcnJlZCBmcm9tIHlvdXIgYWN0dWFsIGNvbXBvbmVudHMuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzeFxuICogLy8gSW4geW91ciBjbGllbnQgY29tcG9uZW50cyBmaWxlOlxuICogZXhwb3J0IGZ1bmN0aW9uIENvdW50ZXIoeyBjb3VudCB9OiB7IGNvdW50OiBudW1iZXIgfSkgeyAuLi4gfVxuICogZXhwb3J0IGZ1bmN0aW9uIEJ1dHRvbih7IG9uQ2xpY2ssIGNoaWxkcmVuIH06IEJ1dHRvblByb3BzKSB7IC4uLiB9XG4gKlxuICogLy8gSW4geW91ciBzZXJ2aWNlIHdvcmtlcjpcbiAqIGltcG9ydCB0eXBlICogYXMgQ2xpZW50Q29tcG9uZW50cyBmcm9tIFwiLi9jb21wb25lbnRzXCI7XG4gKlxuICogY29uc3QgQ2xpZW50ID0gY3JlYXRlQ2xpZW50UmVmczx0eXBlb2YgQ2xpZW50Q29tcG9uZW50cz4oXCJjbGllbnRcIiwgW1xuICogICBcIkNvdW50ZXJcIixcbiAqICAgXCJCdXR0b25cIixcbiAqIF0pO1xuICpcbiAqIC8vIE5vdyB1c2Ugd2l0aCBmdWxsIHR5cGUgc2FmZXR5OlxuICogPENsaWVudC5Db3VudGVyIGNvdW50PXs0Mn0gLz4gIC8vIOKckyBUeXBlIGNoZWNrZWQhXG4gKiA8Q2xpZW50LkNvdW50ZXIgd3Jvbmc9ezF9IC8+ICAgLy8g4pyXIFR5cGUgZXJyb3JcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2xpZW50UmVmczxNIGV4dGVuZHMgQ29tcG9uZW50TW9kdWxlPihcbiAgbW9kdWxlSWQ6IHN0cmluZyxcbiAgZXhwb3J0TmFtZXM6IChrZXlvZiBNICYgc3RyaW5nKVtdLFxuKTogQ2xpZW50UmVmZXJlbmNlczxQaWNrPE0sICh0eXBlb2YgZXhwb3J0TmFtZXMpW251bWJlcl0+PiB7XG4gIGNvbnN0IHJlZnMgPSB7fSBhcyBDbGllbnRSZWZlcmVuY2VzPE0+O1xuXG4gIGZvciAoY29uc3QgbmFtZSBvZiBleHBvcnROYW1lcykge1xuICAgIHJlZnNbbmFtZV0gPSBjbGllbnRSZWYobW9kdWxlSWQsIG5hbWUpO1xuICB9XG5cbiAgcmV0dXJuIHJlZnM7XG59XG5cbi8qKlxuICogQnVpbGQgY2xpZW50IG1hbmlmZXN0IGFuZCByZWZlcmVuY2VzIHRvZ2V0aGVyXG4gKlxuICogQ29udmVuaWVuY2UgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGJvdGggdGhlIG1hbmlmZXN0IChmb3Igc2VyaWFsaXphdGlvbilcbiAqIGFuZCB0eXBlZCByZWZzIChmb3IgSlNYIHVzYWdlKS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHN4XG4gKiBpbXBvcnQgdHlwZSAqIGFzIENvbXBvbmVudHMgZnJvbSBcIi4vY29tcG9uZW50c1wiO1xuICpcbiAqIGNvbnN0IHsgbWFuaWZlc3QsIHJlZnM6IENsaWVudCB9ID0gY3JlYXRlQ2xpZW50TW9kdWxlPHR5cGVvZiBDb21wb25lbnRzPihcbiAqICAgXCJjbGllbnRcIixcbiAqICAgW1wiQ291bnRlclwiLCBcIkJ1dHRvblwiLCBcIkNhcmRcIl1cbiAqICk7XG4gKlxuICogLy8gVXNlIGluIEpTWDpcbiAqIDxDbGllbnQuQ291bnRlciBjb3VudD17MH0gLz5cbiAqXG4gKiAvLyBVc2UgbWFuaWZlc3QgZm9yIHNlcmlhbGl6YXRpb246XG4gKiBjcmVhdGVGbGlnaHRSZXNwb25zZSg8QXBwIC8+LCBtYW5pZmVzdCk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNsaWVudE1vZHVsZTxNIGV4dGVuZHMgQ29tcG9uZW50TW9kdWxlPihcbiAgbW9kdWxlSWQ6IHN0cmluZyxcbiAgZXhwb3J0TmFtZXM6IChrZXlvZiBNICYgc3RyaW5nKVtdLFxuKToge1xuICBtYW5pZmVzdDogQ2xpZW50TWFuaWZlc3Q7XG4gIHJlZnM6IENsaWVudFJlZmVyZW5jZXM8UGljazxNLCAodHlwZW9mIGV4cG9ydE5hbWVzKVtudW1iZXJdPj47XG59IHtcbiAgY29uc3QgbWFuaWZlc3Q6IENsaWVudE1hbmlmZXN0ID0ge1xuICAgIFttb2R1bGVJZF06IHsgaWQ6IG1vZHVsZUlkLCBjaHVua3M6IFtdLCBuYW1lOiBcIipcIiB9LFxuICB9O1xuXG4gIGZvciAoY29uc3QgbmFtZSBvZiBleHBvcnROYW1lcykge1xuICAgIG1hbmlmZXN0W2Ake21vZHVsZUlkfSMke25hbWV9YF0gPSB7IGlkOiBtb2R1bGVJZCwgY2h1bmtzOiBbXSwgbmFtZSB9O1xuICB9XG5cbiAgY29uc3QgcmVmcyA9IGNyZWF0ZUNsaWVudFJlZnM8TT4obW9kdWxlSWQsIGV4cG9ydE5hbWVzKTtcblxuICByZXR1cm4geyBtYW5pZmVzdCwgcmVmcyB9O1xufVxuXG4iLCIvLyBUeXBlc1xuZXhwb3J0IHR5cGUge1xuICBIdHRwTWV0aG9kLFxuICBSb3V0ZVBhcmFtcyxcbiAgUmVxdWVzdENvbnRleHQsXG4gIFJlcXVlc3RIYW5kbGVyLFxuICBSb3V0ZURlZmluaXRpb24sXG4gIFNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICBTZXJ2aWNlV29ya2VyLFxufSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vLyBIVFRQIG1ldGhvZCBoZWxwZXJzIChpbmNsdWRlcyByc2MsIGFjdGlvbiwgcnNjUm91dGVzKVxuZXhwb3J0IHsgaHR0cCwgdHlwZSBSU0NSb3V0ZU9wdGlvbnMgfSBmcm9tIFwiLi9odHRwXCI7XG5cbi8vIFJlc3BvbnNlIGhlbHBlcnNcbmV4cG9ydCB7IGpzb24sIHRleHQsIGh0bWwsIHJlZGlyZWN0LCBub0NvbnRlbnQsIGVycm9yLCBwYXNzdGhyb3VnaCB9IGZyb20gXCIuL3Jlc3BvbnNlXCI7XG5cbi8vIFdvcmtlciBzZXR1cCAoZm9yIHNlcnZpY2Ugd29ya2VyIGZpbGUpXG5leHBvcnQgeyBzZXR1cFdvcmtlciB9IGZyb20gXCIuL3dvcmtlclwiO1xuXG4vLyBXb3JrZXIgcmVnaXN0cmF0aW9uIChmb3IgbWFpbiB0aHJlYWQpXG5leHBvcnQgeyBjcmVhdGVXb3JrZXIgfSBmcm9tIFwiLi93b3JrZXJcIjtcblxuLy8gUlNDIHN1cHBvcnQgLSByZS1leHBvcnQgY29tbW9ubHkgdXNlZCBpdGVtc1xuLy8gRm9yIGZ1bGwgUlNDIEFQSSwgdXNlOiBpbXBvcnQgeyAuLi4gfSBmcm9tICdAbGliL3JzYy1zZXJ2aWNlLXdvcmtlci1iZmYvcnNjJ1xuZXhwb3J0IHtcbiAgLy8gSGFuZGxlciBjcmVhdGlvblxuICBjcmVhdGVSU0NIYW5kbGVyLFxuICAvLyBSb3V0ZSBoZWxwZXJzXG4gIHJzY0dldCxcbiAgcnNjUG9zdCxcbiAgcnNjUm91dGVzLFxuICBjcmVhdGVSU0NSb3V0ZXMsXG4gIC8vIFJlc3BvbnNlIGhlbHBlcnNcbiAgcnNjLFxuICByc2NBY3Rpb24sXG4gIHJzY0Vycm9yLFxuICAvLyBNb2R1bGUgcmVnaXN0cnkgKGZvciBjbGllbnQpXG4gIHJlZ2lzdGVyQ2xpZW50TW9kdWxlLFxuICBidWlsZENsaWVudE1hbmlmZXN0LFxuICAvLyBDbGllbnQgaGVscGVyc1xuICBlbnN1cmVXb3JrZXJSZWFkeSxcbiAgZmV0Y2hSU0MsXG4gIGNvbnN1bWVSU0MsXG4gIGNyZWF0ZUNhbGxTZXJ2ZXIsXG4gIGNhbGxBY3Rpb24sXG4gIHR5cGUgQ2FsbEFjdGlvbk9wdGlvbnMsXG4gIC8vIFBvbHlmaWxsXG4gIHBvbHlmaWxsUmVhZHksXG59IGZyb20gXCIuL3JzY1wiO1xuXG4vLyBDbGllbnQgcmVmZXJlbmNlIHV0aWxpdGllcyAobWFudWFsIGFwcHJvYWNoIC0gZm9yIHNlcnZpY2Ugd29ya2VyKVxuZXhwb3J0IHtcbiAgY2xpZW50UmVmLFxuICBjcmVhdGVDbGllbnRSZWZzLFxuICBjcmVhdGVDbGllbnRNb2R1bGUsXG4gIHR5cGUgQ2xpZW50UmVmZXJlbmNlLFxufSBmcm9tIFwiLi9yc2MvY2xpZW50LXJlZmVyZW5jZVwiO1xuXG4vLyBPZmZpY2lhbCBSU0Mgc2VydmVyIHV0aWxpdGllcyAocmVjb21tZW5kZWQgLSB1c2VzIHJlYWN0LXNlcnZlci1kb20td2VicGFjaylcbmV4cG9ydCB7XG4gIC8vIEFsbC1pbi1vbmUgc2V0dXBcbiAgY3JlYXRlUlNDLFxuICB0eXBlIENyZWF0ZVJTQ0NvbmZpZyxcbiAgdHlwZSBDcmVhdGVSU0NSZXN1bHQsXG4gIC8vIEluZGl2aWR1YWwgdXRpbGl0aWVzXG4gIGNyZWF0ZVJTQ0NvbnRleHQsXG4gIGNyZWF0ZUNsaWVudFByb3h5LFxuICByZWdpc3RlckFjdGlvbixcbiAgcmVnaXN0ZXJBY3Rpb25zLFxuICByZW5kZXJSU0MsXG4gIGhhbmRsZUFjdGlvbixcbiAgZGVjb2RlQWN0aW9uQXJncyxcbiAgaXNBY3Rpb25SZXF1ZXN0LFxuICBnZXRBY3Rpb25JZEZyb21SZXF1ZXN0LFxuICB0eXBlIFJTQ0NvbnRleHQsXG59IGZyb20gXCIuL3JzYy9zZXJ2ZXJcIjtcbiIsIi8qKlxuICogQGxpY2Vuc2UgUmVhY3RcbiAqIHJlYWN0LWpzeC1kZXYtcnVudGltZS5kZXZlbG9wbWVudC5qc1xuICpcbiAqIENvcHlyaWdodCAoYykgTWV0YSBQbGF0Zm9ybXMsIEluYy4gYW5kIGFmZmlsaWF0ZXMuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuXG4gKi9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cInByb2R1Y3Rpb25cIiAhPT0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgJiZcbiAgKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSkge1xuICAgICAgaWYgKG51bGwgPT0gdHlwZSkgcmV0dXJuIG51bGw7XG4gICAgICBpZiAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgdHlwZSlcbiAgICAgICAgcmV0dXJuIHR5cGUuJCR0eXBlb2YgPT09IFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0VcbiAgICAgICAgICA/IG51bGxcbiAgICAgICAgICA6IHR5cGUuZGlzcGxheU5hbWUgfHwgdHlwZS5uYW1lIHx8IG51bGw7XG4gICAgICBpZiAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIHR5cGUpIHJldHVybiB0eXBlO1xuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgUkVBQ1RfRlJBR01FTlRfVFlQRTpcbiAgICAgICAgICByZXR1cm4gXCJGcmFnbWVudFwiO1xuICAgICAgICBjYXNlIFJFQUNUX1BST0ZJTEVSX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiUHJvZmlsZXJcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN0cmljdE1vZGVcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVVNQRU5TRV9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN1c3BlbnNlXCI7XG4gICAgICAgIGNhc2UgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN1c3BlbnNlTGlzdFwiO1xuICAgICAgICBjYXNlIFJFQUNUX0FDVElWSVRZX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiQWN0aXZpdHlcIjtcbiAgICAgIH1cbiAgICAgIGlmIChcIm9iamVjdFwiID09PSB0eXBlb2YgdHlwZSlcbiAgICAgICAgc3dpdGNoIChcbiAgICAgICAgICAoXCJudW1iZXJcIiA9PT0gdHlwZW9mIHR5cGUudGFnICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcIlJlY2VpdmVkIGFuIHVuZXhwZWN0ZWQgb2JqZWN0IGluIGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSgpLiBUaGlzIGlzIGxpa2VseSBhIGJ1ZyBpbiBSZWFjdC4gUGxlYXNlIGZpbGUgYW4gaXNzdWUuXCJcbiAgICAgICAgICAgICksXG4gICAgICAgICAgdHlwZS4kJHR5cGVvZilcbiAgICAgICAgKSB7XG4gICAgICAgICAgY2FzZSBSRUFDVF9QT1JUQUxfVFlQRTpcbiAgICAgICAgICAgIHJldHVybiBcIlBvcnRhbFwiO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfQ09OVEVYVF9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIHR5cGUuZGlzcGxheU5hbWUgfHwgXCJDb250ZXh0XCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9DT05TVU1FUl9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuICh0eXBlLl9jb250ZXh0LmRpc3BsYXlOYW1lIHx8IFwiQ29udGV4dFwiKSArIFwiLkNvbnN1bWVyXCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFOlxuICAgICAgICAgICAgdmFyIGlubmVyVHlwZSA9IHR5cGUucmVuZGVyO1xuICAgICAgICAgICAgdHlwZSA9IHR5cGUuZGlzcGxheU5hbWU7XG4gICAgICAgICAgICB0eXBlIHx8XG4gICAgICAgICAgICAgICgodHlwZSA9IGlubmVyVHlwZS5kaXNwbGF5TmFtZSB8fCBpbm5lclR5cGUubmFtZSB8fCBcIlwiKSxcbiAgICAgICAgICAgICAgKHR5cGUgPSBcIlwiICE9PSB0eXBlID8gXCJGb3J3YXJkUmVmKFwiICsgdHlwZSArIFwiKVwiIDogXCJGb3J3YXJkUmVmXCIpKTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfTUVNT19UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgKGlubmVyVHlwZSA9IHR5cGUuZGlzcGxheU5hbWUgfHwgbnVsbCksXG4gICAgICAgICAgICAgIG51bGwgIT09IGlubmVyVHlwZVxuICAgICAgICAgICAgICAgID8gaW5uZXJUeXBlXG4gICAgICAgICAgICAgICAgOiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZS50eXBlKSB8fCBcIk1lbW9cIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICBjYXNlIFJFQUNUX0xBWllfVFlQRTpcbiAgICAgICAgICAgIGlubmVyVHlwZSA9IHR5cGUuX3BheWxvYWQ7XG4gICAgICAgICAgICB0eXBlID0gdHlwZS5faW5pdDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZShpbm5lclR5cGUpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHgpIHt9XG4gICAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0ZXN0U3RyaW5nQ29lcmNpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiBcIlwiICsgdmFsdWU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNoZWNrS2V5U3RyaW5nQ29lcmNpb24odmFsdWUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRlc3RTdHJpbmdDb2VyY2lvbih2YWx1ZSk7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQgPSAhMTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gITA7XG4gICAgICB9XG4gICAgICBpZiAoSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0KSB7XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9IGNvbnNvbGU7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX3RlbXBfY29uc3QgPSBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQuZXJyb3I7XG4gICAgICAgIHZhciBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQkanNjb21wJDAgPVxuICAgICAgICAgIChcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBTeW1ib2wgJiZcbiAgICAgICAgICAgIFN5bWJvbC50b1N0cmluZ1RhZyAmJlxuICAgICAgICAgICAgdmFsdWVbU3ltYm9sLnRvU3RyaW5nVGFnXSkgfHxcbiAgICAgICAgICB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lIHx8XG4gICAgICAgICAgXCJPYmplY3RcIjtcbiAgICAgICAgSlNDb21waWxlcl90ZW1wX2NvbnN0LmNhbGwoXG4gICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0LFxuICAgICAgICAgIFwiVGhlIHByb3ZpZGVkIGtleSBpcyBhbiB1bnN1cHBvcnRlZCB0eXBlICVzLiBUaGlzIHZhbHVlIG11c3QgYmUgY29lcmNlZCB0byBhIHN0cmluZyBiZWZvcmUgdXNpbmcgaXQgaGVyZS5cIixcbiAgICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQkanNjb21wJDBcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHRlc3RTdHJpbmdDb2VyY2lvbih2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldFRhc2tOYW1lKHR5cGUpIHtcbiAgICAgIGlmICh0eXBlID09PSBSRUFDVF9GUkFHTUVOVF9UWVBFKSByZXR1cm4gXCI8PlwiO1xuICAgICAgaWYgKFxuICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2YgdHlwZSAmJlxuICAgICAgICBudWxsICE9PSB0eXBlICYmXG4gICAgICAgIHR5cGUuJCR0eXBlb2YgPT09IFJFQUNUX0xBWllfVFlQRVxuICAgICAgKVxuICAgICAgICByZXR1cm4gXCI8Li4uPlwiO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIG5hbWUgPSBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSk7XG4gICAgICAgIHJldHVybiBuYW1lID8gXCI8XCIgKyBuYW1lICsgXCI+XCIgOiBcIjwuLi4+XCI7XG4gICAgICB9IGNhdGNoICh4KSB7XG4gICAgICAgIHJldHVybiBcIjwuLi4+XCI7XG4gICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldE93bmVyKCkge1xuICAgICAgdmFyIGRpc3BhdGNoZXIgPSBSZWFjdFNoYXJlZEludGVybmFscy5BO1xuICAgICAgcmV0dXJuIG51bGwgPT09IGRpc3BhdGNoZXIgPyBudWxsIDogZGlzcGF0Y2hlci5nZXRPd25lcigpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBVbmtub3duT3duZXIoKSB7XG4gICAgICByZXR1cm4gRXJyb3IoXCJyZWFjdC1zdGFjay10b3AtZnJhbWVcIik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGhhc1ZhbGlkS2V5KGNvbmZpZykge1xuICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBcImtleVwiKSkge1xuICAgICAgICB2YXIgZ2V0dGVyID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihjb25maWcsIFwia2V5XCIpLmdldDtcbiAgICAgICAgaWYgKGdldHRlciAmJiBnZXR0ZXIuaXNSZWFjdFdhcm5pbmcpIHJldHVybiAhMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2b2lkIDAgIT09IGNvbmZpZy5rZXk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRlZmluZUtleVByb3BXYXJuaW5nR2V0dGVyKHByb3BzLCBkaXNwbGF5TmFtZSkge1xuICAgICAgZnVuY3Rpb24gd2FybkFib3V0QWNjZXNzaW5nS2V5KCkge1xuICAgICAgICBzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93biB8fFxuICAgICAgICAgICgoc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd24gPSAhMCksXG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIFwiJXM6IGBrZXlgIGlzIG5vdCBhIHByb3AuIFRyeWluZyB0byBhY2Nlc3MgaXQgd2lsbCByZXN1bHQgaW4gYHVuZGVmaW5lZGAgYmVpbmcgcmV0dXJuZWQuIElmIHlvdSBuZWVkIHRvIGFjY2VzcyB0aGUgc2FtZSB2YWx1ZSB3aXRoaW4gdGhlIGNoaWxkIGNvbXBvbmVudCwgeW91IHNob3VsZCBwYXNzIGl0IGFzIGEgZGlmZmVyZW50IHByb3AuIChodHRwczovL3JlYWN0LmRldi9saW5rL3NwZWNpYWwtcHJvcHMpXCIsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZVxuICAgICAgICAgICkpO1xuICAgICAgfVxuICAgICAgd2FybkFib3V0QWNjZXNzaW5nS2V5LmlzUmVhY3RXYXJuaW5nID0gITA7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsIFwia2V5XCIsIHtcbiAgICAgICAgZ2V0OiB3YXJuQWJvdXRBY2Nlc3NpbmdLZXksXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITBcbiAgICAgIH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlbGVtZW50UmVmR2V0dGVyV2l0aERlcHJlY2F0aW9uV2FybmluZygpIHtcbiAgICAgIHZhciBjb21wb25lbnROYW1lID0gZ2V0Q29tcG9uZW50TmFtZUZyb21UeXBlKHRoaXMudHlwZSk7XG4gICAgICBkaWRXYXJuQWJvdXRFbGVtZW50UmVmW2NvbXBvbmVudE5hbWVdIHx8XG4gICAgICAgICgoZGlkV2FybkFib3V0RWxlbWVudFJlZltjb21wb25lbnROYW1lXSA9ICEwKSxcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIkFjY2Vzc2luZyBlbGVtZW50LnJlZiB3YXMgcmVtb3ZlZCBpbiBSZWFjdCAxOS4gcmVmIGlzIG5vdyBhIHJlZ3VsYXIgcHJvcC4gSXQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIEpTWCBFbGVtZW50IHR5cGUgaW4gYSBmdXR1cmUgcmVsZWFzZS5cIlxuICAgICAgICApKTtcbiAgICAgIGNvbXBvbmVudE5hbWUgPSB0aGlzLnByb3BzLnJlZjtcbiAgICAgIHJldHVybiB2b2lkIDAgIT09IGNvbXBvbmVudE5hbWUgPyBjb21wb25lbnROYW1lIDogbnVsbDtcbiAgICB9XG4gICAgZnVuY3Rpb24gUmVhY3RFbGVtZW50KHR5cGUsIGtleSwgcHJvcHMsIG93bmVyLCBkZWJ1Z1N0YWNrLCBkZWJ1Z1Rhc2spIHtcbiAgICAgIHZhciByZWZQcm9wID0gcHJvcHMucmVmO1xuICAgICAgdHlwZSA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0VMRU1FTlRfVFlQRSxcbiAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgICAgX293bmVyOiBvd25lclxuICAgICAgfTtcbiAgICAgIG51bGwgIT09ICh2b2lkIDAgIT09IHJlZlByb3AgPyByZWZQcm9wIDogbnVsbClcbiAgICAgICAgPyBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJyZWZcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgICAgICBnZXQ6IGVsZW1lbnRSZWZHZXR0ZXJXaXRoRGVwcmVjYXRpb25XYXJuaW5nXG4gICAgICAgICAgfSlcbiAgICAgICAgOiBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJyZWZcIiwgeyBlbnVtZXJhYmxlOiAhMSwgdmFsdWU6IG51bGwgfSk7XG4gICAgICB0eXBlLl9zdG9yZSA9IHt9O1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUuX3N0b3JlLCBcInZhbGlkYXRlZFwiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITEsXG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICB3cml0YWJsZTogITAsXG4gICAgICAgIHZhbHVlOiAwXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIl9kZWJ1Z0luZm9cIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogbnVsbFxuICAgICAgfSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJfZGVidWdTdGFja1wiLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogITEsXG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICB3cml0YWJsZTogITAsXG4gICAgICAgIHZhbHVlOiBkZWJ1Z1N0YWNrXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIl9kZWJ1Z1Rhc2tcIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogZGVidWdUYXNrXG4gICAgICB9KTtcbiAgICAgIE9iamVjdC5mcmVlemUgJiYgKE9iamVjdC5mcmVlemUodHlwZS5wcm9wcyksIE9iamVjdC5mcmVlemUodHlwZSkpO1xuICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGpzeERFVkltcGwoXG4gICAgICB0eXBlLFxuICAgICAgY29uZmlnLFxuICAgICAgbWF5YmVLZXksXG4gICAgICBpc1N0YXRpY0NoaWxkcmVuLFxuICAgICAgZGVidWdTdGFjayxcbiAgICAgIGRlYnVnVGFza1xuICAgICkge1xuICAgICAgdmFyIGNoaWxkcmVuID0gY29uZmlnLmNoaWxkcmVuO1xuICAgICAgaWYgKHZvaWQgMCAhPT0gY2hpbGRyZW4pXG4gICAgICAgIGlmIChpc1N0YXRpY0NoaWxkcmVuKVxuICAgICAgICAgIGlmIChpc0FycmF5SW1wbChjaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGZvciAoXG4gICAgICAgICAgICAgIGlzU3RhdGljQ2hpbGRyZW4gPSAwO1xuICAgICAgICAgICAgICBpc1N0YXRpY0NoaWxkcmVuIDwgY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICAgICAgICBpc1N0YXRpY0NoaWxkcmVuKytcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgdmFsaWRhdGVDaGlsZEtleXMoY2hpbGRyZW5baXNTdGF0aWNDaGlsZHJlbl0pO1xuICAgICAgICAgICAgT2JqZWN0LmZyZWV6ZSAmJiBPYmplY3QuZnJlZXplKGNoaWxkcmVuKTtcbiAgICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwiUmVhY3QuanN4OiBTdGF0aWMgY2hpbGRyZW4gc2hvdWxkIGFsd2F5cyBiZSBhbiBhcnJheS4gWW91IGFyZSBsaWtlbHkgZXhwbGljaXRseSBjYWxsaW5nIFJlYWN0LmpzeHMgb3IgUmVhY3QuanN4REVWLiBVc2UgdGhlIEJhYmVsIHRyYW5zZm9ybSBpbnN0ZWFkLlwiXG4gICAgICAgICAgICApO1xuICAgICAgICBlbHNlIHZhbGlkYXRlQ2hpbGRLZXlzKGNoaWxkcmVuKTtcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgXCJrZXlcIikpIHtcbiAgICAgICAgY2hpbGRyZW4gPSBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSk7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY29uZmlnKS5maWx0ZXIoZnVuY3Rpb24gKGspIHtcbiAgICAgICAgICByZXR1cm4gXCJrZXlcIiAhPT0gaztcbiAgICAgICAgfSk7XG4gICAgICAgIGlzU3RhdGljQ2hpbGRyZW4gPVxuICAgICAgICAgIDAgPCBrZXlzLmxlbmd0aFxuICAgICAgICAgICAgPyBcIntrZXk6IHNvbWVLZXksIFwiICsga2V5cy5qb2luKFwiOiAuLi4sIFwiKSArIFwiOiAuLi59XCJcbiAgICAgICAgICAgIDogXCJ7a2V5OiBzb21lS2V5fVwiO1xuICAgICAgICBkaWRXYXJuQWJvdXRLZXlTcHJlYWRbY2hpbGRyZW4gKyBpc1N0YXRpY0NoaWxkcmVuXSB8fFxuICAgICAgICAgICgoa2V5cyA9XG4gICAgICAgICAgICAwIDwga2V5cy5sZW5ndGggPyBcIntcIiArIGtleXMuam9pbihcIjogLi4uLCBcIikgKyBcIjogLi4ufVwiIDogXCJ7fVwiKSxcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgJ0EgcHJvcHMgb2JqZWN0IGNvbnRhaW5pbmcgYSBcImtleVwiIHByb3AgaXMgYmVpbmcgc3ByZWFkIGludG8gSlNYOlxcbiAgbGV0IHByb3BzID0gJXM7XFxuICA8JXMgey4uLnByb3BzfSAvPlxcblJlYWN0IGtleXMgbXVzdCBiZSBwYXNzZWQgZGlyZWN0bHkgdG8gSlNYIHdpdGhvdXQgdXNpbmcgc3ByZWFkOlxcbiAgbGV0IHByb3BzID0gJXM7XFxuICA8JXMga2V5PXtzb21lS2V5fSB7Li4ucHJvcHN9IC8+JyxcbiAgICAgICAgICAgIGlzU3RhdGljQ2hpbGRyZW4sXG4gICAgICAgICAgICBjaGlsZHJlbixcbiAgICAgICAgICAgIGtleXMsXG4gICAgICAgICAgICBjaGlsZHJlblxuICAgICAgICAgICksXG4gICAgICAgICAgKGRpZFdhcm5BYm91dEtleVNwcmVhZFtjaGlsZHJlbiArIGlzU3RhdGljQ2hpbGRyZW5dID0gITApKTtcbiAgICAgIH1cbiAgICAgIGNoaWxkcmVuID0gbnVsbDtcbiAgICAgIHZvaWQgMCAhPT0gbWF5YmVLZXkgJiZcbiAgICAgICAgKGNoZWNrS2V5U3RyaW5nQ29lcmNpb24obWF5YmVLZXkpLCAoY2hpbGRyZW4gPSBcIlwiICsgbWF5YmVLZXkpKTtcbiAgICAgIGhhc1ZhbGlkS2V5KGNvbmZpZykgJiZcbiAgICAgICAgKGNoZWNrS2V5U3RyaW5nQ29lcmNpb24oY29uZmlnLmtleSksIChjaGlsZHJlbiA9IFwiXCIgKyBjb25maWcua2V5KSk7XG4gICAgICBpZiAoXCJrZXlcIiBpbiBjb25maWcpIHtcbiAgICAgICAgbWF5YmVLZXkgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgcHJvcE5hbWUgaW4gY29uZmlnKVxuICAgICAgICAgIFwia2V5XCIgIT09IHByb3BOYW1lICYmIChtYXliZUtleVtwcm9wTmFtZV0gPSBjb25maWdbcHJvcE5hbWVdKTtcbiAgICAgIH0gZWxzZSBtYXliZUtleSA9IGNvbmZpZztcbiAgICAgIGNoaWxkcmVuICYmXG4gICAgICAgIGRlZmluZUtleVByb3BXYXJuaW5nR2V0dGVyKFxuICAgICAgICAgIG1heWJlS2V5LFxuICAgICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHR5cGVcbiAgICAgICAgICAgID8gdHlwZS5kaXNwbGF5TmFtZSB8fCB0eXBlLm5hbWUgfHwgXCJVbmtub3duXCJcbiAgICAgICAgICAgIDogdHlwZVxuICAgICAgICApO1xuICAgICAgcmV0dXJuIFJlYWN0RWxlbWVudChcbiAgICAgICAgdHlwZSxcbiAgICAgICAgY2hpbGRyZW4sXG4gICAgICAgIG1heWJlS2V5LFxuICAgICAgICBnZXRPd25lcigpLFxuICAgICAgICBkZWJ1Z1N0YWNrLFxuICAgICAgICBkZWJ1Z1Rhc2tcbiAgICAgICk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlQ2hpbGRLZXlzKG5vZGUpIHtcbiAgICAgIGlzVmFsaWRFbGVtZW50KG5vZGUpXG4gICAgICAgID8gbm9kZS5fc3RvcmUgJiYgKG5vZGUuX3N0b3JlLnZhbGlkYXRlZCA9IDEpXG4gICAgICAgIDogXCJvYmplY3RcIiA9PT0gdHlwZW9mIG5vZGUgJiZcbiAgICAgICAgICBudWxsICE9PSBub2RlICYmXG4gICAgICAgICAgbm9kZS4kJHR5cGVvZiA9PT0gUkVBQ1RfTEFaWV9UWVBFICYmXG4gICAgICAgICAgKFwiZnVsZmlsbGVkXCIgPT09IG5vZGUuX3BheWxvYWQuc3RhdHVzXG4gICAgICAgICAgICA/IGlzVmFsaWRFbGVtZW50KG5vZGUuX3BheWxvYWQudmFsdWUpICYmXG4gICAgICAgICAgICAgIG5vZGUuX3BheWxvYWQudmFsdWUuX3N0b3JlICYmXG4gICAgICAgICAgICAgIChub2RlLl9wYXlsb2FkLnZhbHVlLl9zdG9yZS52YWxpZGF0ZWQgPSAxKVxuICAgICAgICAgICAgOiBub2RlLl9zdG9yZSAmJiAobm9kZS5fc3RvcmUudmFsaWRhdGVkID0gMSkpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1ZhbGlkRWxlbWVudChvYmplY3QpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiBvYmplY3QgJiZcbiAgICAgICAgbnVsbCAhPT0gb2JqZWN0ICYmXG4gICAgICAgIG9iamVjdC4kJHR5cGVvZiA9PT0gUkVBQ1RfRUxFTUVOVF9UWVBFXG4gICAgICApO1xuICAgIH1cbiAgICB2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIiksXG4gICAgICBSRUFDVF9FTEVNRU5UX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QudHJhbnNpdGlvbmFsLmVsZW1lbnRcIiksXG4gICAgICBSRUFDVF9QT1JUQUxfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5wb3J0YWxcIiksXG4gICAgICBSRUFDVF9GUkFHTUVOVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmZyYWdtZW50XCIpLFxuICAgICAgUkVBQ1RfU1RSSUNUX01PREVfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5zdHJpY3RfbW9kZVwiKSxcbiAgICAgIFJFQUNUX1BST0ZJTEVSX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QucHJvZmlsZXJcIiksXG4gICAgICBSRUFDVF9DT05TVU1FUl9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmNvbnN1bWVyXCIpLFxuICAgICAgUkVBQ1RfQ09OVEVYVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmNvbnRleHRcIiksXG4gICAgICBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LmZvcndhcmRfcmVmXCIpLFxuICAgICAgUkVBQ1RfU1VTUEVOU0VfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5zdXNwZW5zZVwiKSxcbiAgICAgIFJFQUNUX1NVU1BFTlNFX0xJU1RfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5zdXNwZW5zZV9saXN0XCIpLFxuICAgICAgUkVBQ1RfTUVNT19UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0Lm1lbW9cIiksXG4gICAgICBSRUFDVF9MQVpZX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QubGF6eVwiKSxcbiAgICAgIFJFQUNUX0FDVElWSVRZX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuYWN0aXZpdHlcIiksXG4gICAgICBSRUFDVF9DTElFTlRfUkVGRVJFTkNFID0gU3ltYm9sLmZvcihcInJlYWN0LmNsaWVudC5yZWZlcmVuY2VcIiksXG4gICAgICBSZWFjdFNoYXJlZEludGVybmFscyA9XG4gICAgICAgIFJlYWN0Ll9fQ0xJRU5UX0lOVEVSTkFMU19ET19OT1RfVVNFX09SX1dBUk5fVVNFUlNfVEhFWV9DQU5OT1RfVVBHUkFERSxcbiAgICAgIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSxcbiAgICAgIGlzQXJyYXlJbXBsID0gQXJyYXkuaXNBcnJheSxcbiAgICAgIGNyZWF0ZVRhc2sgPSBjb25zb2xlLmNyZWF0ZVRhc2tcbiAgICAgICAgPyBjb25zb2xlLmNyZWF0ZVRhc2tcbiAgICAgICAgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9O1xuICAgIFJlYWN0ID0ge1xuICAgICAgcmVhY3Rfc3RhY2tfYm90dG9tX2ZyYW1lOiBmdW5jdGlvbiAoY2FsbFN0YWNrRm9yRXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxTdGFja0ZvckVycm9yKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd247XG4gICAgdmFyIGRpZFdhcm5BYm91dEVsZW1lbnRSZWYgPSB7fTtcbiAgICB2YXIgdW5rbm93bk93bmVyRGVidWdTdGFjayA9IFJlYWN0LnJlYWN0X3N0YWNrX2JvdHRvbV9mcmFtZS5iaW5kKFxuICAgICAgUmVhY3QsXG4gICAgICBVbmtub3duT3duZXJcbiAgICApKCk7XG4gICAgdmFyIHVua25vd25Pd25lckRlYnVnVGFzayA9IGNyZWF0ZVRhc2soZ2V0VGFza05hbWUoVW5rbm93bk93bmVyKSk7XG4gICAgdmFyIGRpZFdhcm5BYm91dEtleVNwcmVhZCA9IHt9O1xuICAgIGV4cG9ydHMuRnJhZ21lbnQgPSBSRUFDVF9GUkFHTUVOVF9UWVBFO1xuICAgIGV4cG9ydHMuanN4REVWID0gZnVuY3Rpb24gKHR5cGUsIGNvbmZpZywgbWF5YmVLZXksIGlzU3RhdGljQ2hpbGRyZW4pIHtcbiAgICAgIHZhciB0cmFja0FjdHVhbE93bmVyID1cbiAgICAgICAgMWU0ID4gUmVhY3RTaGFyZWRJbnRlcm5hbHMucmVjZW50bHlDcmVhdGVkT3duZXJTdGFja3MrKztcbiAgICAgIHJldHVybiBqc3hERVZJbXBsKFxuICAgICAgICB0eXBlLFxuICAgICAgICBjb25maWcsXG4gICAgICAgIG1heWJlS2V5LFxuICAgICAgICBpc1N0YXRpY0NoaWxkcmVuLFxuICAgICAgICB0cmFja0FjdHVhbE93bmVyXG4gICAgICAgICAgPyBFcnJvcihcInJlYWN0LXN0YWNrLXRvcC1mcmFtZVwiKVxuICAgICAgICAgIDogdW5rbm93bk93bmVyRGVidWdTdGFjayxcbiAgICAgICAgdHJhY2tBY3R1YWxPd25lciA/IGNyZWF0ZVRhc2soZ2V0VGFza05hbWUodHlwZSkpIDogdW5rbm93bk93bmVyRGVidWdUYXNrXG4gICAgICApO1xuICAgIH07XG4gIH0pKCk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QtanN4LWRldi1ydW50aW1lLnByb2R1Y3Rpb24uanMnKTtcbn0gZWxzZSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QtanN4LWRldi1ydW50aW1lLmRldmVsb3BtZW50LmpzJyk7XG59XG4iLCIvKipcbiAqIFJTQyBNb3ZpZXMgU2VydmljZSBXb3JrZXJcbiAqXG4gKiBSZW5kZXJzIG1vdmllIGxpc3QgYXMgUmVhY3QgU2VydmVyIENvbXBvbmVudHMuXG4gKiBPbmx5IHRoZSBzdGFyIHJhdGluZyBpcyBpbnRlcmFjdGl2ZSAoY2xpZW50IGNvbXBvbmVudCkuXG4gKi9cbi8vLyA8cmVmZXJlbmNlIGxpYj1cIndlYndvcmtlclwiIC8+XG5cbmltcG9ydCBcImxpYi9yc2Mtc2VydmljZS13b3JrZXItYmZmL3JzYy93ZWJwYWNrLXNoaW1cIjtcblxuaW1wb3J0IHsgc2V0dXBXb3JrZXIsIGh0dHAsIGpzb24sIGNyZWF0ZUNsaWVudE1vZHVsZSB9IGZyb20gXCJsaWIvcnNjLXNlcnZpY2Utd29ya2VyLWJmZlwiO1xuaW1wb3J0IHtcbiAgY3JlYXRlRmxpZ2h0UmVzcG9uc2UsXG4gIGNyZWF0ZVNlcnZlckFjdGlvbixcbiAgZXhlY3V0ZVNlcnZlckFjdGlvbixcbn0gZnJvbSBcImxpYi9yc2Mtc2VydmljZS13b3JrZXItYmZmL3JzYy9mbGlnaHQtc2VyaWFsaXplclwiO1xuaW1wb3J0IHR5cGUgeyBNb3ZpZSB9IGZyb20gXCIuLi8uLi9hcGkvdHlwZXNcIjtcbmltcG9ydCB0eXBlICogYXMgQ2xpZW50Q29tcG9uZW50cyBmcm9tIFwiLi9jbGllbnQtY29tcG9uZW50c1wiO1xuXG4vLyA9PT09PT09PT09IE1vdmllIERhdGFiYXNlID09PT09PT09PT1cbmxldCBtb3ZpZURhdGFiYXNlQ2FjaGU6IE1vdmllW10gfCBudWxsID0gbnVsbDtcblxuYXN5bmMgZnVuY3Rpb24gZ2V0RGF0YWJhc2UoKTogUHJvbWlzZTxNb3ZpZVtdPiB7XG4gIGlmIChtb3ZpZURhdGFiYXNlQ2FjaGUgIT0gbnVsbCkge1xuICAgIHJldHVybiBtb3ZpZURhdGFiYXNlQ2FjaGU7XG4gIH1cblxuICBjb25zdCBbbW92aWVzMSwgbW92aWVzMl0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgZmV0Y2goXCIvbW92aWVzLzEuanNvblwiKS50aGVuKChyZXMpID0+IHJlcy5qc29uKCkpLFxuICAgIGZldGNoKFwiL21vdmllcy8yLmpzb25cIikudGhlbigocmVzKSA9PiByZXMuanNvbigpKSxcbiAgXSk7XG5cbiAgbW92aWVEYXRhYmFzZUNhY2hlID0gWy4uLm1vdmllczEsIC4uLm1vdmllczJdLm1hcChcbiAgICAobW92aWU6IGFueSkgPT5cbiAgICAgICh7XG4gICAgICAgIGlkOiBtb3ZpZS5pZCxcbiAgICAgICAgdGl0bGVUZXh0OiBtb3ZpZS50aXRsZVRleHQudGV4dCxcbiAgICAgICAgcmVsZWFzZVllYXI6IG1vdmllLnJlbGVhc2VZZWFyPy55ZWFyID8/IDAsXG4gICAgICAgIGdlbnJlczogbW92aWUuZ2VucmVzLmdlbnJlcy5tYXAoKGdlbnJlOiB7IHRleHQ6IHN0cmluZyB9KSA9PiBnZW5yZS50ZXh0KSxcbiAgICAgICAgcGxvdDogbW92aWUucGxvdD8ucGxvdFRleHQucGxhaW5UZXh0ID8/IFwiXCIsXG4gICAgICAgIGRpcmVjdG9yczogW10sXG4gICAgICAgIHJhdGluZzogbW92aWUucmF0aW5nc1N1bW1hcnkuYWdncmVnYXRlUmF0aW5nID8/IDAsXG4gICAgICAgIGltYWdlOiBtb3ZpZS5wcmltYXJ5SW1hZ2U/LnVybCA/PyBcIlwiLFxuICAgICAgfSkgc2F0aXNmaWVzIE1vdmllLFxuICApO1xuXG4gIHJldHVybiBtb3ZpZURhdGFiYXNlQ2FjaGU7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlYXJjaE1vdmllcyhxdWVyeTogc3RyaW5nLCBsaW1pdDogbnVtYmVyID0gNTAwKTogUHJvbWlzZTxNb3ZpZVtdPiB7XG4gIGNvbnN0IGRhdGFiYXNlID0gYXdhaXQgZ2V0RGF0YWJhc2UoKTtcbiAgcXVlcnkgPSBxdWVyeS50cmltKCk7XG5cbiAgaWYgKCFxdWVyeSkge1xuICAgIHJldHVybiBkYXRhYmFzZS5zbGljZSgwLCBsaW1pdCk7XG4gIH1cblxuICBjb25zdCBzZWFyY2hUZXJtID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIGRhdGFiYXNlXG4gICAgLmZpbHRlcigobW92aWUpID0+IHtcbiAgICAgIGlmIChtb3ZpZS50aXRsZVRleHQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhzZWFyY2hUZXJtKSkgcmV0dXJuIHRydWU7XG4gICAgICBpZiAobW92aWUuZ2VucmVzLnNvbWUoKGdlbnJlKSA9PiBnZW5yZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHNlYXJjaFRlcm0pKSkgcmV0dXJuIHRydWU7XG4gICAgICBpZiAobW92aWUucGxvdC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHNlYXJjaFRlcm0pKSByZXR1cm4gdHJ1ZTtcbiAgICAgIGlmIChtb3ZpZS5kaXJlY3RvcnMuc29tZSgoZGlyZWN0b3IpID0+IGRpcmVjdG9yLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoc2VhcmNoVGVybSkpKVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KVxuICAgIC5zbGljZSgwLCBsaW1pdCk7XG59XG5cbi8vID09PT09PT09PT0gQ3JlYXRlIENsaWVudCBNb2R1bGUgPT09PT09PT09PVxuY29uc3QgeyBtYW5pZmVzdCwgcmVmczogQ2xpZW50IH0gPSBjcmVhdGVDbGllbnRNb2R1bGU8dHlwZW9mIENsaWVudENvbXBvbmVudHM+KFxuICBcInJzYy1tb3ZpZXMtY2xpZW50XCIsXG4gIFtcIlJhdGluZ1N0YXJzXCJdLFxuKTtcblxuLy8gPT09PT09PT09PSBTZXJ2ZXIgQWN0aW9ucyA9PT09PT09PT09XG5jcmVhdGVTZXJ2ZXJBY3Rpb24oXCJ1cGRhdGVSYXRpbmdcIiwgYXN5bmMgKG1vdmllSWQ6IHN0cmluZywgcmF0aW5nOiBudW1iZXIpOiBQcm9taXNlPE1vdmllPiA9PiB7XG4gIGNvbnN0IGRhdGFiYXNlID0gYXdhaXQgZ2V0RGF0YWJhc2UoKTtcbiAgY29uc3QgbW92aWUgPSBkYXRhYmFzZS5maW5kKChtKSA9PiBtLmlkID09PSBtb3ZpZUlkKTtcbiAgaWYgKCFtb3ZpZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgTW92aWUgJHttb3ZpZUlkfSBub3QgZm91bmRgKTtcbiAgfVxuICAvLyBBZGQgc29tZSByYW5kb21uZXNzIGxpa2UgdGhlIG9yaWdpbmFsXG4gIGNvbnN0IHJhbmRvbURlY2ltYWwgPSBNYXRoLnJhbmRvbSgpICogMS45O1xuICBtb3ZpZS5yYXRpbmcgPSBNYXRoLm1pbigxMCwgcGFyc2VGbG9hdCgocmF0aW5nICsgcmFuZG9tRGVjaW1hbCkudG9GaXhlZCgxKSkpO1xuICBjb25zb2xlLmxvZyhcIltTV10gVXBkYXRlZCByYXRpbmc6XCIsIG1vdmllSWQsIFwiLT5cIiwgbW92aWUucmF0aW5nKTtcbiAgcmV0dXJuIG1vdmllO1xufSk7XG5cbi8vID09PT09PT09PT0gU2VydmVyIENvbXBvbmVudHMgPT09PT09PT09PVxuXG5jb25zdCBNT1ZJRV9DQVJEX1NJWkUgPSBcIjE0MHB4XCI7XG5cbmZ1bmN0aW9uIE1vdmllQ2FyZCh7IG1vdmllIH06IHsgbW92aWU6IE1vdmllIH0pIHtcbiAgY29uc3QgcmF0aW5nID0gbW92aWUucmF0aW5nO1xuICBjb25zdCBjdXJyZW50U3RhcnMgPSBNYXRoLmNlaWwoKHJhdGluZyA/PyAwKSAvIDIpO1xuICBjb25zdCBkaXJlY3RvciA9IG1vdmllLmRpcmVjdG9ycy5qb2luKFwiLCBcIikgfHwgXCJVbmtub3duXCI7XG4gIGNvbnN0IGdlbnJlcyA9IG1vdmllLmdlbnJlcy5qb2luKFwiLCBcIikgfHwgXCJVbmtub3duXCI7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjbGFzc05hbWU9XCJncm91cCBiZy13aGl0ZSBib3JkZXIgYm9yZGVyLWdyYXktMTAwIHJvdW5kZWQtNHhsIFtjb3JuZXItc2hhcGU6c3VwZXJlbGxpcHNlKDEuMzMpXSBvdmVyZmxvdy1oaWRkZW4gaG92ZXI6Ym9yZGVyLWJsYWNrIGhvdmVyOnNoYWRvdy1sZyBmbGV4IGZsZXgtY29sIHNtOmZsZXgtcm93IG1heC13LTN4bCBteC1hdXRvIHctZnVsbFwiXG4gICAgICBzdHlsZT17eyBoZWlnaHQ6IE1PVklFX0NBUkRfU0laRSB9fVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC0zIHNtOnAtNCBmbGV4LTEgZmxleCBmbGV4LWNvbCBnYXAtMlwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtc3RhcnQganVzdGlmeS1iZXR3ZWVuIGdhcC0yXCI+XG4gICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtc20gc206dGV4dC1iYXNlIGZvbnQtYm9sZCB0ZXh0LWJsYWNrIGxpbmUtY2xhbXAtMiBzbTp0cnVuY2F0ZSBncm91cC1ob3Zlcjp0ZXh0LWdyYXktOTAwXCI+XG4gICAgICAgICAgICB7bW92aWUudGl0bGVUZXh0fVxuICAgICAgICAgIDwvaDM+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXdyYXAgaXRlbXMtY2VudGVyIGdhcC0xLjUgc206Z2FwLTIgdGV4dC14cyB0ZXh0LWdyYXktNjAwXCI+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTFcIj5cbiAgICAgICAgICAgIDxzdmcgY2xhc3NOYW1lPVwidy0zIGgtM1wiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCI+XG4gICAgICAgICAgICAgIDxwYXRoIGQ9XCJNNiAyYTEgMSAwIDAwLTEgMXYxSDRhMiAyIDAgMDAtMiAydjEwYTIgMiAwIDAwMiAyaDEyYTIgMiAwIDAwMi0yVjZhMiAyIDAgMDAtMi0yaC0xVjNhMSAxIDAgMTAtMiAwdjFIN1YzYTEgMSAwIDAwLTEtMXptMCA1YTEgMSAwIDAwMCAyaDhhMSAxIDAgMTAwLTJINnpcIiAvPlxuICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICB7bW92aWUucmVsZWFzZVllYXIgPz8gXCJOL0FcIn1cbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMFwiPuKAojwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJweC0yIHB5LTAuNSB0ZXh0LXhzIGZvbnQtYm9sZCBiZy1ibGFjayB0ZXh0LXdoaXRlIHJvdW5kZWQtbWQgc2hhZG93LWxnXCI+XG4gICAgICAgICAgICB7cmF0aW5nPy50b0ZpeGVkKDEpID8/IFwiTi9BXCJ9XG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDBcIj7igKI8L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidHJ1bmNhdGUgbWF4LXctWzEyMHB4XSBzbTptYXgtdy1ub25lXCI+e2RpcmVjdG9yfTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwXCI+4oCiPC9zcGFuPlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInB4LTIgcHktMC41IGJnLWdyYXktMTAwIHRleHQtZ3JheS03MDAgcm91bmRlZC1tZCB0cnVuY2F0ZSBtYXgtdy1bMTUwcHhdXCI+XG4gICAgICAgICAgICB7Z2VucmVzfVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIENsaWVudCBDb21wb25lbnQ6IEludGVyYWN0aXZlIFN0YXIgUmF0aW5nICovfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgPENsaWVudC5SYXRpbmdTdGFycyBtb3ZpZUlkPXttb3ZpZS5pZH0gY3VycmVudFN0YXJzPXtjdXJyZW50U3RhcnN9IC8+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHttb3ZpZS5wbG90ICYmIDxkaXYgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNjAwIGxpbmUtY2xhbXAtMlwiPnttb3ZpZS5wbG90fTwvZGl2Pn1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuXG5mdW5jdGlvbiBNb3ZpZUxpc3QoeyBtb3ZpZXMgfTogeyBtb3ZpZXM6IE1vdmllW10gfSkge1xuICBpZiAobW92aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyIHB5LTEyIG1kOnB5LTIwXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC00eGwgbWQ6dGV4dC02eGwgbWItNFwiPvCfjqw8L2Rpdj5cbiAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1sZyBtZDp0ZXh0LXhsIHRleHQtZ3JheS02MDAgbWItMlwiPk5vIG1vdmllcyBmb3VuZDwvcD5cbiAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyBtZDp0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5UcnkgYSBkaWZmZXJlbnQgc2VhcmNoIHRlcm08L3A+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2PlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYi00IG1kOm1iLTYgdGV4dC1jZW50ZXJcIj5cbiAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyBtZDp0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj5cbiAgICAgICAgICBGb3VuZCB7bW92aWVzLmxlbmd0aH0ge21vdmllcy5sZW5ndGggPT09IDEgPyBcIm1vdmllXCIgOiBcIm1vdmllc1wifVxuICAgICAgICA8L3A+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBnYXAtMyBtZDpnYXAtNFwiPlxuICAgICAgICB7bW92aWVzLm1hcCgobW92aWUpID0+IChcbiAgICAgICAgICA8TW92aWVDYXJkIGtleT17bW92aWUuaWR9IG1vdmllPXttb3ZpZX0gLz5cbiAgICAgICAgKSl9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gQXBwKHsgc2VhcmNoUXVlcnksIGxpbWl0IH06IHsgc2VhcmNoUXVlcnk6IHN0cmluZzsgbGltaXQ6IG51bWJlciB9KSB7XG4gIGNvbnN0IG1vdmllcyA9IGF3YWl0IHNlYXJjaE1vdmllcyhzZWFyY2hRdWVyeSwgbGltaXQpO1xuICByZXR1cm4gPE1vdmllTGlzdCBtb3ZpZXM9e21vdmllc30gLz47XG59XG5cbi8vID09PT09PT09PT0gUm91dGVzID09PT09PT09PT1cbnNldHVwV29ya2VyKFtcbiAgLy8gPT09PT0gSlNPTiBBUEkgKGZvciBDdXN0b21MaWJyYXJ5VGFiICYgVGFuU3RhY2tRdWVyeVRhYikgPT09PT1cblxuICAvLyBHRVQgL2FwaS9tb3ZpZXMvc2VhcmNoP3F1ZXJ5PS4uLiZsaW1pdD0uLi5cbiAgaHR0cC5nZXQoXCIvYXBpL21vdmllcy9zZWFyY2hcIiwgYXN5bmMgKHsgdXJsIH0pID0+IHtcbiAgICBjb25zdCBxdWVyeSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwicXVlcnlcIikgPz8gXCJcIjtcbiAgICBjb25zdCBsaW1pdFBhcmFtID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJsaW1pdFwiKTtcbiAgICBjb25zdCBsaW1pdCA9IGxpbWl0UGFyYW0gIT0gbnVsbCA/IE51bWJlci5wYXJzZUludChsaW1pdFBhcmFtLCAxMCkgOiA1MDA7XG5cbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgc2VhcmNoTW92aWVzKHF1ZXJ5LCBsaW1pdCk7XG4gICAgcmV0dXJuIGpzb24ocmVzdWx0cyk7XG4gIH0pLFxuXG4gIC8vIEdFVCAvYXBpL21vdmllcy86aWRcbiAgaHR0cC5nZXQoXCIvYXBpL21vdmllcy86aWRcIiwgYXN5bmMgKHsgcGFyYW1zIH0pID0+IHtcbiAgICBjb25zdCBpZCA9IHBhcmFtcy5pZCBhcyBzdHJpbmc7XG4gICAgY29uc3QgZGF0YWJhc2UgPSBhd2FpdCBnZXREYXRhYmFzZSgpO1xuICAgIGNvbnN0IG1vdmllID0gZGF0YWJhc2UuZmluZCgobSkgPT4gbS5pZCA9PT0gaWQpO1xuXG4gICAgaWYgKG1vdmllID09IG51bGwpIHtcbiAgICAgIHJldHVybiBqc29uKHsgZXJyb3I6IGBNb3ZpZSB3aXRoIGlkICR7aWR9IG5vdCBmb3VuZGAgfSwgeyBzdGF0dXM6IDQwNCB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4ganNvbihtb3ZpZSk7XG4gIH0pLFxuXG4gIC8vIFBBVENIIC9hcGkvbW92aWVzLzppZC9yYXRpbmdcbiAgaHR0cC5wYXRjaChcIi9hcGkvbW92aWVzLzppZC9yYXRpbmdcIiwgYXN5bmMgKHsgcGFyYW1zLCByZXF1ZXN0IH0pID0+IHtcbiAgICBjb25zdCBpZCA9IHBhcmFtcy5pZCBhcyBzdHJpbmc7XG4gICAgY29uc3QgYm9keSA9IChhd2FpdCByZXF1ZXN0Lmpzb24oKSkgYXMgeyByYXRpbmc6IG51bWJlciB9O1xuICAgIGNvbnN0IGRhdGFiYXNlID0gYXdhaXQgZ2V0RGF0YWJhc2UoKTtcbiAgICBjb25zdCBtb3ZpZSA9IGRhdGFiYXNlLmZpbmQoKG0pID0+IG0uaWQgPT09IGlkKTtcblxuICAgIGlmIChtb3ZpZSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4ganNvbih7IGVycm9yOiBgTW92aWUgd2l0aCBpZCAke2lkfSBub3QgZm91bmRgIH0sIHsgc3RhdHVzOiA0MDQgfSk7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIHJhdGluZyB3aXRoIHNvbWUgcmFuZG9tbmVzc1xuICAgIGNvbnN0IHJhbmRvbURlY2ltYWwgPSBNYXRoLnJhbmRvbSgpICogMS45O1xuICAgIG1vdmllLnJhdGluZyA9IE1hdGgubWluKDEwLCBwYXJzZUZsb2F0KChib2R5LnJhdGluZyArIHJhbmRvbURlY2ltYWwpLnRvRml4ZWQoMSkpKTtcblxuICAgIHJldHVybiBqc29uKG1vdmllKTtcbiAgfSksXG5cbiAgLy8gPT09PT0gUlNDIEFQSSAoZm9yIFJTQ01vdmllc1RhYikgPT09PT1cblxuICAvLyBHRVQgL3JzYy9tb3ZpZXMgLSBSU0Mgc3RyZWFtXG4gIGh0dHAuZ2V0KFwiL3JzYy9tb3ZpZXNcIiwgYXN5bmMgKHsgdXJsIH0pID0+IHtcbiAgICBjb25zdCBzZWFyY2hRdWVyeSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwicVwiKSA/PyBcIlwiO1xuICAgIGNvbnN0IGxpbWl0ID0gTnVtYmVyKHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwibGltaXRcIikgPz8gMTAwKTtcbiAgICBjb25zb2xlLmxvZyhcIltTV10gUmVuZGVyaW5nIFJTQyBmb3IgbW92aWVzOlwiLCB7IHNlYXJjaFF1ZXJ5LCBsaW1pdCB9KTtcbiAgICByZXR1cm4gY3JlYXRlRmxpZ2h0UmVzcG9uc2UoPEFwcCBzZWFyY2hRdWVyeT17c2VhcmNoUXVlcnl9IGxpbWl0PXtsaW1pdH0gLz4sIG1hbmlmZXN0KTtcbiAgfSksXG5cbiAgLy8gUE9TVCAvcnNjL21vdmllcyAtIFNlcnZlciBhY3Rpb25cbiAgaHR0cC5wb3N0KFwiL3JzYy9tb3ZpZXNcIiwgYXN5bmMgKHsgcmVxdWVzdCB9KSA9PiB7XG4gICAgY29uc3QgYWN0aW9uSWQgPSByZXF1ZXN0LmhlYWRlcnMuZ2V0KFwieC1yc2MtYWN0aW9uXCIpO1xuICAgIGlmICghYWN0aW9uSWQpIHtcbiAgICAgIHJldHVybiBqc29uKHsgZXJyb3I6IFwiTWlzc2luZyB4LXJzYy1hY3Rpb24gaGVhZGVyXCIgfSwgeyBzdGF0dXM6IDQwMCB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhcIltTV10gRXhlY3V0aW5nIHNlcnZlciBhY3Rpb246XCIsIGFjdGlvbklkKTtcblxuICAgIC8vIFBhcnNlIGFyZ3MgZnJvbSByZXF1ZXN0IGJvZHlcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVxdWVzdC50ZXh0KCk7XG4gICAgbGV0IGFyZ3M6IHVua25vd25bXSA9IFtdO1xuICAgIHRyeSB7XG4gICAgICBhcmdzID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShhcmdzKSkgYXJncyA9IFthcmdzXTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGFyZ3MgPSBib2R5ID8gW2JvZHldIDogW107XG4gICAgfVxuXG4gICAgcmV0dXJuIGV4ZWN1dGVTZXJ2ZXJBY3Rpb24oYWN0aW9uSWQsIGFyZ3MsIG1hbmlmZXN0KTtcbiAgfSksXG5dKTtcblxuY29uc29sZS5sb2coXCJbTW92aWVzIFNXXSBSb3V0ZXMgcmVnaXN0ZXJlZCAoSlNPTiBBUEkgKyBSU0MpXCIpO1xuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlsyLDcsOSwxMCwxMiwxMywxOCwxOV0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQVdBLElBQU0sTUFBSTtDQU1WLE1BQWFBLGNBQXFELEVBQUU7QUFHcEUsS0FBRSwyQkFBMkI7QUFNN0IsS0FBRSx1QkFBdUIsYUFBOEI7RUFDckQsTUFBTSxTQUFTLFlBQVk7QUFDM0IsTUFBSSxPQUFRLFFBQU8sT0FBTyxXQUFXO0FBQ3JDLFFBQU0sSUFBSSxNQUFNLHdCQUF3QixTQUFTLDhCQUE4Qjs7QUFPakYsS0FBRSwrQkFBOEMsUUFBUSxTQUFTO0FBTWpFLEtBQUUsd0NBQWdEO0FBS2xELEtBQUUsMEJBQTBCO0FBTTVCLEtBQUUsb0JBQW9CLFVBQXlCLFFBQVEsU0FBUztBQUtoRSxLQUFFLG9CQUFvQixLQUFLLGNBQTJDO0FBQ3BFLE1BQUksT0FBTyxXQUFXLGVBQWUsT0FBTyxZQUMxQyxRQUFPLGVBQWUsV0FBUyxPQUFPLGFBQWEsRUFBRSxPQUFPLFVBQVUsQ0FBQztBQUV6RSxTQUFPLGVBQWUsV0FBUyxjQUFjLEVBQUUsT0FBTyxNQUFNLENBQUM7O0FBTS9ELEtBQUUsb0JBQW9CLEtBQ3BCLFdBQ0EsZUFDUztBQUNULE9BQUssTUFBTSxPQUFPLFdBQ2hCLEtBQ0UsT0FBTyxVQUFVLGVBQWUsS0FBSyxZQUFZLElBQUksSUFDckQsQ0FBQyxPQUFPLFVBQVUsZUFBZSxLQUFLLFdBQVMsSUFBSSxDQUVuRCxRQUFPLGVBQWUsV0FBUyxLQUFLO0dBQUUsWUFBWTtHQUFNLEtBQUssV0FBVztHQUFNLENBQUM7O0FBUXJGLEtBQUUsb0JBQW9CLEtBQUssT0FBZ0IsU0FBMEI7QUFDbkUsTUFBSSxPQUFPLEVBQUcsU0FBUyxJQUFFLG9CQUFnRCxNQUFnQjtBQUN6RixNQUFJLE9BQU8sRUFBRyxRQUFPO0FBQ3JCLE1BQ0UsT0FBTyxLQUNQLE9BQU8sVUFBVSxZQUNqQixTQUNDLE1BQW1D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QUFFO0FBQUMsY0FBTyxFQUFFQSxJQUFFOztBQUFDLGFBQU8sR0FBR0MsSUFBRTs7S0FBRSxPQUFPLEtBQUU7TUFBQyxJQUFJRTtBQUFFLFVBQUc7T0FBQyxNQUFNRixNQUFFLEdBQUdELElBQUUsVUFBUyxTQUFTO0FBQUMsV0FBRyxLQUFLLE1BQUlDLElBQUUsUUFBTyxFQUFFO1FBQUMsTUFBSyxDQUFDO1FBQUUsT0FBTUM7UUFBRSxDQUFDO0FBQUMsYUFBRSxFQUFFRCxLQUFFRCxJQUFFLFVBQVMsQ0FBQ0UsSUFBRSxDQUFDO2VBQU9GLEtBQUU7QUFBQyxjQUFPLEVBQUVBLElBQUU7O0FBQUMsYUFBTyxFQUFFRyxJQUFFLEdBQUMsR0FBR0EsSUFBRSxHQUFDLGtCQUFFLElBQUksVUFBVSxxREFBcUQsQ0FBQzs7S0FBRTtBQUFDLFdBQU07S0FBQyxVQUFTRDtLQUFFLFlBQVdBLElBQUU7S0FBSyxNQUFLLENBQUM7S0FBRTtLQUFFLEdBQUdGLEtBQUUsUUFBTyxHQUFHQSxLQUFFLE9BQU8sU0FBUyxDQUFDLENBQUM7UUFBTyxPQUFFLEdBQUdBLEtBQUUsT0FBTyxTQUFTO0FBQUMsTUFBRyxLQUFLLE1BQUlHLElBQUUsT0FBTSxJQUFJLFVBQVUsNkJBQTZCO0VBQUMsTUFBTUMsTUFBRSxFQUFFRCxLQUFFSCxLQUFFLEVBQUUsQ0FBQztBQUFDLE1BQUcsQ0FBQyxFQUFFSSxJQUFFLENBQUMsT0FBTSxJQUFJLFVBQVUsNENBQTRDO0FBQUMsU0FBTTtHQUFDLFVBQVNBO0dBQUUsWUFBV0EsSUFBRTtHQUFLLE1BQUssQ0FBQztHQUFFOztDQUFDLFNBQVMsR0FBRyxLQUFFO0VBQUMsTUFBTUYsTUFBRSxFQUFFRixJQUFFLFlBQVdBLElBQUUsVUFBUyxFQUFFLENBQUM7QUFBQyxNQUFHLENBQUMsRUFBRUUsSUFBRSxDQUFDLE9BQU0sSUFBSSxVQUFVLG1EQUFtRDtBQUFDLFNBQU9BOztDQUFzckMsU0FBUyxHQUFHLEtBQUU7QUFBQyxNQUFHLENBQUMsRUFBRUYsSUFBRSxDQUFDLFFBQU0sQ0FBQztBQUFFLE1B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