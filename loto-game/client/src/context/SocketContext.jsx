import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Connect to backend:
        // 1. Use VITE_SOCKET_URL if provided
        // 2. Use window.location.origin for unified deployment (same port)
        // 3. Fallback to localhost:3001 for development
        const socketUrl = import.meta.env.VITE_SOCKET_URL ||
            (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

        const s = io(socketUrl);
        setSocket(s);

        return () => s.disconnect();
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
