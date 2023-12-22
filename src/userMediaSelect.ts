import { LitElement, html } from 'lit';
import { customElement, state, query, property } from 'lit/decorators.js';

export interface SelectMediaEvent {
    selected: Map<string, MediaStream>;
}

@customElement('media-select')
export class UserMediaSelect extends LitElement {

    @property({ type: Boolean })
    disabled?: boolean;

    @query("#form")
    private _form?: HTMLFieldSetElement;

    @state()
    private _mediaOptions?: MediaDeviceInfo[];

    private _selected: Map<string, MediaStream> = new Map();

    constructor() {
        super();
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.updateDevices();
    }

    render() {
        return html`
        <fieldset id="form" @input="${this._handleInput}">
            <legend>Select input devices</legend>
            ${this._mediaOptions?.map(this._renderDeviceInfo)}
            ${this._mediaOptions ? null : this._renderSelectButton()}
        </fieldset>
      `;
    }

    get selected() {
        return this._selected;
    }

    private _renderDeviceInfo = (info: MediaDeviceInfo) => {
        return html`
        <div>
            <label><input type="checkbox" name="${info.deviceId}" ?disabled="${this.disabled}" />${info.label}</label>
        </div>`;
    }

    private _renderSelectButton = () => {
        return html`
        <div>
            <button @click="${this._handleClickSelect}" ?disabled="${this.disabled}">Select audio</button>
        </div>
        `;
    }

    private async _handleInput() {
        for (const element of this._form!.elements) {
            if (element instanceof HTMLInputElement) {
                if (element.checked) {
                    if (this._selected.has(element.name)) {
                        // Already selected stream
                        continue;
                    }

                    this._selected.set(element.name, await navigator.mediaDevices.getUserMedia({
                        audio: {
                            deviceId: element.name,
                        }
                    }));
                } else {
                    this._selected.delete(element.name);
                }
            }
        }

        this.dispatchEvent(new CustomEvent<SelectMediaEvent>('selectmedia', {
            bubbles: true,
            composed: true,
            detail: { selected: this._selected },
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
