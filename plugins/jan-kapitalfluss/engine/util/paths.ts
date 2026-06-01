/**
 * Path resolution — NEVER hardcode a path anywhere in the engine.
 * Root comes from (in order): explicit arg, $PLUGIN_ROOT, $CLAUDE_PLUGIN_ROOT.
 */
import { resolve, isAbsolute } from "node:path";

export function resolveRoot(explicit?: string): string {
  const root = explicit ?? process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT;
  if (!root) {
    throw new Error(
      "Plugin root not set: pass --root <dir> or set PLUGIN_ROOT / CLAUDE_PLUGIN_ROOT",
    );
  }
  return resolve(root);
}

/** Join parts under the plugin root. */
export function underRoot(root: string, ...parts: string[]): string {
  return resolve(root, ...parts);
}

/** Resolve a config-supplied path: absolute stays absolute, relative resolves under root. */
export function resolvePath(root: string, p: string): string {
  return isAbsolute(p) ? p : resolve(root, p);
}
