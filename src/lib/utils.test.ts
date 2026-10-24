import { expect, test } from "vitest";
import { cn } from "./utils";

test("cn merges conflicting tailwind classes", () => {
	expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
});
