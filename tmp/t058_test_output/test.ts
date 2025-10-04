import { detectVersion } from "./version-detector.ts";

const inputs = ["v1.2.3", "1.2", "foo", "v0.0.0"];
for (const s of inputs) {
  console.log(s, "=>", detectVersion(s));
}

