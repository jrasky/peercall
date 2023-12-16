interface ConnectedMessage {
    type: 'connected';
}

interface PoliteMessage {
    type: 'polite';
    polite: boolean;
}

interface DescriptionMessage {
    type: 'description';
    description: RTCSessionDescription;
}

interface CandidateMessage {
    type: 'candidate';
    candidate: RTCIceCandidate;
}

type PeerMessage = ConnectedMessage | PoliteMessage | DescriptionMessage | CandidateMessage;

export class PeerConnection extends EventTarget {
    private _ws: WebSocket;
    private _pc: RTCPeerConnection;

    private _remoteStream = new MediaStream();
    private _connected = false;
    private _polite = false;
    private _makingOffer = false;

    constructor() {
        super();

        this._ws = new WebSocket(`ws://${document.location.host}${document.location.pathname}`);
        this._ws.addEventListener('open', this._onOpen);
        this._ws.addEventListener('close', this._onClose);
        this._ws.addEventListener('message', this._onMessage);

        this._pc = new RTCPeerConnection({
          iceServers: [{
            urls: 'stun:stun.l.google.com:19302',
          }],
        });

        this._pc.addEventListener('icecandidate', this._onIceCandidate);
        this._pc.addEventListener('iceconnectionstatechange', this._onIceConnectionStateChange);
        this._pc.addEventListener('track', this._onTrack);
        this._pc.addEventListener('negotiationneeded', this._onNegotiationNeeded);
    }

    get remoteStream() {
        return this._remoteStream;
    }

    get connected() {
        return this._connected;
    }

    addTrack(track: MediaStreamTrack): RTCRtpSender {
        return this._pc.addTrack(track);
    }

    removeTrack(sender: RTCRtpSender) {
        this._pc.removeTrack(sender);
    }

    private _sendMessage(message: PeerMessage) {
        this._ws.send(JSON.stringify(message));
    }

    private _onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
        this._sendMessage({ type: 'candidate', candidate: event.candidate! });
    }

    private _onIceConnectionStateChange = () => {
        if (this._pc.iceConnectionState === "failed") {
            this._pc.restartIce();
        }
    }

    private _onTrack = (event: RTCTrackEvent) => {
        this._remoteStream.addTrack(event.track);
    }

    private _onNegotiationNeeded = async () => {
        try {
            this._makingOffer = true;
            this._sendMessage({ type: 'polite', polite: this._polite });
            await this._pc.setLocalDescription();
            this._sendMessage({ type: 'description', description: this._pc.localDescription! });
        } catch (err) {
            console.log(err);
        } finally {
            this._makingOffer = false;
        }
    }

    private _onOpen = () => {
        this._sendMessage({ type: 'connected' });
    }

    private _onClose = () => {
        this._connected = false;
        this.dispatchEvent(new CustomEvent('disconnect'));
    }

    private _onMessage = async (event: MessageEvent) => {
        let ignoreOffer = false;
        const message = JSON.parse(event.data) as PeerMessage;

        switch (message.type) {
            case 'connected': {
                if (!this._connected) {
                    this._sendMessage({ type: 'connected' });
                }
        
                this._connected = true;
                this.dispatchEvent(new CustomEvent('connect'));
                break;
            }

            case 'polite': {
                this._polite = !message.polite;
                break;
            }

            case 'description': {
                const offerCollision = message.description.type === "offer"
                    && (this._makingOffer || this._pc.signalingState !== "stable");

                ignoreOffer = !this._polite && offerCollision;
        
                if (ignoreOffer) {
                    return;
                }
        
                await this._pc.setRemoteDescription(message.description);
                if (message.description.type === "offer") {
                    await this._pc.setLocalDescription();
                    this._sendMessage({ type: 'description', description: this._pc.localDescription! });
                }

                break;
            }

            case 'candidate': {
                try {
                    await this._pc.addIceCandidate(message.candidate);
                } catch (err) {
                    if (!ignoreOffer) {
                        throw err;
                    }
                }
                break;
            }
        }
    }
}
