import { createBatchedStore } from "@sanity/telemetry";
import { createLogger } from "./createGroqSearchFilter.js";
import { CORE_SDK_VERSION } from "./version.js";
import { SDKSessionEnded, SDKError, SDKHookMounted, SDKSessionStarted } from "./_internal.js";
const FLUSH_INTERVAL_MS = 3e4, CONSENT_TAG = "telemetry-consent.sdk", BATCH_TAG = "telemetry.batch", log = createLogger("telemetry");
function createTelemetryManager(options) {
  const { sessionId, getClient, projectId, environment } = options, startedAt = Date.now(), emittedHooks = /* @__PURE__ */ new Set();
  let cachedConsent = null;
  const resolveConsent = async () => {
    if (cachedConsent) return cachedConsent;
    try {
      cachedConsent = await getClient().request({
        uri: "/intake/telemetry-status",
        tag: CONSENT_TAG
      });
    } catch {
      cachedConsent = { status: "undetermined" };
    }
    return cachedConsent;
  }, enrichBatch = (batch) => batch.map((event) => {
    const existing = "context" in event ? event.context : void 0;
    return {
      ...event,
      context: {
        ...existing,
        version: CORE_SDK_VERSION,
        environment,
        origin: typeof window < "u" ? window.location.origin : "node"
      }
    };
  }), store = createBatchedStore(
    sessionId,
    {
      flushInterval: FLUSH_INTERVAL_MS,
      resolveConsent,
      sendEvents: async (batch) => {
        const client = getClient();
        return log.debug("sending event batch", { batchSize: batch.length, environment }), client.request({
          uri: "/intake/batch",
          method: "POST",
          body: { projectId, batch: enrichBatch(batch) },
          tag: BATCH_TAG
        });
      }
    }
  ), logger = store.logger;
  return {
    async checkConsent() {
      const { status } = await resolveConsent();
      return status === "granted";
    },
    logSessionStarted(data) {
      log.debug("event: SDK Session Started", {
        projectId: data.projectId,
        perspective: data.perspective,
        authMethod: data.authMethod,
        version: CORE_SDK_VERSION,
        environment
      }), logger.log(SDKSessionStarted, {
        version: CORE_SDK_VERSION,
        ...data
      });
    },
    logHookFirstUsed(hookName) {
      emittedHooks.has(hookName) || (emittedHooks.add(hookName), log.debug("event: SDK Hook Mounted", { hookName }), logger.log(SDKHookMounted, { hookName }));
    },
    logError(errorType, hookName) {
      log.debug("event: SDK Error", { errorType, hookName }), logger.log(SDKError, { errorType, hookName });
    },
    endSession() {
      const durationSeconds = Math.round((Date.now() - startedAt) / 1e3);
      log.debug("event: SDK Session Ended", {
        durationSeconds,
        hooksUsed: [...emittedHooks],
        environment
      }), logger.log(SDKSessionEnded, {
        durationSeconds,
        hooksUsed: [...emittedHooks]
      }), store.flush().catch(() => {
      }), store.end();
    },
    dispose() {
      store.end();
    },
    get hooksUsed() {
      return emittedHooks;
    }
  };
}
export {
  createTelemetryManager
};
//# sourceMappingURL=telemetryManager.js.map
