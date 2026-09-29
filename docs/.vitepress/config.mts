import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Nischit Documentation",
  description: "Product, contributor, operator, and architecture documentation for Nischit.",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,
  themeConfig: {
    nav: [
      { text: "Documentation", link: "/" },
      { text: "Repository", link: "https://github.com/apil-khadka/nischit" },
    ],
    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "Overview", link: "/" },
          { text: "Run Nischit locally", link: "/getting-started" },
          { text: "Documentation index", link: "/README" },
        ],
      },
      {
        text: "Tutorials",
        items: [{ text: "First local run", link: "/getting-started" }],
      },
      {
        text: "How-to guides",
        items: [
          { text: "Deployment and local services", link: "/deployment" },
          { text: "Authentication setup", link: "/authentication" },
          { text: "Run verification", link: "/testing" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Implementation status", link: "/implementation-status" },
          { text: "Workflow invariants", link: "/workflow-invariants" },
          { text: "Plain-language behavior guide", link: "/test-guide" },
          { text: "Domain language", link: "/domain-language" },
          { text: "Technology stack", link: "/tech-stack" },
          { text: "Design system", link: "/design-system" },
          { text: "Public site", link: "/public-site" },
          { text: "Brand and naming", link: "/brand-naming" },
          { text: "Roadmap", link: "/roadmap" },
        ],
      },
      {
        text: "Explanations",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Security and privacy", link: "/security-privacy" },
          { text: "Multi-tenancy", link: "/multi-tenancy" },
          { text: "UI workflow research", link: "/ui-workflow-research" },
          {
            text: "Architecture decisions",
            link: "/adr/",
            collapsed: true,
            items: [
              { text: "Modular monolith", link: "/adr/0001-typescript-modular-monolith" },
              { text: "PostgreSQL source of truth", link: "/adr/0002-postgresql-source-of-truth" },
              { text: "Tenant isolation", link: "/adr/0003-tenant-isolation" },
              { text: "Chain adapters", link: "/adr/0004-chain-adapters" },
              { text: "Identity and authorization", link: "/adr/0005-identity-and-authorization" },
              { text: "No patient data", link: "/adr/0006-no-patient-data" },
              { text: "Design system", link: "/adr/0007-astryx-design-system" },
              { text: "Storage and deployment", link: "/adr/0008-storage-and-deployment" },
            ],
          },
        ],
      },
    ],
    search: { provider: "local" },
    editLink: {
      pattern: "https://github.com/apil-khadka/nischit/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
  },
});
