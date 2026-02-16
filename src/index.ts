import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { EDITOR_NAME, EntityKey, MAIN_NAME } from './const';
import { JkBmsCardConfig } from './interfaces';
import { localize } from './localize/localize';
import { getRelevantEntityIds, hasRelevantStateChanged } from './helpers/utils';

import { version } from '../package.json';
import { globalData } from './helpers/globals';
import './layouts/default';
import './layouts/core-reactor';

export const CARD_VERSION = version;

console.groupCollapsed(
    `%c🔋 JK-BMS Battery Card%c   ready!  🚀 (v${CARD_VERSION})`,
    'background: linear-gradient(to right, #41cd52, #3090c7); color: white; font-weight: bold; padding: 2px 8px; border-radius: 6px;',
    'background: none; color: #AAA; font-style: italic;'
);
console.log('%c📖 Docs:', 'color: #41cd52; font-weight: bold;', 'https://github.com/Pho3niX90/jk-bms-card');
console.groupEnd();

@customElement(MAIN_NAME)
export class JkBmsCard extends LitElement {
    @property() public hass!: HomeAssistant;
    @property() private _config?: JkBmsCardConfig;

    private _entityIds: Set<string> = new Set();

    public setConfig(config: JkBmsCardConfig): void {
        this._config = JkBmsCard.getStubConfig();
        this._config = { ...this._config, ...config };
        this._entityIds = getRelevantEntityIds(this._config);
    }

    protected shouldUpdate(changedProps: Map<string, any>): boolean {
        if (changedProps.has('_config')) return true;
        if (changedProps.has('hass')) {
            const oldHass = changedProps.get('hass') as HomeAssistant;
            if (!oldHass || this._entityIds.size === 0) return true;
            return hasRelevantStateChanged(this.hass, oldHass, this._entityIds);
        }
        return true;
    }

    static getStubConfig() {
        return {
            title: localize("title"),
            prefix: "jk_bms",
            source: "jk-bms",
            bmsType: "jk",
            cellCount: 16,
            cellColumns: 2,
            cellLayout: "bankMode",
            tempSensorsCount: 0,
            hasHeater: 0,
            entities: Object.keys(EntityKey).reduce((acc, key) => {
                acc[key as EntityKey] = '';
                return acc;
            }, {} as Record<EntityKey, string>)
        } as unknown as JkBmsCardConfig;
    }

    public static async getConfigElement() {
        await import("./editor");
        return document.createElement(EDITOR_NAME) as LovelaceCardEditor;
    }

    public getCardSize(): number {
        return 3;
    }

    render() {
        globalData.hass = this.hass;
        if (!this.hass || !this._config) return html``;

        if (this._config.layout === 'core-reactor') {
            return html`<jk-bms-core-reactor-layout .hass=${this.hass} .config=${this._config}></jk-bms-core-reactor-layout>`;
        }

        return html`
    <jk-bms-default-layout .hass=${this.hass} .config = ${this._config}></jk-bms-default-layout>
        `;
    }
}

(window as any).customCards.push({
    type: MAIN_NAME,
    name: 'JK BMS Card',
    preview: true,
    description: localize('common.description'),
    configurable: true
});
