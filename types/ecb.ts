// types/ecb.ts

// Raw SDMX-JSON (trimmed to what we use)
export interface SdmxTimeValue { id?: string; name?: string }
export interface SdmxObservationDim { id?: string; values?: SdmxTimeValue[] }

export interface SdmxSeries {
    observations?: Record<string, number[] | number>;
}
export interface SdmxDataSet {
    series?: Record<string, SdmxSeries>;
}
export interface SdmxStructure {
    dimensions?: {
        observation?: SdmxObservationDim[];
    };
}
export interface SdmxJson {
    dataSets?: SdmxDataSet[];
    structure?: SdmxStructure;
}

// Normalized (parity with your BLS/FRED cards)
export interface EcbObservation {
    date: string;
    value: number;
}
export interface EcbNormalized {
    observations: EcbObservation[];
    series: string;        // e.g. "EXR:D.USD.EUR.SP00.A"
    units?: string;        // ECB units are trickier; leave optional
    lastUpdated?: string;  // optional (could be from headers/metadata later)
}
