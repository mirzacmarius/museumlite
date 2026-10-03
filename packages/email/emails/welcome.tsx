import {
  Body,
  Button,
  Container,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
} from "@react-email/components";

export type WelcomeLocale = "en" | "fr" | "es" | "no" | "ro";

type WelcomeCopy = {
  preview: string;
  heading: string;
  introduction: string;
  catalog: string;
  workflow: string;
  getStarted: string;
};

const welcomeCopy: Record<WelcomeLocale, WelcomeCopy> = {
  en: {
    preview: "Welcome to MuseumLite",
    heading: "Welcome to MuseumLite",
    introduction:
      "Thanks for joining MuseumLite. Your team now has a shared place to care for and manage its collection.",
    catalog:
      "Create clear object records, keep images and provenance together, and find items quickly with locations and collection groups.",
    workflow:
      "Use accessions and loans to keep important decisions and handoffs organized as your work moves forward.",
    getStarted: "Open MuseumLite",
  },
  fr: {
    preview: "Bienvenue sur MuseumLite",
    heading: "Bienvenue sur MuseumLite",
    introduction:
      "Merci d’avoir rejoint MuseumLite. Votre équipe dispose désormais d’un espace partagé pour prendre soin de sa collection et la gérer.",
    catalog:
      "Créez des fiches d’objets claires, regroupez les images et la provenance, puis retrouvez rapidement les pièces grâce aux emplacements et aux groupes de collection.",
    workflow:
      "Suivez les acquisitions et les prêts pour organiser les décisions importantes et les transmissions au fil de votre travail.",
    getStarted: "Ouvrir MuseumLite",
  },
  es: {
    preview: "Te damos la bienvenida a MuseumLite",
    heading: "Te damos la bienvenida a MuseumLite",
    introduction:
      "Gracias por unirte a MuseumLite. Tu equipo ya cuenta con un espacio compartido para cuidar y gestionar su colección.",
    catalog:
      "Crea fichas claras de los objetos, reúne imágenes e información de procedencia y encuentra las piezas fácilmente mediante ubicaciones y grupos de colección.",
    workflow:
      "Usa las altas y los préstamos para organizar decisiones importantes y traspasos a medida que avanza el trabajo.",
    getStarted: "Abrir MuseumLite",
  },
  no: {
    preview: "Velkommen til MuseumLite",
    heading: "Velkommen til MuseumLite",
    introduction:
      "Takk for at du ble med i MuseumLite. Teamet ditt har nå et felles sted for å ta vare på og administrere samlingen.",
    catalog:
      "Opprett tydelige objektposter, samle bilder og proveniens, og finn gjenstander raskt med plasseringer og samlingsgrupper.",
    workflow:
      "Bruk tilgangsregistreringer og utlån til å holde viktige beslutninger og overleveringer samlet mens arbeidet går videre.",
    getStarted: "Åpne MuseumLite",
  },
  ro: {
    preview: "Bun venit în MuseumLite",
    heading: "Bun venit în MuseumLite",
    introduction:
      "Vă mulțumim că v-ați alăturat MuseumLite. Echipa dvs. are acum un spațiu comun pentru administrarea și îngrijirea colecției.",
    catalog:
      "Creați fișe clare pentru obiecte, păstrați împreună imaginile și proveniența și găsiți rapid piesele folosind locațiile și grupurile de colecții.",
    workflow:
      "Folosiți înregistrările de achiziție și împrumuturile pentru a organiza deciziile importante și transferurile pe măsură ce activitatea continuă.",
    getStarted: "Deschideți MuseumLite",
  },
};

export default function WelcomeEmail({
  locale = "en",
}: {
  locale?: WelcomeLocale;
}) {
  const copy = welcomeCopy[locale];
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3001";

  return (
    <Html lang={locale}>
      <Preview>{copy.preview}</Preview>
      <Tailwind>
        <Body className="my-auto mx-auto font-sans">
          <Container className="border-transparent my-[40px] mx-auto max-w-[600px]">
            <Img src="/logo.png" alt="MuseumLite" width={100} height={100} />
            <Heading className="font-normal text-center p-0 my-[30px] mx-0">
              {copy.heading}
            </Heading>
            <Section className="mb-4">{copy.introduction}</Section>
            <Section className="mb-4">{copy.catalog}</Section>
            <Section className="mb-8">{copy.workflow}</Section>
            <Section className="mb-6">
              <Link href={baseUrl}>
                <Button className="bg-zinc-950 text-white p-4 text-center">
                  {copy.getStarted}
                </Button>
              </Link>
            </Section>
            <Hr />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
