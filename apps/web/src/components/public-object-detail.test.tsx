import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WebLocale } from "@/locales/messages";
import { WebLocaleProvider } from "@/locales/provider";
import {
  PublicObjectDetail,
  type PublicObjectDetailData,
} from "./public-object-detail";

const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

const object: PublicObjectDetailData = {
  accessionNumber: "1998.12.3",
  title: "Fishing net",
  organizationName: "Romsdal Museum",
  creditLine: "Gift of the Strand family",
  rightsStatement: IN_COPYRIGHT,
  images: [
    {
      _id: "image-1",
      url: "https://images.example.org/net.jpg",
      isPrimary: true,
      rightsStatement: CC_BY,
    },
  ],
};

function render(data: PublicObjectDetailData, locale: WebLocale = "en") {
  return renderToStaticMarkup(
    <WebLocaleProvider locale={locale}>
      <PublicObjectDetail object={data} />
    </WebLocaleProvider>,
  );
}

function licenseLinks(markup: string) {
  return [
    ...markup.matchAll(/<a href="([^"]+)"[^>]*rel="license[^"]*"[^>]*>(.*?)</g),
  ].map(([, href, name]) => ({ href, name }));
}

describe("public object rights", () => {
  it("names the Object's and the shown image's statements, each linked to its URI as a license", () => {
    const markup = render(object);

    expect(licenseLinks(markup)).toEqual([
      {
        href: CC_BY,
        name: "Creative Commons Attribution 4.0 International",
      },
      { href: IN_COPYRIGHT, name: "In Copyright" },
    ]);
    expect(markup).toContain("Image rights");
    expect(markup).toContain(">Rights<");
  });

  it("names the statements in the visitor's language", () => {
    expect(licenseLinks(render(object, "no"))).toEqual([
      {
        href: CC_BY,
        name: "Creative Commons Navngivelse 4.0 Internasjonal",
      },
      { href: IN_COPYRIGHT, name: "Opphavsrettslig beskyttet" },
    ]);
  });

  it("shows no rights where none is in effect", () => {
    const markup = render({
      ...object,
      rightsStatement: undefined,
      images: [
        { _id: "image-1", url: object.images[0]?.url ?? "", isPrimary: true },
      ],
    });

    expect(licenseLinks(markup)).toEqual([]);
    expect(markup).not.toContain("Image rights");
  });
});
