import { describe, expect, it } from "vitest";

import {
  LOCALIZED_PATHS,
  MARKETING_PATHS,
  isBlogPath,
  isLocalizedPath,
  isMarketingPath,
  localeSwitchPath,
  languageAlternates,
  marketingRoute,
  publicPathname,
  localizedHref,
  localizedPath,
  parseLocalePath,
} from "./locale-routing";

describe("parseLocalePath", () => {
  it("reads /en as the English home page", () => {
    expect(parseLocalePath("/en")).toEqual({
      path: "/",
      locale: "en",
      prefixed: true,
    });
  });

  it("reads /en/<page> as that page in English", () => {
    expect(parseLocalePath("/en/rate")).toEqual({
      path: "/rate",
      locale: "en",
      prefixed: true,
    });
  });

  it("treats an unprefixed public page as Vietnamese", () => {
    expect(parseLocalePath("/faq")).toEqual({
      path: "/faq",
      locale: "vi",
      prefixed: false,
    });
  });

  it("gives a non-public page no language, so the cookie decides", () => {
    expect(parseLocalePath("/dashboard").locale).toBeNull();
  });

  it("flags /en on a non-public page so the proxy can redirect it", () => {
    expect(parseLocalePath("/en/dashboard")).toEqual({
      path: "/dashboard",
      locale: null,
      prefixed: true,
    });
  });

  it("does not mistake a path that merely starts with 'en' for the prefix", () => {
    // "/enterprise" is not "/en" + "/terprise".
    expect(parseLocalePath("/enterprise")).toEqual({
      path: "/enterprise",
      locale: null,
      prefixed: false,
    });
  });

  it("ignores a trailing slash after the prefix", () => {
    expect(parseLocalePath("/en/faq/").path).toBe("/faq");
  });
});

describe("localizedPath / localizedHref", () => {
  it("leaves Vietnamese at the existing URLs", () => {
    for (const path of LOCALIZED_PATHS) {
      expect(localizedPath(path, "vi")).toBe(path);
    }
  });

  it("prefixes English, with the home page at /en rather than /en/", () => {
    expect(localizedPath("/", "en")).toBe("/en");
    expect(localizedPath("/rate", "en")).toBe("/en/rate");
  });

  it("never prefixes a page that has no English URL", () => {
    expect(localizedPath("/dashboard", "en")).toBe("/dashboard");
  });

  it("keeps the query and hash on an href", () => {
    expect(localizedHref("/login?mode=register", "en")).toBe(
      "/en/login?mode=register",
    );
    expect(localizedHref("/#process", "en")).toBe("/en#process");
    expect(localizedHref("/why-us#achievements", "en")).toBe(
      "/en/why-us#achievements",
    );
  });

  it("leaves external and protocol-relative hrefs alone", () => {
    expect(localizedHref("https://example.com/faq", "en")).toBe(
      "https://example.com/faq",
    );
    expect(localizedHref("//example.com/faq", "en")).toBe("//example.com/faq");
    expect(localizedHref("#top", "en")).toBe("#top");
  });

  it("round-trips: every English URL parses back to its page", () => {
    for (const path of LOCALIZED_PATHS) {
      expect(parseLocalePath(localizedPath(path, "en"))).toEqual({
        path,
        locale: "en",
        prefixed: true,
      });
    }
  });
});

describe("languageAlternates", () => {
  it("names both versions and points x-default at Vietnamese", () => {
    expect(languageAlternates("/rate")).toEqual({
      vi: "/rate",
      en: "/en/rate",
      "x-default": "/rate",
    });
  });
});

describe("marketingRoute / publicPathname", () => {
  it("builds each language under its own prefix, the home page bare", () => {
    expect(marketingRoute("/rate", "vi")).toBe("/vi/rate");
    expect(marketingRoute("/rate", "en")).toBe("/en/rate");
    expect(marketingRoute("/", "vi")).toBe("/vi");
    expect(marketingRoute("/", "en")).toBe("/en");
  });

  it("reads a Vietnamese build's route as its public URL", () => {
    for (const path of MARKETING_PATHS) {
      expect(publicPathname(marketingRoute(path, "vi"))).toBe(path);
    }
  });

  it("leaves public URLs, English ones and look-alikes alone", () => {
    expect(publicPathname("/rate")).toBe("/rate");
    expect(publicPathname("/en/rate")).toBe("/en/rate");
    expect(publicPathname("/vip")).toBe("/vip");
    // Not a marketing page, so not an internal route either.
    expect(publicPathname("/vi/dashboard")).toBe("/vi/dashboard");
  });

  it("prerenders only localized pages", () => {
    for (const path of MARKETING_PATHS) {
      expect(isLocalizedPath(path)).toBe(true);
    }
  });
});

describe("the blog", () => {
  it("is /blog and one level of slug below it", () => {
    expect(isBlogPath("/blog")).toBe(true);
    expect(isBlogPath("/blog/lai-suat-vay-von")).toBe(true);
    expect(isBlogPath("/blog/a/b")).toBe(false);
    expect(isBlogPath("/blog/")).toBe(false);
    expect(isBlogPath("/blogger")).toBe(false);
    expect(isBlogPath("/en/blog")).toBe(false);
  });

  it("is a marketing page, served from its Vietnamese build", () => {
    expect(isMarketingPath("/blog")).toBe(true);
    expect(isMarketingPath("/blog/lai-suat")).toBe(true);
    expect(marketingRoute("/blog/lai-suat", "vi")).toBe("/vi/blog/lai-suat");
    expect(publicPathname("/vi/blog/lai-suat")).toBe("/blog/lai-suat");
    expect(publicPathname("/vi/blog")).toBe("/blog");
  });

  it("is Vietnamese at its unprefixed URL", () => {
    expect(parseLocalePath("/blog/lai-suat")).toEqual({
      path: "/blog/lai-suat",
      locale: "vi",
      prefixed: false,
    });
  });

  it("has no English URL, so /en/blog... is not a page", () => {
    expect(parseLocalePath("/en/blog/lai-suat")).toEqual({
      path: "/blog/lai-suat",
      locale: null,
      prefixed: true,
    });
    expect(parseLocalePath("/en/blog").locale).toBeNull();
  });

  it("is not localized: no hreflang twin, links stay unprefixed", () => {
    expect(isLocalizedPath("/blog")).toBe(false);
    expect(LOCALIZED_PATHS).not.toContain("/blog");
    expect(localizedPath("/blog/lai-suat", "en")).toBe("/blog/lai-suat");
    expect(localizedHref("/blog#muc", "en")).toBe("/blog#muc");
  });

  it("switches to English by going to the English home page", () => {
    expect(localeSwitchPath("/blog/lai-suat", "en")).toBe("/en");
    expect(localeSwitchPath("/blog", "en")).toBe("/en");
    expect(localeSwitchPath("/blog/lai-suat", "vi")).toBe("/blog/lai-suat");
    // Everywhere else it is the page's own URL in that language.
    expect(localeSwitchPath("/rate", "en")).toBe("/en/rate");
    expect(localeSwitchPath("/rate", "vi")).toBe("/rate");
  });
});
