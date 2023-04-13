import * as colors from "https://deno.land/std@0.181.0/fmt/colors.ts";

export type ColorFn = (message: string) => string;
export const colorFunctions: ColorFn[] = [
  colors.red,
  colors.green,
  colors.yellow,
  colors.blue,
  colors.magenta,
  colors.cyan,
];

const NUM_COLORS = colorFunctions.length;

function hashCode(s: string): number {
  let h = 0;
  const l = s.length;
  let i = 0;
  if (l > 0) while (i < l) h = ((h << (NUM_COLORS - 1)) - h + s.charCodeAt(i++)) | 0;
  return h;
}

function generateColor(message: string): ColorFn {
  const hash = Math.abs(hashCode(message));
  return colorFunctions[hash % colorFunctions.length];
}

export interface Debug {
  (fmt: string, ...args: unknown[]): void;
  self: Debugger;
}

/** A simple debug logger based off of https://www.npmjs.com/package/debug */
export class Debugger {
  manager: DebugManager;
  ns: string;
  color: ColorFn;
  last: number;
  enabled: boolean;

  constructor(manager: DebugManager, namespace: string) {
    this.manager = manager;
    this.ns = namespace;
    this.color = generateColor(namespace);
    this.last = 0;
    this.enabled = manager.enabled.some((r) => r.test(namespace));
  }

  log(fmt: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    const diff = Date.now() - (this.last || Date.now());
    fmt = format(fmt, ...args);
    const msg = `${this.color(this.ns)} ${fmt} ${this.color(`+${diff}ms`)}`;
    console.debug(msg);
    this.last = Date.now();
  }
}

export function format(f: string, ...args: unknown[]) {
  let i = 0;
  const len = args.length;
  let str = String(f).replace(/%[sdjoO%]/g, (x: string): string => {
    if (x === "%%") return "%";
    if (i >= len) return x;
    switch (x) {
      case "%s":
        return String(args[i++]);
      case "%d":
        return Number(args[i++]).toString();
      case "%o":
        return Deno.inspect(args[i++])
          .split("\n")
          .map((_) => _.trim())
          .join(" ");
      case "%O":
        return Deno.inspect(args[i++]);
      case "%j":
        try {
          return JSON.stringify(args[i++]);
        } catch {
          return "[Circular]";
        }
      default:
        return x;
    }
  });
  for (const x of args.splice(i)) {
    if (x === null || !(typeof x === "object" && x !== null)) {
      str += " " + x;
    } else {
      str += " " + Deno.inspect(x);
    }
  }
  return str;
}

class DebugManager {
  debuggers: Map<string, Debugger>;
  enabled: RegExp[];

  constructor(enabled?: RegExp[]) {
    this.debuggers = new Map();
    this.enabled = enabled ?? [];
  }
}

function extract(opts?: string): RegExp[] {
  if (!opts || opts.length === 0) return [];
  opts = opts.replace(/\s/g, "").replace(/\*/g, ".+");
  return opts.split(",").map((rule) => new RegExp(`^${rule}$`));
}

let manager: DebugManager;

export function withoutEnv(enabled?: RegExp[] | string) {
  if (!enabled) enabled = [];
  if (typeof enabled === "string") enabled = extract(enabled);
  manager = new DebugManager(enabled);
}

/**
 * Create a debug logging function for the given `namespace`, dependent on the `DEBUG` environment variable being set.
 */
export function debug(namespace: string): Debug {
  if (!manager) manager = new DebugManager(extract(Deno.env.get("DEBUG")));

  const dbg = new Debugger(manager, namespace);
  manager.debuggers.set(namespace, dbg);
  const de: Debug = Object.assign(dbg.log.bind(dbg), {
    self: dbg,
  });
  return de;
}
