const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());



const serviceAccount = require("./firebase-service-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.xyujo4m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('employeeManagement');
        const peoplesCollection = db.collection('peoples');
        const worksCollection = db.collection('works');
        const paymentsCollection = db.collection('payments');

        // custom middlewares
        const verifyFBToken = async (req, res, next) => {
            const authHeaders = req.headers.authorization;
            if (!authHeaders) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = authHeaders.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }

            // verify the token
            try {
                const decoded = await admin.auth().verifyIdToken(token);
                req.decoded = decoded;
                next();
            }
            catch (error) {
                return res.status(403).send({ message: 'forbidden access' })
            }
        };


        // GET employees by role
        app.get("/peoples", verifyFBToken, async (req, res) => {
            try {
                const query = { role: "employee" }; // Always filter to only 'employee' role
                const employees = await peoplesCollection.find(query).toArray();
                res.send(employees);
            } catch (error) {
                console.error("Error fetching employees:", error);
                res.status(500).send({ message: "Failed to fetch employees" });
            }
        });

        // to check role
        app.get('/peoples/role/:email', verifyFBToken, async (req, res) => {
            try {
                const email = req.params.email;
                const user = await peoplesCollection.findOne({ email });

                if (!user) return res.send({ role: null });
                res.send({ role: user.role });
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch role" });
            }
        });

        // to get specific data
        app.get("/peoples/:id", verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const result = await peoplesCollection.findOne(
                { _id: new ObjectId(id) }
            );
            res.send(result);
        });

        // PATCH toggle verification
        app.patch("/peoples/:id", async (req, res) => {
            const id = req.params.id;

            try {
                const user = await peoplesCollection.findOne({ _id: new ObjectId(id) });

                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }

                const result = await peoplesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { isVerified: !user.isVerified } }
                );

                res.send(result);
            } catch (err) {
                console.error("Error toggling verify:", err);
                res.status(500).send({ message: "Internal server error" });
            }
        });


        // registered User post data 
        app.post('/peoples', verifyFBToken, async (req, res) => {
            const email = req.body.email;
            const userExists = await peoplesCollection.findOne({ email })
            if (userExists) {
                // update last log in
                return res.status(200).send({ message: 'User already exists', inserted: false });
            }
            const user = req.body;
            const result = await peoplesCollection.insertOne(user);
            res.send(result);
        });



        // to see work entry
        app.get('/works', verifyFBToken, async (req, res) => {
            try {
                const email = req.query.email;
                const query = email ? { email } : {};
                const works = await worksCollection.find(query).sort({ date: -1 }).toArray();
                res.send(works);
            } catch (err) {
                res.status(500).send({ error: 'Failed to fetch works' });
            }
        });


        //  POST a new work entry
        app.post('/works', async (req, res) => {
            try {
                const work = req.body;
                work.createdAt = new Date();
                const result = await worksCollection.insertOne(work);
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: 'Failed to add work' });
            }
        });

        // to get specific work info by id
        app.get('/works/:id', verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const query = await worksCollection.findOne({ _id: new ObjectId(id) });
            res.send(query);
        });

        // ✅ PATCH to update a work item
        app.patch('/works/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const update = req.body;
                const result = await worksCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: update }
                );
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: 'Failed to update work' });
            }
        });

        // ✅ DELETE a work item
        app.delete('/works/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await worksCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: 'Failed to delete work' });
            }
        });

        // POST create payment
        app.post("/payments", verifyFBToken, async (req, res) => {
            const payment = req.body;
            payment.createdAt = new Date();
            const result = await paymentsCollection.insertOne(payment);
            res.send(result);
        });




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("TrackForce server is running ✅");
});


app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});