import { base64Encode } from "./encode";

describe("Encode function tests", () => {
  // Fixtures
  const ascii = "hello world";
  const base64 = "aGVsbG8gd29ybGQ=";

  it("should convert plain text to base64", () => {
    expect(base64Encode(ascii)).toEqual(base64);
  });
});
