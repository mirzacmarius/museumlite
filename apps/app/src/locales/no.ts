export default {
  dashboard: {
    title: "Lag din App",
    description:
      "Bygg din app på toppen av Convex SaaS, utforsk dokumentasjonen og start din reise.",
    bodyTitle: "Kom i gang",
    bodyDescription: "Utforsk dashbordet og kom i gang med din første app.",
    bodyTip: "TIPS: Prøv å endre språk!",
    headerTitle: "Dashboard",
    headerDescription: "Administrer dine apper og se din bruk.",
    documentationLink: "Utforsk dokumentasjon",
  },
  settings: {
    title: "Innstillinger",
    headerTitle: "Innstillinger",
    headerDescription: "Administrer kontoinnstillingene dine.",
    avatar: {
      title: "Din avatar",
      description: "Dette er din avatar. Den vil vises på profilen din.",
      uploadHint:
        "Klikk på avataren for å laste opp en tilpasset fra filene dine.",
      resetButton: "Tilbakestill",
    },
    deleteAccount: {
      title: "Slett konto",
      description:
        "Slett permanent din Convex SaaS-konto, alle prosjektene dine, lenker og deres respektive statistikk.",
      warning: "Denne handlingen kan ikke angres, vær forsiktig.",
      deleteButton: "Slett konto",
      confirmButton: "Er du sikker?",
    },
    sidebar: {
      general: "Generelt",
      billing: "Fakturering",
    },
  },
  activity: {
    title: "Aktivitet",
    headerTitle: "Aktivitet",
    headerDescription: "Se alle endringer i organisasjonen din",
    filters: {
      title: "Filtre",
      dateRange: "Alle tider",
      type: "Type",
    },
    entityTypes: {
      organization: "Organisasjon",
      collection: "Samling",
      loan: "Lån",
      accession: "Aksesjon",
      deaccession: "Deaksesjon",
      location: "Plassering",
      user: "Bruker",
    },
    noActivity: "Ingen aktivitet funnet",
    loadMore: "Last mer",
    selectOrganization: "Velg en organisasjon",
    selectOrganizationDescription:
      "Vennligst velg en organisasjon fra rullegardinmenyen ovenfor for å se aktivitet.",
  },
  kpi: {
    totalObjects: "Totalt objekter",
    objectsOnLoan: "Objekter utlånt",
    activeLoans: "Aktive lån",
    pendingAccessions: "Ventende aksessjoner",
  },
  assignments: {
    pendingApprovals: "Ventende godkjenninger",
    noPendingAssignments: "Ingen ventende oppdrag",
  },
  newArrivals: {
    title: "Nye ankomster",
    noRecentAccessions: "Ingen nylige aksessjoner",
  },
  loans: {
    admin: {
      activeLoans: "Aktive lån",
      pendingApprovals: "Ventende godkjenninger",
      inTransit: "Under transport",
      overdue: "Forfalt",
    },
  },
  transit: {
    status: "Transportstatus",
    noTransportRecords: "Ingen transportregistre",
  },
  locations: {
    timeline: "Plasseringshistorikk",
    noLocationHistory: "Ingen plasseringshistorikk",
  },
} as const;
