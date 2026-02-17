import { HomeAssistant, LovelaceCardEditor, LovelaceConfig } from 'custom-card-helpers';
import { html, LitElement, TemplateResult } from 'lit';
import { EDITOR_NAME, EntityKey } from './const';
import { customElement, property } from 'lit/decorators.js';
import { JkBmsCardConfig } from './interfaces';
import { localize } from './localize/localize';
import { fireEvent } from './helpers/utils';

@customElement(EDITOR_NAME)
export class JkBmsCardEditor extends LitElement implements LovelaceCardEditor {
    @property() public hass!: HomeAssistant;
    @property() private _config!: JkBmsCardConfig;
    public lovelace?: LovelaceConfig;

    // Cached schema – rebuilt only when _config changes
    private _schema: any[] | null = null;

    public setConfig(config: JkBmsCardConfig): void {
        this._config = { ...this._config, ...config };
        this._schema = null; // invalidate cached schema
    }

    /**
     * Block renders that are triggered solely by hass updates.
     * The editor UI only depends on _config; ha-form gets the fresh
     * hass reference forwarded directly so entity-pickers keep working.
     */
    protected shouldUpdate(changedProps: Map<string, any>): boolean {
        if (changedProps.has('_config')) {
            this._schema = null;
            return true;
        }
        if (changedProps.has('hass')) {
            // First time hass is set → need the initial render
            if (!changedProps.get('hass')) return true;
            // Subsequent hass updates → forward to ha-form without re-render
            const form = this.shadowRoot?.querySelector('ha-form');
            if (form) (form as any).hass = this.hass;
            return false;
        }
        return false;
    }

