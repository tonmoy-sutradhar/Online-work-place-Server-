const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
var jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

// Middleware
const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
  optionalSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Mongodb Connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjt8m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Verify Token
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorize Access." });
  jwt.verify(token, process.env.SECRETE_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorize Access." });
    }

    // ekhane user ta new create , age theke chilo na
    req.user = decoded;
  });
  // console.log(token);

  next();
};

async function run() {
  try {
    await client.connect();

    // <<---------------------------------------------------------------------------------------------------------------->>

    const jobsCollection = client.db("Online-Market").collection("jobs");
    const bidsCollection = client.db("Online-Market").collection("bids");

    // Json web token(JWT) Apply -->>
    app.post("/jwt", async (req, res) => {
      const email = req.body;

      // create token
      const token = jwt.sign(email, process.env.SECRETE_KEY, {
        expiresIn: "5h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .status(200)
        .send({ success: true });
      console.log(token);
    });

    // Logout || clear cookie form browser
    app.get("/logout", async (req, res) => {
      res.clearCookie("token", {
        maxAge: 0,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      });
    });

    // Jobs related Data----------->>

    // 2. Get (all) jobs from DB
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

    // Find all jobs by category wise in Search page --->
    app.get("/all-jobs", async (req, res) => {
      const filter = req.query.filter || "";
      const search = req.query.search || "";
      const sort = req.query.sort || "";
      let options = {};
      if (sort) options = { sort: { deadline: sort === "asc" ? 1 : -1 } };
      let query = {
        job_title: {
          $regex: search,
          $options: "i",
        },
      };
      if (filter) query.category = filter;
      const result = await jobsCollection.find(query, options).toArray();
      res.send(result);
    });

    // Help to chatGPT
    // app.get("/all-jobs", async (req, res) => {
    //   const filter = req.query.filter || "";
    //   const search = req.query.search || "";

    //   let query = {};

    //   if (search) {
    //     query.job_title = {
    //       $regex: search,
    //       $options: "i",
    //     };
    //   }

    //   if (filter) {
    //     query.category = filter;
    //   }

    //   try {
    //     const result = await jobsCollection.find(query).toArray();
    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching jobs:", error);
    //     res
    //       .status(500)
    //       .send({ error: "An error occurred while fetching jobs." });
    //   }
    // });

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

    // Get all dibs for specific user data form DB
    app.get("/bids/:email", async (req, res) => {
      const decodeEmail = req.user?.email;
      const email = req.params.email;
      const query = { email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);

      // if (decodeEmail !== email) {
      //   return res.status(401).send({ message: "Unauthorize Access." });
      // }
      // console.log(decodeEmail);
      // console.log(email);
    });

    // {
    //   const isBuyer = req.query.buyer;
    //   const email = req.params.email;
    //   let query = {};
    //   if (isBuyer) {
    //     query.buyer = email;
    //   } else {
    //     query.email = email;
    //   }
    //   const result = await bidsCollection.find(query).toArray();
    //   res.send(result);
    // }

    // Get all dibs Request for specific user data form DB
    app.get("/bid-request/:email", async (req, res) => {
      const email = req.params.email;
      const query = { buyer: email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // Update Bid status
    app.patch("/bid-status-update/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: {
          status,
        },
      };
      const result = await bidsCollection.updateOne(filter, update);
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
