const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);
console.log("Stripe key:", process.env.STRIPE_SECRET_KEY);

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
        const reviewsCollection = db.collection("reviews");

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

        // get reviews


        // post reviews to db
        app.post('/reviews', async (req, res) => {
            const data = req.body;
            const result = await reviewsCollection.insertOne(data);
            res.send(result);
        });


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

        // get verified employee's and HR's
        app.get("/peoples/verified", verifyFBToken, async (req, res) => {
            try {
                const verifiedUsers = await peoplesCollection
                    .find({
                        isVerified: true,
                        role: { $ne: "admin" }, // Exclude admin
                    })
                    .toArray();

                res.send(verifiedUsers);
            } catch (error) {
                console.error("Error fetching verified employees:", error);
                res.status(500).send({ message: "Internal Server Error" });
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

        // GET /peoples/:id — Return employee info and salary history
        app.get("/peoples/:id", async (req, res) => {
            const employeeId = req.params.id;

            // Get employee info
            const employee = await peoplesCollection.findOne({ _id: new ObjectId(employeeId) });

            if (!employee) return res.status(404).send({ message: "Employee not found" });

            // Get all salary payments for this employee
            const payments = await paymentsCollection
                .find({ employeeId }) // employeeId stored as string
                .sort({ year: 1, month: 1 })
                .toArray();

            res.send({ ...employee, salaryHistory: payments });
        });

        // PATCH toggle verification
        app.patch("/peoples/:id", verifyFBToken, async (req, res) => {
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

        // patch specific employee's fire's status
        app.patch("/peoples/fire/:id", verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const result = await peoplesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { isFired: true } }
            );
            res.send(result);
        });

        // to promote employee's
        app.patch("/peoples/promote/:id", verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const result = await peoplesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { role: "hr" } }
            );
            res.send(result);
        });

        // to increase salary
        app.patch("/peoples/salary/:id", verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const { salary } = req.body;

            try {
                const user = await peoplesCollection.findOne({ _id: new ObjectId(id) });

                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }

                if (typeof salary !== "number" || salary <= user.salary) {
                    return res.status(400).send({
                        message: "New salary must be greater than the current salary",
                    });
                }

                const result = await peoplesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { salary } }
                );

                res.send(result);
            } catch (err) {
                console.error("Failed to update salary:", err);
                res.status(500).send({ message: "Server Error" });
            }
        });

        // registered User post data 
        app.post('/peoples', async (req, res) => {
            const email = req.body.email;
            const userExists = await peoplesCollection.findOne({ email })
            if (userExists) {
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
        app.post('/works', verifyFBToken, async (req, res) => {
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
        app.delete('/works/:id', verifyFBToken, async (req, res) => {
            try {
                const id = req.params.id;
                const result = await worksCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: 'Failed to delete work' });
            }
        });

        // get all the payment data
        app.get("/payment-requests", verifyFBToken, async (req, res) => {
            const result = await paymentsCollection.find().toArray();
            res.send(result);
        });

        // get specific employee pending payment data
        app.get('/payment/:id', verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const result = await paymentsCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        });




        // get payment history employee role
        app.get("/payment-history", verifyFBToken, async (req, res) => {
            try {
                const email = req.query.email;

                if (!email) {
                    return res.status(400).send({ message: "Email is required" });
                }

                const filter = { email }; // <-- this filters MongoDB by field 'email'

                const result = await paymentsCollection.find(filter).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch data", error });
            }
        });

        // mark requested as paid
        app.patch("/payment-requests/:id/pay", verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const { transactionId } = req.body;

            const result = await paymentsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: "paid",
                        transactionId,
                        paymentDate: new Date(),
                    },
                }
            );

            res.send(result);
        });

        // POST create payment
        app.post("/payment", verifyFBToken, async (req, res) => {
            const data = req.body;
            const result = await paymentsCollection.insertOne(data);
            res.send(result);
        });


        app.post('/create-payment-intent', async (req, res) => {
            const amountInCents = req.body.amountInCents
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents, // Amount in cents
                    currency: 'usd',
                    payment_method_types: ['card'],
                });

                res.json({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
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