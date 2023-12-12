declare global {
  var startCapture: () => void;
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

pc.ontrack = ({ track, streams }) => {
  track.onunmute = () => {
    if (remoteVideo.srcObject) {
      return;
    }

    remoteVideo.srcObject = streams[0];
  };
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

let ignoreOffer = false;
ws.onmessage = async (event) => {
  const { description, polite, candidate } = JSON.parse(event.data) as Message;

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

export async function startCapture() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });

  localVideo.srcObject = stream;

  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }
}

globalThis.startCapture = startCapture;