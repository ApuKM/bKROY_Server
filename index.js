const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
        const { category, searchQuery, sort, page, perPage } = req.query;
        // console.log(sort,category)
        let query = {};
        if (category && category !== "All") {
          query.category = category;
        }
        if (searchQuery) {
          query.title = { $regex: searchQuery, $options: "i" };
        }
        const sortMap = {
          latest: { createdAt: -1 },
          price_asc: { price: 1 },
          price_desc: { price: -1 },
        };
        const sortOrder = sortMap[sort] || sortMap.latest;

        const currentPage = Math.max(1, parseInt(page) || 1);
        const limit = Math.max(1, parseInt(perPage) || 12);
        const skip = (currentPage - 1) * limit;

        // Run both queries in parallel for better performance
        const [total, products] = await Promise.all([
          productsCollection.countDocuments(query),
          productsCollection
            .find(query)
            .skip(skip)
            .limit(limit)
            .sort(sortOrder)
            .toArray(),
        ]);

        res.send({ total, products });
      } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).send({ error: "Failed to fetch products" });
      }
    });

    app.get("/api/products/:id", async (req, res) => {
      const { id } = req.params;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    app.patch("/api/products/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedProduct = req.body;
        // console.log(updatedProduct)
        const filter = { _id: new ObjectId(id) };

        const updatedDoc = {
          $set: {
            ...updatedProduct, 
            updatedAt: new Date(), 
          },
        };

        const result = await productsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error("Failed to update product:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    app.get("/api/products/seller/:sellerId", async (req, res) => {
      const { sellerId } = req.params;

      const result = await productsCollection
        .find({ "sellerInfo.userId": sellerId })
        .toArray();

      res.send(result);
    });

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
