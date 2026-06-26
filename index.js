const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env",
  );
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function startServer() {
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    const productsCollection = db.collection("products");

    // Products apis

    app.get("/api/products", async (req, res) => {
      try {
        const result = await productsCollection.find({}).toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).send({ error: "Failed to fetch products" });
      }
    })

    app.post("/api/products", async (req, res) => {
      try {
        const product = req.body;
        const newProduct = {
          ...product,
          createdAt: new Date(),
        };
        const result = await productsCollection.insertOne(newProduct);
        res.send(result);
      } catch (err) {
        console.error("Error inserting product:", err);
        res.status(500).send({ error: "Failed to create product" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("🍃 Successfully connected to MongoDB!");

    // Start listening only after DB connection is ready
    app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    // process.exit(1);
  }
}

startServer();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
