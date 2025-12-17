const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
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
