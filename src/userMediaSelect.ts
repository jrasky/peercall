import { LitElement, html } from 'lit';
import { customElement, state, query, property } from 'lit/decorators.js';

export interface SelectMediaEvent {
    selected: MediaStream | null;
}

@customElement('media-select')
export class UserMediaSelect extends LitElement {

    @property({ type: Boolean })
    disabled?: boolean;

    @property({ type: String })
    kind?: string;

    @query("#select")
    private _input?: HTMLSelectElement;

    @state()
    private _mediaOptions?: MediaDeviceInfo[];

    private _selected: MediaStream | null = null;

    constructor() {
        super();
    }

    connectedCallback(): void {
        super.connectedCallback();
        this._updateDevices();
    }

    render() {
        return html`
        <select id="select" ?disabled=${this.disabled} @click=${this._handleClickSelect} @input=${this._handleInput}>
            <option value="">Select an input</option>
            ${this._mediaOptions?.map(this._renderDeviceInfo) || null}
        </select>
      `;
    }

    get selected() {
        return this._selected;
    }

    private _renderDeviceInfo = (info: MediaDeviceInfo) => {
        return html`<option value="${info.deviceId}">${info.label}</option>`;
    }

    private async _handleInput() {
        if (!this._input!.value) {
            this._selected = null;
            this.dispatchEvent(new CustomEvent<SelectMediaEvent>('selectmedia', {
                bubbles: true,
                composed: true,
                detail: { selected: null },
            }));

            return;
        }

        const stream = await this._getUserMedia(this._input!.value);

        this._selected = stream;

        this.dispatchEvent(new CustomEvent<SelectMediaEvent>('selectmedia', {
            bubbles: true,
            composed: true,
            detail: { selected: stream },
        }));
    }

    private async _handleClickSelect() {
        if (this._mediaOptions) {
            return;
        }

        await this._getUserMedia();

        await this._updateDevices();
    }

    private async _updateDevices() {
        const inputKind = this.kind === "audio" ? "audioinput" : "videoinput";

        const options = (await navigator.mediaDevices.enumerateDevices()).filter(
            info => !!info.label && info.kind === inputKind);

        if (options.length == 0) {
            return;
        }

        this._mediaOptions = options;
    }

    private async _getUserMedia(deviceId?: string) {
        if (this.kind === "audio") {
            return await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId,
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                },
            });
        } else {
            return await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId,
                },
            });
        }
    }
}
