import { LitElement, html } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { SelectMediaEvent, UserMediaSelect } from './userMediaSelect';
import { PeerConnection } from './webrtc';
import './userMediaSelect';

enum CallState {
    WAITING,
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

    private _tracks: Record<string, RTCRtpSender[]> = {};

    constructor() {
        super();

        this._connection = new PeerConnection();
        this._connection.addEventListener('connect', this._onConnect);
        this._connection.addEventListener('disconnect', this._onDisconnect);
    }

    render() {
        return html`
        <div>
            <video id="remoteview" autoplay playsinline controls></video>
        </div>
        <div>
            <p>Self-view</p>
            <video id="selfview" autoplay playsinline muted></video>
            <br>
            <button @click="${this._clickSelectVideo}">Select video</button>
        </div>
        <div>
            <p>Game audio: <media-select @selectmedia="${this._onSelectMedia}" ?disabled="${this._callState !== CallState.CONNECTED}" id="gameAudio" /></p>
        </div>
        <div>
            <p>Mic audio: <media-select @selectmedia="${this._onSelectMedia}" ?disabled="${this._callState !== CallState.CONNECTED}" id="micAudio" /></p>
        </div>
        <div>
            <p>${this._callStateText()}</p>
            <button @click="${this._clickStartCall}" ?disabled=${this._callState !== CallState.CONNECTED}>Start call</button>
        </div>
    `;
    }

    private _callStateText() {
        switch (this._callState) {
            case CallState.WAITING:
                return 'Waiting for connection';
            case CallState.CONNECTED:
                return 'Connected';
            case CallState.DISCONNECTED:
                return 'Disconnected';
        }
    }

    private _clickStartCall() {
        this._remoteVideo!.srcObject = this._connection.remoteStream;
    }

    private async _clickSelectVideo() {
        const videoStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
        });

        this._localVideo!.srcObject = videoStream;
        this._sendStream('video', videoStream);
    }

    private async _onSelectMedia(event: CustomEvent<SelectMediaEvent>) {
        const id = (event.target as UserMediaSelect).id;

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: event.detail.selected.deviceId,
            }
        });

        this._sendStream(id, stream);
    }

    private _sendStream(id: string, stream: MediaStream) {
        if (this._tracks[id]) {
            for (const sender of this._tracks[id]) {
                this._connection.removeTrack(sender);
            }
        }

        this._tracks[id] = [];
        for (const track of stream.getTracks()) {
            this._tracks[id].push(this._connection.addTrack(track));
        }
    }

    private _onConnect = () => {
        this._callState = CallState.CONNECTED;
    }

    private _onDisconnect = () => {
        this._callState = CallState.DISCONNECTED;
    }
}
