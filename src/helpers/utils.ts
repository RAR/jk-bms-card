import {HomeAssistant} from 'custom-card-helpers';
import {EntityKey, YAMBMS_COMMON_MAP, YAMBMS_BMS_TYPE_MAP} from '../const';
import {JkBmsCardConfig} from '../interfaces';

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
    const fullEntityId = configValue.includes('sensor.') || configValue.includes('switch.') || configValue.includes('number.') ? configValue : type + "." + config?.prefix + "_" + configValue;
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

    const entityId = configValue.includes('sensor.') || configValue.includes('switch.') || configValue.includes('number.') ? configValue : `${type}.${config!.prefix}_${configValue}`;
    const entity = hass?.states[entityId];
    const state = entity?.state;
    const stateNumeric = Number(state);

    if (!isNaN(stateNumeric))
        return stateNumeric.toFixed(precision);

    return state ?? defaultValue;
}

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

    // Switches
    [EntityKey.charging, EntityKey.discharging, EntityKey.balancer, EntityKey.heater]
        .forEach(k => resolve(k, 'switch'));

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
