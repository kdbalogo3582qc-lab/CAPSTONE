// Short labels used by run selection and comparison; technical metadata stays in saved JSON.
export const provenanceLabel = analysis => analysis?.analysis_metadata?.execution_kind === 'reused' ? 'Reused result'
    : analysis?.analysis_metadata?.execution_kind === 'fresh' ? 'Fresh analysis' : 'Run origin unknown';
