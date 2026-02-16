import { LovelaceCardConfig } from 'custom-card-helpers';
import { BmsType, EntityKey, SourceType } from './const';

export interface JkBmsCardConfig extends LovelaceCardConfig {
    title: string;
    prefix: string; // The entity prefix (e.g., "jk_bms_bms0_")
    source: SourceType; // 'jk-bms' or 'yambms'
    bmsType?: BmsType; // BMS type for entity name mapping (only used when source=yambms)
    cellCount: number;
    cellColumns: number;
    cellLayout: 'incremental' | 'bankMode';
    layout?: string;
    deltaVoltageUnit?: 'V' | 'mV';
    cellColorMode?: 'progress' | 'gradient';
    cellOrientation?: 'vertical' | 'horizontal';
    tempUnit?: 'auto' | '°C' | '°F';
    minCellVoltage?: number;
    maxCellVoltage?: number;
    entities: Record<EntityKey, string>;
}