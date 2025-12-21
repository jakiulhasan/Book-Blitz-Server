const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@cluster0.8gmleuq.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    const db = client.db("BookBlitz");
    const bannerCollection = db.collection("bannerCollection");
    const usersCollection = db.collection("users");
    const booksCollection = db.collection("books");

    // users API
    app.get("/banner-slider", async (req, res) => {
      try {
        const result = await bannerCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Failed", error);
        res.status(500).send({ message: "Failed" });
      }
    });

    app.post("/add-user", async (req, res) => {
      try {
        const userData = req.body;
        const email = userData.email;
        const query = { email };

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const isExits = await usersCollection.findOne(query);

        if (isExits) {
          return res.status(409).send({ message: "user already exists" });
        }

        const result = await usersCollection.insertOne(userData);
        res.send(result);
      } catch (error) {
        console.error("Failed to add user:", error);
        res.status(500).send({ message: "Failed to add user" });
      }
    });

    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email };
        const user = await usersCollection.findOne(query);
        res.send({ role: user?.role || "user" });
      } catch (error) {
        console.error("Failed to get user role:", error);
        res.status(500).send({ message: "Failed to get user role" });
      }
    });

    app.get("/books/:id", async (req, res) => {
      try {
        const isbn = req.params.id;
        const query = { isbn };
        const book = await booksCollection.findOne(query);
        if (!book) {
          return res.status(404).send({ message: "Book not found" });
        }
        res.send(book);
      } catch (error) {
        console.error("Failed to get book details:", error);
        res.status(500).send({ message: "Failed to get book details" });
      }
    });

    app.get("/books", async (req, res) => {
      try {
        const { latest, limit, skip, maxPrice, categories, sort } = req.query; // Added sort

        let query = {};
        let sortOptions = {};

        // 1. Handle Sorting
        if (sort) {
          const [field, order] = sort.split(":");
          sortOptions[field] = order === "asc" ? 1 : -1;
        }

        // 2. Handle Price Filter
        if (maxPrice) {
          query.price = { $lte: parseFloat(maxPrice) };
        }

        // 3. Handle Categories Filter (Fix is here)
        if (categories) {
          const catArray = categories.split(",");
          // This matches if ANY of the book's categories are in the selected list
          query.categories = { $in: catArray };
        }

        const finalLimit = parseInt(limit) || 12;
        const finalSkip = parseInt(skip) || 0;

        const books = await booksCollection
          .find(query)
          .sort(sortOptions) // Apply the sort here
          .skip(finalSkip)
          .limit(finalLimit)
          .toArray();

        const totalBooks = await booksCollection.countDocuments(query);

        res.send({
          books: books,
          nextSkip:
            finalSkip + books.length < totalBooks
              ? finalSkip + books.length
              : null,
        });
      } catch (error) {
        console.error("Failed to get books details:", error);
        res.status(500).send({ message: "Failed to get books details" });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
