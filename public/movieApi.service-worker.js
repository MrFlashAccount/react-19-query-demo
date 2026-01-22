((this.movieApi = this.movieApi || {}),
  (function () {
    var e = null;
    async function t() {
      if ((await new Promise((e) => setTimeout(e, Math.random() * 250 + 200)), e != null)) return e;
      let [t, n] = await Promise.all([
        fetch(`/movies/1.json`).then((e) => e.json()),
        fetch(`/movies/2.json`).then((e) => e.json()),
      ]);
      return (
        (e = [...t, ...n].map((e) => ({
          id: e.id,
          titleText: e.titleText.text,
          releaseYear: e.releaseYear?.year ?? 0,
          genres: e.genres.genres.map((e) => e.text),
          plot: e.plot?.plotText.plainText ?? ``,
          directors: [],
          rating: e.ratingsSummary.aggregateRating ?? 0,
          image: e.primaryImage?.url ?? ``,
        }))),
        e
      );
    }
    async function n(e, n = 500) {
      let r = await t();
      if (((e = e.trim()), !e)) return r.slice(0, n);
      let i = e.toLowerCase();
      return r
        .filter(
          (e) =>
            !!(
              e.titleText.toLowerCase().includes(i) ||
              e.genres.some((e) => e.toLowerCase().includes(i)) ||
              e.plot.toLowerCase().includes(i) ||
              e.directors.some((e) => e.toLowerCase().includes(i))
            ),
        )
        .slice(0, n);
    }
    function r(e, t = 200) {
      return new Response(JSON.stringify(e), {
        status: t,
        headers: { "Content-Type": `application/json` },
      });
    }
    (self.addEventListener(`install`, (e) => {
      e.waitUntil(self.skipWaiting());
    }),
      self.addEventListener(`activate`, (e) => {
        e.waitUntil(self.clients.claim());
      }),
      self.addEventListener(`fetch`, (e) => {
        let i = new URL(e.request.url),
          a = i.pathname,
          o = e.request.method;
        a.startsWith(`/api/movies`) &&
          e.respondWith(
            (async () => {
              try {
                if (a === `/api/movies/search` && o === `GET`) {
                  let e = i.searchParams.get(`query`) ?? ``,
                    t = i.searchParams.get(`limit`);
                  return r(await n(e, t == null ? 500 : Number.parseInt(t, 10)));
                }
                let s = a.match(/^\/api\/movies\/([^/]+)$/);
                if (s && o === `GET`) {
                  let e = s[1],
                    n = (await t()).find((t) => t.id === e);
                  return n == null ? r({ error: `Movie with id ${e} not found` }, 404) : r(n);
                }
                let c = a.match(/^\/api\/movies\/([^/]+)\/rating$/);
                if (c && o === `PATCH`) {
                  let n = c[1],
                    i = await e.request.json(),
                    a = (await t()).find((e) => e.id === n);
                  if (a == null) return r({ error: `Movie with id ${n} not found` }, 404);
                  let o = Math.random() * 1.9;
                  return ((a.rating = Math.min(10, parseFloat((i.rating + o).toFixed(1)))), r(a));
                }
                return fetch(e.request);
              } catch (e) {
                return r({ error: e instanceof Error ? e.message : String(e) }, 500);
              }
            })(),
          );
      }));
  })());
//# sourceMappingURL=movieApi.service-worker.js.map
