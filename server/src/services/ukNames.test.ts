import { describe, expect, it } from "vitest";
import * as client from "../../../client/src/lib/ukNames";
import { driverName, UK_DRIVER_NAMES } from "./ukNames";

describe("Ukrainian driver names", () => {
  it("the server's map mirrors the client's", () => {
    expect(UK_DRIVER_NAMES).toEqual(client.UK_DRIVER_NAMES);
  });

  it("spells known drivers in Ukrainian on Ukrainian pages only", () => {
    expect(driverName("lewis-hamilton", "Lewis", "Hamilton", true)).toBe("Льюїс Хемілтон");
    expect(driverName("max-verstappen", "Max", "Verstappen", true)).toBe("Макс Ферстаппен");
    expect(driverName("max-verstappen", "Max", "Verstappen", false)).toBe("Max Verstappen");
    expect(driverName("ted-whiteaway", "Ted", "Whiteaway", true)).toBe("Ted Whiteaway");
  });

  it("has no em or en dashes and no Latin letters in the spellings", () => {
    for (const [id, [given, family]] of Object.entries(UK_DRIVER_NAMES)) {
      expect(`${given} ${family}`, id).not.toMatch(/[–—A-Za-z]/);
    }
  });
});
