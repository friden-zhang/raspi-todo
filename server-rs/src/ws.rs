/**
 * WebSocket Implementation for Real-time Updates
 *
 * This module handles WebSocket connections for real-time communication.
 * Think of it as a publish-subscribe system where:
 * - Server can broadcast updates to all connected clients
 * - Clients receive updates instantly without polling
 *
 * Architecture Pattern: Observer/Publisher-Subscriber
 * Similar to Qt signals/slots or event-driven systems in C++
 */
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade}, // WebSocket types
    response::Response,                                  // HTTP response type
};
use futures::{SinkExt, StreamExt}; // Async stream handling
use std::sync::Arc; // Atomic reference counting
use tokio::sync::broadcast; // Multi-producer, multi-consumer channel

/**
 * WebSocket Hub - Central message broadcaster
 *
 * This is the core of the real-time system. It maintains a broadcast channel
 * that can send messages to all connected WebSocket clients simultaneously.
 *
 * Pattern: Mediator - coordinates communication between multiple clients
 * Similar to a message broker or event bus in distributed systems
 */
#[derive(Clone)]
pub struct WsHub {
    pub tx: broadcast::Sender<String>, // Broadcaster for sending messages to all clients
}

impl WsHub {
    /**
     * Create a new WebSocket hub
     *
     * Creates a broadcast channel with buffer capacity of 256 messages.
     * The receiver (_rx) is dropped immediately - clients will create their own.
     *
     * Pattern: Factory method
     */
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(256); // Create broadcast channel
        Self { tx }
    }
}

/**
 * Main WebSocket handler entry point
 *
 * This function is called when a client wants to upgrade from HTTP to WebSocket.
 * It performs the protocol upgrade and delegates to the socket handler.
 *
 * Parameters:
 * - ws: WebSocket upgrade request
 * - hub: Shared message broadcaster (wrapped in Arc for thread safety)
 *
 * Pattern: Adapter - converts HTTP upgrade request to WebSocket connection
 */
pub async fn ws_handler(ws: WebSocketUpgrade, hub: Arc<WsHub>) -> Response {
    // Upgrade the HTTP connection to WebSocket protocol
    // This is like accepting a TCP connection in C++ socket programming
    ws.on_upgrade(move |sock| handle_socket(sock, hub))
}

/**
 * Handle individual WebSocket connection
 *
 * This function manages the lifetime of a single WebSocket connection.
 * It splits the socket into sender/receiver halves and creates two concurrent tasks:
 * 1. Send task: Forwards broadcast messages to this client
 * 2. Receive task: Handles incoming messages from this client
 *
 * Pattern: Actor model - each connection is an independent actor
 * Similar to having separate threads for reading/writing in C++
 */
async fn handle_socket(socket: WebSocket, hub: Arc<WsHub>) {
    // Split WebSocket into independent send/receive halves
    // This allows concurrent reading and writing (like full-duplex communication)
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to broadcast channel to receive messages for all clients
    let mut rx = hub.tx.subscribe();

    // Task 1: Forward broadcast messages to this specific client
    // This runs concurrently and sends any broadcast message to the client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            // Wait for broadcast message
            // Send message to client; if it fails, client disconnected
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break; // Client disconnected, exit the loop
            }
        }
    });

    // Task 2: Handle incoming messages from this client
    // Currently just consumes messages (echo server would send them back)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(_msg)) = receiver.next().await { // Wait for client message
            // TODO: Handle incoming messages if needed
            // This is where you'd implement client-to-server communication
            // For example: client sending new todos, status updates, etc.
        }
    });

    // Wait for either task to complete (usually means client disconnected)
    // This is like pthread_join in C++ - wait for threads to finish
    tokio::select! {
        _ = send_task => { }  // Send task completed (client disconnected)
        _ = recv_task => { }  // Receive task completed (client disconnected)
    }
    // When we reach here, the WebSocket connection is closed and cleaned up
}
