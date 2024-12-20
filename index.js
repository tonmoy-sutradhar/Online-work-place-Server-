const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Mongodb Connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjt8m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // <<---------------------------------------------------------------------------------------------------------------->>

    const jobsCollection = client.db("Online-Market").collection("jobs");
    const bidsCollection = client.db("Online-Market").collection("bids");

    // All Jobs related Data----------->>

    // 2. Get all jobs from DB
    app.get("/jobs", async (req, res) => {
      const cursor = await jobsCollection.find().toArray();
      res.send(cursor);
    });

    // 3. get all jobs posted by a specific user
    app.get("/jobs/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // 5. Get a single job for update
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // 1. Add a job (POST)
    app.post("/add-job", async (req, res) => {
      const jobData = req.body;
      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    });

    // 6. Update a job (PUT)
    app.put("/update-job/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const jobData = req.body;
      const UpdateJob = {
        $set: jobData,
      };
      const options = { upsert: true };
      const result = await jobsCollection.updateOne(filter, UpdateJob, options);
      res.send(result);
    });

    // 4. Delete a job form Database
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    // All Bids related Data ----------------------->>

    // 1. Add a Bids data in DB (POST)
    app.post("/add-bid", async (req, res) => {
      const bidData = req.body;

      // if a user placed a bid already in this job
      const query = { email: bidData.email, jobId: bidData.jobId };
      const alreadyExist = await bidsCollection.findOne(query);
      if (alreadyExist) {
        return res
          .status(400)
          .send("You have already placed a bid on this job");
      }
      console.log("Already exist --> ", alreadyExist);
      const result = await bidsCollection.insertOne(bidData);

      // Increase bid count in jobs Collection
      const filter = { _id: new ObjectId(bidData.jobId) };
      const update = {
        $inc: { bid_count: 1 },
      };
      const updateBidCount = await jobsCollection.updateOne(filter, update);

      res.send(result);
    });

    // <<---------------------------------------------------MongoDB_Connection-------------------------------------------------------->>

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job website is Running");
});
app.listen(port, () => {
  console.log("Port is running on port", port);
});
