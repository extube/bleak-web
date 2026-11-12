// activity-log — OpenCode server plugin (V2, local directory plugin).
//
// Appends one line per agent action to docs/logs/activity.log:
//   UTC-timestamp | session-id | agent-role/id | tool-or-action | short target summary
//
// Sources of actions:
//   - ctx.tool.hook("execute.before") — every tool call, with session + agent
//   - ctx.event.subscribe(...) — session execution lifecycle, permissions,
//     shell sessions, idle/created events
//
// Docs: https://opencode.ai/v2/docs/build/plugins/server (Events, Hooks > Tools)
import { Plugin } from "@opencode/plugin"
import { appendFile, mkdir } from "node:fs/promises"
import path from "node:path"

const LOG_REL = path.join("docs", "logs", "activity.log")
const SUMMARY_MAX = 160

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
}

function oneLine(text: unknown): string {
  if (text === undefined || text === null) return ""
  const s = typeof text === "string" ? text : JSON.stringify(text)
  return s
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUMMARY_MAX)
}

export default Plugin.define({
  id: "activity-log",
  async setup(ctx) {
    const logPath = path.join(ctx.location.directory, LOG_REL)
    await mkdir(path.dirname(logPath), { recursive: true })

    // Serialize appends so concurrent events keep the file line-consistent.
    let chain: Promise<unknown> = Promise.resolve()
    const write = (sessionId: string, agent: string, action: string, summary: string) => {
      const line = `${utcNow()} | ${sessionId || "-"} | ${agent || "-"} | ${action} | ${summary || "-"}\n`
      // Event echoes and overlapping plugin instances (e.g. after config
      // reloads) can deliver the same action more than once within a short
      // window. Deduplicate identical (session, agent, action, summary)
      // writes within 2s, shared across plugin instances via globalThis.
      const g = globalThis as Record<string, unknown>
      const seenKey = "activityLogDedup"
      const seen = (g[seenKey] as Map<string, number> | undefined) ?? new Map<string, number>()
      g[seenKey] = seen
      const now = Date.now()
      for (const [key, at] of seen) if (now - at > 2_000) seen.delete(key)
      const key = `${sessionId}|${agent}|${action}|${summary}`
      const previous = seen.get(key)
      if (previous !== undefined && now - previous <= 2_000) return chain
      seen.set(key, now)
      chain = chain.then(() => appendFile(logPath, line).catch(() => {}))
      return chain
    }

    // Pick a field from an event payload without assuming its exact shape.
    const pick = (obj: any, ...keys: string[]): string => {
      if (!obj || typeof obj !== "object") return ""
      for (const key of keys) {
        const value = obj[key]
        if (typeof value === "string" && value) return value
        if (value !== undefined && value !== null && typeof value !== "object") return String(value)
      }
      return ""
    }

    // --- tool calls (the main "agent action") ---
    await ctx.tool.hook("execute.before", (event: any) => {
      const input = event?.input
      // A short target summary: first meaningful input field (file path,
      // command, pattern, url ...), falling back to the raw input.
      let summary = ""
      if (input && typeof input === "object") {
        const preferred = ["filePath", "file_path", "path", "command", "pattern", "query", "url", "sessionID", "id", "description"]
        for (const key of preferred) {
          const value = (input as Record<string, unknown>)[key]
          if (typeof value === "string" && value) {
            summary = `${key}=${oneLine(value)}`
            break
          }
        }
        if (!summary) summary = oneLine(input)
      } else {
        summary = oneLine(input)
      }
      return write(event?.sessionID ?? "", event?.agent ?? "", `tool:${event?.tool ?? "?"}`, summary)
    })

    // --- session / agent lifecycle events ---
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          types: [
            "session.created",
            "session.execution.started",
            "session.execution.succeeded",
            "session.execution.failed",
            "session.execution.interrupted",
            "session.idle",
            "session.shell.started",
            "session.shell.ended",
            "permission.asked",
            "permission.replied",
          ],
          signal: controller.signal,
        })) {
          const type = (event as { type?: string }).type ?? "unknown"
          const data = (event as { data?: unknown }).data
          const sessionId = pick(data, "sessionID") || pick((data as any)?.info, "sessionID")
          const agent =
            pick(data, "agent") ||
            pick((data as any)?.info, "agent") ||
            pick((data as any)?.message, "agent")
          const summary = oneLine(data)
          await write(sessionId, agent, type, summary)
        }
      } catch {
        // Event stream ended (e.g. server shutdown) — nothing to log.
      }
    })()

    return () => controller.abort()
  },
})
