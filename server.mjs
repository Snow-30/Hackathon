import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(express.text());
const PORT = process.env.PORT || 9000;

const newServer = http.createServer(app);
const io = new Server(newServer, {
	cors: {
		origin: 'http://127.0.0.1:5500',
		methods: ['GET', 'POST'],
		credentials: true,
	},
});

app.get('/', (request, response) => {
	return response.send('Chat Room!');
});

let roomId;
	 
io.on('connection', (socket) => {
	console.log('User connnected');
	console.log('Id: ', socket.id);
	socket.on('chatMessage', (msg) => {
		console.log(msg);
		io.emit('messageForChat', msg);
	});
	socket.on('joinRoom', (roomId) => {
		const room = io.sockets.adapter.rooms.get(roomId);
		if (!room || room.size < 5) {
			socket.join(roomId);
			console.log(`Welcome to the room ${roomId}`);
			socket.to(roomId).emit('user-joined', socket.id);

			io.to(roomId).emit(
				'messageForChat',
				`${socket.id} joined the room ${roomId}`
			);
		} else {
			console.log(`Room ${roomId} is full`);
			socket.emit(
				'roomFull',
				`The room you tried to join ${roomId} is already full.`
			);
		}
	});
	socket.on('userMessage', ({roomId, text}) => {
		console.log('entered the usermessage socket');
		console.log(roomId);
		console.log(text);
		io.to(roomId).emit('messageFromUser', text);
	});
	socket.on('offer', data => {
		io.to(data.target).emit('offer', { from: socket.id, offer: data.offer });
	})
	socket.on('answer', data => {
		io.to(data.target).emit('answer', { from: socket.id, answer: data.answer });
	})
	socket.on('iceCandidate', data => {
		io.to(data.target).emit('iceCandidate', { from: socket.id, candidate: data.iceCandidate });
	})
	socket.on('disconnect', () => {
		console.log('A user disconnected');
	});
});

app.post(
	'/api/roomMembers',
	cors({
		origin: 'http://127.0.0.1:5500',
		methods: ['GET', 'POST'],
		credentials: true,
	}),
	(request, response) => {
		const roomId = request.body;
		console.log(roomId);
		const roomMembers = io.sockets.adapter.rooms.get(roomId);
		if (roomMembers) {
			if (roomMembers.size < 5) {
				console.log(roomMembers.size);
				return response
					.status(200)
					.send(roomMembers.size);
			}
			console.log(roomMembers.size);
			return response.status(400).send('Room is Full');
		} else {
			return response.status(404).send('Room does not exist');
		}
	}
);

newServer.listen(PORT, () => {
	console.log(`Server started on port: ${PORT}`);
});
