export const CREEM_MINIMUMS: Record<string, string> = {
  usd: "$1.00",
  eur: "€1.00",
};

export const CREEM_CURRENCIES = Object.keys(CREEM_MINIMUMS).sort();

export const shimmerCss = `
  @keyframes creemShimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .creemShimmer {
    background: linear-gradient(90deg, rgba(240,240,240,1) 0%, rgba(250,250,250,1) 50%, rgba(240,240,240,1) 100%);
    background-size: 800px 100%;
    animation: creemShimmer 1.2s ease-in-out infinite;
  }
  `;

export const styles = {
  inputFullWidth: { width: "100%" } as const,
  descriptionTextarea: { width: "100%", minHeight: 120 } as const,
} as const;

export const ui = {
  mt2: { marginTop: 2 } as const,
  mt3: { marginTop: 3 } as const,
  mt4: { marginTop: 4 } as const,
  pt4: { paddingTop: 4 } as const,
  pb2: { paddingBottom: 2 } as const,
  pb6: { paddingBottom: 6 } as const,
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "neutral800",
    opacity: 0.4,
    zIndex: 1,
  } as const,
  modalWrapper: {
    display: "flex",
    style: {
      flexDirection: "column",
      justifyContent: "center",
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 2,
      pointerEvents: "none",
    },
  } as const,
  modalCard: {
    background: "neutral0",
    style: { maxHeight: "70vh", overflowY: "scroll" as const },
    width: "900px",
    maxWidth: "90%",
    margin: "auto",
    borderRadius: "8px",
    pointerEvents: "auto",
    shadow: "filterShadow",
  } as const,
  modalHeader: { padding: 6 } as const,
  modalBody: { paddingLeft: 6, paddingRight: 6, paddingBottom: 4 } as const,
  modalFooter: { padding: 6, background: "neutral100" } as const,
  formStack: { direction: "column", gap: 6, style: { width: "100%" } } as const,
  field: { width: "100%" } as const,
  fieldLabel: { variant: "pi", fontWeight: "bold" } as const,
  buttonRow: { gap: 2, wrap: "wrap", justifyContent: "flex-start" } as const,
  stackGap6: { direction: "column", gap: 6 } as const,
  rowGap2Wrap: { gap: 2, wrap: "wrap" } as const,
  justifyBetween: { justifyContent: "space-between" } as const,
  justifyEnd: { justifyContent: "flex-end" } as const,
  headingBetaBold: { variant: "beta", fontWeight: "bold" } as const,
  settingsHeader: { direction: "column", gap: 2, alignItems: "flex-start", width: "100%" } as const,
  settingsTitle: { variant: "beta", style: { textAlign: "left", width: "100%" } } as const,
  settingsSubtitle: {
    variant: "pi",
    textColor: "neutral600",
    style: { textAlign: "left", width: "100%" },
  } as const,
  settingsStack: { style: { display: "flex", flexDirection: "column", gap: 20 } } as const,
  helpText: { variant: "pi", textColor: "neutral600", style: { marginTop: 4 } } as const,
  embedOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "neutral800",
    opacity: 0.4,
    zIndex: 1,
  } as const,
  embedCard: {
    position: "fixed",
    zIndex: 2,
    top: "50%",
    left: "50%",
    style: { transform: "translate(-50%, -50%)" },
    width: "900px",
    maxWidth: "92%",
    background: "neutral0",
    borderRadius: "8px",
    shadow: "tableShadow",
  } as const,
} as const;
