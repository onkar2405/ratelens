require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

// Simulated API endpoints — just return mock responses
app.get("/api/users", (req, res) => {
  res.json({ data: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] });
});

app.get("/api/products", (req, res) => {
  // Simulate occasional slow response
  const delay = Math.random() > 0.9 ? 300 : 10;
  setTimeout(() => {
    res.json({ data: [{ id: 1, name: "Widget" }, { id: 2, name: "Gadget" }] });
  }, delay);
});

app.post("/api/orders", (req, res) => {
  res.status(201).json({ order_id: `ord_${Date.now()}`, status: "created" });
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Dummy backend running on port ${port}`));
