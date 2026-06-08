const { EventEmitter } = require('events');

// Bus de eventos en memoria para notificar a clientes SSE conectados
// cuando se crea un nuevo lead. setMaxListeners alto porque cada
// conexión SSE de un admin/editor agrega un listener.
const leadEvents = new EventEmitter();
leadEvents.setMaxListeners(100);

module.exports = leadEvents;
