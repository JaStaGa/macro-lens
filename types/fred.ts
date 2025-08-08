export interface FredObservation {
    date: string;
    value: string; // FRED returns strings; "." means missing
    realtime_start?: string;
    realtime_end?: string;
}

export interface FredSeriesResponse {
    observations: FredObservation[];
    frequency?: string;
    units?: string;
}
