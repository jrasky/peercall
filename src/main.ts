import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { UserMediaSelect } from './userMediaSelect';
import { PeerConnection } from './webrtc';
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

    @query("#audioselect")
    private _audioSelect?: UserMediaSelect;

    @state()
    private _callState: CallState = CallState.WAITING;

    private _connection: PeerConnection;

    private _videoStream?: MediaStream;
    private _videoSenders: RTCRtpSender[] = [];
    private _audioSenders: Map<string, RTCRtpSender[]> = new Map();

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
            <button @click="${this._clickSelectVideo}" ?disabled="${this._callState === CallState.DISCONNECTED}">Select video</button>
        </div>
        <media-select id="audioselect" @selectmedia="${this._onSelectAudio}" ?disabled="${this._callState === CallState.DISCONNECTED}"></media-select>
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

        this._onSelectAudio();
    }

    private async _clickSelectVideo() {
        const videoStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
        });

        this._localVideo!.srcObject = videoStream;
        this._videoStream = videoStream;

        if (this._callState === CallState.CONNECTED) {
            for (const sender of this._videoSenders) {
                this._connection.removeTrack(sender);
            }

            this._videoSenders = [];

            for (const track of videoStream.getTracks()) {
                this._videoSenders.push(this._connection.addTrack(track));
            }
        }
    }

    private _onSelectAudio() {
        for (const [id, senders] of this._audioSenders.entries()) {
            if (!this._audioSelect!.selected.has(id)) {
                for (const sender of senders) {
                    this._connection.removeTrack(sender);
                }

                this._audioSenders.delete(id);
            }
        }

        for (const [id, stream] of this._audioSelect!.selected.entries()) {
            if (this._audioSenders.has(id)) {
                // Assume we don't need to update anything for the same device
                continue;
            }

            const senders = []
            for (const track of stream.getTracks()) {
                senders.push(this._connection.addTrack(track));
            }
            this._audioSenders.set(id, senders);
        }
    }

    private _onConnect = () => {
        this._callState = CallState.READY;
    }

    private _onDisconnect = () => {
        this._callState = CallState.DISCONNECTED;
    }
}
