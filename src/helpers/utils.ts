import {HomeAssistant} from 'custom-card-helpers';
import {EntityKey, YAMBMS_COMMON_MAP, YAMBMS_BMS_TYPE_MAP} from '../const';
import {JkBmsCardConfig} from '../interfaces';
import {globalData} from './globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fireEvent(node: HTMLElement, type: string, detail: any, options?: any) {
    options = options || {};
    detail = detail === null || detail === undefined ? {} : detail;
    const event = new Event(type, {
        bubbles: options.bubbles === undefined ? true : options.bubbles,
        cancelable: Boolean(options.cancelable),
        composed: options.composed === undefined ? true : options.composed,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event as any).detail = detail;
    node.dispatchEvent(event);
    return event;
}

export const configOrEnum = (config: JkBmsCardConfig, entityId: EntityKey) => {
    const configValue = config?.entities[entityId]?.toString()?.trim();
    if (configValue && configValue.length > 1) return configValue;
    // Apply YamBMS entity name mapping when source is 'yambms'
    if (config?.source === 'yambms') {
        // BMS-type-specific overrides take priority
        let bmsType = config.bmsType ?? 'jk-ble';
        // Backwards compat: old configs may have 'jk' instead of 'jk-ble'
        if (bmsType === ('jk' as any)) bmsType = 'jk-ble';
        const bmsMap = YAMBMS_BMS_TYPE_MAP[bmsType];
        if (bmsMap) {
            const bmsOverride = bmsMap[entityId];
            if (bmsOverride) return bmsOverride;
        }
        // Then common YamBMS overrides
        const common = YAMBMS_COMMON_MAP[entityId];
        if (common) return common;
    }
    return entityId?.toString();
}

export const navigate = (event, config: JkBmsCardConfig, entityId: EntityKey, type: "sensor" | "switch" | "number" = "sensor") => {
    if (!event) {
        return;
    }

    event.stopPropagation();

    const configValue = configOrEnum(config, entityId);
    let fullEntityId = configValue.includes('sensor.') || configValue.includes('switch.') || configValue.includes('binary_sensor.') || configValue.includes('number.') ? configValue : type + "." + config?.prefix + "_" + configValue;

    // Fallback chain for switches: try binary_sensor with same suffix,
    // then binary_sensor with the raw entity key name (e.g. 'charging')
    if (type === 'switch' && !configValue.includes('.')) {
        const hass = (globalData as any).hass as HomeAssistant | undefined;
        if (hass && !hass.states[fullEntityId]) {
            const bsFallback = `binary_sensor.${config?.prefix}_${configValue}`;
            if (hass.states[bsFallback]) {
                fullEntityId = bsFallback;
            } else {
                const rawKey = entityId?.toString();
                if (rawKey && rawKey !== configValue) {
                    const bsRawFallback = `binary_sensor.${config?.prefix}_${rawKey}`;
                    if (hass.states[bsRawFallback]) fullEntityId = bsRawFallback;
                }
            }
        }
    }

    let customEvent = new CustomEvent('hass-more-info', {
        detail: {entityId: fullEntityId},
        composed: true,
    })
    event.target.dispatchEvent(customEvent);
}

export const getState = (hass: HomeAssistant, config: JkBmsCardConfig, entityKey: EntityKey, precision: number = 2, defaultValue = '', type: "sensor" | "switch" | "number" = "sensor"): string => {
    const configValue = configOrEnum(config, entityKey)
    if (!configValue)
        return defaultValue;

    let entityId = configValue.includes('sensor.') || configValue.includes('switch.') || configValue.includes('binary_sensor.') || configValue.includes('number.') ? configValue : `${type}.${config!.prefix}_${configValue}`;

    // Fallback chain for switches: try binary_sensor with same suffix,
    // then binary_sensor with the raw entity key name (e.g. 'charging')
    if (type === 'switch' && !configValue.includes('.') && !hass?.states[entityId]) {
        const bsFallback = `binary_sensor.${config!.prefix}_${configValue}`;
        if (hass?.states[bsFallback]) {
            entityId = bsFallback;
        } else {
            const rawKey = entityKey?.toString();
            if (rawKey && rawKey !== configValue) {
                const bsRawFallback = `binary_sensor.${config!.prefix}_${rawKey}`;
                if (hass?.states[bsRawFallback]) {
                    entityId = bsRawFallback;
                }
            }
        }
    }

    const entity = hass?.states[entityId];
    const state = entity?.state;
    const stateNumeric = Number(state);

    if (!isNaN(stateNumeric))
        return stateNumeric.toFixed(precision);

    return state ?? defaultValue;
}

