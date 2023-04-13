import { debug } from "../debug.ts";
import { assertSpyCall, spy } from "./deps.ts";

Deno.test("debug", async (t) => {
  await t.step("creates a debug logger and logs Hello World", () => {
    Deno.env.set("DEBUG", "*");

    const consoleDebugSpy = spy(console, "debug");

    const log = debug("quackware");
    log("Hello World");

    assertSpyCall(consoleDebugSpy, 0);
  });
});
