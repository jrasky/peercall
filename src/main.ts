import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

declare global {
  var startCall: () => void;
  var selectVideo: () => void;
}

@customElement('media-select')
export class UserMediaSelect extends LitElement {

  @state()
  _mediaOptions?: MediaDeviceInfo[];

  constructor() {
    super();

    this.updateDevices();
  }

  render() {
    return html`
      <select id="select" @click="${this._handleClickSelect}" @change="${this._handleSelect}">
        <option value="">Select input</option>
        ${this._mediaOptions?.map(this._renderDeviceInfo)}
      </select>
      `;
  }

  private _renderDeviceInfo(info: MediaDeviceInfo) {
    return html`<option value="${info.deviceId}">${info.label}</option>`;
  }

  private _handleSelect() {
    const id = (this.renderRoot.querySelector("#select")! as HTMLSelectElement).value;
    const selected = this._mediaOptions?.find(info => info.deviceId === id);

    this.dispatchEvent(new CustomEvent('selectMedia', {
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
    this.requestUpdate();
  }
}

const localVideo = document.querySelector('video#selfview')! as HTMLVideoElement;
const remoteVideo = document.querySelector('video#remoteview')! as HTMLVideoElement;
const ws = new WebSocket(`ws://${document.location.host}${document.location.pathname}`);
const pc = new RTCPeerConnection({
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302',
  }]
});

interface Message {
  connected?: boolean;
  polite?: boolean;
  description?: RTCSessionDescription;
  candidate?: RTCIceCandidate;
}

pc.onicecandidate = ({ candidate }) => {
  ws.send(JSON.stringify({ candidate }));
};

pc.oniceconnectionstatechange = () => {
  if (pc.iceConnectionState === "failed") {
    pc.restartIce();
  }
};

const remoteStream = new MediaStream();
pc.ontrack = ({ track }) => {
  remoteVideo.srcObject = remoteStream;
  remoteStream.addTrack(track);
};

let isPolite = false;
let makingOffer = false;
pc.onnegotiationneeded = async () => {
  try {
    makingOffer = true;
    ws.send(JSON.stringify({ polite: isPolite }));
    await pc.setLocalDescription();
    ws.send(JSON.stringify({ description: pc.localDescription }));
  } catch (err) {
    console.error(err);
  } finally {
    makingOffer = false;
  }
};

let isConnected = false;
ws.onopen = () => {
  ws.send(JSON.stringify({ connected: true }));
}

ws.onclose = () => {
  isConnected = false;
  (document.querySelector("#startCall") as HTMLButtonElement).disabled = true;
}

let ignoreOffer = false;
ws.onmessage = async (event) => {
  const { connected, description, polite, candidate } = JSON.parse(event.data) as Message;

  if (connected !== undefined) {
    if (!isConnected) {
      ws.send(JSON.stringify({ connected: true }));
    }

    isConnected = true;
    (document.querySelector("#startCall") as HTMLButtonElement).disabled = false;
  }

  if (polite !== undefined) {
    isPolite = !polite;
  }
  
  if (description !== undefined) {
    const offerCollision = description.type === "offer" && (makingOffer || pc.signalingState !== "stable");
    ignoreOffer = !isPolite && offerCollision;

    if (ignoreOffer) {
      return;
    }

    await pc.setRemoteDescription(description);
    if (description.type === "offer") {
      await pc.setLocalDescription();
      ws.send(JSON.stringify({ description: pc.localDescription }));
    }
  }

  if (candidate !== undefined) {
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (!ignoreOffer) {
        throw err;
      }
    }
  }
}

let videoStream: MediaStream | null = null;
let gameAudioStream: MediaStream | null = null;
let micAudioStream: MediaStream | null = null;

export async function startCall() {
  if (!videoStream || !gameAudioStream || !micAudioStream) {
    return;
  }

  for (const track of videoStream.getTracks()) {
    pc.addTrack(track);
  }

  for (const track of gameAudioStream.getTracks()) {
    pc.addTrack(track);
  }

  for (const track of micAudioStream.getTracks()) {
    pc.addTrack(track);
  }
}

export async function selectVideo() {
  videoStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
  });

  localVideo.srcObject = videoStream;
}

document.querySelector("#gameAudioSelect")!.addEventListener('selectMedia', async (event) => {
  const info = ((event as CustomEvent).detail.selected as MediaDeviceInfo);

  gameAudioStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: info.deviceId }});
});

document.querySelector("#micAudioSelect")!.addEventListener('selectMedia', async (event) => {
  const info = ((event as CustomEvent).detail.selected as MediaDeviceInfo);

  micAudioStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: info.deviceId }});
});

globalThis.startCall = startCall;
globalThis.selectVideo = selectVideo;
