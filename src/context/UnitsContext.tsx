import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StorageService } from '../services/storage';

export type UnitSystem = 'metric' | 'imperial';

// ── Conversion constants ─────────────────────────────────
const KG_TO_LBS = 2.20462;
const CM_TO_IN = 0.393701;

// ── Conversion helpers ───────────────────────────────────
export const unitConversions = {
    // Weight
    kgToLbs: (kg: number) => +(kg * KG_TO_LBS).toFixed(1),
    lbsToKg: (lbs: number) => +(lbs / KG_TO_LBS).toFixed(1),

    // Length
    cmToIn: (cm: number) => +(cm * CM_TO_IN).toFixed(1),
    inToCm: (inches: number) => +(inches / CM_TO_IN).toFixed(1),
};

interface UnitsContextValue {
    unitSystem: UnitSystem;
    setUnitSystem: (system: UnitSystem) => Promise<void>;

    /** Labels for display */
    weightUnit: string;       // "kg" or "lbs"
    lengthUnit: string;       // "cm" or "in"

    /** Convert a metric value TO the current display unit */
    displayWeight: (kgValue: number) => number;
    displayLength: (cmValue: number) => number;

    /** Convert a user-entered value FROM the current display unit back TO metric */
    toMetricWeight: (displayValue: number) => number;
    toMetricLength: (displayValue: number) => number;

    /** Format a value with its unit string */
    formatWeight: (kgValue: number) => string;
    formatLength: (cmValue: number) => string;
}

const UnitsContext = createContext<UnitsContextValue | undefined>(undefined);

export const UnitsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');

    useEffect(() => {
        const load = async () => {
            const saved = await StorageService.getUnitPreference();
            if (saved) setUnitSystemState(saved);
        };
        load();
    }, []);

    const setUnitSystem = useCallback(async (system: UnitSystem) => {
        setUnitSystemState(system);
        await StorageService.setUnitPreference(system);
    }, []);

    const isMetric = unitSystem === 'metric';

    const weightUnit = isMetric ? 'kg' : 'lbs';
    const lengthUnit = isMetric ? 'cm' : 'in';

    const displayWeight = useCallback(
        (kgValue: number) => isMetric ? kgValue : unitConversions.kgToLbs(kgValue),
        [isMetric]
    );

    const displayLength = useCallback(
        (cmValue: number) => isMetric ? cmValue : unitConversions.cmToIn(cmValue),
        [isMetric]
    );

    const toMetricWeight = useCallback(
        (displayValue: number) => isMetric ? displayValue : unitConversions.lbsToKg(displayValue),
        [isMetric]
    );

    const toMetricLength = useCallback(
        (displayValue: number) => isMetric ? displayValue : unitConversions.inToCm(displayValue),
        [isMetric]
    );

    const formatWeight = useCallback(
        (kgValue: number) => `${displayWeight(kgValue)} ${weightUnit}`,
        [displayWeight, weightUnit]
    );

    const formatLength = useCallback(
        (cmValue: number) => `${displayLength(cmValue)} ${lengthUnit}`,
        [displayLength, lengthUnit]
    );

    const value = useMemo(
        () => ({
            unitSystem,
            setUnitSystem,
            weightUnit,
            lengthUnit,
            displayWeight,
            displayLength,
            toMetricWeight,
            toMetricLength,
            formatWeight,
            formatLength,
        }),
        [unitSystem, setUnitSystem, weightUnit, lengthUnit, displayWeight, displayLength, toMetricWeight, toMetricLength, formatWeight, formatLength]
    );

    return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
};

export const useUnits = (): UnitsContextValue => {
    const context = useContext(UnitsContext);
    if (!context) {
        throw new Error('useUnits must be used within UnitsProvider');
    }
    return context;
};
