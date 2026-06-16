const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "ratelens-gateway",
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();

async function connectKafka() {
  await producer.connect();
  console.log("Kafka producer connected");
}

async function emitUsageEvent(event) {
  await producer.send({
    topic: process.env.KAFKA_TOPIC_USAGE,
    messages: [{ value: JSON.stringify(event) }],
  });
}

module.exports = { connectKafka, emitUsageEvent };
