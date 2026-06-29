require("dotenv").config();
const express = require("express");
const cors = require("cors");
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
    const ordersCollection = db.collection("orders");
    const paymentsCollection = db.collection("payments");
    const wishListCollection = db.collection("wishlist");
    const sessionCollection = db.collection("session");


      // Token related
    const verifyToken = async (req, res, next) => {
      // console.log("Headers", req.headers);
      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      const session = await sessionCollection.findOne({ token: token });
      // console.log("session", session);
      if (!session) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      const userId = session.userId;
      const user = await usersCollection.findOne({ _id: userId });
      // console.log("user of the session", user);
      if (!user) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      req.user = user;
      next();
    };

       const verifyBuyer = async (req, res, next) => {
      if (req.user?.role !== "buyer") {
        return res.status(403).send({ message: "Forbidden" });
      }
      next();
    };
    const verifySeller = async (req, res, next) => {
      if (req.user?.role !== "seller") {
        return res.status(403).send({ message: "Forbidden" });
      }
      next();
    };
    const verifyAdmin = async (req, res, next) => {
      if (req.user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden" });
      }
      next();
    };

    // Products apis
    app.get("/api/products", async (req, res) => {
      try {
        const { category, searchQuery, sort, page, perPage } = req.query;
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

    app.get("/api/products/featured", async (req, res) => {
      try {
        const result = await productsCollection.find({}).limit(6).toArray();

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch featured products" });
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

    app.patch("/api/products/:id", verifySeller, verifyToken, async (req, res) => {
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
    app.delete("/api/products/:id", verifySeller, verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const result = await productsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error("Failed to delete product:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    app.get("/api/products/seller/:sellerId", verifySeller, verifyToken, async (req, res) => {
      const { sellerId } = req.params;

      const result = await productsCollection
        .find({ "sellerInfo.userId": sellerId })
        .toArray();

      res.send(result);
    });

    app.post("/api/products", verifySeller, verifyToken, async (req, res) => {
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

    app.post("/api/products/wishlist", verifyBuyer, verifyToken, async (req, res) => {
      try {
        const wish = req.body;
        const wishWithDate = {
          ...wish,
          createdAt: new Date(),
        };
        const result = await wishListCollection.insertOne(wishWithDate);
        res.send(result);
      } catch (err) {
        console.error("Error inserting product:", err);
        res.status(500).send({ error: "Failed to create product" });
      }
    });
    app.get("/api/products/wishlist/:buyerId", verifyBuyer, verifyToken, async (req, res) => {
      const { buyerId } = req.params;
      console.log(buyerId)
      const result = await wishListCollection.find({ "buyer.id": buyerId }).toArray();
      res.send(result)
    });

    // Order apis
    app.post("/api/orders", verifyBuyer, verifyToken, async (req, res) => {
      try {
        const orderInfo = req.body;
        const orderInfoWithDate = {
          ...orderInfo,
          createdAt: new Date(),
        };
        const result = await ordersCollection.insertOne(orderInfoWithDate);
        res.send(result);
      } catch (err) {
        console.error("Error making order:", err);
        res.status(500).send({ error: "Failed to create order" });
      }
    });

    app.get("/api/orders/buyer/:buyerId", verifyBuyer, verifyToken, async (req, res) => {
      const { buyerId } = req.params;

      const result = await ordersCollection
        .find({ "buyerInfo.userId": buyerId })
        .toArray();
      res.send(result);
    });

    app.delete("/api/orders/:id", verifyBuyer, verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        // console.log(id)
        const result = await ordersCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error("Failed to delete order:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    //Payments apis
    app.post("/api/transactions", verifyBuyer, verifyToken, async (req, res) => {
      const transactionInfo = req.body;
      // console.log(transactionInfo)
      try {
        const result = await paymentsCollection.insertOne(transactionInfo);
        res.send(result);
      } catch (err) {
        console.error("Error inserting paymentInfo:", err);
        res.status(500).send({ error: "Failed to create payment" });
      }
    });
    app.get("/api/transactions", verifyBuyer, verifyToken, async (req, res) => {
      const { buyerId } = req.query;
      try {
        const result = await paymentsCollection.find({ buyerId }).toArray();
        console.log("result:", result);
        res.send(result);
      } catch (err) {
        console.error("Error getting paymentInfo:", err);
        res.status(500).send({ error: "Failed to get payments" });
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