/**
 * Resolve the temperature unit symbol for display.
 * If config.tempUnit is 'auto' (default), reads the unit_of_measurement
 * attribute from the first available temperature entity in HA.
 */
export const getTempUnit = (hass: HomeAssistant, config: JkBmsCardConfig): string => {
    if (config?.tempUnit && config.tempUnit !== 'auto') return config.tempUnit;

    // Auto-detect from the first temp entity that exists
    const tempKeys = [
        EntityKey.temperature_sensor_1,
        EntityKey.temperature_sensor_2,
        EntityKey.power_tube_temperature,
    ];
    for (const key of tempKeys) {
        const val = configOrEnum(config, key);
        if (!val) continue;
        const entityId = val.includes('sensor.') ? val : `sensor.${config.prefix}_${val}`;
        const entity = hass?.states[entityId];
        if (entity?.attributes?.unit_of_measurement) {
            return entity.attributes.unit_of_measurement;
        }
    }
    return '°C';
};

/**
 * Build the set of HA entity IDs this card config cares about.
 * Used by shouldUpdate() to skip renders when unrelated entities change.
 */
export const getRelevantEntityIds = (config: JkBmsCardConfig): Set<string> => {
    const ids = new Set<string>();
    if (!config?.prefix) return ids;

    const resolve = (key: EntityKey, type = 'sensor'): void => {
        const val = configOrEnum(config, key);
        if (!val) return;
        ids.add(val.includes('.') ? val : `${type}.${config.prefix}_${val}`);
    };

    // Core sensors
    [
        EntityKey.delta_cell_voltage, EntityKey.balancing_current, EntityKey.power,
        EntityKey.total_voltage, EntityKey.total_battery_capacity_setting,
        EntityKey.total_charging_cycle_capacity, EntityKey.average_cell_voltage,
        EntityKey.current, EntityKey.state_of_charge, EntityKey.capacity_remaining,
        EntityKey.charging_cycles, EntityKey.power_tube_temperature,
        EntityKey.min_voltage_cell, EntityKey.max_voltage_cell, EntityKey.errors,
        EntityKey.total_runtime_formatted,
    ].forEach(k => resolve(k));

    // Switches (also register binary_sensor fallbacks with both mapped and raw key names)
    [EntityKey.charging, EntityKey.discharging, EntityKey.balancer, EntityKey.heater]
        .forEach(k => {
            resolve(k, 'switch');
            resolve(k, 'binary_sensor');
            // Also register the raw key name as binary_sensor in case the mapped
            // name differs (e.g. ecoworthy secondary: switch name is 'charge_switch'
            // but binary_sensor is 'charging')
            const rawKey = k.toString();
            const mapped = configOrEnum(config, k);
            if (mapped && mapped !== rawKey && !mapped.includes('.')) {
                const rawId = `binary_sensor.${config.prefix}_${rawKey}`;
                ids.add(rawId);
            }
        });

    // Numbers
    resolve(EntityKey.balance_trigger_voltage, 'number');

    // Temperature sensors
    for (let i = 1; i <= ((config as any).tempSensorsCount ?? 0); i++) {
        const key = EntityKey[`temperature_sensor_${i}`];
        if (key) resolve(key as EntityKey);
    }

    // Cell voltages and resistances
    for (let i = 1; i <= (config.cellCount ?? 16); i++) {
        const vKey = EntityKey[`cell_voltage_${i}`];
        if (vKey) resolve(vKey as EntityKey);
        const rKey = EntityKey[`cell_resistance_${i}`];
        if (rKey) resolve(rKey as EntityKey);
    }

    return ids;
};

/**
 * Returns true if any tracked entity state reference changed between hass updates.
 */
export const hasRelevantStateChanged = (
    newHass: HomeAssistant,
    oldHass: HomeAssistant,
    entityIds: Set<string>
): boolean => {
    for (const id of entityIds) {
        if (newHass.states[id] !== oldHass.states[id]) return true;
    }
    return false;
};

export const formatDeltaVoltage = (
    unit: 'V' | 'mV' = 'V',
    maxDeltaV: number | string
): string => {
    const valInVolts = typeof maxDeltaV === 'string'
        ? parseFloat(maxDeltaV)
        : maxDeltaV;

    if (isNaN(valInVolts)) return '-';

    if (unit === 'mV') {
        return `${(valInVolts * 1000).toFixed(0)} mV`;
    }

    const formattedVolts = valInVolts.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });

    return `${formattedVolts} V`;
}
