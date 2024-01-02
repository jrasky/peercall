import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { PeerConnection } from './webrtc';
import { SelectMediaEvent } from './userMediaSelect';
import './userMediaSelect';

enum CallState {
    WAITING,
    READY,
    CONNECTED,
    DISCONNECTED
}

@customElement('peer-call-app')
export class PeerCallApp extends LitElement {

    @query("#remoteview")
    private _remoteVideo?: HTMLVideoElement;

    @query("#selfview")
    private _localVideo?: HTMLVideoElement;

    @state()
    private _callState: CallState = CallState.WAITING;

    private _connection: PeerConnection;

    private _videoStream: MediaStream | null = null;
    private _audioStream: MediaStream | null = null;
    private _videoSenders: RTCRtpSender[] = [];
    private _audioSenders: RTCRtpSender[] = [];

    constructor() {
        super();

        this._connection = new PeerConnection();
        this._connection.addEventListener('connect', this._onConnect);
        this._connection.addEventListener('disconnect', this._onDisconnect);
    }

    static styles = css`
    video#remoteview {
        width: 1280px;
        height: 720px;
    }

    video#selfview {
        width: 320px;
        height: 180px;
    }
    `;

    render() {
        return html`
        <div>
            <video id="remoteview" autoplay playsinline controls></video>
        </div>
        <div>
            <p>Self-view</p>
            <video id="selfview" autoplay playsinline muted></video>
            <br>
            <media-select kind="video" @selectmedia="${this._onSelectVideo}" ?disabled="${this._callState === CallState.DISCONNECTED}"></media-select>
        </div>
        <div>
            <label>
                Audio input:
                <media-select kind="audio" @selectmedia="${this._onSelectAudio}" ?disabled="${this._callState === CallState.DISCONNECTED}"></media-select>
            </label>
        </div>
        <div>
            <p>${this._callStateText()}</p>
            <button @click="${this._clickStartCall}" ?disabled=${this._callState !== CallState.READY}>Start call</button>
        </div>
    `;
    }

    private _callStateText() {
        switch (this._callState) {
            case CallState.WAITING:
                return 'Waiting for connection';
            case CallState.READY:
                return 'Ready';
            case CallState.CONNECTED:
                return 'Connected';
            case CallState.DISCONNECTED:
                return 'Disconnected';
        }
    }

    private _clickStartCall() {
        this._callState = CallState.CONNECTED;
        this._remoteVideo!.srcObject = this._connection.remoteStream;

        if (this._videoStream) {
            for (const track of this._videoStream.getTracks()) {
                this._videoSenders.push(this._connection.addTrack(track));
            }
        }

        if (this._audioStream) {
            for (const track of this._audioStream.getTracks()) {
                this._audioSenders.push(this._connection.addTrack(track));
            }
        }
    }

    private async _onSelectVideo(event: CustomEvent<SelectMediaEvent>) {
        this._localVideo!.srcObject = event.detail.selected;
        this._videoStream = event.detail.selected;

        if (this._callState === CallState.CONNECTED) {
            for (const sender of this._videoSenders) {
                this._connection.removeTrack(sender);
            }

            this._videoSenders = [];

            if (this._videoStream) {
                for (const track of this._videoStream.getTracks()) {
                    this._videoSenders.push(this._connection.addTrack(track));
                }
            }
        }
    }

    private async _onSelectAudio(event: CustomEvent<SelectMediaEvent>) {
        this._audioStream = event.detail.selected;

        if (this._callState === CallState.CONNECTED) {
            for (const sender of this._audioSenders) {
                this._connection.removeTrack(sender);

                this._audioSenders = [];

                if (this._audioStream) {
                    for (const track of this._audioStream.getTracks()) {
                        this._audioSenders.push(this._connection.addTrack(track));
                    }
                }
            }
        }
    }

    private _onConnect = () => {
        this._callState = CallState.READY;
    }

    private _onDisconnect = () => {
        this._callState = CallState.DISCONNECTED;
    }
}
