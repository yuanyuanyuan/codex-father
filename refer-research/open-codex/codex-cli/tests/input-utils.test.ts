import { describe, it, expect, vi } from "vitest";
import fs from "fs/promises";
import { createInputItem } from "../src/utils/input-utils.js";

describe("createInputItem", () => {
  it("returns only text when no images provided", async () => {
    const result = await createInputItem("hello", []);
    expect(result).toEqual({
      role: "user",
      content: [{ type: "text", text: "hello" }],
    });
  });

  it("includes image content for existing file", async () => {
    const fakeBuffer = Buffer.from("fake image content");
    const readSpy = vi
      .spyOn(fs, "readFile")
      .mockResolvedValue(fakeBuffer as any);
    const result = await createInputItem("hello", ["dummy-path"]);
    const expectedUrl = `data:application/octet-stream;base64,${fakeBuffer.toString(
      "base64",
    )}`;
    expect(result.role).toBe("user");
    expect(result.content?.length).toBe(2);
    // @ts-expect-error ignore
    const [textItem, imageItem] = result.content;
    expect(textItem).toEqual({ type: "text", text: "hello" });
    expect(imageItem).toEqual({
      type: "image_url",
      image_url: {
        url: expectedUrl,
      },
    });
    readSpy.mockRestore();
  });

  it("falls back to missing image text for non-existent file", async () => {
    const filePath = "tests/__fixtures__/does-not-exist.png";
    const result = await createInputItem("hello", [filePath]);
    expect(result.content?.length).toBe(2);
    // @ts-expect-error ignore
    const fallbackItem = result.content[1];
    expect(fallbackItem).toEqual({
      type: "text",
      text: "[missing image: does-not-exist.png]",
    });
  });
});
