import { nanoid } from 'https://cdn.jsdelivr.net/npm/nanoid/nanoid.js';

const socket = io('http://localhost:9000');

const chatBox = document.querySelector('.chat');
const createRoom = document.querySelector('.createRoom');
const joinRoom = document.querySelector('.joinRoom');
const roomToJoin = document.querySelector('.roomId');
const sendMessage = document.querySelector('.sendMessage');
const inputMessage = document.querySelector('.inputMessage');

const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

const myAudio = document.createElement('audio');
myAudio.srcObject = localStream;
myAudio.autoplay = true;
myAudio.muted = false; // ⚠️ Careful with echo
myAudio.controls = true;
document.body.appendChild(myAudio);
const peerConnections = {};

joinRoom.addEventListener('click', async (room) => {
	const roomId = roomToJoin.value;
	try {
		const roomMembers = await fetch(
			'http://localhost:9000/api/roomMembers',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'text/plain',
				},
				body: roomId,
			}
		);
		// const roomMembs = await roomMembers.text();
		// const parsedRoomMembers = parseInt(roomMembs);
		if (!roomMembers.ok) {
			const errorText = await roomMembers.text();
			throw new Error(errorText || 'Something went wrong!');
		}
		const roomMembs = parseInt(await roomMembers.text());
		if (roomMembs < 5) {
			window.location.href = `${window.location.pathname}?room=${roomId}`;
		} else throw new Error('Room is Full');
	} catch (err) {
		console.error(err.message);
	}
});

createRoom.addEventListener('click', () => {
	const roomId = nanoid(8);
	window.location.href = `${window.location.pathname}?room=${roomId}`;
});

sendMessage.addEventListener('click', () => {
	const roomId = getRoomId();
	socket.emit('roomId', roomId);
	socket.emit('userMessage', { roomId, text: inputMessage.value });
	inputMessage.value = '';
});

function getRoomId() {
	const urlParams = new URLSearchParams(window.location.search);
	const roomId = urlParams.get('room');
	return roomId;
}
const roomId = getRoomId();
if (roomId) {
	socket.emit('joinRoom', roomId);
	console.log(`Joined room ${roomId}`);
}

socket.on('user-joined', async (newUserId) => {
	const pc = new RTCPeerConnection({
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
	});
	peerConnections[newUserId] = pc;
	localStream.getTracks().forEach((track) => {
		pc.addTrack(track, localStream);
	});

	pc.onicecandidate = (e) => {
		if (e.candidate) {
			socket.emit('iceCandidate', {
				target: newUserId,
				candidate: e.candidate.toJSON(),
			});
		}
	};

	pc.ontrack = (e) => {
		console.log('🔊 Remote audio stream received 1');
		const audio = document.createElement('audio');
		audio.srcObject = e.streams[0];
		audio.autoplay = true;
		audio.controls = true; // So you can manually play/pause for debugging
		document.body.appendChild(audio);
	};

	const offer = await pc.createOffer();
	await pc.setLocalDescription(offer);

	socket.emit('offer', {
		target: newUserId,
		offer: offer,
	});
});

socket.on('offer', async ({ from, offer }) => {
	const pc = new RTCPeerConnection({
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
	});
	peerConnections[from] = pc;

	localStream
		.getTracks()
		.forEach((track) => pc.addTrack(track, localStream));

	pc.onicecandidate = (e) => {
		if (e.candidate) {
			socket.emit('iceCandidate', {
				target: from,
				candidate: e.candidate.toJSON(),
			});
		}
	};


	//only for testing purposes.........Finalisima
	pc.ontrack = (e) => {
		console.log('🔊 Remote audio stream received 2');
		const audio = document.createElement('audio');
		audio.srcObject = e.streams[0];
		audio.autoplay = true;
		audio.controls = true; // So you can manually play/pause for debugging
		document.body.appendChild(audio);
	};

	await pc.setRemoteDescription(new RTCSessionDescription(offer));
	const answer = await pc.createAnswer();
	await pc.setLocalDescription(answer);

	socket.emit('answer', { target: from, answer });
});

socket.on('answer', async ({from, answer}) => {
	const pc = peerConnections[from];
	pc.setRemoteDescription(new RTCSessionDescription(answer));
})

socket.on('iceCandidate', ({ from, candidate }) => {
	const pc = peerConnections[from];
	if (candidate && candidate.candidate) {
		pc.addIceCandidate(new RTCIceCandidate(candidate));
	}
});

socket.on('roomFull', (msg) => {
	console.log(msg);
});

socket.on('messageForChat', (msg) => {
	console.log(msg);
});

socket.on('messageFromUser', (message) => {
	console.log(message);
});
