export default {
  dashboard: {
    title: "Create your App",
    description:
      "Build your app on top of Convex SaaS, explore the documentation and start your journey.",
    bodyTitle: "Get Started",
    bodyDescription:
      "Explore the Dashboard and get started with your first app.",
    bodyTip: "TIP: Try changing the language!",
    headerTitle: "Dashboard",
    headerDescription: "Manage your apps and view your usage.",
    documentationLink: "Explore Documentation",
  },
  settings: {
    title: "Settings",
    headerTitle: "Settings",
    headerDescription: "Manage your account settings.",
    avatar: {
      title: "Your Avatar",
      description: "This is your avatar. It will be displayed on your profile.",
      uploadHint: "Click on the avatar to upload a custom one from your files.",
      resetButton: "Reset",
    },
    deleteAccount: {
      title: "Delete Account",
      description:
        "Permanently delete your Convex SaaS account, all of your projects, links and their respective stats.",
      warning: "This action cannot be undone, proceed with caution.",
      deleteButton: "Delete Account",
      confirmButton: "Are you sure?",
    },
    sidebar: {
      general: "General",
      billing: "Billing",
    },
  },
  activity: {
    title: "Activity",
    headerTitle: "Activity",
    headerDescription: "View all changes in your organization",
    filters: {
      title: "Filters",
      dateRange: "All Time",
      type: "Type",
    },
    entityTypes: {
      organization: "Organization",
      collection: "Collection",
      loan: "Loan",
      accession: "Accession",
      deaccession: "Deaccession",
      location: "Location",
      user: "User",
    },
    noActivity: "No activity found",
    loadMore: "Load More",
    selectOrganization: "Select an Organization",
    selectOrganizationDescription:
      "Please select an organization from the dropdown above to view activity.",
  },
  kpi: {
    totalObjects: "Total Objects",
    objectsOnLoan: "Objects on Loan",
    activeLoans: "Active Loans",
    pendingAccessions: "Pending Accessions",
  },
  assignments: {
    pendingApprovals: "Pending Approvals",
    noPendingAssignments: "No pending assignments",
  },
  newArrivals: {
    title: "New Arrivals",
    noRecentAccessions: "No recent accessions",
  },
  loans: {
    admin: {
      activeLoans: "Active Loans",
      pendingApprovals: "Pending Approvals",
      inTransit: "In Transit",
      overdue: "Overdue",
    },
  },
  transit: {
    status: "Transport Status",
    noTransportRecords: "No transport records",
  },
  locations: {
    timeline: "Location History",
    noLocationHistory: "No location history",
  },
  common: {
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    search: "Search",
    filter: "Filter",
    actions: "Actions",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    pending: "Pending",
    noResults: "No results found",
    selectAll: "Select all",
    selected: "selected",
    viewAll: "View All",
    viewDetails: "View Details",
    backToList: "Back to list",
  },
} as const;
