import { defer, map, shareReplay, distinctUntilChanged, switchMap, of, startWith, share, ReplaySubject, Observable, catchError } from "rxjs";
const AGENT_BUNDLE_PREFIX = "agent-", INITIAL_STATE = {
  bundles: [],
  loading: !0
}, EMPTY_STATE = {
  bundles: [],
  loading: !1
};
function isAgentBundleName(versionName) {
  return typeof versionName == "string" && versionName.startsWith(AGENT_BUNDLE_PREFIX);
}
function createAgentBundlesStore(context) {
  const {
    organizationId$,
    client
  } = context;
  return {
    state$: organizationId$.pipe(distinctUntilChanged(), switchMap((organizationId) => organizationId ? listenToBundles(client, organizationId) : of(EMPTY_STATE)), startWith(INITIAL_STATE), share({
      connector: () => new ReplaySubject(1)
    }))
  };
}
const eventSourcePolyfill$ = defer(() => import("@sanity/eventsource")).pipe(map(({
  default: ES
}) => ES), shareReplay(1));
function listenToBundles(client, organizationId) {
  const {
    token,
    withCredentials
  } = client.config(), url = client.getUrl(`/agent/${organizationId}/bundles/mine/listen`), esOptions = {};
  return (token || withCredentials) && (esOptions.withCredentials = !0), token && (esOptions.headers = {
    Authorization: `Bearer ${token}`
  }), (esOptions.headers ? eventSourcePolyfill$ : of(EventSource)).pipe(map((ES) => new ES(url, esOptions))).pipe(switchMap((es) => new Observable((subscriber) => (es.addEventListener("bundles", (event) => {
    try {
      const data = JSON.parse(event.data);
      subscriber.next({
        bundles: data.bundles,
        loading: !1
      });
    } catch {
    }
  }), es.addEventListener("error", () => {
  }), () => {
    es.close();
  }))), catchError(() => of(EMPTY_STATE)));
}
export {
  INITIAL_STATE,
  createAgentBundlesStore,
  isAgentBundleName
};
//# sourceMappingURL=createAgentBundlesStore.js.map
