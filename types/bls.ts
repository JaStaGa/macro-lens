export interface BlsDatum {
    year: string;        // e.g. "2025"
    period: string;      // e.g. "M07"
    periodName: string;  // e.g. "July"
    value: string;       // numeric string like "4.3"
    footnotes?: Array<{ code?: string; text?: string | null }>;
}

export interface BlsSeries {
    seriesID?: string;
    data: BlsDatum[];    // newest first
}

export interface BlsResponse {
    Results?: { series: BlsSeries[] };
    status?: string;     // e.g. "REQUEST_SUCCEEDED"
    message?: string[];  // error messages if any
}
