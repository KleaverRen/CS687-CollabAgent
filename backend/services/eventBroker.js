const EventEmitter = require('events');

class EventBroker extends EventEmitter {
  constructor() {
    super();
    this.history = [];
    this.maxHistorySize = 100;
  }

  /**
   * Publishes an event to the queue asynchronously to simulate an external broker.
   * @param {string} topic The channel/topic name.
   * @param {object} payload The event payload containing metadata and data.
   */
  publish(topic, payload) {
    const event = {
      event_id: `evt_${Math.random().toString(36).substring(2, 11)}`,
      topic,
      timestamp: new Date().toISOString(),
      payload,
    };
    const historyEvent = {
      ...event,
      payload: this.sanitizeHistoryPayload(topic, payload),
    };

    // Store in history for real-time monitoring
    this.history.push(historyEvent);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    console.log(`[EventBroker] ✉️  Published to [${topic}] - ID: ${event.event_id}`);

    // Asynchronously dispatch event to simulate network/queue latency (e.g., 200ms)
    setTimeout(() => {
      this.emit(topic, event);
      // Also emit a general event for live system monitoring
      this.emit('*', event);
    }, 200);

    return event.event_id;
  }

  sanitizeHistoryPayload(topic, payload) {
    if (!payload || typeof payload !== 'object') return payload;

    if (topic === 'document.created' && Object.prototype.hasOwnProperty.call(payload, 'content')) {
      const { content, ...rest } = payload;
      return {
        ...rest,
        contentLength: String(content || '').length,
      };
    }

    return payload;
  }

  /**
   * Subscribes a listener to a specific topic.
   * @param {string} topic The topic to subscribe to.
   * @param {string} consumerName The name of the consumer service (for logging).
   * @param {function} handler Callback when an event is received.
   */
  subscribe(topic, consumerName, handler) {
    console.log(`[EventBroker] 🔄  Consumer [${consumerName}] registered for topic [${topic}]`);
    this.on(topic, async (event) => {
      try {
        console.log(`[EventBroker] 📥  Consumer [${consumerName}] processing event: ${event.event_id} from [${topic}]`);
        await handler(event.payload, event);
      } catch (err) {
        console.error(`[EventBroker] ❌  Consumer [${consumerName}] failed to process event ${event.event_id}:`, err);
        // In a real-world system, we would publish to a Dead Letter Queue (DLQ) here
        this.publish(`${topic}.dlq`, { originalEvent: event, error: err.message });
      }
    });
  }

  /**
   * Gets the recent event history for debugging/monitoring.
   */
  getHistory() {
    return this.history;
  }
}

// Create a single shared instance for the application
const brokerInstance = new EventBroker();

module.exports = brokerInstance;
