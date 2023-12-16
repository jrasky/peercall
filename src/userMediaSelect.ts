import { LitElement, html } from 'lit';
import { customElement, state, query, property } from 'lit/decorators.js';

export interface SelectMediaEvent {
    selected: MediaDeviceInfo;
}

@customElement('media-select')
export class UserMediaSelect extends LitElement {

    @property({ type: Boolean })
    disabled?: boolean;

    @query("#select")
    private _select?: HTMLSelectElement;

    @state()
    private _mediaOptions?: MediaDeviceInfo[];

    constructor() {
        super();

        this.updateDevices();
    }

    render() {
        return html`
      <select id="select" ?disabled="${this.disabled}" @click="${this._handleClickSelect}" @change="${this._handleSelect}">
        <option value="">Select input</option>
        ${this._mediaOptions?.map(this._renderDeviceInfo)}
      </select>
      `;
    }

    private _renderDeviceInfo(info: MediaDeviceInfo) {
        return html`<option value="${info.deviceId}">${info.label}</option>`;
    }

    private _handleSelect() {
        const id = this._select!.value;
        const selected = this._mediaOptions?.find(info => info.deviceId === id)!;

        this.dispatchEvent(new CustomEvent<SelectMediaEvent>('selectmedia', {
            bubbles: true,
            composed: true,
            detail: { selected },
        }));
    }

    private async _handleClickSelect() {
        if (this._mediaOptions) {
            return;
        }

        await navigator.mediaDevices.getUserMedia({ audio: true });

        await this.updateDevices();
    }

    private async updateDevices() {
        const options = (await navigator.mediaDevices.enumerateDevices()).filter(
            info => !!info.label && info.kind === "audioinput");

        if (options.length == 0) {
            return;
        }

        this._mediaOptions = options;
    }
}