    /** Build the schema once and cache it until config changes. */
    private _buildSchema(): any[] {
        if (this._schema) return this._schema;

        // Only non-cell entity pickers (cells are auto-resolved from prefix)
        const entityConfigs = Object.values(EntityKey)
            .filter((key: string) => !key.startsWith('cell_voltage_') && !key.startsWith('cell_resistance_'))
            .map((key: string) => ({ name: key, selector: { entity: {} } }));

        this._schema = [
            {
                type: 'grid',
                title: localize('config.source'),
                schema: [
                    {
                        type: 'grid',
                        schema: [
                            {
                                name: 'source',
                                selector: {
                                    select: {
                                        options: [
                                            { label: 'JK BMS (direct)', value: 'jk-bms' },
                                            { label: 'YamBMS (sub-device)', value: 'yambms' }
                                        ]
                                    }
                                }
                            },
                            ...(this._config?.source === 'yambms' ? [{
                                name: 'bmsType',
                                selector: {
                                    select: {
                                        options: [
                                            { label: 'JK BMS (BLE)', value: 'jk-ble' },
                                            { label: 'JK BMS (RS485)', value: 'jk-rs485' },
                                            { label: 'Ecoworthy', value: 'ecoworthy' },
                                            { label: 'EG4', value: 'eg4' },
                                            { label: 'JBD', value: 'jbd' },
                                            { label: 'PACE', value: 'pace' },
                                            { label: 'SEPLOS V1/V2', value: 'seplos-v1v2' },
                                            { label: 'SEPLOS V3', value: 'seplos-v3' },
                                            { label: 'BASEN', value: 'basen' },
                                            { label: 'DEYE CAN', value: 'deye' },
                                            { label: 'Other', value: 'other' },
                                        ]
                                    }
                                }
                            }] : []),
                        ],
                    },
                ],
            },
            {
                type: 'grid',
                title: localize('config.title'),
                schema: [
                    {
                        type: 'grid',
                        schema: [
                            { name: 'title', selector: { text: {} } },
                        ],
                    },
                ],
            },
            {
                type: 'grid',
                title: localize('config.prefix'),
                schema: [
                    {
                        type: 'grid',
                        schema: [
                            { name: 'prefix', selector: { text: {} } },
                        ],
                    },
                ],
            },
            {
                type: 'grid',
                title: localize('config.layout'),
                schema: [
                    {
                        type: 'grid',
                        schema: [
                            {
                                name: 'layout',
                                selector: {
                                    select: {
                                        options: [
                                            { label: 'Default', value: 'default' },
                                            { label: 'Core Reactor', value: 'core-reactor' }
                                        ]
                                    }
                                }
                            },
                            {
                                name: 'deltaVoltageUnit',
                                selector: {
                                    select: {
                                        options: [
                                            { label: 'Volts (V)', value: 'V' },
                                            { label: 'Millivolts (mV)', value: 'mV' }
                                        ]
                                    }
                                }
                            },
                            { name: 'minCellVoltage', selector: { number: { min: 2.0, max: 4.0, step: 0.01, mode: 'box' } } },
                            {
                                name: 'tempUnit',
                                selector: {
                                    select: {
                                        options: [
                                            { label: 'Auto (from entity)', value: 'auto' },
                                            { label: 'Celsius (°C)', value: '°C' },
                                            { label: 'Fahrenheit (°F)', value: '°F' }
                                        ]
                                    }
                                }
                            },
                        ],
                    },
                    {
                        type: 'grid',
                        column_min_width: '200px',
                        schema: [
                            {
                                name: 'cellColorMode',
                                selector: {
                                    select: {
                                        options: [
                                            { label: 'Progress Bar', value: 'progress' },
                                            { label: 'Voltage Gradient', value: 'gradient' }
                                        ]
                                    }
                                }
                            },
                            {
                                name: 'cellOrientation',
                                selector: {
                                    select: {
                                        options: [
                                            { label: 'Vertical', value: 'vertical' },
                                            { label: 'Horizontal', value: 'horizontal' }
                                        ]
                                    }
                                }
                            },
                            { name: 'maxCellVoltage', selector: { number: { min: 2.0, max: 4.0, step: 0.01, mode: 'box' } } },
                            { name: 'sparklineHours', selector: { number: { min: 1, max: 48, step: 1, mode: 'box' } } },
                        ],
                    },
                ],
            },
            {
                type: 'grid',
                title: localize('config.cellCount'),
                schema: [
                    {
                        type: 'grid',
                        schema: [
                            { name: 'cellCount', selector: { number: { min: 2, max: 48, step: 2 } } },
                            { name: 'cellColumns', selector: { number: { min: 1, max: 8, step: 1 } } },
                            {
                                name: 'cellLayout', selector: {
                                    select: {
                                        options: [
                                            { label: 'Incremental', value: 'incremental' },
                                            { label: 'Bank Mode', value: 'bankMode' },
                                        ]
                                    }
                                }
                            },
                        ],
                    },
                ],
            },
            {
                type: 'grid',
                title: localize('config.tempSensorsCount'),
                schema: [
                    {
                        type: 'grid',
                        schema: [
                            { name: 'tempSensorsCount', selector: { number: { min: 0, max: 4, step: 2 } } },
                        ],
                    },
                ],
            },
            {
                type: 'grid',
                title: localize('config.hasHeater'),
                schema: [
                    {
                        type: 'grid',
                        schema: [
                            {
                                name: 'hasHeater', selector: {
                                    select: {
                                        multiple: false, mode: "list", options: [
                                            { label: "Yes", value: "1" },
                                            { label: "No", value: "0" }
                                        ]
                                    }
                                }
                            },
                        ],
                    },
                ],
            },
            {
                type: 'expandable',
                title: localize('config.manualAssignment'),
                schema: [
                    {
                        name: 'entities',
                        type: 'grid',
                        schema: entityConfigs,
                    },
                ],
            },
        ];
        return this._schema;
    }

    protected render(): TemplateResult | void {
        if (!this._config || !this.hass) {
            return html``;
        }

        return html`
            <ha-form
                .hass=${this.hass}
                .data=${this._config}
                .computeLabel=${this._computeLabelCallback}
                .schema=${this._buildSchema()}
                @value-changed=${this._valueChanged}
            ></ha-form>
        `;
    }

    private _computeLabelCallback = (data: any) => localize(`config.${data.name}`) ?? data.name;

    private _valueChanged = (ev: CustomEvent): void => {
        fireEvent(this, 'config-changed', { config: ev.detail.value });
    };
}
