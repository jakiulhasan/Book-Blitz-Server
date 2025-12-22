const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// This is your test secret API key.
const stripe = require("stripe")(process.env.Stripe_api_key);

app.listen(4242, () => console.log("Running on port 4242"));

app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

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
    const ordersCollection = db.collection("orders");
    const paymentCollection = db.collection("payment");

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

    app.get("/orders", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }
        const query = { email: email };
        const orders = await ordersCollection.find(query).toArray();
        res.send(orders);
      } catch (error) {
        console.error("Failed to get orders:", error);
        res.status(500).send({ message: "Failed to get orders" });
      }
    });

    app.post("/orders", async (req, res) => {
      try {
        const orderData = req.body;
        const result = await ordersCollection.insertOne(orderData);
        res.send(result);
      } catch (error) {
        console.error("Failed to place order:", error);
        res.status(500).send({ message: "Failed to place order" });
      }
    });

    app.patch("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;
        if (!id || id.length !== 24) {
          return res.status(400).send({ message: "Invalid Order ID format" });
        }
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: status },
        };
        const result = await ordersCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Failed to update order status:", error);
        res.status(500).send({ message: "Internal Server Error" });
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

    // payment related apis
    app.post("/payment-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: `Please pay for: ${paymentInfo.parcelName}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          parcelId: paymentInfo.parcelId,
          parcelName: paymentInfo.parcelName,
        },
        customer_email: paymentInfo.senderEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    // app.patch("/payment-success", async (req, res) => {
    //   const sessionId = req.query.session_id;
    //   const session = await stripe.checkout.sessions.retrieve(sessionId);

    //   const query = { paymentID: session.payment_intent };

    //   const result = paymentCollection.findOne(query);
    //   console.log(result);
    //   if (result) {
    //     res.send({ message: "Payment already recorded" });
    //   }

    //   const paymentRecord = {
    //     paymentID: session.payment_intent,
    //     amount_total: session.amount_total / 100,
    //     date: new Date(),
    //   };

    //   await paymentCollection.insertOne(paymentRecord);

    //   if (session.payment_status === "paid") {
    //     const id = session.metadata.parcelId;
    //     const query = { _id: new ObjectId(id) };
    //     const update = {
    //       $set: {
    //         status: "paid",
    //       },
    //     };

    //     const result = await ordersCollection.updateOne(query, update);
    //     return res.send(result);
    //   }
    //   return res.send({ success: false });
    // });

    app.patch("/payment-success", async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        if (!sessionId) {
          return res.status(400).send({ message: "Session ID is required" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const query = { paymentID: session.payment_intent };
        const existingPayment = await paymentCollection.findOne(query);

        if (existingPayment) {
          return res.send({
            message: "Payment already recorded",
            success: true,
          });
        }

        if (session.payment_status === "paid") {
          const paymentRecord = {
            paymentID: session.payment_intent,
            title: session.metadata.parcelName,
            amount_total: session.amount_total / 100,
            currency: session.currency,
            customer_email: session.customer_details?.email,
            date: new Date(),
          };

          await paymentCollection.insertOne(paymentRecord);

          const parcelId = session.metadata.parcelId;
          const orderQuery = { _id: new ObjectId(parcelId) };
          const updateDoc = {
            $set: { status: "paid" },
          };

          const updateResult = await ordersCollection.updateOne(
            orderQuery,
            updateDoc
          );

          return res.send(updateResult);
        } else {
          return res
            .status(400)
            .send({ success: false, message: "Payment not verified" });
        }
      } catch (error) {
        console.error("Error processing payment success:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal Server Error" });
      }
    });

    app.get("/invoices", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const query = { customer_email: email };

        const result = await paymentCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        console.error("Invoices error:", error);
        res.status(500).send({ message: "Failed to fetch invoices" });
      }
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    app.post("/librarian/books", async (req, res) => {
      try {
        const bookData = req.body;
        const result = await booksCollection.insertOne(bookData);
        res.send(result);
      } catch (error) {
        console.error("Failed to add book:", error);
        res.status(500).send({ message: "Failed to add book" });
      }
    });
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
