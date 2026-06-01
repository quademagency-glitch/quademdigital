import { createLogger } from "./createGroqSearchFilter.js";
import { defineEvent } from "@sanity/telemetry";
const SANITY_CONTROLLED_HOST_SUFFIXES = [".sanity.studio", ".sanity.io"];
function getBrowserHostname(win) {
  const hostname = win.location?.hostname;
  return typeof hostname == "string" && hostname.length > 0 ? hostname.toLowerCase() : null;
}
function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
function isSanityControlledHostname(hostname) {
  return SANITY_CONTROLLED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}
function getTelemetryEnvironment() {
  if (typeof window < "u") {
    const hostname = getBrowserHostname(window);
    return hostname ? isLocalHostname(hostname) ? "development" : isSanityControlledHostname(hostname) ? "production" : null : null;
  }
  return typeof process < "u" && process.env?.NODE_ENV === "development" ? "development" : null;
}
const SDKSessionStarted = defineEvent({
  name: "SDK Session Started",
  version: 1,
  description: "SDK instance created (environment is recorded in the event context)"
}), SDKHookMounted = defineEvent({
  name: "SDK Hook Mounted",
  version: 1,
  description: "An SDK hook was mounted for the first time in this session"
}), SDKSessionEnded = defineEvent({
  name: "SDK Session Ended",
  version: 1,
  description: "SDK instance disposed (environment is recorded in the event context)"
}), SDKError = defineEvent({
  name: "SDK Error",
  version: 1,
  description: "Runtime error caught in the SDK"
}), DEFAULT_TELEMETRY_API_VERSION = "2024-11-12", logger = createLogger("telemetry"), telemetryManagers = /* @__PURE__ */ new WeakMap(), pendingHooks = /* @__PURE__ */ new WeakMap(), initInFlight = /* @__PURE__ */ new WeakSet();
function initTelemetry(instance, projectId) {
  const environment = getTelemetryEnvironment();
  if (!environment) {
    logger.trace("initTelemetry skipped: environment not eligible", { internal: !0 });
    return;
  }
  if (!projectId) {
    logger.trace("initTelemetry skipped: no projectId", { internal: !0 });
    return;
  }
  telemetryManagers.has(instance) || initInFlight.has(instance) || (initInFlight.add(instance), logger.debug("initializing telemetry", { projectId, environment }), Promise.all([
    import("./telemetryManager.js"),
    import("./createGroqSearchFilter.js").then(function(n) {
      return n.clientStore;
    }),
    import("./createGroqSearchFilter.js").then(function(n) {
      return n.authStore$1;
    })
  ]).then(async ([{ createTelemetryManager }, { getClient }, { getTokenState }]) => {
    if (instance.isDisposed()) {
      initInFlight.delete(instance), logger.debug("telemetry skipped: instance disposed before imports resolved");
      return;
    }
    const token = getTokenState(instance).getCurrent();
    if (logger.trace("auth token check", { tokenPresent: !!token, internal: !0 }), !token && (logger.debug("waiting for auth token"), !await new Promise((resolve) => {
      if (instance.isDisposed()) return resolve(!1);
      const cleanup = { unsubscribe: () => {
      } }, unsub = instance.onDispose(() => {
        cleanup.unsubscribe(), resolve(!1);
      });
      let received = !1;
      const sub = getTokenState(instance).observable.subscribe((t) => {
        received || !t || (received = !0, logger.debug("auth token received"), unsub(), resolve(!0), cleanup.unsubscribe());
      });
      cleanup.unsubscribe = () => sub.unsubscribe(), received && cleanup.unsubscribe();
    }) || instance.isDisposed())) {
      initInFlight.delete(instance), logger.debug("telemetry skipped: no token resolved or instance disposed");
      return;
    }
    const manager = createTelemetryManager({
      sessionId: instance.instanceId,
      getClient: () => getClient(instance, { apiVersion: DEFAULT_TELEMETRY_API_VERSION }),
      projectId,
      environment
    }), consented = await manager.checkConsent();
    if (logger.debug("consent check complete", { consented }), !consented || instance.isDisposed()) {
      initInFlight.delete(instance), manager.dispose();
      return;
    }
    initInFlight.delete(instance), telemetryManagers.set(instance, manager);
    const buffered = pendingHooks.get(instance);
    if (buffered) {
      logger.debug("flushing buffered hooks", { hooks: Array.from(buffered) });
      for (const hookName of buffered)
        manager.logHookFirstUsed(hookName);
      pendingHooks.delete(instance);
    }
    const config = instance.config, perspective = typeof config.perspective == "string" ? config.perspective : "published", authMethod = config.auth?.token ? "token" : config.studio?.auth?.token ? "studio" : "default";
    logger.info("telemetry session started", { projectId, perspective, authMethod, environment }), manager.logSessionStarted({
      projectId,
      perspective,
      authMethod
    }), instance.onDispose(() => {
      manager.endSession(), telemetryManagers.delete(instance), logger.debug("telemetry session ended");
    });
  }).catch((err) => {
    initInFlight.delete(instance), logger.warn("telemetry init failed", { error: err });
  }));
}
function getTelemetryManager(instance) {
  return telemetryManagers.get(instance);
}
function trackHookMounted(instance, hookName) {
  if (!getTelemetryEnvironment()) return;
  const manager = findManager(instance);
  if (manager) {
    logger.trace("hook mounted (logged)", { hookName, internal: !0 }), manager.logHookFirstUsed(hookName);
    return;
  }
  const root = instance;
  let hooks = pendingHooks.get(root);
  hooks || (hooks = /* @__PURE__ */ new Set(), pendingHooks.set(root, hooks)), hooks.has(hookName) || logger.trace("hook mounted (buffered)", { hookName, internal: !0 }), hooks.add(hookName);
}
function findManager(instance) {
  return telemetryManagers.get(instance);
}
export {
  SDKError,
  SDKHookMounted,
  SDKSessionEnded,
  SDKSessionStarted,
  getTelemetryManager,
  initTelemetry,
  trackHookMounted
};
//# sourceMappingURL=_internal.js.map
